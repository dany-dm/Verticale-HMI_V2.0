# test_ports.py
import socket

def test_port(port):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect(("127.0.0.1", port))
        print(f"Port {port} is OPEN and responding!")
        s.close()
        return True
    except Exception as e:
        print(f"Port {port} is CLOSED or failed: {e}")
        return False

print("Testing local ports...")
test_port(8080)
test_port(9001)
test_port(9000)
