#!/usr/bin/env python3
"""Prepare fixed operator guides and source provenance; requires NumPy/Pillow."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import math
import subprocess

import numpy as np
from PIL import Image

EXP = Path(__file__).resolve().parent
ROOT = EXP.parent


def resample(points, step=3):
    points = np.asarray(points, dtype=float)
    arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    if arc[-1] == 0:
        return points
    locations = np.linspace(0, arc[-1], max(2, math.ceil(arc[-1] / step) + 1))
    return np.column_stack([np.interp(locations, arc, points[:, k]) for k in range(2)])


def guide(points, native_scale, seed):
    points = resample(points, max(1, 10 / native_scale))
    if len(points) > 110:
        indices = np.linspace(0, len(points) - 1, 110).round().astype(int)
        points = points[indices]
    t = np.linspace(0, 1, len(points))
    tangent = np.gradient(points, axis=0)
    length = np.linalg.norm(tangent, axis=1)
    length[length == 0] = 1
    normal = np.column_stack([-tangent[:, 1], tangent[:, 0]]) / length[:, None]
    # Reproducible rough input, not a prediction of normal student tracing.
    offset = (3 * np.sin(t * 11 + seed * 0.17)) / native_scale
    return (points + normal * offset[:, None]).round(4).tolist()


def frame_transform(points, axes, inverse=False):
    origin = np.asarray(axes["origin"], dtype=float)
    xbasis = (np.asarray(axes["x_marker"]) - origin) / axes["x_value"]
    ybasis = (np.asarray(axes["y_marker"]) - origin) / axes["y_value"]
    basis = np.column_stack([xbasis, ybasis])
    points = np.asarray(points, dtype=float)
    if inverse:
        return points @ basis.T + origin
    return np.linalg.solve(basis, (points - origin).T).T


def main():
    cases = []
    manifest = json.loads((ROOT / "synthetic/manifest.json").read_text())
    for entry in manifest["cases"]:
        ref = json.loads((ROOT / "synthetic" / entry["reference"]).read_text())
        markers = ref["calibration_markers"]
        axes = {
            "origin": markers["O"]["image_px"],
            "x_marker": markers["X"]["image_px"],
            "y_marker": markers["Y"]["image_px"],
            "x_value": 1, "y_value": 1,
        }
        branches = [b["image_pixel_points"] for b in ref["branches"]]
        cases.append({
            "id": "controlled--" + entry["id"],
            "collection": "controlled",
            "drawing_id": entry["drawing_id"],
            "variant": entry["variant"],
            "image": str((ROOT / "synthetic" / entry["image"]).resolve()),
            "image_size": ref["image_size"],
            "axes": axes,
            "axis_policy": "Known fixture marker locations and numerical graph units",
            "reference_status": "known generated centerline",
            "reference_branch_count": ref["branch_count"],
            "reference_branches": branches,
            "true_graph_branches": [b["graph_points"] for b in ref["branches"]],
            "true_features": ref["features"],
            "ideal_function": ref["ideal_function"],
            "guide_source": "known generated centerline plus fixed 3-pixel normal offset",
            "notes": ref["purpose"],
        })
    annotations = json.loads((EXP / "annotations.json").read_text())
    for entry in annotations["cases"]:
        image = (ROOT / entry["source"]).resolve()
        with Image.open(image) as im:
            size = list(im.size)
        axes = {k: entry[k] for k in ["origin", "x_marker", "y_marker", "x_value", "y_value"]}
        cases.append({
            "id": entry["id"], "collection": entry["collection"],
            "drawing_id": entry["id"], "variant": "original",
            "image": str(image), "image_size": size,
            "axes": axes, "axis_policy": entry["axis_policy"],
            "reference_status": "single-agent approximate visual annotation",
            "annotation_uncertainty_original_px": entry["estimated_annotation_uncertainty_original_px"],
            "reference_branch_count": entry["reference_branch_count"],
            "reference_branches": entry["branches"],
            "manual_guide_branches": entry.get("guide_branches"),
            "corner_px": entry.get("corner_px"),
            "guide_source": "visual centerline annotation plus fixed 3-pixel normal offset",
            "notes": entry["notes"],
        })
    for index, case in enumerate(cases):
        w, h = case["image_size"]
        scale = min(1, 900 / max(w, h))
        native_size = [round(w * scale), round(h * scale)]
        case["native_size"] = native_size
        case["native_scale_xy"] = [native_size[0] / w, native_size[1] / h]
        reference = case["reference_branches"]
        guides = case.pop("manual_guide_branches", None) or reference
        case["guide_branches"] = [guide(b, scale, index) for b in guides]
        case["reference_branches"] = [resample(b, 2 / scale).round(5).tolist() for b in reference]
        case["reference_graph_branches"] = [frame_transform(b, case["axes"]).round(6).tolist() for b in case["reference_branches"]]
        case["input_sha256"] = hashlib.sha256(Path(case["image"]).read_bytes()).hexdigest()
        case["sequence"] = index
        case["diagnostic_only"] = case["reference_branch_count"] != 1 or bool(case.get("corner_px")) or "reciprocal" in case["id"] or "absolute-value" in case["id"]
    (EXP / "catalog.json").write_text(json.dumps({"schema_version": 1, "cases": cases}, indent=2) + "\n")
    repo = ROOT.parents[1]
    source_paths = [
        "elements/pl-sketch/star-photo.js", "elements/pl-sketch/star-fit.js",
        "elements/pl-sketch/pl-sketch.js", "elements/pl-sketch/pl-sketch.py",
        "questions/star-photo-test/question.html",
    ]
    provenance = {
        "prepared_utc": datetime.now(timezone.utc).isoformat(),
        "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip(),
        "source_files": {p: hashlib.sha256((repo / p).read_bytes()).hexdigest() for p in source_paths},
        "browser_method": "Playwright CLI; Browser plugin absent",
        "operator": "automated replay with reference-guided rough tracing",
        "ui_layout_for_batch": "photo panel expanded in browser only; original layout tested separately",
        "image_count": len(cases), "drawing_count": len({c["drawing_id"] for c in cases}),
    }
    (EXP / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    # Visual overlays for checking the reference annotations before the run.
    from PIL import ImageDraw
    overlay_dir = EXP / "annotation-overlays"
    overlay_dir.mkdir(exist_ok=True)
    for case in cases:
        if case["collection"] == "controlled":
            continue
        with Image.open(case["image"]) as original:
            overlay = original.convert("RGB")
        draw = ImageDraw.Draw(overlay)
        for branch in case["reference_branches"]:
            draw.line([tuple(p) for p in branch], fill=(225, 30, 160), width=3)
        for marker in ["origin", "x_marker", "y_marker"]:
            x, y = case["axes"][marker]
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), outline=(0, 160, 220), width=2)
        overlay.save(overlay_dir / (case["id"] + ".jpg"), quality=92)
    print("Prepared", len(cases), "cases from", provenance["drawing_count"], "drawings.")


if __name__ == "__main__":
    main()
