# netlinker_client.py
import socket
import time
import threading

def to_netlinker_name(name):
    # NetLinker reale risponde a Navetta_X (senza zero pad), quindi restituiamo inalterato
    return name

def from_netlinker_name(name):
    # NetLinker reale risponde a Navetta_X (senza zero pad), quindi restituiamo inalterato
    return name

class NetLinkerClient:
    def __init__(self, datastore, syslog_logger):
        self.datastore = datastore
        self.syslog = syslog_logger
        self.host = "localhost"
        self.port = 9000
        self.refresh_rate = 0.3
        
        self._sock = None
        self._sock_lock = threading.Lock()
        self._running = False
        self._thread = None

    def start(self, host, port, refresh_rate):
        self.host = host
        self.port = port
        self.refresh_rate = refresh_rate
        self._running = True
        self._thread = threading.Thread(target=self._polling_loop, daemon=True)
        self._thread.start()
        self.syslog.log(f"NetLinker Client avviato su {host}:{port}", severity=6)

    def stop(self):
        self._running = False
        with self._sock_lock:
            if self._sock:
                try:
                    self._sock.close()
                except Exception:
                    pass
                self._sock = None
        self.datastore.set_netlinker_status(False)

    def is_connected(self):
        with self._sock_lock:
            return self._sock is not None

    def _connect(self):
        """Tenta di connettersi al server NetLinker."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2.0)
            s.connect((self.host, self.port))
            self.syslog.log(f"Connesso a NetLinker ({self.host}:{self.port})", severity=6)
            return s
        except Exception as e:
            self.syslog.log(f"Errore connessione a NetLinker: {e}", severity=3)
            return None

    def invia_comando(self, comando):
        """Invia un comando sincrono a NetLinker e restituisce la risposta."""
        # Traduci i nomi HMI in nomi NetLinker nel comando
        parti = comando.strip().split()
        if len(parti) > 1:
            parti[1] = to_netlinker_name(parti[1])
        comando_tradotto = " ".join(parti)

        for tentativo in range(2):
            with self._sock_lock:
                s_attiva = self._sock
                connessione_temporanea = False
                if not s_attiva:
                    s_attiva = self._connect()
                    if not s_attiva:
                        return ""
                    connessione_temporanea = True

                try:
                    s_attiva.sendall((comando_tradotto + "\n").encode("utf-8"))
                    risposta_bytes = s_attiva.recv(16384)
                    if not risposta_bytes:
                        raise socket.error("Connessione chiusa dall'host remoto (recv ha restituito 0 byte)")
                    risposta = risposta_bytes.decode("utf-8")
                    
                    # Traduci la risposta da NetLinker a nomi HMI
                    risposta_tradotta = []
                    for riga in risposta.splitlines():
                        if "=" in riga and "." in riga:
                            macchina, resto = riga.split(".", 1)
                            macchina_hmi = from_netlinker_name(macchina.strip())
                            risposta_tradotta.append(f"{macchina_hmi}.{resto}")
                        elif ":" in riga:
                            macchina, resto = riga.split(":", 1)
                            # Gestisce formati tipo Navetta_04: connected o Navetta_04:Template: connected
                            macchina_pulita = macchina.strip()
                            template_id = ""
                            if ":" in macchina_pulita:
                                macchina_pulita, template_id = macchina_pulita.split(":", 1)
                            macchina_hmi = from_netlinker_name(macchina_pulita)
                            tag = f"{macchina_hmi}:{template_id}" if template_id else macchina_hmi
                            risposta_tradotta.append(f"{tag}:{resto}")
                        else:
                            # Rimpiazza i nomi grezzi anche nelle stringhe generiche
                            riga_tradotta = riga
                            for i in range(1, 20):
                                riga_tradotta = riga_tradotta.replace(f"Navetta_{i:02d}", f"Navetta_{i}")
                            risposta_tradotta.append(riga_tradotta)
                    
                    final_res = "\n".join(risposta_tradotta)
                    
                    if connessione_temporanea:
                        s_attiva.close()
                        
                    return final_res
                except Exception as e:
                    self.syslog.log(f"Errore durante l'invio del comando '{comando}' (tentativo {tentativo+1}): {e}", severity=3)
                    if not connessione_temporanea and self._sock:
                        try:
                            self._sock.close()
                        except Exception:
                            pass
                        self._sock = None
                    elif connessione_temporanea and s_attiva:
                        try:
                            s_attiva.close()
                        except Exception:
                            pass
                    
                    if connessione_temporanea:
                        # Se è fallito con connessione temporanea appena stabilita, non riprovare
                        break
                return ""

    def _polling_loop(self):
        """Ciclo continuo di polling per tutte le macchine abilitate."""
        while self._running:
            # Controlla la socket
            with self._sock_lock:
                if not self._sock:
                    self._sock = self._connect()
            
            if not self._sock:
                # Se non connesso, imposta tutte le macchine a offline
                self.datastore.set_netlinker_status(False)
                for nome_macchina in self.datastore.get_all_states().keys():
                    self.datastore.set_device_online(nome_macchina, False)
                time.sleep(2.0)
                continue
            
            self.datastore.set_netlinker_status(True)

            # Recupera l'elenco delle macchine
            stati_locali = self.datastore.get_all_states()
            
            for nome_macchina in stati_locali.keys():
                if not self._running:
                    break
                
                # Per ogni macchina, recupera i template attivi
                templates_attivi = self.datastore.get_active_templates_for_device(nome_macchina)
                if not templates_attivi:
                    # Nessun template attivo, salta il polling
                    continue

                for tpl in templates_attivi:
                    # Costruisci comando NetLinker
                    # Se il template è quello base generico (es. navetta, carrello ecc), possiamo usare read_all
                    # Altrimenti leggiamo il template specifico
                    if tpl in ["navetta", "carrello", "caricatore", "rulliere"]:
                        cmd = f"read_all {nome_macchina}"
                    else:
                        cmd = f"read_template {nome_macchina} {tpl}"

                    risposta = self.invia_comando(cmd)
                    
                    if not risposta.strip():
                        # Connessione persa o timeout
                        self.datastore.set_device_online(nome_macchina, False)
                        continue

                    if "disconnected" in risposta.lower() or "not found" in risposta.lower():
                        self.datastore.set_device_online(nome_macchina, False)
                        continue

                    # Parsing dei dati
                    righe = risposta.strip().split("\n")
                    dati_macchina = {}
                    for riga in righe:
                        if "=" in riga and "." in riga:
                            try:
                                _, coppia = riga.split(".", 1)
                                chiave, valore = coppia.split("=", 1)
                                chiave = chiave.strip()
                                valore = valore.strip()
                                
                                # Parsing valore
                                if valore in ["0", "1"]:
                                    valore_parsed = (valore == "1")
                                else:
                                    try:
                                        valore_parsed = round(float(valore), 2) if "." in valore else int(valore)
                                    except ValueError:
                                        valore_parsed = valore
                                dati_macchina[chiave] = valore_parsed
                            except Exception:
                                pass
                    
                    if dati_macchina:
                        self.datastore.update_device_data(nome_macchina, dati_macchina, online=True)
            
            time.sleep(self.refresh_rate)
