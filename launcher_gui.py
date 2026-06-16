# launcher_gui.py
import tkinter as tk
import webbrowser
import os
import sys

class LauncherGUI:
    def __init__(self, port, datastore, shutdown_callback):
        self.port = port
        self.datastore = datastore
        self.shutdown_callback = shutdown_callback
        
        self.root = None
        self._lbl_connection = None
        self._led_canvas = None
        self._led_id = None
        self._running = False

    def start(self):
        self._running = True
        
        # Crea la finestra Tkinter
        self.root = tk.Tk()
        self.root.title("Verticale HMI Launcher")
        self.root.geometry("400x240")
        self.root.resizable(False, False)
        
        # Icona di default (se presente)
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            icon_path = os.path.join(base_dir, "hmi_icon.ico")
            if os.path.exists(icon_path):
                self.root.iconbitmap(icon_path)
        except Exception:
            pass
            
        self.root.configure(bg="#2c3e50")

        # Layout padding
        main_frame = tk.Frame(self.root, bg="#2c3e50", padx=15, pady=15)
        main_frame.pack(fill="both", expand=True)

        # Titolo
        lbl_title = tk.Label(main_frame, text="Verticale HMI v2.0", font=("Arial", 16, "bold"), fg="#ecf0f1", bg="#2c3e50")
        lbl_title.pack(anchor="w", pady=(0, 10))

        # Stato Server
        status_frame = tk.Frame(main_frame, bg="#2c3e50")
        status_frame.pack(fill="x", pady=5)
        
        lbl_status_desc = tk.Label(status_frame, text="Stato Server HMI:", font=("Arial", 11), fg="#bdc3c7", bg="#2c3e50")
        lbl_status_desc.pack(side="left")

        lbl_status_val = tk.Label(status_frame, text="Attivo", font=("Arial", 11, "bold"), fg="#2ecc71", bg="#2c3e50")
        lbl_status_val.pack(side="left", padx=5)

        # Stato Connessione NetLinker (LED + Testo)
        conn_frame = tk.Frame(main_frame, bg="#2c3e50")
        conn_frame.pack(fill="x", pady=5)

        lbl_conn_desc = tk.Label(conn_frame, text="Connessione NetLinker:", font=("Arial", 11), fg="#bdc3c7", bg="#2c3e50")
        lbl_conn_desc.pack(side="left")

        self._led_canvas = tk.Canvas(conn_frame, width=16, height=16, bg="#2c3e50", highlightthickness=0)
        self._led_id = self._led_canvas.create_oval(2, 2, 14, 14, fill="red")
        self._led_canvas.pack(side="left", padx=(5, 5))

        self._lbl_connection = tk.Label(conn_frame, text="Disconnesso", font=("Arial", 11, "bold"), fg="#e74c3c", bg="#2c3e50")
        self._lbl_connection.pack(side="left")

        # Info Porta
        lbl_info = tk.Label(main_frame, text=f"Porta HTTP HMI: {self.port}", font=("Arial", 10), fg="#95a5a6", bg="#2c3e50")
        lbl_info.pack(anchor="w", pady=(10, 5))

        # Bottone Apri Browser
        btn_open = tk.Button(
            main_frame, 
            text="Apri HMI nel Browser", 
            font=("Arial", 12, "bold"),
            bg="#1abc9c", 
            fg="white", 
            activebackground="#16a085", 
            activeforeground="white",
            bd=0, 
            padx=10, 
            pady=8,
            cursor="hand2",
            command=self.open_browser
        )
        btn_open.pack(fill="x", pady=10)

        # Intercetta chiusura finestra
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        # Avvia aggiornamento ciclico stato connessione nel thread Tkinter
        self.root.after(500, self.update_status)
        
        self.root.mainloop()

    def open_browser(self):
        url = f"http://localhost:{self.port}"
        webbrowser.open(url)

    def update_status(self):
        if not self._running:
            return
        
        netlinker_ok = self.datastore.get_netlinker_status()

        if netlinker_ok:
            if self._lbl_connection:
                self._lbl_connection.config(text="Connesso", fg="#2ecc71")
            if self._led_canvas and self._led_id:
                self._led_canvas.itemconfig(self._led_id, fill="#2ecc71")
        else:
            if self._lbl_connection:
                self._lbl_connection.config(text="Disconnesso", fg="#e74c3c")
            if self._led_canvas and self._led_id:
                self._led_canvas.itemconfig(self._led_id, fill="#e74c3c")
                
        if self.root:
            self.root.after(500, self.update_status)

    def on_close(self):
        self._running = False
        if self.root:
            self.root.destroy()
        if self.shutdown_callback:
            self.shutdown_callback()
