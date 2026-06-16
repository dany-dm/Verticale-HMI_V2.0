# mock_netlinker.py
import socket
import threading
import time
import sys

# Stato simulato dei PLC (con nomi conformi a NetLinker, es. Navetta_01)
plc_state = {
    "Navetta_01": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "Stato_X_Homed": 1,
        "Stato_Y_Homed": 1,
        "Stato_Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 1,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Encoder_X": 5000.0,
        "Encoder_Y1": 1200.0,
        "Encoder_Y2": 1200.0,
        "Encoder_Z": 800.0,
        "TabellaLavoro_Index": 1,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "Stato_GoToX": 0,
        "Stato_GoToZ": 0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0
    },
    "Navetta_02": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "Stato_X_Homed": 1,
        "Stato_Y_Homed": 1,
        "Stato_Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Encoder_X": 12000.0,
        "Encoder_Y1": 1200.0,
        "Encoder_Y2": 1200.0,
        "Encoder_Z": 200.0,
        "TabellaLavoro_Index": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 1,
        "Stato_GoToX": 0,
        "Stato_GoToZ": 0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0
    },
    "Navetta_03": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "Stato_X_Homed": 1,
        "Stato_Y_Homed": 1,
        "Stato_Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 1,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Encoder_X": 18000.0,
        "Encoder_Y1": 1200.0,
        "Encoder_Y2": 1200.0,
        "Encoder_Z": 1500.0,
        "TabellaLavoro_Index": 3,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "Stato_GoToX": 0,
        "Stato_GoToZ": 0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0
    },
    "Navetta_04": {
        "Stato_Inverter_OK": 1,
        "Stato_ComunicazioneRulliere": 1,
        "Stato_ComunicazioneCarrello": 1,
        "Stato_X_Homed": 1,
        "Stato_Y_Homed": 1,
        "Stato_Z_Homed": 1,
        "Home_OK": 1,
        "Stato_Pick": 0,
        "Stato_Picked": 0,
        "Stato_Emergenza": 0,
        "Stato_Aria_OK": 1,
        "Encoder_X": 25000.0,
        "Encoder_Y1": 1200.0,
        "Encoder_Y2": 1200.0,
        "Encoder_Z": 3000.0,
        "TabellaLavoro_Index": 0,
        "Stato_EnableDrive": 1,
        "Stato_Automatico": 0,
        "Stato_GoToX": 0,
        "Stato_GoToZ": 0,
        "Stato_MaintenancePosition": 0,
        "CMD_EnableDrive": 0,
        "CMD_Automatico": 0,
        "CMD_MaintenancePosition": 0
        # Campi del template tpl_1781456080355 (on-demand) sono esclusi di default, aggiunti se richiesti
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
        "Navetta_01": 1, "Navetta_02": -1, "Navetta_03": 1, "Navetta_04": -1,
        "Carrello": 1, "Caricatore_Z": 1, "Caricatore_Rot": 1
    }
    
    while simulation_running:
        try:
            # 1. Animazione Navette (movimento asse X)
            for i in range(1, 5):
                name = f"Navetta_0{i}"
                if plc_state[name]["Stato_EnableDrive"] == 1:
                    plc_state[name]["Encoder_X"] += direzioni[name] * 200
                    if plc_state[name]["Encoder_X"] > 26000:
                        direzioni[name] = -1
                    elif plc_state[name]["Encoder_X"] < 1000:
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
    active_templates = {"Navetta_04": {"navetta": True, "tpl_1781456080355": False}}
    
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
                        # Se è Navetta_04, restituisce solo i campi del template attivo
                        for k, v in plc_state[macchina].items():
                            # Se è navetta 4 ed il template non-ciclico è spento, escludiamo ID e Lunghezza
                            if macchina == "Navetta_04" and k in ["ID", "Lunghezza"] and not active_templates["Navetta_04"]["tpl_1781456080355"]:
                                continue
                            res.append(f"{macchina}.{k} = {v}")
                        sock.sendall(("\n".join(res) + "\n").encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n".encode("utf-8"))
                        
                elif cmd == "read_template":
                    macchina = parti[1]
                    tpl = parti[2]
                    if macchina in plc_state:
                        res = []
                        if tpl == "tpl_1781456080355" and macchina == "Navetta_04":
                            # Restituisce solo i campi del template
                            res.append(f"Navetta_04.ID = 17814")
                            res.append(f"Navetta_04.Lunghezza = 2200")
                        else:
                            # Restituisce tutto
                            for k, v in plc_state[macchina].items():
                                res.append(f"{macchina}.{k} = {v}")
                        sock.sendall(("\n".join(res) + "\n").encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n".encode("utf-8"))
                        
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
                            
                        sock.sendall(f"{macchina}.{parametro} scritto: {valore}\n".encode("utf-8"))
                    else:
                        sock.sendall(f"{macchina}: disconnected or not found\n".encode("utf-8"))
                        
                elif cmd == "connect":
                    target = parti[1]
                    if ":" in target:
                        macchina, tpl = target.split(":", 1)
                        if macchina == "Navetta_04" and tpl == "tpl_1781456080355":
                            active_templates["Navetta_04"]["tpl_1781456080355"] = True
                            # Scrive nel datastore simulato
                            plc_state["Navetta_04"]["ID"] = 178145608
                            plc_state["Navetta_04"]["Lunghezza"] = 4500
                        sock.sendall(f"{target} connesso.\n".encode("utf-8"))
                    else:
                        sock.sendall(f"{target} connesso.\n".encode("utf-8"))
                        
                elif cmd == "disconnect":
                    target = parti[1]
                    if ":" in target:
                        macchina, tpl = target.split(":", 1)
                        if macchina == "Navetta_04" and tpl == "tpl_1781456080355":
                            active_templates["Navetta_04"]["tpl_1781456080355"] = False
                            # Rimuove dal datastore simulato
                            if "ID" in plc_state["Navetta_04"]:
                                del plc_state["Navetta_04"]["ID"]
                            if "Lunghezza" in plc_state["Navetta_04"]:
                                del plc_state["Navetta_04"]["Lunghezza"]
                        sock.sendall(f"{target} disconnesso.\n".encode("utf-8"))
                    else:
                        sock.sendall(f"{target} disconnesso.\n".encode("utf-8"))
                        
                elif cmd == "status":
                    res = [
                        "web_port: 8080",
                        "socket_port: 9000",
                        "modbus_port: 502"
                    ]
                    for m in plc_state.keys():
                        res.append(f"{m}: connected")
                    sock.sendall(("\n".join(res) + "\n").encode("utf-8"))
                    
                else:
                    sock.sendall(f"Comando '{cmd}' non supportato dal mock.\n".encode("utf-8"))
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
