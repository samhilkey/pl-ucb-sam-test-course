#!/usr/bin/env python3
"""Offline reference evaluation. This module never calls a model or provider."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from jsonschema import ValidationError

from common import HERE, all_points, load_manifest, read_json, safe_id, sha256, validate_prediction, write_json
from geometry import compare, graph_coordinates, stroke_plan


def load_references(policy_path, manifest):
    policy_path = Path(policy_path).resolve()
    policy = read_json(policy_path)
    for field in ["reference_catalog", "reference_annotations"]:
        ref = policy[field]
        if Path(ref["path"]).is_absolute():
            raise ValueError("Reference paths must be relative to the policy")
        if sha256((policy_path.parent / ref["path"]).read_bytes()) != ref["sha256"]:
            raise ValueError("Reference checksum changed: " + field)
    catalog = read_json(policy_path.parent / policy["reference_catalog"]["path"])
    references = {c["id"]: c for c in catalog["cases"]}
    policies = {c["id"]: c for c in policy["cases"]}
    if len(policies) != len(policy["cases"]) or set(policies) != {c["id"] for c in manifest["cases"]}:
        raise ValueError("Policy must cover each manifest case exactly once")
    for case in manifest["cases"]:
        ref, rule = references[case["id"]], policies[case["id"]]
        if ref["input_sha256"] != case["sha256"] or ref["image_size"] != case["image_size"]:
            raise ValueError("Reference image identity does not match manifest")
        if (rule["diagnostic_only"] or rule.get("reference_verification_required")) and any(rule["scoring"].values()):
            raise ValueError("Unverified diagnostic reference must not enter quantitative scoring")
    return policy, references, policies


def qualitative(prediction, rule):
    """Observed output is factual; preservation/invention requires photo review."""
    result = {
        "diagnostic_only": rule["diagnostic_only"], "review_status": "pending",
        "isolated_points_preserved": "unverified", "invented_connecting_curves": "unverified",
        "drawing_errors_preserved": "unverified", "reviewer_notes": "",
        "isolated_points_reported": None, "curve_branches_reported": None,
        "point_only_output": None, "connecting_curve_proposed": None,
        "clarification_requested": None, "clarification_request": None, "assistance_required": None,
        "uncertainty_reasons_json": None, "model_confidence": None, "review_focus": rule.get("review_focus", ""),
    }
    if prediction is not None:
        points, curves = len(prediction["isolated_points"]), len(prediction["branches"])
        uncertainty = prediction["uncertainty"]
        result.update(isolated_points_reported=points, curve_branches_reported=curves,
                      point_only_output=bool(points and not curves), connecting_curve_proposed=bool(curves),
                      clarification_requested=uncertainty["clarification_request"] is not None,
                      clarification_request=uncertainty["clarification_request"],
                      assistance_required=uncertainty["assistance_required"],
                      uncertainty_reasons_json=json.dumps(uncertainty["reasons"]), model_confidence=uncertainty["confidence"])
    return result


def empty_metrics(ref, rule):
    return {
        "expected_branches": ref["reference_branch_count"] if rule["scoring"]["branch_count"] else None,
        "predicted_branches": None, "branch_count_match": None,
        "bidirectional_p95_native_px": None, "bidirectional_p95_900px": None,
        "reference_to_prediction_p95_900px": None, "prediction_to_reference_p95_900px": None,
        "reference_coverage_10px_at_900": None, "geometry_fidelity_pass": None,
        "origin_error_native_px": None, "x_unit_error_native_px": None, "y_unit_error_native_px": None,
        "calibration_p95_graph_units": None, "reported_graph_coordinate_p95_error": None,
        "corner_vertices_reported": None,
        "reference_corner_recall_10px_at_900": None,
        "calibration_status": None, "assistance_required": None,
    }


def score_prediction(prediction, ref, rule):
    scale = 900 / max(ref["image_size"])
    predicted = [[p["pixel"] for p in b["points"]] for b in prediction["branches"]]
    row = empty_metrics(ref, rule)
    row.update(predicted_branches=len(predicted),
               corner_vertices_reported=sum(p["vertex_kind"] == "corner" for b in prediction["branches"] for p in b["points"]),
               calibration_status=prediction["calibration"]["status"],
               assistance_required=prediction["uncertainty"]["assistance_required"])
    if rule["scoring"]["branch_count"]:
        row["branch_count_match"] = len(predicted) == ref["reference_branch_count"]
    if rule["scoring"]["curve_geometry"]:
        reference = [np.asarray(b)*scale for b in ref["reference_branches"]]
        metrics = compare(reference, [np.asarray(b)*scale for b in predicted])
        p95 = metrics.get("bidirectional_p95")
        row.update(bidirectional_p95_900px=p95, bidirectional_p95_native_px=p95/scale if p95 is not None else None,
                   reference_to_prediction_p95_900px=metrics.get("reference_to_output_p95"),
                   prediction_to_reference_p95_900px=metrics.get("output_to_reference_p95"),
                   reference_coverage_10px_at_900=metrics.get("reference_coverage"),
                   geometry_fidelity_pass=bool(p95 is not None and p95 <= 10 and metrics["reference_coverage"] >= 0.9))
    if rule["scoring"]["numeric_axes"]:
        axes, cal = prediction["axes"], prediction["calibration"]
        origin = axes["origin_px"]
        known_origin = np.asarray(ref["axes"]["origin"])
        if origin is not None:
            row["origin_error_native_px"] = float(np.linalg.norm(origin-known_origin))
        for name in ["x", "y"]:
            vector = cal[name+"_unit_vector_px"]
            if vector is not None:
                known = (np.asarray(ref["axes"][name+"_marker"])-known_origin)/ref["axes"][name+"_value"]
                row[name+"_unit_error_native_px"] = float(np.linalg.norm(vector-known))
        if cal["status"] == "reliable":
            basis = np.column_stack([cal["x_unit_vector_px"], cal["y_unit_vector_px"]])
            pixels = np.concatenate(ref["reference_branches"])
            inferred = np.linalg.solve(basis, (pixels-origin).T).T
            row["calibration_p95_graph_units"] = float(np.percentile(np.linalg.norm(inferred-graph_coordinates(pixels, ref["axes"]), axis=1), 95))
            points = [p for p in all_points(prediction) if p["graph"] is not None]
            if points:
                known = graph_coordinates([p["pixel"] for p in points], ref["axes"])
                row["reported_graph_coordinate_p95_error"] = float(np.percentile(np.linalg.norm(known-[p["graph"] for p in points], axis=1), 95))
        corners = [f["image_px"] for f in ref.get("true_features", []) if "corner" in f["kind"]]
        found = [p["pixel"] for b in prediction["branches"] for p in b["points"] if p["vertex_kind"] == "corner"]
        if corners:
            row["reference_corner_recall_10px_at_900"] = float(np.mean(np.linalg.norm(np.asarray(corners)[:, None, :]-np.asarray(found)[None, :, :], axis=2).min(axis=1)*scale <= 10)) if found else 0.0
    return row


def overlay(image_path, destination, case, ref, rule, prediction, status, source_kind):
    """Original / reference / prediction triptych; each branch drawn separately."""
    with Image.open(image_path) as original:
        photo = original.convert("RGB")
    photo.thumbnail((420, 560))
    width, height = photo.size
    factors = np.asarray(photo.size) / case["image_size"]
    panels = [photo.copy() for _ in range(3)]
    def coords(points):
        return [tuple(p) for p in np.asarray(points)*factors]
    draw = ImageDraw.Draw(panels[1])
    for branch in ref["reference_branches"]:
        draw.line(coords(branch), fill="#df208f", width=3)
    if prediction is not None:
        draw = ImageDraw.Draw(panels[2])
        for branch in prediction["branches"]:
            draw.line(coords([p["pixel"] for p in branch["points"]]), fill="#e88100", width=3)
            for point in branch["points"]:
                if point["vertex_kind"] == "corner":
                    x, y = np.asarray(point["pixel"])*factors
                    draw.polygon([(x,y-5),(x+5,y),(x,y+5),(x-5,y)], fill="#d00000")
            for endpoint in branch["endpoints"]:
                x, y = np.asarray(branch["points"][endpoint["point_index"]]["pixel"])*factors
                draw.ellipse((x-4,y-4,x+4,y+4), outline="#225bdf", width=2)
        for point in prediction["isolated_points"]:
            x, y = np.asarray(point["pixel"])*factors
            draw.ellipse((x-4,y-4,x+4,y+4), outline="#00a0b0", width=3)
    result = Image.new("RGB", (3*width, height+115), "white")
    font = ImageFont.load_default(size=14)
    labels = ["Original photo", "Reference" + (" (unverified)" if rule["diagnostic_only"] else " (approximate)" if rule["collection"] != "controlled" else " (known centerline)"), "Prediction: " + status]
    for i, panel in enumerate(panels):
        result.paste(panel, (i*width, 35))
        ImageDraw.Draw(result).text((i*width+5, 8), labels[i], font=font, fill="black")
    d = ImageDraw.Draw(result)
    prefix = "MOCK TEST ONLY - no model inference | " if source_kind == "mock" else "VLM output | "
    d.text((5, height+42), prefix+case["id"], font=font, fill="black")
    d.text((5, height+64), "Reference: magenta | Prediction: orange | Isolated points: cyan | Corners: red | Endpoints: blue", font=font, fill="black")
    if rule["diagnostic_only"]:
        d.text((5, height+86), "Qualitative review required. No verified point/curve reference; excluded from accuracy denominators.", font=font, fill="black")
    result.save(destination)


def write_csv(path, rows):
    fields = list(dict.fromkeys(k for row in rows for k in row))
    with Path(path).open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def evaluate(run_id, output_root=HERE, manifest_path=HERE / "pilot.json", policy_path=HERE / "evaluation-policy.json", report_id=None, allow_mock=False):
    safe_id(run_id)
    report_id = safe_id(report_id or run_id)
    output_root = Path(output_root).resolve()
    manifest_path = Path(manifest_path).resolve()
    manifest = load_manifest(manifest_path)
    policy, references, policies = load_references(policy_path, manifest)
    run_root = output_root / "predictions" / run_id
    metadata = read_json(run_root / "run.json")
    schema = metadata["schema"]
    if sha256(json.dumps(schema, sort_keys=True).encode()) != metadata["schema_canonical_sha256"]:
        raise ValueError("Saved schema snapshot checksum mismatch")
    if metadata["source_kind"] not in {"api", "mock"} or metadata["schema_version"] != "1.1":
        raise ValueError("Unsupported source kind or schema version")
    if metadata["source_kind"] == "mock" and not allow_mock:
        raise ValueError("Mock run is not recognition evidence; use --allow-mock only for offline diagnostics")
    selected = metadata["manifest"]["cases"]
    manifest_by_id = {c["id"]: c for c in manifest["cases"]}
    if len({c["id"] for c in selected}) != len(selected) or not selected:
        raise ValueError("Run manifest has duplicate or missing cases")
    for case in selected:
        safe_id(case["id"])
        current = manifest_by_id.get(case["id"])
        if current is None or current["sha256"] != case["sha256"] or current["image_size"] != case["image_size"]:
            raise ValueError("Run image identity differs from evaluation manifest")
    report_dir = output_root / "reports" / report_id
    overlay_dir = output_root / "overlays" / report_id
    if report_dir.exists() or overlay_dir.exists():
        raise ValueError("Report already exists; use a new --report-id to preserve review edits")
    report_dir.mkdir(parents=True)
    overlay_dir.mkdir(parents=True)
    rows, review_rows, plans = [], [], {}
    for saved_case in selected:
        case = manifest_by_id[saved_case["id"]]
        ident = case["id"]
        rule, ref = policies[ident], references[ident]
        row = {"id": ident, "source_kind": metadata["source_kind"], "collection": rule["collection"],
               "reference_status": rule["reference_status"], "diagnostic_only": rule["diagnostic_only"],
               "annotation_uncertainty_original_px": rule.get("annotation_uncertainty_original_px"),
               "status": "not_run", "error": None}
        row.update(empty_metrics(ref, rule))
        prediction = None
        record_path = run_root / "records" / (ident+".json")
        if record_path.exists():
            try:
                record = read_json(record_path)
                row.update(status=record["status"], latency_ms=record["latency_ms"], usage_json=json.dumps(record["usage"]), error=json.dumps(record["error"]) if record["error"] else None)
                if record["id"] != ident or record["input_sha256"] != case["sha256"]:
                    raise ValueError("Record/image identity mismatch")
                if record["status"] == "validated":
                    path = run_root / "validated" / (ident+".json")
                    if sha256(path.read_bytes()) != record["validated_sha256"]:
                        raise ValueError("Validated prediction checksum changed")
                    candidate = read_json(path)
                    validate_prediction(candidate, case["image_size"], schema)
                    prediction = candidate
                    row.update(score_prediction(prediction, ref, rule))
                    plans[ident] = stroke_plan(prediction)
            except (ValueError, ValidationError, KeyError, OSError) as exc:
                row.update(status="artifact_error", error=str(exc))
                prediction = None
        review = {"id": ident, "source_kind": metadata["source_kind"], **qualitative(prediction, rule)}
        review_rows.append(review)
        row["is_real_recognition"] = metadata["source_kind"] == "api" and row["status"] == "validated"
        row.update({k: review[k] for k in ["isolated_points_reported", "connecting_curve_proposed", "clarification_requested", "clarification_request"]})
        row["overlay"] = "../../overlays/"+report_id+"/"+ident+".png"
        overlay(manifest_path.parent/case["image"], overlay_dir/(ident+".png"), case, ref, rule, prediction, row["status"], metadata["source_kind"])
        rows.append(row)
    groups = {}
    for collection in sorted({r["collection"] for r in rows}):
        subset = [r for r in rows if r["collection"] == collection]
        eligible = [r for r in subset if not r["diagnostic_only"]]
        groups[collection] = {"selected": len(subset), "quantitative_eligible": len(eligible),
                              "validated": sum(r["status"] == "validated" for r in subset),
                              "geometry_scored": sum(r.get("geometry_fidelity_pass") is not None for r in eligible),
                              "geometry_pass": sum(r.get("geometry_fidelity_pass") is True for r in eligible),
                              "unscored_missing_or_invalid": sum(r["status"] != "validated" for r in eligible)}
    summary = {"run_id": run_id, "report_id": report_id, "source_kind": metadata["source_kind"],
               "generated_utc": datetime.now(timezone.utc).isoformat(), "status_counts": dict(Counter(r["status"] for r in rows)),
               "groups": groups if metadata["source_kind"] == "api" else {},
               "mock_groups": groups if metadata["source_kind"] == "mock" else {},
               "real_recognition_cases": sum(r["is_real_recognition"] for r in rows),
               "rows": rows, "qualitative": review_rows,
               "model": metadata["requested_model"], "prompt_sha256": metadata["prompt_sha256"],
               "policy_sha256": sha256(Path(policy_path).read_bytes()), "reference_hashes": {k: policy[k] for k in ["reference_catalog", "reference_annotations"]},
               "evaluation_code_sha256": {p: sha256((HERE/p).read_bytes()) for p in ["evaluate.py", "geometry.py", "common.py"]},
               "geometry_sources": {p: sha256((HERE.parent/"experiment-01"/p).read_bytes()) for p in ["analyze_results.py", "prepare_cases.py"]}}
    write_csv(report_dir / "results.csv", rows)
    write_csv(report_dir / "qualitative-review.csv", review_rows)
    write_json(report_dir / "summary.json", summary)
    write_json(report_dir / "stroke-plans.json", {"source_kind": metadata["source_kind"], "format": "offline_breakpoint_plan_not_native_PL_state", "cases": plans})
    title = "MOCK TEST ONLY - no model inference" if metadata["source_kind"] == "mock" else "VLM pilot evaluation"
    lines = ["# "+title, "", "Run: `"+run_id+"`. Results are separated by collection; sparse-point judgments require photo review.", "", "| Case | Status | Geometry pass | Overlay |", "| --- | --- | --- | --- |"]
    for row in rows:
        flag = row["geometry_fidelity_pass"] if row["geometry_fidelity_pass"] is not None else "unscored"
        lines.append(f"| {row['id']} | {row['status']} | {flag} | [view]({row['overlay']}) |")
    lines.extend(["", "`qualitative-review.csv` records observed point/curve output and clarification requests. Preservation/invention judgments remain unverified for manual review.", "", "Calibration is affine only; perspective-distorted photos can remain pixel-evaluable while graph units are unavailable.", ""])
    (report_dir / "REPORT.md").write_text("\n".join(lines))
    print("Saved offline report:", report_dir)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-root", default=str(HERE))
    parser.add_argument("--manifest", default=str(HERE/"pilot.json"))
    parser.add_argument("--policy", default=str(HERE/"evaluation-policy.json"))
    parser.add_argument("--report-id")
    parser.add_argument("--allow-mock", action="store_true", help="Offline diagnostics only; mock metrics never populate real recognition groups")
    args = parser.parse_args()
    evaluate(args.run_id, args.output_root, args.manifest, args.policy, args.report_id, args.allow_mock)
