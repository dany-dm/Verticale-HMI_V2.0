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
        "Stato_Y1_PannelloPreso": 0,
        "Stato_Y2_PannelloPreso": 0,
        "Stato_Y1_bascula": 0,
        "Stato_Y2_bascula": 0,
        "X_destinazione": 5000.0,
        "X_Ricalcolata": 5000.0,
        "Z_destinazione": 800.0,
        "Z_Speed": 1500,
        "Z_accelerazione": 2000,
        "Z_Decelerazione": 2000,
        "Stato_Memoria_Op1": 0,
        "Stato_Memoria_Op3": 0,
        "Stato_Op1": 1,
        "Stato_Op2": 0,
        "Stato_Op3": 0,
        "Stato_Op4": 0,
        "Stato_Caso5_PrimaParte": 0,
        "Stato_Y1_Prendi": 0,
        "Stato_Y1_avanti": 0,
        "Stato_Y1_indietro": 1,
        "Stato_Y1_venturi": 0,
        "Stato_Y2_Prendi": 0,
        "Stato_Y2_avanti": 0,
        "Stato_Y2_indietro": 1,
        "Stato_Y2_venturi": 0,
        "Stato_Y_soffia": 0,
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
        "Stato_Y1_PannelloPreso": 0,
        "Stato_Y2_PannelloPreso": 0,
        "Stato_Y1_bascula": 0,
        "Stato_Y2_bascula": 0,
        "X_destinazione": 12000.0,
        "X_Ricalcolata": 12000.0,
        "Z_destinazione": 200.0,
        "Z_Speed": 1200,
        "Z_accelerazione": 1800,
        "Z_Decelerazione": 1800,
        "Stato_Memoria_Op1": 0,
        "Stato_Memoria_Op3": 0,
        "Stato_Op1": 0,
        "Stato_Op2": 0,
        "Stato_Op3": 0,
        "Stato_Op4": 0,
        "Stato_Caso5_PrimaParte": 0,
        "Stato_Y1_Prendi": 0,
        "Stato_Y1_avanti": 0,
        "Stato_Y1_indietro": 1,
        "Stato_Y1_venturi": 0,
        "Stato_Y2_Prendi": 0,
        "Stato_Y2_avanti": 0,
        "Stato_Y2_indietro": 1,
        "Stato_Y2_venturi": 0,
        "Stato_Y_soffia": 0,
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
        "Stato_Y1_PannelloPreso": 0,
        "Stato_Y2_PannelloPreso": 0,
        "Stato_Y1_bascula": 0,
        "Stato_Y2_bascula": 0,
        "X_destinazione": 18000.0,
        "X_Ricalcolata": 18000.0,
        "Z_destinazione": 1500.0,
        "Z_Speed": 1800,
        "Z_accelerazione": 2200,
        "Z_Decelerazione": 2200,
        "Stato_Memoria_Op1": 0,
        "Stato_Memoria_Op3": 0,
        "Stato_Op1": 0,
        "Stato_Op2": 0,
        "Stato_Op3": 1,
        "Stato_Op4": 0,
        "Stato_Caso5_PrimaParte": 0,
        "Stato_Y1_Prendi": 0,
        "Stato_Y1_avanti": 0,
        "Stato_Y1_indietro": 1,
        "Stato_Y1_venturi": 0,
        "Stato_Y2_Prendi": 0,
        "Stato_Y2_avanti": 0,
        "Stato_Y2_indietro": 1,
        "Stato_Y2_venturi": 0,
        "Stato_Y_soffia": 0,
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
        "Stato_Y1_PannelloPreso": 0,
        "Stato_Y2_PannelloPreso": 0,
        "Stato_Y1_bascula": 0,
        "Stato_Y2_bascula": 0,
        "X_destinazione": 25000.0,
        "X_Ricalcolata": 25000.0,
        "Z_destinazione": 3000.0,
        "Z_Speed": 2000,
        "Z_accelerazione": 2500,
        "Z_Decelerazione": 2500,
        "Stato_Memoria_Op1": 0,
        "Stato_Memoria_Op3": 0,
        "Stato_Op1": 0,
        "Stato_Op2": 0,
        "Stato_Op3": 0,
        "Stato_Op4": 0,
        "Stato_Caso5_PrimaParte": 0,
        "Stato_Y1_Prendi": 0,
        "Stato_Y1_avanti": 0,
        "Stato_Y1_indietro": 1,
        "Stato_Y1_venturi": 0,
        "Stato_Y2_Prendi": 0,
        "Stato_Y2_avanti": 0,
        "Stato_Y2_indietro": 1,
        "Stato_Y2_venturi": 0,
        "Stato_Y_soffia": 0,
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
        "CMD_MaintenancePosition": 0,
        "carrello_comanda_ID": 4001,
        "carrello_comanda_Lunghezza": 2100,
        "carrello_comanda_Larghezza": 900,
        "carrello_comanda_Spessore": 20,
        "carrello_comanda_From_X": 10400,
        "carrello_comanda_From_Y": 103,
        "carrello_comanda_From_Z": 10,
        "carrello_comanda_To_X": 10400,
        "carrello_comanda_To_Y": 106,
        "carrello_comanda_ToZ": 200
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
        "CMD_Automatico": 0,
        "caricatore_comanda_ID": 3001,
        "caricatore_comanda_Lunghezza": 2000,
        "caricatore_comanda_Larghezza": 800,
        "caricatore_comanda_Spessore": 19,
        "caricatore_comanda_From_X": 100,
        "caricatore_comanda_From_Y": 200,
        "caricatore_comanda_From_Z": 0,
        "caricatore_comanda_To_X": 500,
        "caricatore_comanda_To_Y": 600,
        "caricatore_comanda_ToZ": 100
    },
    "Rulliere": {
        "Stato_PannelloSuBiesse": 0,
        "Stato_PannelloSuR1": 1,
        "Stato_PannelloSuR2": 0,
        "Stato_R2InPos90": 0,
        "Stato_R2InPos0": 1,
        "Stato_R2Vuota": 1,
        "First": 1,
        "rulliere_comanda_ID": 5001,
        "rulliere_comanda_Lunghezza": 2200,
        "rulliere_comanda_Larghezza": 1000,
        "rulliere_comanda_Spessore": 21,
        "rulliere_comanda_From_X": 700,
        "rulliere_comanda_From_Y": 800,
        "rulliere_comanda_From_Z": 20,
        "rulliere_comanda_To_X": 1500,
        "rulliere_comanda_To_Y": 1600,
        "rulliere_comanda_ToZ": 300,
        
        # Tabella01
        "Tabella01_ID": 1001,
        "Tabella01_Lunghezza": 1200,
        "Tabella01_Larghezza": 800,
        "Tabella01_Spessore": 18,
        "Tabella01_From_X": 500,
        "Tabella01_From_Y": 600,
        "Tabella01_From_Z": 1,
        "Tabella01_To_X": 25000,
        "Tabella01_To_Y": 1200,
        "Tabella01_ToZ": 2,
        "Tabella01_NewDatas": 1,
        "Tabella01_WorkingStampante": 0,
        "Tabella01_DoneStampante": 0,
        "Tabella01_WorkingR2": 0,
        "Tabella01_DoneR2": 0,
        "Tabella01_Working_Navette": 0,
        "Tabella01_Done_Navette": 0,
        "Tabella01_Working_Navetta_2": 0,
        "Tabella01_Done_Navetta_2": 0,
        "Tabella01_Working_Carrello": 0,
        "Tabella01_Done_Carrello": 0,
        "Tabella01_WorkingR1": 0,
        "Tabella01_DoneR1": 0,
        "Tabella01_Working_Caricatore": 0,
        "Tabella01_Done_Caricatore": 0,

        # Tabella02
        "Tabella02_ID": 1002,
        "Tabella02_Lunghezza": 2400,
        "Tabella02_Larghezza": 1200,
        "Tabella02_Spessore": 18,
        "Tabella02_From_X": 1500,
        "Tabella02_From_Y": 800,
        "Tabella02_From_Z": 2,
        "Tabella02_To_X": 12000,
        "Tabella02_To_Y": 900,
        "Tabella02_ToZ": 3,
        "Tabella02_NewDatas": 0,
        "Tabella02_WorkingStampante": 0,
        "Tabella02_DoneStampante": 0,
        "Tabella02_WorkingR2": 1,
        "Tabella02_DoneR2": 0,
        "Tabella02_Working_Navette": 0,
        "Tabella02_Done_Navette": 0,
        "Tabella02_Working_Navetta_2": 0,
        "Tabella02_Done_Navetta_2": 0,
        "Tabella02_Working_Carrello": 0,
        "Tabella02_Done_Carrello": 0,
        "Tabella02_WorkingR1": 1,
        "Tabella02_DoneR1": 0,
        "Tabella02_Working_Caricatore": 0,
        "Tabella02_Done_Caricatore": 0,

        # Tabella03
        "Tabella03_ID": 1003,
        "Tabella03_Lunghezza": 1800,
        "Tabella03_Larghezza": 900,
        "Tabella03_Spessore": 25,
        "Tabella03_From_X": 2000,
        "Tabella03_From_Y": 1200,
        "Tabella03_From_Z": 1,
        "Tabella03_To_X": 18000,
        "Tabella03_To_Y": 1000,
        "Tabella03_ToZ": 1,
        "Tabella03_NewDatas": 0,
        "Tabella03_WorkingStampante": 0,
        "Tabella03_DoneStampante": 1,
        "Tabella03_WorkingR2": 0,
        "Tabella03_DoneR2": 1,
        "Tabella03_Working_Navette": 0,
        "Tabella03_Done_Navette": 0,
        "Tabella03_Working_Navetta_2": 0,
        "Tabella03_Done_Navetta_2": 0,
        "Tabella03_Working_Carrello": 0,
        "Tabella03_Done_Carrello": 0,
        "Tabella03_WorkingR1": 0,
        "Tabella03_DoneR1": 0,
        "Tabella03_Working_Caricatore": 0,
        "Tabella03_Done_Caricatore": 0,

        # Tabella04
        "Tabella04_ID": 0,
        "Tabella04_Lunghezza": 0,
        "Tabella04_Larghezza": 0,
        "Tabella04_Spessore": 0,
        "Tabella04_From_X": 0,
        "Tabella04_From_Y": 0,
        "Tabella04_From_Z": 0,
        "Tabella04_To_X": 0,
        "Tabella04_To_Y": 0,
        "Tabella04_ToZ": 0,
        "Tabella04_NewDatas": 0,
        "Tabella04_WorkingStampante": 0,
        "Tabella04_DoneStampante": 0,
        "Tabella04_WorkingR2": 0,
        "Tabella04_DoneR2": 0,
        "Tabella04_Working_Navette": 0,
        "Tabella04_Done_Navette": 0,
        "Tabella04_Working_Navetta_2": 0,
        "Tabella04_Done_Navetta_2": 0,
        "Tabella04_Working_Carrello": 0,
        "Tabella04_Done_Carrello": 0,
        "Tabella04_WorkingR1": 0,
        "Tabella04_DoneR1": 0,
        "Tabella04_Working_Caricatore": 0,
        "Tabella04_Done_Caricatore": 0,

        # Tabella05
        "Tabella05_ID": 0,
        "Tabella05_Lunghezza": 0,
        "Tabella05_Larghezza": 0,
        "Tabella05_Spessore": 0,
        "Tabella05_From_X": 0,
        "Tabella05_From_Y": 0,
        "Tabella05_From_Z": 0,
        "Tabella05_To_X": 0,
        "Tabella05_To_Y": 0,
        "Tabella05_ToZ": 0,
        "Tabella05_NewDatas": 0,
        "Tabella05_WorkingStampante": 0,
        "Tabella05_DoneStampante": 0,
        "Tabella05_WorkingR2": 0,
        "Tabella05_DoneR2": 0,
        "Tabella05_Working_Navette": 0,
        "Tabella05_Done_Navette": 0,
        "Tabella05_Working_Navetta_2": 0,
        "Tabella05_Done_Navetta_2": 0,
        "Tabella05_Working_Carrello": 0,
        "Tabella05_Done_Carrello": 0,
        "Tabella05_WorkingR1": 0,
        "Tabella05_DoneR1": 0,
        "Tabella05_Working_Caricatore": 0,
        "Tabella05_Done_Caricatore": 0,

        # Tabella06
        "Tabella06_ID": 0,
        "Tabella06_Lunghezza": 0,
        "Tabella06_Larghezza": 0,
        "Tabella06_Spessore": 0,
        "Tabella06_From_X": 0,
        "Tabella06_From_Y": 0,
        "Tabella06_From_Z": 0,
        "Tabella06_To_X": 0,
        "Tabella06_To_Y": 0,
        "Tabella06_ToZ": 0,
        "Tabella06_NewDatas": 0,
        "Tabella06_WorkingStampante": 0,
        "Tabella06_DoneStampante": 0,
        "Tabella06_WorkingR2": 0,
        "Tabella06_DoneR2": 0,
        "Tabella06_Working_Navette": 0,
        "Tabella06_Done_Navette": 0,
        "Tabella06_Working_Navetta_2": 0,
        "Tabella06_Done_Navetta_2": 0,
        "Tabella06_Working_Carrello": 0,
        "Tabella06_Done_Carrello": 0,
        "Tabella06_WorkingR1": 0,
        "Tabella06_DoneR1": 0,
        "Tabella06_Working_Caricatore": 0,
        "Tabella06_Done_Caricatore": 0,
        
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
                
                comandi = line.split(";")
                risposte_lista = []
                
                for sing_cmd_str in comandi:
                    sing_cmd_str = sing_cmd_str.strip()
                    if not sing_cmd_str:
                        continue
                    
                    parti = sing_cmd_str.split()
                    if not parti:
                        continue
                    cmd = parti[0].lower()
                    
                    if cmd == "read_all":
                        macchina = parti[1]
                        if macchina in plc_state:
                            res = []
                            for k, v in plc_state[macchina].items():
                                res.append(f"{macchina}.{k} = {v}")
                            risposte_lista.append("\n".join(res))
                        else:
                            risposte_lista.append(f"{macchina}: disconnected or not found")
                            
                    elif cmd == "read_template":
                        macchina = parti[1]
                        tpl = parti[2]
                        if macchina in plc_state:
                            res = []
                            for k, v in plc_state[macchina].items():
                                res.append(f"{macchina}.{k} = {v}")
                            risposte_lista.append("\n".join(res))
                        else:
                            risposte_lista.append(f"{macchina}: disconnected or not found")
                            
                    elif cmd == "write":
                        macchina = parti[1]
                        parametro = parti[2]
                        valore = parti[3]
                        
                        if macchina in plc_state:
                            if valore.lower() in ["1", "true", "-1"]:
                                val_parsed = 1
                            elif valore.lower() in ["0", "false"]:
                                val_parsed = 0
                            else:
                                try:
                                    val_parsed = float(valore) if "." in valore else int(valore)
                                except ValueError:
                                    val_parsed = valore
                                    
                            plc_state[macchina][parametro] = val_parsed
                            
                            if parametro == "CMD_EnableDrive":
                                plc_state[macchina]["Stato_EnableDrive"] = val_parsed
                            elif parametro == "CMD_Automatico":
                                plc_state[macchina]["Stato_Automatico"] = val_parsed
                            elif parametro == "CMD_MaintenancePosition":
                                plc_state[macchina]["Stato_MaintenancePosition"] = val_parsed
                            elif parametro == "CMD_Home":
                                plc_state[macchina]["Home_OK"] = 1
                            elif parametro == "cmd_Caso5primaParte":
                                plc_state[macchina]["Stato_Caso5_PrimaParte"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y1_Prendi":
                                plc_state[macchina]["Stato_Y1_Prendi"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y1_avanti":
                                if val_parsed in [-513, 65023, 32767]:
                                    plc_state[macchina]["Stato_Y1_avanti"] = 0
                                else:
                                    plc_state[macchina]["Stato_Y1_avanti"] = 1
                                    plc_state[macchina]["Stato_Y1_indietro"] = 0
                            elif parametro == "cmd_Y1_indietro":
                                if val_parsed in [-513, 65023, 32767]:
                                    plc_state[macchina]["Stato_Y1_indietro"] = 0
                                else:
                                    plc_state[macchina]["Stato_Y1_avanti"] = 0
                                    plc_state[macchina]["Stato_Y1_indietro"] = 1
                            elif parametro == "cmd_Y1_venturi":
                                plc_state[macchina]["Stato_Y1_venturi"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y1_bascula":
                                plc_state[macchina]["Stato_Y1_bascula"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y2_Prendi":
                                plc_state[macchina]["Stato_Y2_Prendi"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y2_avanti":
                                if val_parsed in [-513, 65023, 32767]:
                                    plc_state[macchina]["Stato_Y2_avanti"] = 0
                                else:
                                    plc_state[macchina]["Stato_Y2_avanti"] = 1
                                    plc_state[macchina]["Stato_Y2_indietro"] = 0
                            elif parametro == "cmd_Y2_indietro":
                                if val_parsed in [-513, 65023, 32767]:
                                    plc_state[macchina]["Stato_Y2_indietro"] = 0
                                else:
                                    plc_state[macchina]["Stato_Y2_avanti"] = 0
                                    plc_state[macchina]["Stato_Y2_indietro"] = 1
                            elif parametro == "cmd_Y2_venturi":
                                plc_state[macchina]["Stato_Y2_venturi"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y2_bascula":
                                plc_state[macchina]["Stato_Y2_bascula"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Y_soffia":
                                plc_state[macchina]["Stato_Y_soffia"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Memoria_Op1":
                                plc_state[macchina]["Stato_Memoria_Op1"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Memoria_Op2" or parametro == "cmd_Memoria_Op3":
                                plc_state[macchina]["Stato_Memoria_Op3"] = 0 if val_parsed in [-513, 65023, 32767] else 1
                            elif parametro == "cmd_Pannello_Preso":
                                if val_parsed in [-513, 65023, 32767]:
                                    plc_state[macchina]["Stato_Y1_PannelloPreso"] = 0
                                    plc_state[macchina]["Stato_Y2_PannelloPreso"] = 0
                                else:
                                    plc_state[macchina]["Stato_Y1_PannelloPreso"] = 1
                                    plc_state[macchina]["Stato_Y2_PannelloPreso"] = 1
                            elif parametro == "cmd_Operazioni_1-2-3-4":
                                val_int = int(val_parsed)
                                plc_state[macchina]["Stato_Op1"] = 1 if val_int == 768 else 0
                                plc_state[macchina]["Stato_Op2"] = 1 if val_int == 1280 else 0
                                plc_state[macchina]["Stato_Op3"] = 1 if val_int == 2304 else 0
                                plc_state[macchina]["Stato_Op4"] = 1 if val_int == 4352 else 0
                                
                            risposte_lista.append(f"{macchina}.{parametro} scritto: {valore}")
                        else:
                            risposte_lista.append(f"{macchina}: disconnected or not found")
                            
                    elif cmd == "connect":
                        target = parti[1]
                        risposte_lista.append(f"{target} connesso.")
                            
                    elif cmd == "disconnect":
                        target = parti[1]
                        risposte_lista.append(f"{target} disconnesso.")
                            
                    elif cmd == "status":
                        res = [
                            "web_port: 8080",
                            "socket_port: 9000",
                            "modbus_port: 502"
                        ]
                        for m in plc_state.keys():
                            res.append(f"{m}: connected")
                        risposte_lista.append("\n".join(res))
                        
                    else:
                        risposte_lista.append(f"Comando '{cmd}' non supportato dal mock.")
                
                if risposte_lista:
                    sock.sendall(("\n".join(risposte_lista) + "\n\x03").encode("utf-8"))
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
