#main.py

import tkinter as tk
import threading
import json
import os
import time
import socket

from globale import PaginaGlobale
from navette import PaginaNavette
from carrello import PaginaCarrello
from caricatore import PaginaCaricatore
from rulliere import PaginaRulliere
from impostazioni import PaginaImpostazioni

# --- Variabili dati ---
dati_navetta = {}
indice_navetta = 0

# --- Configurazione polling di default ---
HOST = 'localhost'
PORT = 499

# --- Carica configurazione ---
config_path = os.path.join("config", "config.json")
os.makedirs(os.path.dirname(config_path), exist_ok=True)

try:
    if not os.path.isfile(config_path):
        configurazione = {
            "polling_ip": "",
            "polling_port": 0,
            "refresh": 0.3,
            "carrello": {
                "corsa_max_y": 0
            },
            "caricatore": {
                "corsa_max_z": 0
            },
            "navette": {}
        }

        for i in range(1, 11):
            configurazione["navette"][f"Navetta_{i}"] = {
                "attivo": True,
                "valori": [0, 0, 0, 0, 0]
            }

        # Salva il file iniziale
        with open(config_path, "w") as f:
            json.dump(configurazione, f, indent=4)
        print("Creato nuovo config.json")

    else:
        with open(config_path, "r") as f:
            configurazione = json.load(f)
        print("Configurazione caricata")

except Exception as e:
    print(f"Errore nella lettura di config.json: {e}")
    configurazione = {}

# --- Funzione invio comando TCP ---
def invia_comando_socket(comando, host=None, port=None):
    # Se host/port non specificati, prendo da configurazione
    host = host or configurazione.get("polling_ip", "localhost")
    port = port or configurazione.get("polling_port", 499)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.5)
            s.connect((host, port))
            s.sendall((comando + '\n').encode())
            risposta = s.recv(8192).decode()

            return risposta
    except Exception as e:
        print(f"Errore socket per comando '{comando}' su {host}:{port} :", e)
        return ""

# --- Thread polling ---
def ricevi_dati():
    global dati_navetta
    while True:
        host = configurazione.get("polling_ip", "localhost")
        port = configurazione.get("polling_port", 499)

        navette = configurazione.get("navette", {})

        for navetta_key, nav_data in navette.items():
            if nav_data.get("attivo", True):
                comando = f"read_all {navetta_key}"
                risposta = invia_comando_socket(comando, host, port)
                #print(f"[DEBUG] Risposta lettura {navetta_key} {risposta}")
                # Se non arriva risposta
                if not risposta.strip():
                    print(f"Nessuna risposta da {host}:{port} per {navetta_key}, attesa di 1s...")
                    dati_navetta[navetta_key] = {"__comunicazione_ok__": False}
                    time.sleep(1)
                    continue
                # Se arriva "disconnected" nella risposta
                if "disconnected" in risposta.lower():
                    print(f"{navetta_key}: Disconnesso! -> risposta: {risposta.strip()}")
                    dati_navetta[navetta_key] = {"__comunicazione_ok__": False}
                    time.sleep(1)
                    continue

                righe = risposta.strip().split("\n")
                stato = {}
                for riga in righe:
                    if '=' in riga and '.' in riga:
                        _, coppia = riga.split(".", 1)
                        chiave, valore = coppia.split("=", 1)
                        chiave = chiave.strip()
                        valore = valore.strip()
                        if valore in ["0", "1"]:
                            valore_parsed = valore == "1"
                            #print(f"[DEBUG] ciccia {chiave} {valore}")
                        else:
                            try:
                                valore_parsed = round(float(valore), 2) if '.' in valore else int(valore)
                            except:
                                valore_parsed = valore
                        stato[chiave] = valore_parsed
                        #print(f"[DEBUG] valori {chiave} {valore}")
                # --- Aggiungi flag comunicazione OK ---
                stato["__comunicazione_ok__"] = True
                # Aggiorno solo il dizionario!
                dati_navetta[navetta_key] = stato

        # Attendo refresh
        time.sleep(configurazione.get("refresh", 0.3))

