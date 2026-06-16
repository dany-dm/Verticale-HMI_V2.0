#pagina_navette.py

import tkinter as tk

from navette_controllo import NavetteControllo

class PaginaNavette(tk.Frame):
    def __init__(self, parent, controller, invia_comando_fn, leggi_stato_fn):
        super().__init__(parent)
        self.controller = controller
        self.invia_comando_fn = invia_comando_fn
        self.leggi_stato_fn = leggi_stato_fn
        
        # --- Variabili ---
        self.indice_navetta = 0
        self.stato_labels = {}
        self.bottoni_navette = []
        self.last_x_encoder = None
        self.last_z_encoder = None

        # --- Frame selector ---
        frame_selector = tk.Frame(self)
        frame_selector.grid(row=0, column=0, sticky="ew", pady=5)

        for i in range(10):
            navetta_key = f"Navetta_{i+1}"
            attivo = self.controller.configurazione.get("navette", {}).get(navetta_key, {}).get("attivo", True)

            if attivo:
                btn = tk.Button(
                    frame_selector,
                    text=f"Navetta {i+1}",
                    command=lambda idx=i: self.seleziona_navetta(idx),
                    font=("Arial", 14),
                    bg="#34495e",
                    fg="white",
                    activebackground="#1abc9c",
                    activeforeground="white",
                    relief="raised",
                    bd=2,
                    padx=8,
                    pady=4
                )
                btn.pack(side="left", padx=5, pady=5)
                self.bottoni_navette.append(btn)

        # --- Contenitore colonne ---
        contenitore_colonne = tk.Frame(self)
        contenitore_colonne.grid(row=1, column=0, sticky="nsew")

        # Rendi la pagina espandibile
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Configura colonne di contenitore_colonne
        contenitore_colonne.grid_columnconfigure(0, weight=1)
        contenitore_colonne.grid_rowconfigure(0, weight=1)

        # --- Frame sinistro (frame2) ---
        frame2 = tk.Frame(contenitore_colonne)
        frame2.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
        frame2.grid_rowconfigure(2, weight=1) 

        # --- Frame comunicazione ---
        frame_comunicazione = tk.Frame(frame2)
        frame_comunicazione.grid(row=0, column=0, sticky="ew", pady=5)

        self.label_navetta_selezionata = tk.Label(frame_comunicazione, text="Navetta 1", font=("Arial", 20, "bold"))
        self.label_navetta_selezionata.pack(side="left", padx=10)

        label_conn = tk.Label(frame_comunicazione, text="Comunicazione con PLC", font=("Arial", 16))
        label_conn.pack(side="left")

        self.canvas_comunicazione = tk.Canvas(frame_comunicazione, width=20, height=20, highlightthickness=0)
        self.led_comunicazione_id = self.canvas_comunicazione.create_oval(2, 2, 18, 18, fill="gray")
        self.canvas_comunicazione.pack(side="left", padx=5)

        # --- Frame stati ---
        frame_stati = tk.Frame(frame2, bd=2, relief="groove")
        frame_stati.grid(row=1, column=0, sticky="nsew", pady=5)

        colonne = [
            [
                ("Asse X homed", "X_Homed"),
                ("Asse Y homed", "Y_Homed"),
                ("Asse Z homed", "Z_Homed"),
                ("Tutto home", "Home_OK")
            ],
            [
                ("In attesa lavoro", "Stato_Pick"),
                ("In lavorazione", "Stato_Picked"),
                ("Tabella Index", "IndexTabellaLavoro"),
            ],
            [
                ("Emergenza", "Stato_Emergenza"),
                ("Aria OK", "Stato_Aria_OK"),
                ("Inverter OK", "Stato_Inverter_OK")
            ],
            [
                ("Rulliere", "Stato_ComunicazioneRulliere"),
                ("Carrello", "Stato_ComunicazioneCarrello")
            ]
        ]

        for col_idx, gruppo in enumerate(colonne):
            col_frame = tk.LabelFrame(frame_stati, text=["Azzeramenti:", "Automatico:", "Allarmi:", "Comunicazioni:"][col_idx],
                                      font=("Arial", 12, "bold"), padx=5, pady=5, bd=2, relief="groove")
            col_frame.grid(row=0, column=col_idx, padx=10, sticky="n")

            for descrizione, chiave in gruppo:
                f = tk.Frame(col_frame)
                f.pack(anchor="w", pady=0, padx=0)
                lbl = tk.Label(f, text=descrizione + ":", font=("Arial", 14), anchor="w")
                lbl.pack(side="left", padx=(0, 5))

                if chiave == "IndexTabellaLavoro":
                    val = tk.Entry(f, width=3, font=("Arial", 14), state='readonly', justify="center")
                    val.pack(side="left", padx=10)
                    self.stato_labels[chiave] = val
                    continue

                # --- LED di stato ---
                canvas = tk.Canvas(f, width=20, height=20, highlightthickness=0)
                led_id = canvas.create_oval(2, 2, 18, 18, fill="gray")
                canvas.pack(side="left")
                self.stato_labels[chiave] = (canvas, led_id)

                # --- Campi encoder ---
                if col_idx == 0 and chiave == "X_Homed":
                    val_frame = tk.Frame(f)
                    val_frame.pack(side="left", padx=10)
                    val = tk.Entry(val_frame, width=7, font=("Arial", 14), state='readonly', justify="right")
                    val.pack(side="left")
                    mm_label = tk.Label(val_frame, text="mm", font=("Arial", 12))
                    mm_label.pack(side="left", padx=(5, 0))
                    self.stato_labels["X_Encoder"] = val

                elif col_idx == 0 and chiave == "Y_Homed":
                    val_frame = tk.Frame(f)
                    val_frame.pack(side="left", padx=10)

                    val1 = tk.Entry(val_frame, width=6, font=("Arial", 14), state='readonly', justify="right")
                    val1.pack(side="left")
                    mm_label1 = tk.Label(val_frame, text="Y1 mm", font=("Arial", 12))
                    mm_label1.pack(side="left", padx=(5, 10))
                    self.stato_labels["Y1_Encoder"] = val1

                    val2 = tk.Entry(val_frame, width=6, font=("Arial", 14), state='readonly', justify="right")
                    val2.pack(side="left")
                    mm_label2 = tk.Label(val_frame, text="Y2 mm", font=("Arial", 12))
                    mm_label2.pack(side="left", padx=(5, 0))
                    self.stato_labels["Y2_Encoder"] = val2

                elif col_idx == 0 and chiave == "Z_Homed":
                    val_frame = tk.Frame(f)
                    val_frame.pack(side="left", padx=10)
                    val = tk.Entry(val_frame, width=6, font=("Arial", 14), state='readonly', justify="right")
                    val.pack(side="left")
                    mm_label = tk.Label(val_frame, text="mm", font=("Arial", 12))
                    mm_label.pack(side="left", padx=(5, 0))
                    self.stato_labels["Z_Encoder"] = val

        # --- Frame comandi ---
        frame_comandi = tk.Frame(frame2, bg="#f0f0f0")
        frame_comandi.grid(row=2, column=0, sticky="nsew", pady=5)
        # --- Instanzia il pannello di controllo ---
        self.controllo = NavetteControllo(
            frame_comandi,
            self.controller,
            lambda: self.indice_navetta,
            self.invia_comando_fn,
            self.leggi_stato_fn
        )
        self.controllo.pack(fill="both", expand=True)
        
        # --- Frame barra X ---
        frame_barra_x = tk.Frame(frame2)
        frame_barra_x.grid(row=3, column=0, sticky="ew", pady=5)
        self.barra_X = tk.Canvas(frame_barra_x, height=100, bg="white")
        self.barra_X.pack(fill="x", padx=10, pady=(5, 10))
        self.barra_X.bind("<Configure>", lambda e: self.aggiorna_barra_corsa())

        # --- Frame barra Z ---
        frame_barra_z = tk.Frame(contenitore_colonne)
        frame_barra_z.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)
        # TRUCCO: faccio crescere la riga 0 di frame_barra_z
        frame_barra_z.grid_rowconfigure(0, weight=1)
        frame_barra_z.grid_columnconfigure(0, weight=1)
        # Canvas barra Z — usiamo grid, NON pack!
        self.barra_Z = tk.Canvas(frame_barra_z, width=100, bg="white")
        self.barra_Z.grid(row=0, column=0, sticky="nsew")
        self.barra_Z.bind("<Configure>", lambda e: self.aggiorna_barra_z())


        # --- Avvia refresh GUI ---
        self.after(200, self.refresh_gui_periodico)

    # --- Funzioni ---

    def seleziona_navetta(self, idx):
        self.indice_navetta = idx
        self.label_navetta_selezionata.config(text=f"Navetta {idx+1}")
        self.last_x_encoder = None
        self.last_z_encoder = None

    def aggiorna_gui(self, dati_macchine, indice_navetta):
        navetta_key = f"Navetta_{indice_navetta+1}"
        stato = dati_macchine.get(navetta_key)

        comunicazione_ok = False
        if stato:
            comunicazione_ok = stato.get("__comunicazione_ok__", False)

        attivo = self.controller.configurazione.get("navette", {}).get(navetta_key, {}).get("attivo", True)

        colore_led = "green" if comunicazione_ok and attivo else "red"
        self.canvas_comunicazione.itemconfig(self.led_comunicazione_id, fill=colore_led)

        if hasattr(self, 'controllo'):
            if comunicazione_ok:
                self.controllo.pack(fill="both", expand=True)
            else:
                self.controllo.pack_forget()
        if hasattr(self.controllo, "aggiorna_tutti_comandi"):
            self.controllo.aggiorna_tutti_comandi(stato)

        for chiave, widget in self.stato_labels.items():
            if not stato or chiave not in stato:
                if isinstance(widget, tuple):
                    canvas, led_id = widget
                    canvas.itemconfig(led_id, fill="gray")
                elif isinstance(widget, tk.Entry):
                    widget.config(state='normal')
                    widget.delete(0, tk.END)
                    widget.insert(0, "")
                    widget.config(state='disabled')
                continue

            val = stato[chiave]
            if isinstance(widget, tuple) and isinstance(val, bool):
                canvas, led_id = widget
                if chiave == "Stato_Emergenza":
                    nuovo_colore = "red" if val else "green"
                elif chiave in ["Stato_Pick", "Stato_Picked"]:
                    nuovo_colore = "green" if val else "yellow"
                else:
                    nuovo_colore = "green" if val else "red"
                canvas.itemconfig(led_id, fill=nuovo_colore)
            elif isinstance(widget, tk.Entry):
                widget.config(state='normal')
                widget.delete(0, tk.END)
                if chiave == "IndexTabellaLavoro":
                    try:
                        widget.insert(0, str(int(float(val))))
                    except:
                        widget.insert(0, "0")
                else:
                    widget.insert(0, str(val))
                widget.config(state='disabled')
                


        self.aggiorna_barra_corsa()
        self.aggiorna_barra_z()

    def aggiorna_barra_corsa(self):
        navetta_key = f"Navetta_{self.indice_navetta+1}"

        try:
            corsa_max_x = float(self.controller.configurazione["navette"][navetta_key]["valori"][0])
        except:
            corsa_max_x = 20000

        stato = self.controller.dati_macchine.get(navetta_key, {})

        try:
            x_encoder = float(stato.get("X_Encoder", 0))
        except:
            x_encoder = 0

        if self.last_x_encoder == x_encoder:
            return

        self.last_x_encoder = x_encoder

        self.barra_X.delete("all")

        offset = 700
        offset_macchina = 4200
        total_length_mm = corsa_max_x + offset + offset_macchina
        scala = self.barra_X.winfo_width() / total_length_mm if total_length_mm != 0 else 1

        x_start = offset * scala
        x_end = (corsa_max_x + offset) * scala + 5
        self.barra_X.create_line(x_start, 50, x_end, 50, fill="blue", width=4)

        rect_x_min = (x_encoder + offset) * scala
        rect_x_max = (x_encoder + offset_macchina + offset) * scala
        self.barra_X.create_rectangle(rect_x_min, 40, rect_x_max, 60, fill="green", outline="")
        self.barra_X.create_polygon(rect_x_min, 40, rect_x_min + 10, 40, rect_x_min + 5, 60, fill="black")

        indicatori = [
            (0, "0.0 mm"),
            (4600, "home"),
            (corsa_max_x, f"{int(corsa_max_x)} mm")
        ]
        for quota, label in indicatori:
            x_pos = (quota + offset) * scala
            self.barra_X.create_polygon(x_pos, 75, x_pos + 10, 75, x_pos + 5, 65, fill="black")
            self.barra_X.create_text(x_pos + 5, 80, text=label, font=("Arial", 10), anchor="n")

    def aggiorna_barra_z(self):
        navetta_key = f"Navetta_{self.indice_navetta+1}"

        try:
            corsa_max_z = float(self.controller.configurazione["navette"][navetta_key]["valori"][3])
        except:
            corsa_max_z = 5000

        stato = self.controller.dati_macchine.get(navetta_key, {})

        try:
            z_encoder = float(stato.get("Z_Encoder", 0))
        except:
            z_encoder = 0

        if self.last_z_encoder == z_encoder:
            return

        self.last_z_encoder = z_encoder

        self.barra_Z.delete("all")

        offset = 100
        offset_macchina = 500
        total_height_mm = corsa_max_z + offset + offset + offset_macchina
        scala = self.barra_Z.winfo_height() / total_height_mm if total_height_mm != 0 else 1

        y_start = offset * scala
        y_end = (total_height_mm - offset) * scala
        self.barra_Z.create_line(20, y_start, 20, y_end, fill="blue", width=4)

        rect_y = y_end - ((z_encoder + offset_macchina) * scala)
        rect_y_basso = rect_y + offset_macchina * scala
        self.barra_Z.create_rectangle(10, rect_y, 30, rect_y_basso, fill="green", outline="")
        self.barra_Z.create_polygon(10, rect_y_basso, 30, rect_y_basso - 6, 10, rect_y_basso - 12, fill="black")

        indicatori = [
            (0 - offset, "home"),
            (corsa_max_z - offset, f"{int(corsa_max_z)} mm")
        ]
        for quota, label in indicatori:
            y_pos = y_end - ((quota + offset) * scala) - 6
            self.barra_Z.create_polygon(40, y_pos, 50, y_pos - 6, 50, y_pos + 6, fill="black")
            self.barra_Z.create_text(40, y_pos + 15, text=label, font=("Arial", 10), anchor="w")

    def refresh_gui_periodico(self):
        if self.controller.current_page_name == "PaginaNavette":
            self.aggiorna_gui(self.controller.dati_macchine, self.indice_navetta)

        self.after(200, self.refresh_gui_periodico)
