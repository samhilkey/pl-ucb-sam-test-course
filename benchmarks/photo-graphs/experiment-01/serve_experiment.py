#!/usr/bin/env python3
"""Local-only result collector for the browser experiment; standard library."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import re

EXP = Path(__file__).resolve().parent
EVIDENCE = Path("/tmp/star-step1-20261015/evidence")
EVIDENCE.mkdir(parents=True, exist_ok=True)
RESULTS = EXP / "results/raw"
RESULTS.mkdir(parents=True, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = self.path.split("?")[0]
        match = re.fullmatch(r"/results/([a-zA-Z0-9_-]+)", route)
        if match and (RESULTS / (match[1] + '.json')).exists():
            body = (RESULTS / (match[1] + '.json')).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if route != "/catalog.json":
            self.send_error(404)
            return
        data = json.loads((EXP / "catalog.json").read_text())
        workspace = EXP.parents[2]
        for case in data["cases"]:
            if case["image"].startswith("/course/"):
                case["image"] = str(workspace / case["image"][len("/course/"):])
        data["workspace_root"] = str(workspace)
        data["evidence_dir"] = str(EVIDENCE)
        data["results_dir"] = str(RESULTS)
        data["completed"] = [p.stem for p in RESULTS.glob("*.json")]
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        match = re.fullmatch(r"/results/([a-zA-Z0-9_-]+)", self.path)
        if not match:
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length < 10_000_000:
            self.send_error(400)
            return
        value = json.loads(self.rfile.read(length))
        target = RESULTS / (match[1] + ".json")
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2) + "\n")
        temporary.replace(target)
        print("SAVED", match[1], value.get("status"), (value.get("model") or {}).get("family"), flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    print("Experiment collector on http://127.0.0.1:" + str(args.port), flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
