import tkinter as tk
from tkinter import ttk

class PaginaLog(tk.Frame):
    def __init__(self, parent, controller, invia_comando_fn, leggi_stato_fn):
        super().__init__(parent)
        self.controller = controller
        self.invia_comando_fn = invia_comando_fn
        self.leggi_stato_fn = leggi_stato_fn

        label = ttk.Label(self, text="Vista Globale", font=("Arial", 24))
        label.pack(pady=20)

        # Esempio di layout - qui puoi mettere la tua vista globale (stato macchine, riepiloghi, ecc.)
        info_label = ttk.Label(self, text="Qui verrà mostrata la vista globale delle macchine.", font=("Arial", 16))
        info_label.pack(pady=10)

        # Placeholder per aggiungere widget futuri (stato navette, carrello, rulliere ecc.)
