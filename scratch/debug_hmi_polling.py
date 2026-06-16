# scratch/debug_hmi_polling.py
import time
import sys
import os

# Aggiungi la directory principale al path per caricare i moduli
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datastore import Datastore
from netlinker_client import NetLinkerClient
from syslog_logger import SyslogLogger

class ConsoleSyslogLogger:
    def log(self, message, severity=6, facility=1):
        print(f"SYSLOG [{severity}]: {message}")

def run_debug():
    datastore = Datastore()
    syslog = ConsoleSyslogLogger()
    
    # Inizializziamo le macchine come in main.py
    for i in range(1, 11):
        nav_name = f"Navetta_{i}"
        if i <= 4:
            datastore.initialize_device(nav_name, {"navetta": True})
            
    datastore.initialize_device("Carrello", {"carrello": True})
    datastore.initialize_device("Caricatore", {"caricatore": True})
    datastore.initialize_device("Rulliere", {"rulliere": True})
    
    client = NetLinkerClient(datastore, syslog)
    
    host = "192.168.3.66"
    port = 9000
    
    print(f"DEBUG: Avvio client HMI NetLinker verso {host}:{port}...")
    client.start(host=host, port=port, refresh_rate=0.3)
    
    # Eseguiamo il monitoraggio dello stato per 15 secondi
    for sec in range(10):
        time.sleep(1.0)
        stati = datastore.get_all_states()
        print(f"\n--- SECONDO {sec+1} ---")
        print(f"  GLOBAL NETLINKER STATUS: {'CONNECTED' if datastore.get_netlinker_status() else 'DISCONNECTED'}")
        for macchina, stato in stati.items():
            if macchina.startswith("__"):
                continue
            online = stato.get("__comunicazione_ok__", False)
            print(f"  {macchina}: {'ONLINE' if online else 'OFFLINE'}")
            
    print("\nDEBUG: Fine test. Spegnimento client...")
    client.stop()

if __name__ == "__main__":
    run_debug()
