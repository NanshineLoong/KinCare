import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    api_base_url = os.getenv("API_BASE_URL", "http://api:8000")

    def do_GET(self) -> None:  # noqa: N802
        body = json.dumps(
            {
                "service": "kincare-mcp-placeholder",
                "status": "ok",
                "api_base_url": self.api_base_url,
            }
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return


def main() -> None:
    port = int(os.getenv("PORT", "8081"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"KinCare MCP placeholder started on port {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
