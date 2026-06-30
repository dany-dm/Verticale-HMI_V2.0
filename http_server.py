# http_server.py
import http.server
import socketserver
import json
import os
import time
import urllib.parse
import sys
import threading

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

class HMIHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    # Rimuove il logging predefinito per non riempire lo standard output dell'HMI
    def log_message(self, format, *args):
        pass

    def address_string(self):
        # Disabilita il lookup DNS inverso per evitare blocchi e timeout
        return self.client_address[0]

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # 1. Endpoint Server-Sent Events (SSE) per aggiornamenti real-time velocissimi
        if path == "/api/events":
            self.handle_sse()
            return

        # 2. Endpoint API Stato Macchine
        elif path == "/api/state":
            self.handle_api_state()
            return

        # 3. Endpoint API per l'invio dei comandi di scrittura
        elif path == "/api/write":
            self.handle_api_write(query_params)
            return

        # 4. Endpoint API Log
        elif path == "/api/logs":
            self.handle_api_logs()
            return

        # 4b. Endpoint API Config
        elif path == "/api/config":
            self.handle_api_config()
            return

        # 5. Servizio File Statici (Web App)
        else:
            self.serve_static_files(path)

    def do_POST(self):
        # Supporta la scrittura anche via POST
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == "/api/write":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            query_params = urllib.parse.parse_qs(post_data)
            self.handle_api_write(query_params)
        else:
            self.send_error(404, "Not Found")

    def handle_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        datastore = self.server.datastore
        client = self.server.client
        refresh_rate = datastore.get_device_state("Navetta_1").get("__refresh__", 0.3)
        if refresh_rate <= 0:
            refresh_rate = 0.3

        last_hash = None

        while self.server.running:
            try:
                # Recupera i dati
                states = datastore.get_all_states()
                # Calcola un hash per verificare se i dati sono cambiati
                # (facoltativo, ma utile per ridurre banda, inviamo comunque ogni refresh per sicurezza)
                json_data = json.dumps(states)
                
                # Invia l'evento
                self.wfile.write(f"data: {json_data}\n\n".encode("utf-8"))
                self.wfile.flush()
                
                # Pausa basata sul refresh_rate configurato
                time.sleep(refresh_rate)
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
                # Il browser ha chiuso la connessione SSE (cambio pagina, chiusura tab)
                break
            except Exception:
                break

    def handle_api_state(self):
        states = self.server.datastore.get_all_states()
        self.send_json_response(states)

    def handle_api_config(self):
        try:
            from config import carica_configurazione
            cfg = carica_configurazione()
            self.send_json_response(cfg)
        except Exception as e:
            self.send_json_response({"error": str(e)}, status=500)

    def handle_api_write(self, params):
        device = params.get("device", [""])[0]
        parameter = params.get("parameter", [""])[0]
        value = params.get("value", [""])[0]

        if not device or not parameter or not value:
            self.send_json_response({"success": False, "error": "Parametri mancanti: device, parameter, value richiesti"}, status=400)
            return

        # 1. Intercetta configurazione di sistema speciale
        if device == "HMI" and parameter == "__config__":
            try:
                config_json = urllib.parse.unquote(value)
                config_data = json.loads(config_json)
                from config import salva_configurazione
                if salva_configurazione(config_data):
                    self.server.datastore.add_log("HMI", "Configurazione salvata con successo. Riavvio moduli in corso...", level="INFO")
                    
                    # Riavvia il client NetLinker con i nuovi parametri
                    refresh_rate = config_data.get("refresh", 0.3)
                    self.server.client.stop()
                    self.server.client.start(config_data.get("polling_ip", "localhost"), config_data.get("polling_port", 9000), refresh_rate)
                    
                    self.send_json_response({"success": True})
                else:
                    self.send_json_response({"success": False, "error": "Impossibile scrivere il file di configurazione"})
            except Exception as e:
                self.send_json_response({"success": False, "error": f"Errore parsing configurazione: {e}"})
            return


        # 3. Comandi standard di scrittura variabili PLC
        cmd = f"write {device} {parameter} {value}"
        self.server.syslog.log(f"Ricevuto comando da HMI Web: {cmd}", severity=5)
        
        # Inoltra al client NetLinker
        risposta = self.server.client.invia_comando(cmd)
        
        if "scritto" in risposta.lower():
            # Aggiunge al log in memoria
            self.server.datastore.add_log("HMI Web", f"Inviato comando: {cmd} - Esito: {risposta.strip()}", level="INFO")
            self.send_json_response({"success": True, "result": risposta.strip()})
        else:
            self.server.datastore.add_log("HMI Web", f"Fallito comando: {cmd} - Risposta: {risposta.strip()}", level="WARNING")
            self.send_json_response({"success": False, "error": risposta.strip()})

    def handle_api_logs(self):
        logs = self.server.datastore.get_logs()
        self.send_json_response(logs)

    def serve_static_files(self, path):
        # Riferimento alla cartella "web" locale
        base_dir = os.path.dirname(os.path.abspath(__file__))
        web_dir = os.path.join(base_dir, "web")
        
        # Pulisce il percorso ed evita directory traversal
        path = path.lstrip("/")
        if not path or path == "index.html":
            file_path = os.path.join(web_dir, "index.html")
        else:
            file_path = os.path.join(web_dir, path)
            
        # Controlla che il file esista ed sia all'interno di web_dir
        file_path = os.path.abspath(file_path)
        if not file_path.startswith(os.path.abspath(web_dir)) or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_error(404, "File Not Found")
            return

        # Riconoscimento Content-Type
        content_type = "text/plain"
        if file_path.endswith(".html"):
            content_type = "text/html"
        elif file_path.endswith(".css"):
            content_type = "text/css"
        elif file_path.endswith(".js"):
            content_type = "application/javascript"
        elif file_path.endswith(".png"):
            content_type = "image/png"
        elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
            content_type = "image/jpeg"
        elif file_path.endswith(".svg"):
            content_type = "image/svg+xml"
        elif file_path.endswith(".ico"):
            content_type = "image/x-icon"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {e}")

    def send_json_response(self, data, status=200):
        try:
            content = json.dumps(data).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"JSON Generation Error: {e}")


class HTTPServerManager:
    def __init__(self, datastore, netlinker_client, syslog_logger):
        self.datastore = datastore
        self.client = netlinker_client
        self.syslog = syslog_logger
        self.port = 8080
        self.host = "0.0.0.0"
        self._server = None
        self._thread = None

    def start(self, host, port):
        self.host = host
        self.port = port
        self.syslog.log(f"Avvio del server HTTP su http://{self.host}:{self.port} ...", severity=6)
        
        try:
            # Creazione del server
            self._server = ThreadedHTTPServer((self.host, self.port), HMIHTTPRequestHandler)
            # Passa i riferimenti ai componenti
            self._server.datastore = self.datastore
            self._server.client = self.client
            self._server.syslog = self.syslog
            self._server.running = True
            
            self._thread = threading.Thread(target=self._run_server, daemon=True)
            self._thread.start()
            self.syslog.log(f"Server HTTP avviato con successo su porta {self.port}", severity=6)
            return True
        except Exception as e:
            self.syslog.log(f"Impossibile avviare il server HTTP: {e}", severity=3)
            return False

    def _run_server(self):
        try:
            self._server.serve_forever()
        except Exception:
            pass

    def stop(self):
        if self._server:
            self._server.running = False
            self._server.shutdown()
            try:
                self._server.server_close()
            except Exception:
                pass
            self._server = None
        self.syslog.log("Server HTTP arrestato", severity=6)
