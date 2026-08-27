import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.request import urlopen

from client_app_server import create_client_app_server


class TokenBackendHandler(BaseHTTPRequestHandler):
    request_headers = None
    request_body = None

    def do_POST(self):
        type(self).request_headers = self.headers
        type(self).request_body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        payload = json.dumps(
            {"access_token": "real-backend-token", "token_type": "bearer", "expires_in": 300}
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass


class ClientAppServerTest(unittest.TestCase):
    def test_token_endpoint_exchanges_configured_principal_with_backend(self):
        backend = ThreadingHTTPServer(("127.0.0.1", 0), TokenBackendHandler)
        Thread(target=backend.serve_forever, daemon=True).start()
        self.addCleanup(backend.server_close)
        self.addCleanup(backend.shutdown)

        with TemporaryDirectory() as directory:
            Path(directory, "index.html").write_text("client app", encoding="utf-8")
            client_app = create_client_app_server(
                host="127.0.0.1",
                port=0,
                directory=directory,
                backend_url=f"http://127.0.0.1:{backend.server_port}",
                client_id="company-profile-local",
                client_secret="server-only-secret",
                subject="portal-sso-user-731",
            )
            Thread(target=client_app.serve_forever, daemon=True).start()
            self.addCleanup(client_app.server_close)
            self.addCleanup(client_app.shutdown)

            with urlopen(f"http://127.0.0.1:{client_app.server_port}/api/chat-token") as response:
                result = json.load(response)

        self.assertEqual(result["access_token"], "real-backend-token")
        self.assertEqual(
            TokenBackendHandler.request_headers["X-Chat-Client-Id"], "company-profile-local"
        )
        self.assertEqual(TokenBackendHandler.request_headers["X-Chat-Client-Secret"], "server-only-secret")
        self.assertEqual(
            TokenBackendHandler.request_body,
            {"subject": "portal-sso-user-731"},
        )


if __name__ == "__main__":
    unittest.main()
