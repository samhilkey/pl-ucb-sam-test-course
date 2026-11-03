"""Read-only loopback gallery; original inputs remain in the step-2 archive."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
INPUTS = ROOT.parent / "experiment-01" / "inputs"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = unquote(urlsplit(path).path)
        base = INPUTS if path.startswith("/inputs/") else ROOT
        relative = path[len("/inputs/"):] if base == INPUTS else path.lstrip("/")
        candidate = (base / relative).resolve()
        return str(candidate if candidate.is_relative_to(base) else ROOT / "not-found")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    print(f"Native import evidence: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
