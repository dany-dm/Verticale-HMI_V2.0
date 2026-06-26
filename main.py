# main.py
import argparse
import sys
import os
import time
import threading
import json
import socket

from config import carica_configurazione, salva_configurazione
from datastore import Datastore
from syslog_logger import SyslogLogger
from netlinker_client import NetLinkerClient
from tcp_server import TCPServer
from http_server import HTTPServerManager
from launcher_gui import LauncherGUI

# Variabili globali per orchestrare lo spegnimento e il reset a caldo
running = True
datastore = None
syslog = None
client = None
tcp_server = None
http_server = None
launcher = None

def query_status_mode(socket_port):
    """Esegue l'applicazione come messaggero CLI."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.5)
            s.connect(("127.0.0.1", socket_port))
            s.sendall(b"status\n")
            risposta = s.recv(8192).decode("utf-8")
            print(risposta.strip())
            sys.exit(0)
    except Exception as e:
        print(f"Errore connessione al server HMI locale sulla porta {socket_port}: {e}")
        sys.exit(1)

def scrivi_file_stato(pid, status, ports):
    """Scrive periodicamente il file netlinker_status.json."""
    status_path = "netlinker_status.json"
    
    online_devices = []
    if datastore:
        for k, v in datastore.get_all_states().items():
            if v.get("__comunicazione_ok__", False):
                online_devices.append(k)
                
    dati = {
        "pid": pid,
        "status": status,
        "last_update": time.strftime("%Y-%m-%d %H:%M:%S"),
        "configured_ports": {
            "socket_control_port": ports.get("socket", 9001),
            "api_port": ports.get("web", 8080)
        },
        "connected_devices": online_devices
    }
    
    try:
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(dati, f, indent=2)
    except Exception as e:
        if syslog:
            syslog.log(f"Impossibile scrivere netlinker_status.json: {e}", severity=4)

def status_file_loop(pid, ports):
    """Ciclo in background per aggiornare netlinker_status.json ogni 2 secondi."""
    global running
    while running:
        scrivi_file_stato(pid, "running", ports)
        time.sleep(2.0)

def stdin_thread_loop():
    """Ascolta continuamente su sys.stdin per comandi da pipe."""
    global running, tcp_server, datastore
    while running:
        try:
            line = sys.stdin.readline()
            if not line:
                # Pipe chiusa, interrompe il loop
                break
            
            line = line.strip()
            if not line:
                continue
                
            # Splitta per comandi concatenati da ";"
            comandi = line.split(";")
            risposte = []
            for cmd in comandi:
                cmd = cmd.strip()
                if cmd:
                    # Rileva se il comando è speciale (reset o shutdown)
                    cmd_type = cmd.split()[0].lower()
                    if cmd_type in ["reset", "restart"]:
                        esegui_reset_a_caldo()
                        risposte.append("reset completato.")
                    elif cmd_type in ["shutdown", "exit"]:
                        risposte.append("shutdown avviato.")
                        threading.Thread(target=arresto_completo, daemon=True).start()
                    else:
                        # Comando standard
                        risp = tcp_server.elabora_comando(cmd)
                        if risp:
                            risposte.append(risp)
                            
            if risposte:
                sys.stdout.write("\n".join(risposte) + "\n")
                sys.stdout.flush()
                
        except Exception as e:
            if syslog:
                syslog.log(f"Errore nel thread stdin: {e}", severity=3)
            break

def esegui_reset_a_caldo():
    """Ricarica la configurazione e riavvia i moduli a caldo."""
    global datastore, syslog, client
    if syslog:
        syslog.log("Reset a caldo: ricaricamento configurazione config.json...", severity=5)
        
    config = carica_configurazione()
    
    # Aggiorna Syslog Logger
    if syslog:
        syslog.update_config(config.get("syslog_ip", "127.0.0.1"), config.get("syslog_port", 514))
        
    # Riavvia Client NetLinker con i nuovi parametri
    if client:
        client.stop()
        client.start(
            config.get("polling_ip", "localhost"),
            config.get("polling_port", 9000),
            config.get("refresh", 0.3)
        )
        
    # Ri-allinea i dispositivi abilitati nel Datastore
    if datastore:
        # Pulisce gli stati vecchi e ricarica
        for i in range(1, 11):
            nav_name = f"Navetta_{i}"
            nav_cfg = config.get("navette", {}).get(nav_name, {})
            attivo = nav_cfg.get("attivo", False)
            if attivo:
                # Navetta 4 ha template aggiuntivo on-demand
                templates = {"navetta": True}
                if i == 4:
                    templates["tpl_1781456080355"] = False
                datastore.initialize_device(nav_name, templates)
                
        datastore.initialize_device("Carrello", {"carrello": True})
        datastore.initialize_device("Caricatore", {"caricatore": True})
        datastore.initialize_device("Rulliere", {"rulliere": True})
        
        # Aggiunge log del reset
        datastore.add_log("System", "Reset a caldo completato.", level="INFO")
        
    if syslog:
        syslog.log("Reset a caldo completato con successo", severity=5)

def arresto_completo():
    """Arresta tutti i moduli in modo controllato."""
    global running, client, tcp_server, http_server, launcher
    running = False
    
    # Scrive lo stato finale "stopped" prima di chiudere tutto
    pid = os.getpid()
    ports = {
        "socket": tcp_server.port if tcp_server else 9001,
        "web": http_server.port if http_server else 8080
    }
    scrivi_file_stato(pid, "stopped", ports)
    
    if client:
        client.stop()
    if tcp_server:
        tcp_server.stop()
    if http_server:
        http_server.stop()
        
    if launcher and launcher.root:
        try:
            launcher.root.quit()
        except Exception:
            pass
            
    sys.exit(0)

def main():
    global datastore, syslog, client, tcp_server, http_server, launcher, running
    
    # 1. Parsing Argomenti CLI
    parser = argparse.ArgumentParser(description="Verticale HMI v2.0.1 - Interfaccia Controllo Navette")
    parser.add_argument("--port-socket", type=int, default=9001, help="Porta server TCP Socket HMI (default: 9001)")
    parser.add_argument("--port-web", type=int, default=8080, help="Porta server Web HMI/API (default: 8080)")
    parser.add_argument("--no-gui", action="store_true", help="Avvia il server in modalità headless (senza finestra Tkinter)")
    parser.add_argument("--query-status", action="store_true", help="Interroga lo stato del server locale via socket ed esce")
    args = parser.parse_args()

    # 2. Modalità CLI Messenger
    if args.query_status:
        # Se viene richiesta la query status, la inviamo alla porta del socket HMI
        query_status_mode(args.port_socket)
        return

    # 3. Caricamento Configurazione
    config = carica_configurazione()
    
    # Se la porta web in config è diversa, e non è specificata da CLI, la allineiamo
    web_port = args.port_web
    socket_port = args.port_socket

    # 4. Inizializzazione Datastore (Thread-Safe)
    datastore = Datastore()
    
    # Inizializza i dispositivi abilitati
    # Navette
    for i in range(1, 11):
        nav_name = f"Navetta_{i}"
        nav_cfg = config.get("navette", {}).get(nav_name, {})
        if nav_cfg.get("attivo", i <= 4): # Di default 1-4
            templates = {"navetta": True}
            if i == 4:
                templates["tpl_1781456080355"] = False # on-demand
            datastore.initialize_device(nav_name, templates)
            
    # Altre macchine
    datastore.initialize_device("Carrello", {"carrello": True})
    datastore.initialize_device("Caricatore", {"caricatore": True})
    datastore.initialize_device("Rulliere", {"rulliere": True})

    # Salviamo le porte per il SSE/Front-end
    datastore.update_device_data("Navetta_1", {"__refresh__": config.get("refresh", 0.3)})

    # 5. Inizializzazione Logger Syslog
    syslog = SyslogLogger(
        host=config.get("syslog_ip", "127.0.0.1"),
        port=config.get("syslog_port", 514)
    )
    
    # 6. Avvio Client NetLinker (TCP Client verso la porta 9000 di NetLinker)
    client = NetLinkerClient(datastore, syslog)
    client.start(
        host=config.get("polling_ip", "localhost"),
        port=config.get("polling_port", 9000), # NetLinker socket control port
        refresh_rate=config.get("refresh", 0.3)
    )

    # 7. Avvio Server TCP HMI locale (per consentire al programma madre di connettersi)
    pid = os.getpid()
    tcp_server = TCPServer(datastore, client, syslog)
    tcp_server.start("0.0.0.0", socket_port, pid)

    # 8. Avvio Server HTTP/SSE locale per la Web GUI
    http_server = HTTPServerManager(datastore, client, syslog)
    http_server.start("0.0.0.0", web_port)

    # 9. Scrittura periodica file di stato netlinker_status.json
    ports_map = {"socket": socket_port, "web": web_port}
    scrivi_file_stato(pid, "running", ports_map)
    threading.Thread(target=status_file_loop, args=(pid, ports_map), daemon=True).start()

    # 10. Thread di ascolto standard input pipe (Stdin)
    threading.Thread(target=stdin_thread_loop, daemon=True).start()

    # 11. Avvio Interfaccia Grafica Launcher Tkinter o blocco CLI
    if not args.no_gui:
        syslog.log("Avvio del launcher grafico Tkinter...", severity=6)
        launcher = LauncherGUI(web_port, datastore, arresto_completo)
        launcher.start()
    else:
        syslog.log("Avvio in modalità Headless (consolle). Attesa comandi da Stdin/Socket...", severity=6)
        try:
            while running:
                time.sleep(1.0)
        except KeyboardInterrupt:
            syslog.log("Rilevato KeyboardInterrupt, avvio arresto HMI...", severity=5)
            arresto_completo()

if __name__ == "__main__":
    main()
