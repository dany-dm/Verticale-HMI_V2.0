# mock_netlinker.py
import socket
import threading
import time
import sys

# Stato simulato dei PLC (con nomi conformi a NetLinker, es. Navetta_1)
plc_state = {
    "Navetta_1": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "X_Homed": 1,
        "Y_Homed": 1,
        "Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 1,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "X_Encoder": 5000.0,
        "Y1_Encoder": 1200.0,
        "Y2_Encoder": 1200.0,
        "Z_Encoder": 800.0,
        "IndexTabellaLavoro": 1,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "GoToX": 0.0,
        "GoToZ": 0.0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0,
        "Y1_PannelloPreso": 0,
        "Y2_PannelloPreso": 0,
        "Y1_bascula": 0,
        "Y2_bascula": 0,
        "comanda_ID": 1024,
        "comanda_Lunghezza": 2400,
        "comanda_Larghezza": 1200,
        "comanda_Spessore": 18,
        "comanda_From_X": 5000,
        "comanda_From_Y": 800,
        "comanda_From_Z": 200,
        "comanda_To_X": 15000,
        "comanda_To_Y": 1000,
        "comanda_ToZ": 1200
    },
    "Navetta_2": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "X_Homed": 1,
        "Y_Homed": 1,
        "Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "X_Encoder": 12000.0,
        "Y1_Encoder": 1200.0,
        "Y2_Encoder": 1200.0,
        "Z_Encoder": 200.0,
        "IndexTabellaLavoro": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 1,
        "GoToX": 0.0,
        "GoToZ": 0.0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0,
        "Y1_PannelloPreso": 0,
        "Y2_PannelloPreso": 0,
        "Y1_bascula": 0,
        "Y2_bascula": 0,
        "comanda_ID": 0,
        "comanda_Lunghezza": 0,
        "comanda_Larghezza": 0,
        "comanda_Spessore": 0,
        "comanda_From_X": 0,
        "comanda_From_Y": 0,
        "comanda_From_Z": 0,
        "comanda_To_X": 0,
        "comanda_To_Y": 0,
        "comanda_ToZ": 0
    },
    "Navetta_3": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "X_Homed": 1,
        "Y_Homed": 1,
        "Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 1,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "X_Encoder": 18000.0,
        "Y1_Encoder": 1200.0,
        "Y2_Encoder": 1200.0,
        "Z_Encoder": 1500.0,
        "IndexTabellaLavoro": 3,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "GoToX": 0.0,
        "GoToZ": 0.0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0,
        "Y1_PannelloPreso": 0,
        "Y2_PannelloPreso": 0,
        "Y1_bascula": 0,
        "Y2_bascula": 0,
        "comanda_ID": 2048,
        "comanda_Lunghezza": 3000,
        "comanda_Larghezza": 1300,
        "comanda_Spessore": 22,
        "comanda_From_X": 8000,
        "comanda_From_Y": 900,
        "comanda_From_Z": 300,
        "comanda_To_X": 18000,
        "comanda_To_Y": 1200,
        "comanda_ToZ": 1500
    },
    "Navetta_4": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "X_Homed": 1,
        "Y_Homed": 1,
        "Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "X_Encoder": 25000.0,
        "Y1_Encoder": 1200.0,
        "Y2_Encoder": 1200.0,
        "Z_Encoder": 3000.0,
        "IndexTabellaLavoro": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "GoToX": 0.0,
        "GoToZ": 0.0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0,
        "Y1_PannelloPreso": 0,
        "Y2_PannelloPreso": 0,
        "Y1_bascula": 0,
        "Y2_bascula": 0,
        "comanda_ID": 0,
        "comanda_Lunghezza": 0,
        "comanda_Larghezza": 0,
        "comanda_Spessore": 0,
        "comanda_From_X": 0,
        "comanda_From_Y": 0,
        "comanda_From_Z": 0,
        "comanda_To_X": 0,
        "comanda_To_Y": 0,
        "comanda_ToZ": 0
        # Solo campi ciclici
    },
    "Carrello": {
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCaricatore": 1,
        "Stato_ComunicazioneNavette": 1,
        "Y_Homed": 1,
        "Rotazione_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Stato_Inverter_OK": 1,
        "Y_Encoder": 15000.0,
        "Rotazione_Encoder": 0.0,
        "IndexTabellaLavoro": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0
    },
    "Caricatore": {
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "Z_Homed": 1,
        "Rotazione_Homed": 1,
        "Telaio_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Z_Encoder": 100.0,
        "Rotazione_Encoder": 0.0,
        "telaio_Encoder": 0.0,
        "IndexTabellaLavoro": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0
    },
    "Rulliere": {
        "Stato_PannelloSuBiesse": 0,
        "Stato_PannelloSuR1": 1,
        "Stato_PannelloSuR2": 0,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Stato_ComunicazioneCarrello": 1,
        "IndexTabellaLavoro": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0
    }
}

# Variabili per gestire l'oscillazione dei valori e l'animazione degli assi
simulation_running = True

