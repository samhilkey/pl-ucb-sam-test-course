"""Image-only manifest handling and provider-independent prediction validation.

This module deliberately has no reference/annotation loader.
"""
from pathlib import Path
import hashlib
import io
import json
import math
import re

import numpy as np
from jsonschema import Draft202012Validator
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
CONSISTENCY_PX = 1.0
MAX_CALIBRATION_CONDITION = 1e6


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return loads_json(Path(path).read_text())


def loads_json(text):
    return json.loads(text, parse_constant=reject_constant, object_pairs_hook=unique_keys)


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError(f"Nonfinite JSON number: {value}")


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def safe_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,150}", value):
        raise ValueError("IDs must contain only letters, digits, underscores and hyphens")
    return value


def load_manifest(path=HERE / "pilot.json"):
    path = Path(path).resolve()
    manifest = read_json(path)
    if set(manifest) != {"version", "cases"} or not manifest["cases"]:
        raise ValueError("Expected image-only manifest: version and nonempty cases")
    if not isinstance(manifest["version"], str) or not isinstance(manifest["cases"], list):
        raise ValueError("Invalid manifest version/cases")
    ids = set()
    for c in manifest["cases"]:
        if set(c) != {"id", "image", "image_size", "sha256"}:
            raise ValueError("Manifest cases may contain only id, image, image_size, sha256")
        safe_id(c["id"])
        if c["id"] in ids:
            raise ValueError("Duplicate manifest case ID")
        if Path(c["image"]).is_absolute():
            raise ValueError("Image paths must be relative to the manifest")
        if not re.fullmatch(r"[0-9a-f]{64}", c["sha256"]):
            raise ValueError("Invalid image SHA-256")
        if len(c["image_size"]) != 2 or any(type(v) is not int or v < 1 for v in c["image_size"]):
            raise ValueError("Invalid image dimensions")
        ids.add(c["id"])
        image_bytes(c, path.parent)
    return manifest


def image_bytes(case, base=HERE):
    """Verify original bytes, then strip all metadata without resizing pixels."""
    raw = (Path(base) / case["image"]).read_bytes()
    if sha256(raw) != case["sha256"]:
        raise ValueError("Image checksum mismatch")
    with Image.open(io.BytesIO(raw)) as im:
        if list(im.size) != case["image_size"]:
            raise ValueError("Image dimensions mismatch")
        # Copy pixels into a fresh image so EXIF/text/filenames do not reach the model.
        clean = Image.new("RGB", im.size)
        clean.paste(im.convert("RGB"))
        output = io.BytesIO()
        clean.save(output, format="PNG")
    return output.getvalue()


def all_points(prediction):
    for b in prediction["branches"]:
        yield from b["points"]
    yield from prediction["isolated_points"]


