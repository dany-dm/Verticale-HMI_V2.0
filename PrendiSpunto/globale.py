import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from condizioni import valida_condizioni_navetta, valida_condizioni_carrello, valida_condizioni_caricatore, valida_condizioni_rulliere
from globale_vista import GlobaleVista


class PaginaGlobale(tk.Frame):
    def __init__(self, parent, controller, invia_comando_fn, leggi_stato_fn):
        super().__init__(parent)
        self.controller = controller
        self.invia_comando_fn = invia_comando_fn
        self.leggi_stato_fn = leggi_stato_fn

        # --- Frame tabella comandi ---
        frame_tabella = tk.LabelFrame(self, text="Stato Comandi Globali", font=("Arial", 14, "bold"))
        frame_tabella.pack(side="top", fill="x", padx=10, pady=10)

                # --- Costruisci intestazioni dinamiche ---
        self.intestazioni = ["Comandi"]

        # Navette attive
        navette_cfg = self.controller.configurazione.get("navette", {})
        for i in range(1, 11):
            navetta_key = f"Navetta_{i}"
            navetta_data = navette_cfg.get(navetta_key, {})
            if navetta_data.get("attivo", False):
                self.intestazioni.append(f"Nav {i}")

        # Altri dispositivi
        self.intestazioni += ["Carrello", "Caricatore", "Rulliere"]


        # --- Intestazione ---
        for col, header in enumerate(self.intestazioni):
            if header == "Comandi":
                col_width = 14
            elif header.startswith("Nav"):
                col_width = 6  # Navette più strette
            else:
                col_width = 8  # Altri dispositivi

            lbl = tk.Label(frame_tabella, text=header, font=("Arial", 12, "bold"),
                           borderwidth=1, relief="solid", padx=3, pady=3, width=col_width)
            lbl.grid(row=0, column=col, sticky="nsew", padx=1, pady=1)


                # --- Righe comandi ---
        self.comandi = ["EnableInverter", "Home", "Automatico"]

        # Salvo riferimenti alle label stato
        self.label_stati = {}

        for row, cmd in enumerate(self.comandi, start=1):
            # Colonna "Comandi" → BOTTONI
            btn_cmd = tk.Button(frame_tabella, text=cmd, font=("Arial", 12, "bold"),
                                command=lambda c=cmd: self.esegui_comando_globale(c))
            btn_cmd.grid(row=row, column=0, sticky="nsew", padx=1, pady=1)

            # Colonne dispositivi (Navette, Carrello, ecc.)
            for col in range(1, len(self.intestazioni)):
                macchina = self.intestazioni[col]

                if cmd == "Home" and macchina == "Rulliere":
                    # Oscura la cella
                    lbl_stato = tk.Label(frame_tabella, text="", bg="gray75",
                                         borderwidth=1, relief="solid", width=6)
                else:
                    # Cella normale
                    lbl_stato = tk.Label(frame_tabella, text="⭕", font=("Arial", 18), fg="red",
                                         borderwidth=1, relief="solid", padx=3, pady=3)

                lbl_stato.grid(row=row, column=col, sticky="nsew", padx=1, pady=1)

                # Salvo riferimento SOLO se la cella è attiva (non oscurata)
                if not (cmd == "Home" and macchina == "Rulliere"):
                    if cmd not in self.label_stati:
                        self.label_stati[cmd] = {}

                    self.label_stati[cmd][macchina] = lbl_stato


        # --- Contenitore orizzontale STOP + Legenda ---
        frame_stop_legenda = tk.Frame(self)
        frame_stop_legenda.pack(side="top", pady=10, fill="x", padx=10)

        # --- Bottone STOP Inverter ---
        btn_stop_inverter = tk.Button(
            frame_stop_legenda,
            text="STOP Inverter",
            font=("Arial", 14, "bold"),
            bg="red",
            fg="white",
            padx=10,
            pady=5,
            command=self.stop_inverter_globale
        )
        btn_stop_inverter.pack(side="left", padx=10)

        # --- Legenda ---
        frame_legenda = tk.Frame(frame_stop_legenda)
        frame_legenda.pack(side="left", padx=20)

        lbl_v = tk.Label(frame_legenda, text="✅", font=("Arial", 14), fg="green")
        lbl_v.pack(side="left", padx=5)

        lbl_text_v = tk.Label(frame_legenda, text="= Attivo", font=("Arial", 14))
        lbl_text_v.pack(side="left", padx=(0, 15))

        lbl_o = tk.Label(frame_legenda, text="⭕", font=("Arial", 14), fg="red")
        lbl_o.pack(side="left", padx=5)

        lbl_text_o = tk.Label(frame_legenda, text="= Spento", font=("Arial", 14))
        lbl_text_o.pack(side="left", padx=(0, 15))

        lbl_x = tk.Label(frame_legenda, text="❎", font=("Arial", 14), fg="gray30")
        lbl_x.pack(side="left", padx=5)

        lbl_text_x = tk.Label(frame_legenda, text="= Non eseguibile / controllare condizioni", font=("Arial", 14))
        lbl_text_x.pack(side="left", padx=(0, 15))

        # --- Frame contenitore per GlobaleVista ---
        self.frame_globale_vista = tk.Frame(self)
        self.frame_globale_vista.pack(side="top", fill="both", expand=True, padx=10, pady=10)
        self.vista_globale = GlobaleVista(
            self.frame_globale_vista,
            dati_macchine=self.controller.dati_macchine,
            configurazione=self.controller.configurazione,
            invia_comando_fn=self.invia_comando_fn
        )
        self.vista_globale.pack(fill="both", expand=True)


        # --- Avvia refresh GUI periodico ---
        self.after(200, self.refresh_stati)

    def refresh_stati(self):
        """
        Aggiorna le icone di stato della tabella.
        La V ha priorità assoluta → se già attivo, sempre verde anche se condizioni cambiano.
        """
        dati = self.controller.dati_macchine  # Dizionario globale già aggiornato

        for cmd in self.comandi:
            for macchina in self.label_stati[cmd]:
                stato_label = self.label_stati[cmd][macchina]

                # Ricavo il dizionario stato della macchina
                stato_macchina = None
                if macchina.startswith("Nav"):
                    nav_idx = int(macchina.split()[1])  # "Nav 1" → 1
                    stato_macchina = dati.get(f"Navetta_{nav_idx}", {})
                    condizioni, ok, _ = valida_condizioni_navetta(dati, nav_idx-1, 
                        "EnableInverter_ON" if cmd == "EnableInverter" else 
                        "CMD_Home" if cmd == "Home" else 
                        "Enable_Auto_ON")
                elif macchina == "Carrello":
                    stato_macchina = dati.get("Carrello", {})
                    condizioni, ok, _ = valida_condizioni_carrello(dati, 0, 
                        "EnableInverter_ON" if cmd == "EnableInverter" else 
                        "CMD_Home" if cmd == "Home" else 
                        "Enable_Auto_ON")
                elif macchina == "Caricatore":
                    stato_macchina = dati.get("Caricatore", {})
                    condizioni, ok, _ = valida_condizioni_caricatore(dati, 0, 
                        "EnableInverter_ON" if cmd == "EnableInverter" else 
                        "CMD_Home" if cmd == "Home" else 
                        "Enable_Auto_ON")
                elif macchina == "Rulliere":
                    stato_macchina = dati.get("Rulliere", {})
                    condizioni, ok, _ = valida_condizioni_rulliere(dati, 0, 
                        "EnableInverter_ON" if cmd == "EnableInverter" else 
                        "CMD_Home" if cmd == "Home" else 
                        "Enable_Auto_ON")
                else:
                    stato_macchina = {}
                    ok = False  # macchina sconosciuta

                # Verifica comunicazione
                comunicazione_ok = stato_macchina.get("__comunicazione_ok__", False)

                # Mappa comandi → flag di stato
                if cmd == "EnableInverter":
                    flag = stato_macchina.get("Stato_EnableDrive", False)
                elif cmd == "Home":
                    flag = stato_macchina.get("Home_OK", False)
                elif cmd == "Automatico":
                    flag = stato_macchina.get("Stato_Automatico", False)
                else:
                    flag = False

                # --- PRIORITA':
                if flag:
                    # Priorità → ✅ verde SEMPRE
                    stato_label.config(text="✅", fg="green")
                elif not comunicazione_ok:
                    # Comunicazione assente → ❎ grigio
                    stato_label.config(text="❎", fg="gray30")
                elif not ok:
                    # Condizioni NON rispettate → ❎ grigio
                    stato_label.config(text="❎", fg="gray30")
                else:
                    # Condizioni ok e non attivo → ⭕ rossa
                    stato_label.config(text="⭕", fg="red")

        # Richiama di nuovo dopo 500 ms
        self.after(200, self.refresh_stati)

    def esegui_comando_globale(self, cmd):
        """
        Esegue il comando globale su tutte le macchine attive e con condizioni rispettate.
        Non reinvia se già nello stato desiderato.
        """
        print(f"[Globale] Esecuzione comando globale: {cmd}")

        # --- Navette ---
        for i in range(1, 11):
            navetta_cfg = self.controller.configurazione.get("navette", {}).get(f"Navetta_{i}", {})
            if navetta_cfg.get("attivo", False):
                navetta_key = f"Navetta_{i}"
                condizioni, ok, _ = valida_condizioni_navetta(self.controller.dati_macchine, i-1, 
                    "EnableInverter_ON" if cmd == "EnableInverter" else 
                    "CMD_Home" if cmd == "Home" else 
                    "Enable_Auto_ON")

                stato_nav = self.controller.dati_macchine.get(navetta_key, {})
                # Stato attuale
                if cmd == "EnableInverter":
                    stato_attuale = stato_nav.get("Stato_EnableDrive", False)
                elif cmd == "Home":
                    stato_attuale = stato_nav.get("Home_OK", False)
                elif cmd == "Automatico":
                    stato_attuale = stato_nav.get("Stato_Automatico", False)
                else:
                    stato_attuale = False

                # Invia SOLO se condizioni OK e NON già attivo
                if ok and not stato_attuale:
                    comando = self.mappa_comando(cmd)
                    comando_str = f"write {navetta_key} {comando} -1"
                    print(f"[Globale] → {comando_str}")
                    self.invia_comando_fn(comando_str)
                else:
                    print(f"[Globale] Skipped {navetta_key} → già attivo o condizioni non OK")

        # --- Carrello ---
        if cmd != "Home":
            condizioni, ok, _ = valida_condizioni_carrello(self.controller.dati_macchine, 0, 
                "EnableInverter_ON" if cmd == "EnableInverter" else 
                "Enable_Auto_ON")

            stato_carrello = self.controller.dati_macchine.get("Carrello", {})
            stato_attuale = {
                "EnableInverter": stato_carrello.get("Stato_EnableDrive", False),
                "Automatico": stato_carrello.get("Stato_Automatico", False)
            }[cmd]

            if ok and not stato_attuale:
                comando = self.mappa_comando(cmd)
                comando_str = f"write Carrello {comando} -1"
                print(f"[Globale] → {comando_str}")
                self.invia_comando_fn(comando_str)
            else:
                print(f"[Globale] Skipped Carrello → già attivo o condizioni non OK")

        # --- Caricatore ---
        if cmd != "Home":
            condizioni, ok, _ = valida_condizioni_caricatore(self.controller.dati_macchine, 0, 
                "EnableInverter_ON" if cmd == "EnableInverter" else 
                "Enable_Auto_ON")

            stato_caricatore = self.controller.dati_macchine.get("Caricatore", {})
            stato_attuale = {
                "EnableInverter": stato_caricatore.get("Stato_EnableDrive", False),
                "Automatico": stato_caricatore.get("Stato_Automatico", False)
            }[cmd]

            if ok and not stato_attuale:
                comando = self.mappa_comando(cmd)
                comando_str = f"write Caricatore {comando} -1"
                print(f"[Globale] → {comando_str}")
                self.invia_comando_fn(comando_str)
            else:
                print(f"[Globale] Skipped Caricatore → già attivo o condizioni non OK")

        # --- Rulliere ---
        if cmd != "Home":
            condizioni, ok, _ = valida_condizioni_rulliere(self.controller.dati_macchine, 0, 
                "EnableInverter_ON" if cmd == "EnableInverter" else 
                "Enable_Auto_ON")

            stato_rulliere = self.controller.dati_macchine.get("Rulliere", {})
            stato_attuale = {
                "EnableInverter": stato_rulliere.get("Stato_EnableDrive", False),
                "Automatico": stato_rulliere.get("Stato_Automatico", False)
            }[cmd]

            if ok and not stato_attuale:
                comando = self.mappa_comando(cmd)
                comando_str = f"write Rulliere {comando} -1"
                print(f"[Globale] → {comando_str}")
                self.invia_comando_fn(comando_str)
            else:
                print(f"[Globale] Skipped Rulliere → già attivo o condizioni non OK")

    def stop_inverter_globale(self):
        """
        Arresta gli inverter su tutte le macchine attive che hanno inverter abilitato.
        Chiede conferma.
        """
        risposta = messagebox.askyesno("Conferma STOP", "⚠️ Sei sicuro di voler disabilitare TUTTI gli inverter?")
        if not risposta:
            return

        print("[Globale] Avvio STOP Inverter su tutte le macchine attive...")

        # --- Navette ---
        for i in range(1, 11):
            navetta_cfg = self.controller.configurazione.get("navette", {}).get(f"Navetta_{i}", {})
            if navetta_cfg.get("attivo", False):
                navetta_key = f"Navetta_{i}"
                stato_nav = self.controller.dati_macchine.get(navetta_key, {})
                stato_drive = stato_nav.get("Stato_EnableDrive", False)

                if stato_drive:
                    comando_str = f"write {navetta_key} CMD_EnableDrive 0"
                    print(f"[STOP] → {comando_str}")
                    self.invia_comando_fn(comando_str)
                else:
                    print(f"[STOP] Skipped {navetta_key} → inverter già disattivo")

        # --- Carrello ---
        stato_carrello = self.controller.dati_macchine.get("Carrello", {})
        if stato_carrello.get("Stato_EnableDrive", False):
            comando_str = "write Carrello CMD_EnableDrive 0"
            print(f"[STOP] → {comando_str}")
            self.invia_comando_fn(comando_str)
        else:
            print("[STOP] Skipped Carrello → inverter già disattivo")

        # --- Caricatore ---
        stato_caricatore = self.controller.dati_macchine.get("Caricatore", {})
        if stato_caricatore.get("Stato_EnableDrive", False):
            comando_str = "write Caricatore CMD_EnableDrive 0"
            print(f"[STOP] → {comando_str}")
            self.invia_comando_fn(comando_str)
        else:
            print("[STOP] Skipped Caricatore → inverter già disattivo")

        # --- Rulliere ---
        stato_rulliere = self.controller.dati_macchine.get("Rulliere", {})
        if stato_rulliere.get("Stato_EnableDrive", False):
            comando_str = "write Rulliere CMD_EnableDrive 0"
            print(f"[STOP] → {comando_str}")
            self.invia_comando_fn(comando_str)
        else:
            print("[STOP] Skipped Rulliere → inverter già disattivo")


    def mappa_comando(self, cmd):
        """
        Mappa il comando globale al nome reale da inviare.
        """
        if cmd == "EnableInverter":
            return "CMD_EnableDrive"
        elif cmd == "Home":
            return "CMD_Home"
        elif cmd == "Automatico":
            return "CMD_Automatico"
        else:
            return "UNKNOWN"
