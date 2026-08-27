import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def create_client_app_server(
    *,
    host: str,
    port: int,
    directory: str,
    backend_url: str,
    client_id: str,
    client_secret: str,
    subject: str,
) -> ThreadingHTTPServer:
    class ClientAppHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

        def do_GET(self):
            if self.path != "/api/chat-token":
                return super().do_GET()

            body = json.dumps({"subject": subject}).encode()
            request = Request(
                f"{backend_url.rstrip('/')}/api/integrations/token",
                data=body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-Chat-Client-Id": client_id,
                    "X-Chat-Client-Secret": client_secret,
                },
            )
            try:
                with urlopen(request, timeout=10) as response:
                    payload = response.read()
                    status = response.status
            except HTTPError as error:
                payload = error.read()
                status = error.code
            except URLError:
                return self._json_response(502, {"detail": "Chat backend tidak tersedia"})

            self._raw_json_response(status, payload)

        def _json_response(self, status: int, value: dict):
            self._raw_json_response(status, json.dumps(value).encode())

        def _raw_json_response(self, status: int, payload: bytes):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    return ThreadingHTTPServer((host, port), ClientAppHandler)


if __name__ == "__main__":
    required = {
        "CHAT_CLIENT_ID": os.environ.get("CHAT_CLIENT_ID"),
        "CHAT_CLIENT_SECRET": os.environ.get("CHAT_CLIENT_SECRET"),
        "CHAT_USER_SUBJECT": os.environ.get("CHAT_USER_SUBJECT"),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise SystemExit(f"Missing environment: {', '.join(missing)}")

    server = create_client_app_server(
        host=os.environ.get("CLIENT_APP_HOST", "127.0.0.1"),
        port=int(os.environ.get("CLIENT_APP_PORT", "3001")),
        directory=os.path.dirname(os.path.abspath(__file__)),
        backend_url=os.environ.get("CHAT_BACKEND_URL", "http://127.0.0.1:8080"),
        client_id=required["CHAT_CLIENT_ID"],
        client_secret=required["CHAT_CLIENT_SECRET"],
        subject=required["CHAT_USER_SUBJECT"],
    )
    print(f"Client App listening on http://{server.server_address[0]}:{server.server_port}")
    server.serve_forever()
