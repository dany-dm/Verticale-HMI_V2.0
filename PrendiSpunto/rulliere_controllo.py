# caricatore_controllo.py

import tkinter as tk
from tkinter import messagebox
from condizioni import valida_condizioni_rulliere

class RulliereControllo(tk.Frame):
    def __init__(self, parent, controller, invia_comando_fn, leggi_stato_fn):
        super().__init__(parent)
        self.controller = controller
        self.invia_comando_fn = invia_comando_fn
        self.leggi_stato_fn = leggi_stato_fn
        
        # --- Variabili ---
        self.pulsanti_comandi = {}

        # --- Layout: due colonne ---
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # --- Frame sinistro: comandi ---
        self.frame_pulsanti = tk.LabelFrame(self, text="Comandi:", font=("Arial", 12, "bold"))
        self.frame_pulsanti.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

        # --- Frame destro: help ---
        self.frame_help = tk.LabelFrame(self, text="Help", font=("Arial", 12, "bold"))
        self.frame_help.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)

        # --- Sezione Inverter ---
        self.frame_inverter = tk.LabelFrame(self.frame_pulsanti, text="Inverter:", font=("Arial", 12, "bold"))
        self.frame_inverter.pack(fill="x", padx=5, pady=5)

        # --- Pulsanti inverter affiancati ---
        btn_frame = tk.Frame(self.frame_inverter)
        btn_frame.pack(pady=5)

        # --- Bottone Disabilita ---
        self.pulsanti_comandi["EnableInverter_OFF"] = tk.Button(
            btn_frame,
            text="Disabilita",
            width=12,
            font=("Arial", 14),
            command=lambda: self.invia_comando_enable_drive(0)
        )
        self.pulsanti_comandi["EnableInverter_OFF"].pack(side="left", padx=5)
        self.pulsanti_comandi["EnableInverter_OFF"].bind("<Enter>", lambda e: self.aggiorna_help("EnableInverter_OFF"))
        self.pulsanti_comandi["EnableInverter_OFF"].bind("<Leave>", lambda e: self.pulisci_help())
        
        # --- Bottone Abilita ---
        self.pulsanti_comandi["EnableInverter_ON"] = tk.Button(
            btn_frame,
            text="Abilita",
            width=12,
            font=("Arial", 14),
            command=lambda: self.invia_comando_enable_drive(-1)
        )
        self.pulsanti_comandi["EnableInverter_ON"].pack(side="left", padx=5)
        self.pulsanti_comandi["EnableInverter_ON"].bind("<Enter>", lambda e: self.aggiorna_help("EnableInverter_ON"))
        self.pulsanti_comandi["EnableInverter_ON"].bind("<Leave>", lambda e: self.pulisci_help())

        # --- Etichetta stato inverter ---
        self.label_inverter_stato = tk.Label(
            btn_frame,
            text="❌",
            font=("Arial", 20),
            fg="red"
        )
        self.label_inverter_stato.pack(side="left", padx=10)

        # --- Sezione Manuale / Automatico ---
        self.frame_auto = tk.LabelFrame(self.frame_pulsanti, text="Manuale / Automatico:", font=("Arial", 12, "bold"))
        self.frame_auto.pack(fill="x", padx=5, pady=5)

        # --- Pulsanti Manuale / Automatico affiancati ---
        btn_frame_auto = tk.Frame(self.frame_auto)
        btn_frame_auto.pack(pady=5)

        # Bottone Manuale (OFF)
        self.pulsanti_comandi["Enable_Auto_OFF"] = tk.Button(
            btn_frame_auto,
            text="Manuale",
            width=12,
            font=("Arial", 14),
            command=lambda: self.invia_comando_enable_auto(0)
        )
        self.pulsanti_comandi["Enable_Auto_OFF"].pack(side="left", padx=5)
        self.pulsanti_comandi["Enable_Auto_OFF"].bind("<Enter>", lambda e: self.aggiorna_help("Enable_Auto_OFF"))
        self.pulsanti_comandi["Enable_Auto_OFF"].bind("<Leave>", lambda e: self.pulisci_help())
        
        # Bottone Automatico (ON)
        self.pulsanti_comandi["Enable_Auto_ON"] = tk.Button(
            btn_frame_auto,
            text="Automatico",
            width=12,
            font=("Arial", 14),
            command=lambda: self.invia_comando_enable_auto(-1)
        )
        self.pulsanti_comandi["Enable_Auto_ON"].pack(side="left", padx=5)
        self.pulsanti_comandi["Enable_Auto_ON"].bind("<Enter>", lambda e: self.aggiorna_help("Enable_Auto_ON"))
        self.pulsanti_comandi["Enable_Auto_ON"].bind("<Leave>", lambda e: self.pulisci_help())

        # --- Etichetta stato Manuale / Automatico ---
        self.label_auto_stato = tk.Label(
            btn_frame_auto,
            text="❎",
            font=("Arial", 20),
            fg="red"
        )
        self.label_auto_stato.pack(side="left", padx=10)

                # --- Sezione Comandi vari ---
        self.frame_extra = tk.LabelFrame(self.frame_pulsanti, text="Comandi Extra:", font=("Arial", 12, "bold"))
        self.frame_extra.pack(fill="x", padx=5, pady=5, anchor="center")

        # --- Riga RESET ---
        frame_reset = tk.Frame(self.frame_extra)
        frame_reset.pack(fill="x", padx=10, pady=5)

        frame_reset.grid_columnconfigure(0, weight=1)
        frame_reset.grid_columnconfigure(1, weight=0)
        frame_reset.grid_columnconfigure(2, weight=1)

        lbl_reset_left = tk.Label(frame_reset, fg="orange", text="⚠️", font=("Arial", 24))
        lbl_reset_left.grid(row=0, column=0, sticky="e")

        self.pulsanti_comandi["CMD_Reset"] = tk.Button(
            frame_reset,
            text="RESET",
            width=16,
            font=("Arial", 14),
            command=self.invia_comando_reset
        )
        self.pulsanti_comandi["CMD_Reset"].grid(row=0, column=1, padx=10)
        self.pulsanti_comandi["CMD_Reset"].bind("<Enter>", lambda e: self.aggiorna_help("CMD_Reset"))
        self.pulsanti_comandi["CMD_Reset"].bind("<Leave>", lambda e: self.pulisci_help())

        lbl_reset_right = tk.Label(frame_reset, fg="orange", text="⚠️", font=("Arial", 24))
        lbl_reset_right.grid(row=0, column=2, sticky="w")

    def aggiorna_tutti_comandi(self, stato_macchina):
        """
        Aggiorna TUTTI i comandi gestiti dalla macchina.
        """
        for cmd in self.pulsanti_comandi.keys():
            self.aggiorna_comando(cmd, stato_macchina)

    def aggiorna_comando(self, cmd, stato_macchina):
        """
        Aggiorna un singolo comando (relief + enabled/disabled) in base allo stato della macchina.
        """
        comando_to_flag = {
            "EnableInverter_ON": "Stato_EnableDrive",
            "EnableInverter_OFF": "Stato_EnableDrive",
            "Enable_Auto_ON": "Stato_Automatico",
            "Enable_Auto_OFF": "Stato_Automatico",
        }

        if cmd in comando_to_flag:
            flag = comando_to_flag[cmd]
            flag_value = stato_macchina.get(flag, False)

            if cmd == "EnableInverter_ON":
                relief = "sunken" if flag_value else "raised"
            elif cmd == "EnableInverter_OFF":
                relief = "raised" if flag_value else "sunken"
            elif cmd == "Enable_Auto_ON":
                relief = "sunken" if flag_value else "raised"
            elif cmd == "Enable_Auto_OFF":
                relief = "raised" if flag_value else "sunken"
            else:
                relief = "raised"

            condizioni, ok, _ = valida_condizioni_rulliere(
                self.controller.dati_macchine,
                "Rulliere",
                cmd
            )

            self.pulsanti_comandi[cmd].config(relief=relief)

            new_state = "normal" if ok and relief != "sunken" else "disabled"
            self.pulsanti_comandi[cmd].config(state=new_state)

            # --- Aggiorna le label ---
            if cmd in ["EnableInverter_ON", "EnableInverter_OFF"]:
                simbolo = "✅" if flag_value else "❎"
                colore = "green" if flag_value else "red"
                self.label_inverter_stato.config(text=simbolo, fg=colore)

            elif cmd in ["Enable_Auto_ON", "Enable_Auto_OFF"]:
                simbolo = "✅" if flag_value else "❎"
                colore = "green" if flag_value else "red"
                self.label_auto_stato.config(text=simbolo, fg=colore)

    def invia_comando_enable_drive(self, valore):
        comando_str = f"write Rulliere CMD_EnableDrive {valore}"
        print(f"[DEBUG] Invio comando: {comando_str}")

        if self.invia_comando_fn:
            self.invia_comando_fn(comando_str)
            self.controller.dati_macchine["Rulliere"]["Stato_EnableDrive"] = (valore == -1)
        else:
            print("[ERRORE] invia_comando_fn non definita!")

    def invia_comando_enable_auto(self, valore):
        comando_str = f"write Rulliere CMD_Automatico {valore}"
        print(f"[DEBUG] Invio comando: {comando_str}")

        if self.invia_comando_fn:
            self.invia_comando_fn(comando_str)
            self.controller.dati_macchine["Rulliere"]["Stato_Automatico"] = (valore == -1)
        else:
            print("[ERRORE] invia_comando_fn non definita!")

    def invia_comando_reset(self):
        risposta = messagebox.askyesno("Conferma RESET", "Sei sicuro di voler inviare il comando RESET?")
        if not risposta:
            print("[DEBUG] RESET annullato dall'utente.")
            return

        comando_str = f"write Rulliere CMD_Reset -1"
        print(f"[DEBUG] Invio comando: {comando_str}")

        if self.invia_comando_fn:
            self.invia_comando_fn(comando_str)
        else:
            print("[ERRORE] invia_comando_fn non definita!")

    def aggiorna_help(self, cmd):
        """
        Aggiorna il contenuto del frame help con il tooltip + condizioni del comando selezionato.
        """
        condizioni, _, tooltip = valida_condizioni_rulliere(
            self.controller.dati_macchine,
            "Rulliere",
            cmd
        )

        self.pulisci_help()

        lbl_tooltip = tk.Label(
            self.frame_help,
            text=tooltip,
            font=("Arial", 12, "italic"),
            fg="blue",
            wraplength=300,
            justify="left"
        )
        lbl_tooltip.pack(anchor="w", padx=5, pady=(0, 5))

        for nome, ok in condizioni:
            simbolo = "✅" if ok else "❌"
            colore = "green" if ok else "red"
            lbl = tk.Label(
                self.frame_help,
                text=f"{simbolo} {nome}",
                font=("Arial", 12),
                anchor="w",
                fg=colore
            )
            lbl.pack(anchor="w", padx=5, pady=2)

    def pulisci_help(self):
        """
        Pulisce il frame help.
        """
        for widget in self.frame_help.winfo_children():
            widget.destroy()
