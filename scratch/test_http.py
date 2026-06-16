# test_http.py
import socket

def test_http():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect(("127.0.0.1", 8080))
        print("Connected to port 8080. Sending GET request...")
        s.sendall(b"GET /api/state HTTP/1.1\r\nHost: localhost:8080\r\nConnection: close\r\n\r\n")
        response = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            response += chunk
        print("Received response:")
        print(response.decode("utf-8", errors="ignore"))
        s.close()
    except Exception as e:
        print(f"HTTP Request failed: {e}")

test_http()
