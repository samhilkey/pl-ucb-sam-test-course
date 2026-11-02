"""Serve only the experiment and its two browser modules on loopback."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
ELEMENT = ROOT.parents[3] / "elements" / "pl-sketch"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = unquote(urlsplit(path).path)
        modules = {
            "/modules/star-geometry.js": ELEMENT / "star-geometry.js",
            "/modules/star-recognition.js": ELEMENT / "star-recognition.js",
        }
        if path in modules:
            return str(modules[path])
        candidate = (ROOT / path.lstrip("/")).resolve()
        if not candidate.is_relative_to(ROOT):
            return str(ROOT / "not-found")
        return str(candidate)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    print(f"Step 2 evidence: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
