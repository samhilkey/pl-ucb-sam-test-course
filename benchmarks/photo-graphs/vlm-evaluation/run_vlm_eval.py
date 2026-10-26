#!/usr/bin/env python3
"""Image-only inference; no imports or reads of evaluation references."""
import argparse
import base64
from datetime import datetime, timezone
import importlib.metadata
import json
import math
import os
from pathlib import Path
import subprocess
import time
from urllib import error, parse, request
import uuid

from jsonschema import Draft202012Validator
from common import HERE, REPO, image_bytes, load_manifest, loads_json, read_json, safe_id, sha256, validate_prediction, write_json


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def post_json(url, payload, key, timeout):
    """One request, no hidden retries. Return HTTP errors as raw evidence too."""
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    req = request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with request.build_opener(NoRedirect).open(req, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        with exc:
            return exc.code, exc.read().decode("utf-8", errors="replace")


def build_payload(case, png, prompt, schema, args):
    """Allowlist: generic prompt, schema, dimensions and metadata-free image only.

    Case IDs, paths, hashes, collections, references and equations stay local.
    """
    payload = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": prompt + "\nJSON Schema:\n" + json.dumps(schema)},
            {"role": "user", "content": [
                {"type": "text", "text": "Image width=%d height=%d pixels." % tuple(case["image_size"])},
                {"type": "image_url", "image_url": {
                    "url": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
                    "detail": args.image_detail,
                }},
            ]},
        ],
        args.token_limit_field: args.max_output_tokens,
    }
    if args.temperature is not None:
        payload["temperature"] = args.temperature
    if args.response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}
    elif args.response_format == "json_schema":
        # Provider schema dialects differ; validation is always repeated locally.
        payload["response_format"] = {"type": "json_schema", "json_schema": {
            "name": "star_graph_transcription", "schema": schema, "strict": False,
        }}
    return payload


def parse_response(envelope, size, schema):
    choice = envelope["choices"][0]
    message = choice["message"]
    if message.get("refusal"):
        raise ValueError("Model refused transcription")
    if choice.get("finish_reason") != "stop":
        raise ValueError("Incomplete response: finish_reason must be stop")
    # No code-fence removal, coercion, geometry repair or second model call.
    prediction = loads_json(message["content"])
    return validate_prediction(prediction, size, schema)


def endpoint_url(base_url):
    url = parse.urlsplit(base_url)
    if url.scheme not in {"https", "http"} or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("Base URL must be an HTTP(S) API root without credentials/query/fragment")
    if url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Remote API endpoints require HTTPS")
    return base_url.rstrip("/") + "/chat/completions"


