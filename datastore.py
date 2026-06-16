# datastore.py
import threading
import time
import json

class Datastore:
    def __init__(self):
        self._lock = threading.RLock()
        self._states = {}
        # Mappa dei template attivi per ciascuna macchina: { nome_macchina: { template_name: bool } }
        self._active_templates = {}
        self._logs = []
        self._max_logs = 100
        self._server_status = "running"
        self._start_time = time.strftime("%Y-%m-%d %H:%M:%S")

    def initialize_device(self, name, templates):
        """Inizializza lo stato di un dispositivo e dei suoi template."""
        with self._lock:
            if name not in self._states:
                self._states[name] = {
                    "__comunicazione_ok__": False,
                    "__last_update__": ""
                }
                self._active_templates[name] = {}
                for tpl, is_cyclic in templates.items():
                    # Di default i template ciclici sono attivi, quelli on-demand no
                    self._active_templates[name][tpl] = is_cyclic

    def update_device_data(self, name, data, online=True):
        """Aggiorna le variabili di una macchina nel datastore."""
        with self._lock:
            if name not in self._states:
                self._states[name] = {}
            
            # Aggiorna i valori
            for k, v in data.items():
                self._states[name][k] = v
                
            self._states[name]["__comunicazione_ok__"] = online
            self._states[name]["__last_update__"] = time.strftime("%Y-%m-%d %H:%M:%S")

    def set_device_online(self, name, online):
        """Imposta lo stato di connessione di una macchina."""
        with self._lock:
            if name in self._states:
                self._states[name]["__comunicazione_ok__"] = online
                self._states[name]["__last_update__"] = time.strftime("%Y-%m-%d %H:%M:%S")

    def get_device_state(self, name):
        """Restituisce una copia dello stato di una macchina."""
        with self._lock:
            if name in self._states:
                return dict(self._states[name])
            return {"__comunicazione_ok__": False}

    def get_all_states(self):
        """Restituisce una copia di tutti gli stati delle macchine."""
        with self._lock:
            return {k: dict(v) for k, v in self._states.items()}

    def set_template_active(self, name, template_id, active):
        """Attiva o disattiva un template per una determinata macchina."""
        with self._lock:
            if name in self._active_templates:
                self._active_templates[name][template_id] = active
                return True
            return False

    def is_template_active(self, name, template_id):
        """Verifica se un template è attivo per una macchina."""
        with self._lock:
            if name in self._active_templates:
                return self._active_templates[name].get(template_id, False)
            return False

    def get_active_templates_for_device(self, name):
        """Restituisce l'elenco dei template attualmente attivi per una macchina."""
        with self._lock:
            if name in self._active_templates:
                return [tpl for tpl, active in self._active_templates[name].items() if active]
            return []

    def get_configured_templates(self, name):
        """Restituisce tutti i template configurati per una macchina e il loro stato di attivazione."""
        with self._lock:
            if name in self._active_templates:
                return dict(self._active_templates[name])
            return {}

    def add_log(self, source, message, level="INFO"):
        """Aggiunge una riga di log in memoria per la console web."""
        with self._lock:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            log_entry = {
                "timestamp": timestamp,
                "source": source,
                "message": message,
                "level": level
            }
            self._logs.append(log_entry)
            if len(self._logs) > self._max_logs:
                self._logs.pop(0)

    def get_logs(self):
        """Restituisce la copia dei log memorizzati."""
        with self._lock:
            return list(self._logs)

    def get_server_metadata(self, pid, ports):
        """Restituisce i metadati del server per lo stato globale."""
        with self._lock:
            online_devices = [k for k, v in self._states.items() if v.get("__comunicazione_ok__", False)]
            return {
                "pid": pid,
                "status": self._server_status,
                "last_update": time.strftime("%Y-%m-%d %H:%M:%S"),
                "configured_ports": {
                    "socket_control_port": ports.get("socket", 9000),
                    "api_port": ports.get("web", 8080)
                },
                "connected_devices": online_devices
            }

    def set_server_status(self, status):
        """Imposta lo stato di esecuzione del server."""
        with self._lock:
            self._server_status = status

    def set_netlinker_status(self, connected):
        """Imposta lo stato di connessione a NetLinker."""
        with self._lock:
            if "__system__" not in self._states:
                self._states["__system__"] = {}
            self._states["__system__"]["netlinker_connected"] = connected

    def get_netlinker_status(self):
        """Ritorna lo stato di connessione a NetLinker."""
        with self._lock:
            if "__system__" in self._states:
                return self._states["__system__"].get("netlinker_connected", False)
            return False
