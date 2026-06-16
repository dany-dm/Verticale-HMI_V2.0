# tcp_server.py
import socket
import threading
import sys
import time

class TCPServer:
    def __init__(self, datastore, netlinker_client, syslog_logger):
        self.datastore = datastore
        self.client = netlinker_client
        self.syslog = syslog_logger
        self.port = 9001 # Porta del server HMI TCP di default (diversa da NetLinker)
        self.host = "0.0.0.0"
        self._server_sock = None
        self._running = False
        self._threads = []
        self.pid = 0

    def start(self, host, port, pid):
        self.host = host
        self.port = port
        self.pid = pid
        self._running = True
        
        try:
            self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_sock.bind((self.host, self.port))
            self._server_sock.listen(10)
            
            t = threading.Thread(target=self._accept_loop, daemon=True)
            t.start()
            self._threads.append(t)
            
            self.syslog.log(f"Server TCP Socket HMI in ascolto su {self.host}:{self.port}", severity=6)
            return True
        except Exception as e:
            self.syslog.log(f"Errore all'avvio del server TCP Socket: {e}", severity=3)
            return False

    def stop(self):
        self._running = False
        if self._server_sock:
            try:
                self._server_sock.close()
            except Exception:
                pass
            self._server_sock = None
            
        # Chiude tutte le connessioni attive
        self.syslog.log("Server TCP Socket HMI arrestato", severity=6)

    def _accept_loop(self):
        while self._running:
            try:
                client_sock, client_addr = self._server_sock.accept()
                t = threading.Thread(target=self._handle_client, args=(client_sock, client_addr), daemon=True)
                t.start()
            except Exception:
                break

    def _handle_client(self, sock, addr):
        sock.settimeout(5.0) # 5 secondi di inattività timeout
        buffer = ""
        while self._running:
            try:
                data = sock.recv(4096).decode("utf-8")
                if not data:
                    break
                buffer += data
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Elabora i comandi concatenati da ";"
                    comandi = line.split(";")
                    risposte = []
                    for cmd in comandi:
                        cmd = cmd.strip()
                        if cmd:
                            risp = self.elabora_comando(cmd)
                            if risp:
                                risposte.append(risp)
                    
                    if risposte:
                        sock.sendall(("\n".join(risposte) + "\n").encode("utf-8"))
                        
            except socket.timeout:
                break
            except Exception:
                break
        try:
            sock.close()
        except Exception:
            pass

    def elabora_comando(self, comando):
        """
        Elabora i comandi provenienti da TCP Socket o Stdin.
        Implementa lo stesso parser di comandi del protocollo NetLinker.
        """
        parti = comando.strip().split()
        if not parti:
            return ""
        
        cmd_type = parti[0].lower()
        
        if cmd_type == "status":
            if len(parti) == 1:
                # Elenca lo stato di tutte le macchine configurate
                ports = {
                    "socket": self.port,
                    "web": 8080 # default
                }
                metadata = self.datastore.get_server_metadata(self.pid, ports)
                res = [
                    f"web_port: {metadata['configured_ports']['api_port']}",
                    f"socket_port: {metadata['configured_ports']['socket_control_port']}"
                ]
                for nome, stato in self.datastore.get_all_states().items():
                    if nome.startswith("__"):
                        continue
                    status_str = "connected" if stato.get("__comunicazione_ok__", False) else "disconnected"
                    res.append(f"{nome}: {status_str}")
                return "\n".join(res)
            
            else:
                # Status per singola macchina o macchina:template
                target = parti[1]
                macchina = target
                template_id = ""
                if ":" in target:
                    macchina, template_id = target.split(":", 1)
                
                stato = self.datastore.get_device_state(macchina)
                if not stato.get("__comunicazione_ok__", False):
                    return f"{target}: disconnected"
                
                if template_id:
                    attivo = self.datastore.is_template_active(macchina, template_id)
                    return f"{target}: {'connected' if attivo else 'disconnected'}"
                return f"{macchina}: connected"

        elif cmd_type == "read":
            if len(parti) < 3:
                return "Errore: parametri insufficienti per read."
            macchina = parti[1]
            parametro = parti[2]
            
            stato = self.datastore.get_device_state(macchina)
            if not stato.get("__comunicazione_ok__", False):
                return f"{macchina}.{parametro} = 0" # Ritorna 0 o offline
            
            if parametro in stato:
                val = stato[parametro]
                # Rappresenta i booleani come 1 o 0
                if isinstance(val, bool):
                    val = 1 if val else 0
                return f"{macchina}.{parametro} = {val}"
            else:
                return f"{macchina}.{parametro} = not found"

        elif cmd_type == "read_all":
            if len(parti) < 2:
                return "Errore: macchina non specificata."
            macchina = parti[1]
            
            stato = self.datastore.get_device_state(macchina)
            if not stato.get("__comunicazione_ok__", False):
                return f"{macchina}: disconnected or not found"
            
            res = []
            for k, v in stato.items():
                if k.startswith("__"):
                    continue
                if isinstance(v, bool):
                    v = 1 if v else 0
                res.append(f"{macchina}.{k} = {v}")
            return "\n".join(res)

        elif cmd_type == "read_template":
            if len(parti) < 3:
                return "Errore: parametri insufficienti per read_template."
            macchina = parti[1]
            template_id = parti[2]
            
            stato = self.datastore.get_device_state(macchina)
            if not stato.get("__comunicazione_ok__", False):
                return f"{macchina}:{template_id}: disconnected or not found"
            
            # Dal momento che non abbiamo la separazione fine dei parametri per template locale (poiché la nostra cache raccoglie tutto),
            # inoltriamo la richiesta di lettura template direttamente a NetLinker per ottenere solo quei valori.
            # In questo modo siamo fedeli al protocollo.
            risp = self.client.invia_comando(comando)
            return risp

        elif cmd_type == "write":
            if len(parti) < 4:
                return "Errore: parametri insufficienti per write."
            macchina = parti[1]
            parametro = parti[2]
            valore = parti[3]
            
            # Invia la scrittura a NetLinker
            risp = self.client.invia_comando(comando)
            
            # Se la scrittura va a buon fine, forziamo l'aggiornamento locale della variabile per immediatezza
            if "scritto" in risp:
                if valore.lower() in ["1", "true", "-1"]:
                    val_parsed = True
                elif valore.lower() in ["0", "false"]:
                    val_parsed = False
                else:
                    try:
                        val_parsed = float(valore) if "." in valore else int(valore)
                    except ValueError:
                        val_parsed = valore
                self.datastore.update_device_data(macchina, {parametro: val_parsed})
                
            return risp

        elif cmd_type == "connect":
            if len(parti) < 2:
                return "Errore: target non specificato."
            target = parti[1]
            macchina = target
            template_id = ""
            if ":" in target:
                macchina, template_id = target.split(":", 1)
                
            # Attiva il polling per la macchina o il template locale
            if template_id:
                self.datastore.set_template_active(macchina, template_id, True)
            else:
                # Attiva tutti i template della macchina
                templates = self.datastore.get_configured_templates(macchina)
                for tpl in templates.keys():
                    self.datastore.set_template_active(macchina, tpl, True)
            
            # Inoltra a NetLinker
            risp = self.client.invia_comando(comando)
            return risp

        elif cmd_type == "disconnect":
            if len(parti) < 2:
                return "Errore: target non specificato."
            target = parti[1]
            macchina = target
            template_id = ""
            if ":" in target:
                macchina, template_id = target.split(":", 1)
                
            # Disattiva il polling per la macchina o il template locale
            if template_id:
                self.datastore.set_template_active(macchina, template_id, False)
            else:
                # Disattiva tutti i template della macchina
                templates = self.datastore.get_configured_templates(macchina)
                for tpl in templates.keys():
                    self.datastore.set_template_active(macchina, tpl, False)
            
            # Inoltra a NetLinker
            risp = self.client.invia_comando(comando)
            return risp

        elif cmd_type == "poll":
            # Forza polling immediato, inoltra a NetLinker
            risp = self.client.invia_comando(comando)
            return risp

        elif cmd_type in ["reset", "restart"]:
            # Ritorna messaggio di reset. Il main.py intercetterà la chiamata ed effettuerà il reset a caldo
            return "reset completato."

        elif cmd_type in ["shutdown", "exit"]:
            return "shutdown avviato."

        else:
            return f"Errore: comando '{comando}' sconosciuto."
