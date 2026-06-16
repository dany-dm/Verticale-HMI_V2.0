# scratch/debug_netlinker.py
import socket
import time
import sys

def run_debug():
    host = "192.168.3.66"
    port = 9000
    
    print(f"DEBUG: Tentativo di connessione a NetLinker su {host}:{port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3.0)
        s.connect((host, port))
        print("DEBUG: Connesso con successo!")
    except Exception as e:
        print(f"DEBUG: Connessione fallita immediatamente: {e}")
        sys.exit(1)
        
    commands = [
        "read_all Navetta_1",
        "read_all Navetta_2",
        "read_all Navetta_3",
        "read_all Navetta_4",
        "read_all Carrello",
        "read_all Caricatore",
        "read_all Rulliere"
    ]
    
    # Eseguiamo più cicli per vedere se si disconnette o dà errori
    for ciclo in range(1, 5):
        print(f"\n--- CICLO DI POLLING {ciclo} ---")
        for cmd in commands:
            print(f"Invio: '{cmd}'...")
            try:
                s.sendall((cmd + "\n").encode("utf-8"))
                res_bytes = s.recv(16384)
                if not res_bytes:
                    print("--> ERROR: Ricevuti 0 byte! La connessione è stata chiusa dal server.")
                    s.close()
                    return
                print(f"Risposta (primi 100 car.): {res_bytes[:100].decode('utf-8', errors='ignore').strip()}")
            except Exception as e:
                print(f"--> EXCEPTION: {e}")
                try:
                    s.close()
                except:
                    pass
                return
            time.sleep(0.3)
            
    print("\nDEBUG: Tutti i cicli completati senza disconnessione della socket persistente.")
    s.close()

if __name__ == "__main__":
    run_debug()
