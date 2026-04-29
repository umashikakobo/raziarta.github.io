"""Sprite server - serves from project root, saves POSTed sprites."""
import http.server, json, base64, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8090

# Change working directory to project root so SimpleHTTPRequestHandler serves from there
os.chdir(ROOT)
print(f"Serving from: {os.getcwd()}")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/save-sprites":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            saved = 0
            for item in data.get("sprites", []):
                fpath = os.path.join(ROOT, item["path"])
                os.makedirs(os.path.dirname(fpath), exist_ok=True)
                img_data = base64.b64decode(item["data"])
                with open(fpath, "wb") as f:
                    f.write(img_data)
                saved += 1
                print(f"  Saved: {item['path']}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"saved": saved}).encode())
            return
        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

print(f"Open: http://localhost:{PORT}/tools/sprite_baker.html")
sys.stdout.flush()
http.server.HTTPServer(("", PORT), Handler).serve_forever()
