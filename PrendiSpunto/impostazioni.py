import tkinter as tk
from tkinter import ttk
import os
import json

class PaginaImpostazioni(tk.Frame):
    def __init__(self, parent, controller, configurazione):
        super().__init__(parent)
        self.controller = controller
        self.configurazione = configurazione

        self.navette_config = {}
        self.config_entries = {}
        self.carrello_y_entry = None
        self.caricatore_z_entry = None

        # --- Layout ---
        label = ttk.Label(self, text="Pagina Impostazioni", font=("Arial", 24))
        label.pack(pady=10)

        frame_impostazioni = tk.Frame(self)
        frame_impostazioni.pack(pady=10, padx=10, anchor="nw")

        col_frame_1 = tk.Frame(frame_impostazioni)
        col_frame_2 = tk.Frame(frame_impostazioni)
        col_frame_3 = tk.Frame(frame_impostazioni)
        col_frame_4 = tk.Frame(frame_impostazioni)

        col_frame_1.grid(row=0, column=0, padx=10, sticky="nw")
        col_frame_2.grid(row=0, column=1, padx=10, sticky="nw")
        col_frame_3.grid(row=0, column=2, padx=10, sticky="nw")
        col_frame_4.grid(row=0, column=3, padx=10, sticky="nw")

        # --- Polling IP / Port / Refresh ---
        labels = ["Polling IP", "Polling Port", "Refresh"]
        for label_text in labels:
            frame = tk.Frame(col_frame_1)
            frame.pack(anchor="w", pady=2)
            lbl = tk.Label(frame, text=label_text + ":", font=("Arial", 12))
            lbl.pack(side="left")
            entry = tk.Entry(frame, width=18 if label_text == "Polling IP" else 6, font=("Arial", 12), justify="right")
            entry.pack(side="left")
            self.config_entries[label_text] = entry

        # --- Carrello ---
        carrello_group = tk.LabelFrame(col_frame_1, text="Impostazioni Carrello", font=("Arial", 12, "bold"))
        carrello_group.pack(anchor="w", pady=5)
        frame = tk.Frame(carrello_group)
        frame.pack(anchor="w")
        tk.Label(frame, text="Corsa max Y:", font=("Arial", 12)).pack(side="left")
        self.carrello_y_entry = tk.Entry(frame, width=10, font=("Arial", 12), justify="right")
        self.carrello_y_entry.pack(side="left")

        # --- Caricatore ---
        caricatore_group = tk.LabelFrame(col_frame_1, text="Impostazioni Caricatore", font=("Arial", 12, "bold"))
        caricatore_group.pack(anchor="w", pady=5)
        frame = tk.Frame(caricatore_group)
        frame.pack(anchor="w")
        tk.Label(frame, text="Corsa max Z:", font=("Arial", 12)).pack(side="left")
        self.caricatore_z_entry = tk.Entry(frame, width=10, font=("Arial", 12), justify="right")
        self.caricatore_z_entry.pack(side="left")

        # --- Navette 1-4 (col_frame_2) ---
        for i in range(1, 5):
            self.crea_navetta_frame(col_frame_2, i)

        # --- Navette 5-8 (col_frame_3) ---
        for i in range(5, 9):
            self.crea_navetta_frame(col_frame_3, i)

        # --- Navette 9-10 (col_frame_4) ---
        for i in range(9, 11):
            self.crea_navetta_frame(col_frame_4, i)

        # --- Pulsante Salva ---
        bottoni_frame = tk.Frame(self)
        bottoni_frame.pack(pady=10)

        btn_salva = ttk.Button(bottoni_frame, text="Salva configurazione", command=self.salva_configurazione)
        btn_salva.pack(pady=5)

    def crea_navetta_frame(self, parent_frame, numero_navetta):
        group = tk.LabelFrame(parent_frame, text=f"Impostazioni Navetta {numero_navetta}", font=("Arial", 12, "bold"))
        var_attivo = tk.BooleanVar(value=True)
        chk = tk.Checkbutton(group, text="Attivo?", variable=var_attivo, font=("Arial", 10))
        chk.pack(anchor="w", pady=2)

        self.navette_config[f"Navetta_{numero_navetta}"] = {"attivo": var_attivo, "entries": []}

        for axis in ["Corsa max X", "Corsa max Y1", "Corsa max Y2", "Corsa max Z", "Posizione Y navetta"]:
            frame = tk.Frame(group)
            frame.pack(anchor="w", pady=1)
            lbl = tk.Label(frame, text=axis + ":", font=("Arial", 12), width=20, anchor="e")
            lbl.pack(side="left")
            entry = tk.Entry(frame, width=10, font=("Arial", 12), justify="right")
            entry.pack(side="left")
            self.navette_config[f"Navetta_{numero_navetta}"]["entries"].append(entry)

        group.pack(pady=5, anchor="w")

    def salva_configurazione(self):
        try:
            dati = {}

            # --- Polling ---
            dati["polling_ip"] = self.config_entries["Polling IP"].get()
            dati["polling_port"] = int(self.config_entries["Polling Port"].get() or 0)
            dati["refresh"] = float(self.config_entries["Refresh"].get() or 0)

            # --- Carrello ---
            dati["carrello"] = {
                "corsa_max_y": float(self.carrello_y_entry.get() or 0)
            }

            # --- Caricatore ---
            dati["caricatore"] = {
                "corsa_max_z": float(self.caricatore_z_entry.get() or 0)
            }

            # --- Navette ---
            dati["navette"] = {}
            for navetta_key, navetta in self.navette_config.items():
                valori = []
                for entry_widget in navetta["entries"]:
                    val = entry_widget.get()
                    valori.append(float(val) if val else 0)
                dati["navette"][navetta_key] = {
                    "attivo": navetta["attivo"].get(),
                    "valori": valori
                }

            # Aggiorna il dizionario configurazione condiviso
            self.configurazione.clear()
            self.configurazione.update(dati)

            # Salva su file
            file_path = os.path.join("config", "config.json")
            with open(file_path, "w") as f:
                json.dump(self.configurazione, f, indent=4)

            print("Configurazione salvata!")

        except Exception as e:
            print(f"Errore nel salvataggio configurazione: {e}")

    def aggiorna_gui(self):
        try:
            # --- Polling ---
            self.config_entries["Polling IP"].delete(0, tk.END)
            self.config_entries["Polling IP"].insert(0, self.configurazione.get("polling_ip", ""))

            self.config_entries["Polling Port"].delete(0, tk.END)
            self.config_entries["Polling Port"].insert(0, str(self.configurazione.get("polling_port", 0)))

            self.config_entries["Refresh"].delete(0, tk.END)
            self.config_entries["Refresh"].insert(0, str(self.configurazione.get("refresh", 0)))

            # --- Carrello ---
            self.carrello_y_entry.delete(0, tk.END)
            self.carrello_y_entry.insert(0, str(self.configurazione.get("carrello", {}).get("corsa_max_y", 0)))

            # --- Caricatore ---
            self.caricatore_z_entry.delete(0, tk.END)
            self.caricatore_z_entry.insert(0, str(self.configurazione.get("caricatore", {}).get("corsa_max_z", 0)))

            # --- Navette ---
            navette_data = self.configurazione.get("navette", {})
            for navetta_key, navetta in self.navette_config.items():
                nav_data = navette_data.get(navetta_key, {})
                navetta["attivo"].set(nav_data.get("attivo", True))
                valori = nav_data.get("valori", [0, 0, 0, 0, 0])
                for entry_widget, val in zip(navetta["entries"], valori):
                    entry_widget.delete(0, tk.END)
                    entry_widget.insert(0, str(val))

        except Exception as e:
            print(f"Errore durante aggiorna_gui: {e}")