def leggi_stato_macchina(macchina_key, variabile):
    """
    Legge una singola variabile da una macchina (qualsiasi macchina, navetta o altro).
    Aggiorna direttamente dati_navetta[macchina_key][variabile].
    """
    host = configurazione.get("polling_ip", "localhost")
    port = configurazione.get("polling_port", 499)

    comando = f"update {macchina_key} {variabile}"
    risposta = invia_comando_socket(comando, host, port)

    print(f"[DEBUG] Risposta lettura {macchina_key} {variabile}: {risposta}")

    # --- Se risposta valida, aggiorna lo stato ---
    if risposta and "=" in risposta:
        righe = risposta.strip().split("\n")
        for riga in righe:
            if '=' in riga and '.' in riga:
                _, coppia = riga.split(".", 1)
                chiave, valore = coppia.split("=", 1)
                chiave = chiave.strip()
                #chiave = chiave.replace(" (update)", "").strip()
                valore = valore.strip()
                if valore in ["0", "1"]:
                    valore_parsed = valore == "1"
                else:
                    try:
                        valore_parsed = round(float(valore), 2) if '.' in valore else int(valore)
                    except:
                        valore_parsed = valore

                # --- Aggiorna dizionario ---
                if macchina_key not in dati_navetta:
                    dati_navetta[macchina_key] = {}

                dati_navetta[macchina_key][chiave] = valore_parsed

                print(f"[DEBUG main.py - leggi_stato_macchina] Aggiornato: {macchina_key} -> {chiave} = {valore_parsed}")
    prova = dati_navetta.get(macchina_key, {}).get(variabile, None)
    print(f"[DEBUG return lettura] {prova}")
    return dati_navetta.get(macchina_key, {}).get(variabile, None)




# --- App principale ---
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Verticale HMI")
        self.geometry("1400x1000")
        self.configurazione = configurazione
        self.dati_navetta = dati_navetta

        # --- Layout ---
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # --- Menu laterale ---
        menu_frame = tk.Frame(self, bg="#2c3e50")
        menu_frame.grid(row=0, column=0, sticky="ns")

        bottoni_menu = [
            ("Globale", lambda: self.show_page("PaginaGlobale")),
            ("Navette", lambda: self.show_page("PaginaNavette")),
            ("Carrello", lambda: self.show_page("PaginaCarrello")),
            ("Caricatore", lambda: self.show_page("PaginaCaricatore")),
            ("Rulliere", lambda: self.show_page("PaginaRulliere")),
            ("Impostazioni", lambda: self.show_page("PaginaImpostazioni")),
        ]

        for nome, comando in bottoni_menu:
            b = tk.Button(menu_frame, text=nome, command=comando, bg="#34495e", fg="white",
                          font=("Arial", 16), width=15)
            b.pack(pady=5, padx=10, anchor="w")

        # --- Container pagine ---
        self.container = tk.Frame(self)
        self.container.grid(row=0, column=1, sticky="nsew")
        self.container.grid_rowconfigure(0, weight=1)
        self.container.grid_columnconfigure(0, weight=1)

        self.pages = {}
        self.current_page_name = None

        for PageClass in (PaginaGlobale, PaginaNavette, PaginaCarrello, PaginaCaricatore, PaginaRulliere, PaginaImpostazioni):
            if PageClass == PaginaImpostazioni:
                frame = PageClass(parent=self.container, controller=self, configurazione=configurazione)
            elif PageClass == PaginaNavette:
                frame = PageClass(parent=self.container, controller=self, invia_comando_fn=invia_comando_socket, leggi_stato_fn=leggi_stato_macchina)
            else:
                frame = PageClass(parent=self.container, controller=self)
            self.pages[PageClass.__name__] = frame
            frame.grid(row=0, column=0, sticky="nsew")

        self.show_page("PaginaGlobale")



    def show_page(self, page_name):
        self.current_page_name = page_name
        page = self.pages[page_name]

        # Se è la PaginaImpostazioni, aggiorna la GUI
        if page_name == "PaginaImpostazioni":
            page.aggiorna_gui()

        page.tkraise()


    

# --- Avvio app ---
if __name__ == "__main__":
    app = App()
    app.dati_navetta = dati_navetta
    threading.Thread(target=ricevi_dati, daemon=True).start()
    app.protocol("WM_DELETE_WINDOW", app.destroy)
    app.mainloop()
