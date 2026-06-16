#rulliere.py


import tkinter as tk
from tkinter import ttk

from rulliere_controllo import RulliereControllo

class PaginaRulliere(tk.Frame):
    def __init__(self, parent, controller, invia_comando_fn, leggi_stato_fn):
        super().__init__(parent)
        self.controller = controller
        self.invia_comando_fn = invia_comando_fn
        self.leggi_stato_fn = leggi_stato_fn
        
        # --- Variabili ---
        self.stato_labels = {}
        self.last_x_encoder = None
        self.last_y_encoder = None

        # --- Frame selector ---
        frame_selector = tk.Frame(self)
        frame_selector.grid(row=0, column=0, sticky="ew", pady=5)

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

        label_macchina = tk.Label(frame_comunicazione, text="Rulliere", font=("Arial", 20, "bold"))
        label_macchina.pack(side="left", padx=10)

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


        # --- Frame comandi ---
        frame_comandi = tk.Frame(frame2, bg="#f0f0f0")
        frame_comandi.grid(row=2, column=0, sticky="nsew", pady=5)
        # --- Instanzia il pannello di controllo ---
        self.controllo = RulliereControllo(
            frame_comandi,
            self.controller,
            self.invia_comando_fn,
            self.leggi_stato_fn
        )
        self.controllo.pack(fill="both", expand=True)
        
        # --- Avvia refresh GUI ---
        self.after(200, self.refresh_gui_periodico)

    # --- Funzioni ---

    def aggiorna_gui(self, dati_macchine):
        stato = dati_macchine.get("Rulliere")

        comunicazione_ok = False
        if stato:
            comunicazione_ok = stato.get("__comunicazione_ok__", False)

        colore_led = "green" if comunicazione_ok else "red"
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
    
    def refresh_gui_periodico(self):
        if self.controller.current_page_name == "PaginaRulliere":
            self.aggiorna_gui(self.controller.dati_macchine)


        self.after(200, self.refresh_gui_periodico)
