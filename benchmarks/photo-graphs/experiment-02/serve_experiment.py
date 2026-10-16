#!/usr/bin/env python3
"""Replay experiment-01's immutable catalog; write only experiment-02 results."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import re

EXP = Path(__file__).resolve().parent
BASE = EXP.parent / "experiment-01"
ROOT = EXP.parents[2]
RESULTS = EXP / "results/raw"
EVIDENCE = EXP / "results/evidence"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/catalog.json":
            self.send_error(404)
            return
        data = json.loads((BASE / "catalog.json").read_text())
        for case in data["cases"]:
            case["image"] = str(ROOT / case["image"].removeprefix("/course/"))
        data["evidence_dir"] = str(EVIDENCE)
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
        target = RESULTS / (match[1] + ".json")
        if target.exists():
            self.send_error(409, "Existing observation will not be overwritten")
            return
        value = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2) + "\n")
        temporary.replace(target)
        print("SAVED", match[1], value.get("status"), flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8768)
    args = parser.parse_args()
    RESULTS.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    print("Experiment-02 collector: http://127.0.0.1:" + str(args.port), flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
