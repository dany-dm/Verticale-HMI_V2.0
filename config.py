# config.py
import os
import json

DEFAULT_CONFIG = {
    "polling_ip": "localhost",
    "polling_port": 9000,
    "refresh": 0.3,
    "syslog_ip": "127.0.0.1",
    "syslog_port": 514,
    "carrello": {
        "corsa_max_y": 28500.0
    },
    "caricatore": {
        "corsa_max_z": 1500.0
    },
    "navette": {
        "Navetta_1": {
            "attivo": True,
            "valori": [27000.0, 1200.0, 1200.0, 3685.0, 18500.0]
        },
        "Navetta_2": {
            "attivo": True,
            "valori": [27000.0, 1200.0, 1200.0, 3685.0, 21200.0]
        },
        "Navetta_3": {
            "attivo": True,
            "valori": [27000.0, 1200.0, 1200.0, 3685.0, 24040.0]
        },
        "Navetta_4": {
            "attivo": True,
            "valori": [27000.0, 1200.0, 1200.0, 3685.0, 27060.0]
        }
    }
}

for i in range(5, 11):
    DEFAULT_CONFIG["navette"][f"Navetta_{i}"] = {
        "attivo": False,
        "valori": [27000.0, 1200.0, 1200.0, 3685.0, 0.0]
    }

def get_config_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    config_dir = os.path.join(base_dir, "config")
    os.makedirs(config_dir, exist_ok=True)
    return os.path.join(config_dir, "config.json")

def carica_configurazione():
    path = get_config_path()
    if not os.path.exists(path):
        salva_configurazione(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
    try:
        with open(path, "r", encoding="utf-8") as f:
            config = json.load(f)
            # Assicura la presenza di parametri minimi
            for k, v in DEFAULT_CONFIG.items():
                if k not in config:
                    config[k] = v
            return config
    except Exception as e:
        print(f"[CONFIG] Errore nel caricamento del file di configurazione: {e}")
        return DEFAULT_CONFIG

def salva_configurazione(config):
    path = get_config_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=4)
        return True
    except Exception as e:
        print(f"[CONFIG] Errore nel salvataggio del file di configurazione: {e}")
        return False
