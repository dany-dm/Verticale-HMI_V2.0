# syslog_logger.py
import socket
import time
import threading

class SyslogLogger:
    def __init__(self, host="127.0.0.1", port=514):
        self.host = host
        self.port = port
        self._lock = threading.Lock()

    def update_config(self, host, port):
        with self._lock:
            self.host = host
            self.port = port

    def log(self, message, severity=6, facility=1):
        """
        Invia un messaggio syslog via UDP (RFC 3164).
        Severities:
          0 = Emergency: system is unusable
          1 = Alert: action must be taken immediately
          2 = Critical: critical conditions
          3 = Error: error conditions
          4 = Warning: warning conditions
          5 = Notice: normal but significant condition
          6 = Informational: informational messages
          7 = Debug: debug-level messages
        """
        # Avvia l'invio in un thread separato per evitare qualsiasi blocco
        t = threading.Thread(target=self._send_udp, args=(message, severity, facility), daemon=True)
        t.start()

    def _send_udp(self, message, severity, facility):
        with self._lock:
            host = self.host
            port = self.port
            
        pri = (facility << 3) + severity
        # Formato RFC 3164: <PRI>Mmm dd hh:mm:ss tag: message
        timestamp = time.strftime("%b %d %H:%M:%S")
        formatted = f"<{pri}>{timestamp} VerticaleHMI: {message}"
        
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.settimeout(1.0)
                s.sendto(formatted.encode("utf-8"), (host, port))
        except Exception:
            # Silenzioso: non vogliamo bloccare l'HMI se il syslog non risponde
            pass