def animazione_loop():
    """Simula l'avanzamento dei motori per mostrare movimento in tempo reale."""
    global plc_state, simulation_running
    direzioni = {
        "Navetta_1": 1, "Navetta_2": -1, "Navetta_3": 1, "Navetta_4": -1,
        "Carrello": 1, "Caricatore_Z": 1, "Caricatore_Rot": 1
    }
    
    while simulation_running:
        try:
            # 1. Animazione Navette (movimento asse X)
            for i in range(1, 5):
                name = f"Navetta_{i}"
                if plc_state[name]["Stato_EnableDrive"] == 1:
                    plc_state[name]["X_Encoder"] += direzioni[name] * 200
                    if plc_state[name]["X_Encoder"] > 26000:
                        direzioni[name] = -1
                    elif plc_state[name]["X_Encoder"] < 1000:
                        direzioni[name] = 1
                        
            # 2. Animazione Carrello (Asse Y)
            if plc_state["Carrello"]["Stato_EnableDrive"] == 1:
                plc_state["Carrello"]["Y_Encoder"] += direzioni["Carrello"] * 150
                if plc_state["Carrello"]["Y_Encoder"] > 27500:
                    direzioni["Carrello"] = -1
                elif plc_state["Carrello"]["Y_Encoder"] < 1000:
                    direzioni["Carrello"] = 1
                    
            # 3. Animazione Caricatore
            if plc_state["Caricatore"]["Stato_EnableDrive"] == 1:
                # Z Encoder
                plc_state["Caricatore"]["Z_Encoder"] += direzioni["Caricatore_Z"] * 25
                if plc_state["Caricatore"]["Z_Encoder"] > 1400:
                    direzioni["Caricatore_Z"] = -1
                elif plc_state["Caricatore"]["Z_Encoder"] < 50:
                    direzioni["Caricatore_Z"] = 1
                
                # Rotazione (gradi da 0 a 180)
                plc_state["Caricatore"]["Rotazione_Encoder"] += direzioni["Caricatore_Rot"] * 2
                if plc_state["Caricatore"]["Rotazione_Encoder"] > 180:
                    direzioni["Caricatore_Rot"] = -1
                elif plc_state["Caricatore"]["Rotazione_Encoder"] < 0:
                    direzioni["Caricatore_Rot"] = 1
                    
            time.sleep(0.1)
        except Exception:
            break

def client_handler(sock):
    sock.settimeout(5.0)
    buffer = ""
    active_templates = {"Navetta_4": {"navetta": True}}
    
    while simulation_running:
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
                
                parti = line.split()
                cmd = parti[0].lower()
                
                if cmd == "read_all":
                    macchina = parti[1]
                    if macchina in plc_state:
                        res = []
                        # Se è Navetta_4, restituisce solo i campi del template attivo
                        for k, v in plc_state[macchina].items():
                            # Restituisce tutto lo stato ciclico
                            res.append(f"{macchina}.{k} = {v}")
                        sock.sendall(("\n".join(res) + "\n\x03").encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n\x03".encode("utf-8"))
                        
                elif cmd == "read_template":
                    macchina = parti[1]
                    tpl = parti[2]
                    if macchina in plc_state:
                        res = []
                        for k, v in plc_state[macchina].items():
                            res.append(f"{macchina}.{k} = {v}")
                        sock.sendall(("\n".join(res) + "\n\x03").encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n\x03".encode("utf-8"))
                        
                elif cmd == "write":
                    macchina = parti[1]
                    parametro = parti[2]
                    valore = parti[3]
                    
                    if macchina in plc_state:
                        # Parsing valore
                        if valore.lower() in ["1", "true", "-1"]:
                            val_parsed = 1
                        elif valore.lower() in ["0", "false"]:
                            val_parsed = 0
                        else:
                            try:
                                val_parsed = float(valore) if "." in valore else int(valore)
                            except ValueError:
                                val_parsed = valore
                                
                        # Aggiorna lo stato
                        plc_state[macchina][parametro] = val_parsed
                        
                        # Aggiorna i relativi stati fittizi Modbus
                        if parametro == "CMD_EnableDrive":
                            plc_state[macchina]["Stato_EnableDrive"] = val_parsed
                        elif parametro == "CMD_Automatico":
                            plc_state[macchina]["Stato_Automatico"] = val_parsed
                        elif parametro == "CMD_MaintenancePosition":
                            plc_state[macchina]["Stato_MaintenancePosition"] = val_parsed
                        elif parametro == "CMD_Home":
                            plc_state[macchina]["Home_OK"] = 1
                            
                        sock.sendall(f"{macchina}.{parametro} scritto: {valore}\n\x03".encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n\x03".encode("utf-8"))
                        
                elif cmd == "connect":
                    target = parti[1]
                    sock.sendall(f"{target} connesso.\n\x03".encode("utf-8"))
                        
                elif cmd == "disconnect":
                    target = parti[1]
                    sock.sendall(f"{target} disconnesso.\n\x03".encode("utf-8"))
                        
                elif cmd == "status":
                    res = [
                        "web_port: 8080",
                        "socket_port: 9000",
                        "modbus_port: 502"
                    ]
                    for m in plc_state.keys():
                        res.append(f"{m}: connected")
                    sock.sendall(("\n".join(res) + "\n\x03").encode("utf-8"))
                    
                else:
                    sock.sendall(f"Comando '{cmd}' non supportato dal mock.\n\x03".encode("utf-8"))
        except Exception:
            break
    sock.close()

def main():
    global simulation_running
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    port = 9000
    try:
        server_sock.bind(("127.0.0.1", port))
        server_sock.listen(5)
        print(f"[MOCK] Mock NetLinker Server in ascolto su 127.0.0.1:{port} ...")
    except Exception as e:
        print(f"[MOCK] Errore bind porta {port}: {e}")
        sys.exit(1)
        
    # Avvia thread animazione
    t_anim = threading.Thread(target=animazione_loop, daemon=True)
    t_anim.start()
    
    try:
        while True:
            sock, addr = server_sock.accept()
            t = threading.Thread(target=client_handler, args=(sock,), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print("\nArresto mock server...")
        simulation_running = False
        server_sock.close()

if __name__ == "__main__":
    main()