def validate_prediction(prediction, size, schema=None):
    schema = schema or read_json(HERE / "prediction.schema.json")
    Draft202012Validator(schema).validate(prediction)
    # JSON Schema's number type alone does not exclude NaN/infinity in Python.
    def finite(value):
        if isinstance(value, (float, int)) and not isinstance(value, bool):
            try:
                valid = math.isfinite(value)
            except OverflowError:
                valid = False
            if not valid:
                raise ValueError("Nonfinite/unrepresentable prediction number")
        if isinstance(value, dict):
            for child in value.values():
                finite(child)
        if isinstance(value, list):
            for child in value:
                finite(child)
    finite(prediction)
    w, h = size
    if prediction["image"] != {"width": w, "height": h}:
        raise ValueError("Prediction uses incorrect image dimensions")
    axes, cal = prediction["axes"], prediction["calibration"]
    locations = [p["pixel"] for p in all_points(prediction)]
    if axes["origin_px"] is not None:
        locations.append(axes["origin_px"])
    for axis in [axes["x"], axes["y"]]:
        locations.extend(axis["line_px"] or [])
        locations.extend(t["position_px"] for t in axis["tick_labels"])
    if any(not (0 <= p[0] <= w-1 and 0 <= p[1] <= h-1) for p in locations):
        raise ValueError("Pixel location outside original image")
    ids = [b["id"] for b in prediction["branches"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate branch IDs")
    for branch in prediction["branches"]:
        vertices = branch["points"]
        pixels = np.asarray([p["pixel"] for p in vertices], dtype=float)
        if np.any(np.linalg.norm(np.diff(pixels, axis=0), axis=1) <= 1e-9):
            raise ValueError("Consecutive stroke samples must be distinct; use vertex_kind for corners")
        indices = [e["point_index"] for e in branch["endpoints"]]
        if len(indices) != len(set(indices)):
            raise ValueError("Duplicate endpoint reference")
        if any(i not in {0, len(vertices)-1} for i in indices):
            raise ValueError("Endpoint must reference this stroke's first or last sample")
        if np.array_equal(pixels[0], pixels[-1]) and indices:
            raise ValueError("Closed stroke cannot have endpoints")
    x, y = cal["x_unit_vector_px"], cal["y_unit_vector_px"]
    for vector in [x, y]:
        if vector is not None and np.linalg.norm(vector) < 1e-6:
            raise ValueError("Calibration unit vector is degenerate")
    basis = None
    if x is not None and y is not None:
        basis = np.column_stack([x, y]).astype(float)
        condition = np.linalg.cond(basis)
        if not np.isfinite(condition) or condition > MAX_CALIBRATION_CONDITION:
            raise ValueError("Calibration transform is singular or ill-conditioned")
    for name in ["x", "y"]:
        axis = axes[name]
        line = axis["line_px"]
        if line is not None:
            if not axis["visible"] or np.linalg.norm(np.subtract(*line)) < 1e-6:
                raise ValueError("Detected axis line must be visible and nondegenerate")
    if cal["status"] == "reliable":
        if axes["origin_px"] is None or basis is None:
            raise ValueError("Reliable calibration requires an origin and independent unit vectors")
        origin = np.asarray(axes["origin_px"])
        for name, vector in [("x", x), ("y", y)]:
            axis = axes[name]
            if not axis["visible"] or axis["line_px"] is None:
                raise ValueError("Reliable calibration requires both visible axis lines")
            a, b = np.asarray(axis["line_px"], dtype=float)
            direction = (b-a) / np.linalg.norm(b-a)
            for point in [origin, origin+vector]:
                delta = point-a
                if np.linalg.norm(delta - np.dot(delta, direction)*direction) > CONSISTENCY_PX:
                    raise ValueError("Calibration origin/unit vector disagrees with detected axis line")
            numeric = [t for t in axis["tick_labels"] if t["value"] is not None]
            if not any(t["value"] != 0 for t in numeric):
                raise ValueError("Reliable calibration requires a nonzero numeric tick on each axis")
            for tick in numeric:
                expected = origin + tick["value"] * np.asarray(vector)
                if np.linalg.norm(expected - tick["position_px"]) > CONSISTENCY_PX:
                    raise ValueError("Numeric tick disagrees with affine calibration")
        for point in all_points(prediction):
            if point["graph"] is not None:
                expected = origin + basis @ np.asarray(point["graph"])
                if not np.all(np.isfinite(expected)) or np.linalg.norm(expected-point["pixel"]) > CONSISTENCY_PX:
                    raise ValueError("Pixel-to-graph coordinates disagree by more than 1 native pixel")
    else:
        if any(p["graph"] is not None for p in all_points(prediction)):
            raise ValueError("Graph coordinates require reliable calibration")
        if not prediction["uncertainty"]["assistance_required"]:
            raise ValueError("Uncertain calibration requires assistance")
    if prediction["uncertainty"]["assistance_required"] and not prediction["uncertainty"]["reasons"]:
        raise ValueError("Assistance requires an uncertainty reason")
    if prediction["uncertainty"]["clarification_request"] is not None and not prediction["uncertainty"]["assistance_required"]:
        raise ValueError("Clarification request requires assistance_required=true")
    if prediction["isolated_points"] and not prediction["branches"] and not prediction["uncertainty"]["assistance_required"]:
        raise ValueError("Point-only incomplete input requires assistance")
    return prediction