def run(args, send=None):
    manifest_path = Path(args.manifest).resolve()
    manifest = load_manifest(manifest_path)
    selected = set(args.case or [])
    if selected - {c["id"] for c in manifest["cases"]}:
        raise ValueError("Unknown --case ID")
    cases = [c for c in manifest["cases"] if not selected or c["id"] in selected]
    prompt = Path(args.prompt).read_text()
    schema = read_json(args.schema)
    Draft202012Validator.check_schema(schema)
    url = endpoint_url(args.base_url)
    if not math.isfinite(args.timeout) or args.timeout <= 0 or args.max_output_tokens <= 0:
        raise ValueError("Timeout and token limit must be positive")
    if args.temperature is not None and (not math.isfinite(args.temperature) or not 0 <= args.temperature <= 2):
        raise ValueError("Temperature must be finite and between 0 and 2")
    if args.dry_run or not args.execute:
        for c in cases:
            png = image_bytes(c, manifest_path.parent)
            payload = build_payload(c, png, prompt, schema, args)
            print(json.dumps({"id": c["id"], "status": "dry_run_no_inference", "image_size": c["image_size"],
                              "input_sha256": c["sha256"], "transmitted_sha256": sha256(png),
                              "request_bytes": len(json.dumps(payload).encode())}))
        return 0
    if not args.model:
        raise ValueError("Set VLM_MODEL or pass --model")
    source_kind = "mock" if send is not None else "api"
    send = send or post_json
    key = os.environ.get(args.api_key_env, "")
    if not key and not args.allow_unauthenticated and source_kind == "api":
        raise ValueError("Set the credential environment variable or use --allow-unauthenticated for a local endpoint")
    if not key and source_kind == "api" and parse.urlsplit(url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Unauthenticated mode is limited to local endpoints")
    def redact(value):
        return value.replace(key, "[REDACTED]") if key else value
    run_id = safe_id(args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8])
    root = Path(args.output_root).resolve() / "predictions" / run_id
    root.mkdir(parents=True, exist_ok=False)
    for name in ["raw", "validated", "records"]:
        (root / name).mkdir()
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None
    code_files = ["run_vlm_eval.py", "common.py"]
    metadata = {
        "run_id": run_id, "source_kind": source_kind, "started_utc": datetime.now(timezone.utc).isoformat(),
        "transport": "openai-compatible-chat-completions-v1", "endpoint": url,
        "requested_model": args.model, "source_commit": commit,
        "code_sha256": {p: sha256((HERE / p).read_bytes()) for p in code_files},
        "versions": {p: importlib.metadata.version(p) for p in ["numpy", "Pillow", "jsonschema"]},
        "manifest": {"version": manifest["version"], "cases": cases},
        "manifest_sha256": sha256(manifest_path.read_bytes()),
        "prompt_file": Path(args.prompt).name, "prompt_version": prompt.splitlines()[0],
        "prompt_sha256": sha256(prompt.encode()), "prompt": prompt,
        "schema_sha256": sha256(Path(args.schema).read_bytes()), "schema": schema,
        "schema_version": schema["properties"]["schema_version"]["const"],
        "schema_canonical_sha256": sha256(json.dumps(schema, sort_keys=True).encode()),
        "settings": {k: getattr(args, k) for k in ["response_format", "max_output_tokens", "token_limit_field", "temperature", "image_detail", "timeout"]},
        "python_version": os.sys.version,
    }
    write_json(root / "run.json", metadata)
    failed = 0
    for c in cases:
        record = {"id": c["id"], "input_sha256": c["sha256"], "status": "error", "latency_ms": None,
                  "usage": None, "error": None}
        start = None
        try:
            png = image_bytes(c, manifest_path.parent)
            payload = build_payload(c, png, prompt, schema, args)
            record["transmitted_sha256"] = sha256(png)
            record["request_sha256"] = sha256(json.dumps(payload, sort_keys=True).encode())
            start = time.perf_counter()
            status, raw = send(url, payload, key, args.timeout)
            record["latency_ms"] = (time.perf_counter() - start) * 1000
            # An API should not echo credentials; redact if it does, including error bodies.
            saved_raw = redact(raw)
            (root / "raw" / (c["id"] + ".txt")).write_text(saved_raw)
            record.update(http_status=status, raw_sha256=sha256(saved_raw.encode()), raw_redacted=saved_raw != raw)
            if not 200 <= status < 300:
                record["status"] = "api_error"
                raise ValueError(f"HTTP {status}; see saved raw response")
            record["status"] = "invalid_response"
            envelope = loads_json(saved_raw)
            record.update(usage=envelope.get("usage"), returned_model=envelope.get("model"),
                          response_id=envelope.get("id"), system_fingerprint=envelope.get("system_fingerprint"))
            prediction = parse_response(envelope, c["image_size"], schema)
            dest = root / "validated" / (c["id"] + ".json")
            write_json(dest, prediction)
            record.update(status="validated", validated_sha256=sha256(dest.read_bytes()))
        except Exception as exc:
            if start is not None and record["latency_ms"] is None:
                record["latency_ms"] = (time.perf_counter() - start) * 1000
            # jsonschema exceptions may include the invalid model output; redact secrets.
            record["error"] = {"type": type(exc).__name__, "message": redact(str(exc))}
            failed += 1
        write_json(root / "records" / (c["id"] + ".json"), record)
        print(c["id"], record["status"])
    metadata.update(completed_utc=datetime.now(timezone.utc).isoformat(), failed_cases=failed)
    write_json(root / "run.json", metadata)
    print("Saved run:", root)
    return int(failed > 0)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", default=str(HERE / "pilot.json"))
    p.add_argument("--prompt", default=str(HERE / "prompts/transcribe-v1.1.txt"))
    p.add_argument("--schema", default=str(HERE / "prediction.schema.json"))
    p.add_argument("--model", default=os.environ.get("VLM_MODEL"))
    p.add_argument("--base-url", default=os.environ.get("VLM_BASE_URL", "https://api.openai.com/v1"))
    p.add_argument("--api-key-env", default="VLM_API_KEY", help="Environment variable NAME, never the credential itself")
    p.add_argument("--allow-unauthenticated", action="store_true")
    p.add_argument("--response-format", choices=["json_object", "json_schema", "none"], default="json_object")
    p.add_argument("--max-output-tokens", type=int, default=8000)
    p.add_argument("--token-limit-field", choices=["max_tokens", "max_completion_tokens"], default="max_completion_tokens")
    p.add_argument("--temperature", type=float, default=None)
    p.add_argument("--image-detail", choices=["auto", "high", "low"], default="high")
    p.add_argument("--timeout", type=float, default=180)
    p.add_argument("--case", action="append", help="Repeat to restrict the manifest")
    p.add_argument("--run-id")
    p.add_argument("--output-root", default=str(HERE))
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Default: verify requests without network or output files")
    mode.add_argument("--execute", action="store_true", help="Send requests; omit until the offline implementation is approved")
    return p


if __name__ == "__main__":
    args = parser().parse_args()
    try:
        raise SystemExit(run(args))
    except (ValueError, OSError) as exc:
        raise SystemExit(str(exc))
