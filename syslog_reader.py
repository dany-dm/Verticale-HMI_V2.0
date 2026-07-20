# syslog_reader.py
import os
import time
import threading
import subprocess
import platform

class SyslogReader:
    def __init__(self, datastore, file_path="", username="", password=""):
        self.datastore = datastore
        self.file_path = file_path
        self.username = username
        self.password = password
        self.running = False
        self.thread = None
        self._lock = threading.Lock()

    def start(self, file_path=None, username=None, password=None):
        with self._lock:
            if file_path is not None:
                self.file_path = file_path
            if username is not None:
                self.username = username
            if password is not None:
                self.password = password
            if self.running:
                return
            self.running = True
            
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        with self._lock:
            self.running = False

    def restart(self, file_path, username="", password=""):
        self.stop()
        # Attendiamo brevemente che il thread termini
        time.sleep(0.2)
        self.start(file_path, username, password)

    def _open_file(self, path):
        """Apre il file in modalità sola lettura senza porre alcun blocco (share read/write/delete)."""
        if platform.system() == "Windows":
            import ctypes
            from ctypes import wintypes
            import msvcrt

            GENERIC_READ = 0x80000000
            FILE_SHARE_READ = 0x00000001
            FILE_SHARE_WRITE = 0x00000002
            FILE_SHARE_DELETE = 0x00000004
            OPEN_EXISTING = 3
            FILE_ATTRIBUTE_NORMAL = 0x80
            INVALID_HANDLE_VALUE = -1

            kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
            CreateFileW = kernel32.CreateFileW
            CreateFileW.argtypes = [
                wintypes.LPCWSTR,
                wintypes.DWORD,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
                wintypes.DWORD,
                wintypes.HANDLE
            ]
            CreateFileW.restype = wintypes.HANDLE

            handle = CreateFileW(
                path,
                GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                None,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                None
            )

            if handle == INVALID_HANDLE_VALUE:
                err = ctypes.get_last_error()
                raise ctypes.WinError(err)

            fd = msvcrt.open_osfhandle(handle, os.O_RDONLY)
            return open(fd, 'r', encoding='utf-8', errors='replace')
        else:
            return open(path, 'r', encoding='utf-8', errors='replace')

    def _authenticate_unc(self, path):
        # Se il percorso inizia con \\ ed è fornito username, esegui "net use"
        if not path.startswith("\\\\"):
            return True
            
        # Trova la parte del server e dello share (es. \\192.168.1.100\share)
        normalized = path.replace("/", "\\")
        parts = [p for p in normalized.split("\\") if p]
        if len(parts) < 2:
            return True
        share_path = f"\\\\{parts[0]}\\{parts[1]}"
        
        if not self.username:
            return True # prova senza autenticazione
            
        self.datastore.add_log("SyslogReader", f"Autenticazione condivisione di rete {share_path}...", level="INFO")
        cmd = ["net", "use", share_path, self.password, f"/user:{self.username}", "/persistent:no"]
        try:
            # Rimuovi eventuali connessioni precedenti per evitare conflitti
            subprocess.run(["net", "use", share_path, "/delete", "/y"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if result.returncode == 0:
                self.datastore.add_log("SyslogReader", f"Connessione di rete {share_path} stabilita con successo.", level="INFO")
                return True
            else:
                self.datastore.add_log("SyslogReader", f"Errore autenticazione {share_path}: {result.stderr.strip()}", level="ERROR")
                return False
        except Exception as e:
            self.datastore.add_log("SyslogReader", f"Errore durante l'esecuzione di net use: {e}", level="ERROR")
            return False

    def _run(self):
        with self._lock:
            file_path = self.file_path
            
        if not file_path:
            self.datastore.add_log("SyslogReader", "Nessun percorso file syslog specificato.", level="WARNING")
            return
            
        # Prova ad autenticarsi se è un percorso UNC
        self._authenticate_unc(file_path)
        
        self.datastore.add_log("SyslogReader", f"Avvio monitoraggio file syslog (modalità non bloccante): {file_path}", level="INFO")
        
        # Attesa del file se non esiste ancora
        wait_cycles = 0
        while self.running and not os.path.exists(file_path):
            if wait_cycles % 10 == 0:  # Logga ogni 5 secondi
                self.datastore.add_log("SyslogReader", f"Attesa creazione file syslog: {file_path}", level="INFO")
            time.sleep(0.5)
            wait_cycles += 1
            
        if not self.running:
            return
            
        # Inizializziamo last_position
        last_position = 0
        try:
            file_size = os.path.getsize(file_path)
            if file_size > 50000:  # circa 50KB
                last_position = file_size - 50000
                # Salta la prima riga parziale per allineamento
                try:
                    with self._open_file(file_path) as f:
                        f.seek(last_position)
                        f.readline()
                        last_position = f.tell()
                except Exception:
                    last_position = file_size
            else:
                last_position = 0
        except Exception as e:
            self.datastore.add_log("SyslogReader", f"Errore inizializzazione posizione: {e}", level="WARNING")

        while self.running:
            try:
                if not os.path.exists(file_path):
                    time.sleep(0.5)
                    continue
                    
                curr_size = os.path.getsize(file_path)
                
                if curr_size < last_position:
                    # Il file è stato troncato o ruotato
                    self.datastore.add_log("SyslogReader", "Rilevata rotazione o troncamento del file syslog. Riapertura da inizio file...", level="INFO")
                    last_position = 0
                
                if curr_size > last_position:
                    with self._open_file(file_path) as f:
                        f.seek(last_position)
                        while self.running:
                            line = f.readline()
                            if not line:
                                break
                            self._parse_and_store_line(line)
                        last_position = f.tell()
            except Exception as e:
                # Evita loop rapidi se ci sono errori persistenti
                time.sleep(0.5)
                
            time.sleep(0.2)

    def _parse_and_store_line(self, line):
        line = line.strip()
        if not line:
            return
            
        import re
        
        severity = 6 # default INFO
        facility = 1 # default USER
        timestamp = None
        message = line
        
        # 1. Prova a verificare se c'è un tag PRI tipo <30> o <14>
        pri_match = re.match(r"^<(\d+)>(.*)", line)
        if pri_match:
            pri = int(pri_match.group(1))
            facility = pri // 8
            severity = pri % 8
            content = pri_match.group(2).strip()
            
            # Estrai timestamp standard syslog se presente
            # Esempio: Oct 12 10:14:15 tag: message
            ts_pattern = r"^([A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(.*)"
            ts_match = re.match(ts_pattern, content)
            if ts_match:
                raw_ts = ts_match.group(1)
                message = ts_match.group(2)
                import datetime
                try:
                    parsed_ts = datetime.datetime.strptime(raw_ts, "%b %d %H:%M:%S")
                    parsed_ts = parsed_ts.replace(year=datetime.datetime.now().year)
                    timestamp = parsed_ts.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass
            else:
                # Controlla RFC 5424 timestamp
                # Esempio: 2026-07-10T10:42:08.003Z
                rfc_pattern = r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s+(.*)"
                rfc_match = re.match(rfc_pattern, content)
                if rfc_match:
                    raw_ts = rfc_match.group(1)
                    message = rfc_match.group(2)
                    timestamp = raw_ts.replace("T", " ").replace("Z", "")
                    if "." in timestamp:
                        timestamp = timestamp.split(".")[0]
                else:
                    message = content
        else:
            # Se non c'è tag PRI, proviamo a estrarre data/ora all'inizio e il livello di log
            # Esempio: 2026-07-10 10:42:08.123 [INFO] messaggio...
            std_pattern = r"^\[?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:\.\d+)?\]?\s+([A-Z]+|\[[A-Z]+\])\s+(.*)"
            std_match = re.match(std_pattern, line)
            if std_match:
                timestamp = std_match.group(1)
                level_str = std_match.group(2).strip("[]").upper()
                message = std_match.group(3)
                
                if "EMERG" in level_str: severity = 0
                elif "ALERT" in level_str: severity = 1
                elif "CRIT" in level_str: severity = 2
                elif "ERR" in level_str or "FAIL" in level_str: severity = 3
                elif "WARN" in level_str: severity = 4
                elif "NOTICE" in level_str: severity = 5
                elif "INFO" in level_str: severity = 6
                elif "DEBUG" in level_str: severity = 7
            else:
                # Pattern semplice con solo timestamp
                simple_ts_pattern = r"^\[?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:\.\d+)?\]?\s+(.*)"
                simple_ts_match = re.match(simple_ts_pattern, line)
                if simple_ts_match:
                    timestamp = simple_ts_match.group(1)
                    message = simple_ts_match.group(2)
                    
        # Se non è stato possibile ricavare il timestamp, usa l'ora corrente
        if not timestamp:
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
        self.datastore.add_syslog_log(message, severity, facility, timestamp)
