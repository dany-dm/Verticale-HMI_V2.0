import tkinter as tk
from tkinter import ttk

class PaginaCarrello(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller

        label = ttk.Label(self, text="Pagina Carrello", font=("Arial", 24))
        label.pack(pady=20)

        # Qui puoi aggiungere i widget specifici per il carrello
