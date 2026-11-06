#!/usr/bin/env python3
"""Fixed image-only transforms. No evaluator, reference geometry or equations."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def luminance(rgb):
    return rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)


def quantize(values):
    return np.clip(np.rint(values), 0, 255).astype(np.uint8)


def stretch(values, limits):
    lo, hi = map(float, limits)
    if hi <= lo:
        return quantize(values), {"low": lo, "high": hi, "gain": None, "degenerate": True}
    return quantize((values.astype(np.float32) - lo) * (255 / (hi - lo))), {
        "low": lo, "high": hi, "gain": 255 / (hi - lo), "degenerate": False}


def transform(rgb, condition):
    """Return same-frame RGB pixels, pixel-only diagnostics and optional background."""
    method = condition["method"]
    p = condition["parameters"]
    bg = None
    diagnostics = {}
    gray = luminance(rgb)
    if method == "identity":
        out = rgb.copy()
    elif method == "luminance":
        out = np.repeat(quantize(gray)[..., None], 3, axis=2)
    elif method == "percentile_rgb_shared_luminance_limits":
        limits = np.percentile(gray, [p["low_percentile"], p["high_percentile"]], method=p["quantile_method"])
        out, diagnostics = stretch(rgb, limits)
    elif method == "divide_by_gaussian_luminance_background":
        bg = cv2.GaussianBlur(gray, (0, 0), sigmaX=p["sigma_pixels"], borderType=cv2.BORDER_REFLECT_101)
        out = quantize(rgb.astype(np.float32) * p["target_background"] / np.maximum(bg, p["minimum_background"])[..., None])
        diagnostics = {"background_min": float(bg.min()), "background_max": float(bg.max())}
    elif method == "clahe_lab_luminance":
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        lab[..., 0] = cv2.createCLAHE(clipLimit=p["clip_limit"], tileGridSize=tuple(p["tile_grid"])).apply(lab[..., 0])
        out = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    elif method == "percentile_single_rgb_channel":
        channel = rgb[..., p["channel"]]
        limits = np.percentile(channel, [p["low_percentile"], p["high_percentile"]], method=p["quantile_method"])
        stretched, diagnostics = stretch(channel, limits)
        out = np.repeat(stretched[..., None], 3, axis=2)
    else:
        raise ValueError("Unsupported fixed transform: " + method)
    assert out.shape == rgb.shape and out.dtype == np.uint8
    diagnostics.update({"luminance_p01_p99": np.percentile(luminance(out), [1, 99]).tolist(),
                        "luminance_std": float(luminance(out).std()),
                        "channel_zero_fraction": float((out == 0).mean()),
                        "channel_255_fraction": float((out == 255).mean())})
    return out, diagnostics, bg


def run(output):
    manifest_bytes = (HERE / "inputs.json").read_bytes()
    condition_bytes = (HERE / "conditions.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    conditions = json.loads(condition_bytes)["conditions"]
    if set(manifest) != {"version", "cases"}:
        raise ValueError("Expected image-only manifest")
    # Freeze parameter/code identities in the run before recognition/evaluation.
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    for case in manifest["cases"]:
        if set(case) != {"id", "image", "image_size", "sha256"}:
            raise ValueError("Reference/solution fields are forbidden in preprocessing")
        source = (HERE / case["image"]).resolve()
        raw = source.read_bytes()
        if sha(raw) != case["sha256"]:
            raise ValueError("Input hash mismatch")
        with Image.open(source) as im:
            rgb = np.array(im.convert("RGB"))
        if list(rgb.shape[1::-1]) != case["image_size"]:
            raise ValueError("Input dimensions changed")
        folder = output / case["id"]
        folder.mkdir()
        shutil.copyfile(source, folder / "before.png")
        for condition in conditions:
            dest = folder / condition["id"]
            dest.mkdir()
            started = time.perf_counter()
            pixels, diagnostics, bg = transform(rgb, condition)
            elapsed = (time.perf_counter() - started) * 1000
            if condition["id"] == "original":
                shutil.copyfile(source, dest / "image.png")
            else:
                Image.fromarray(pixels).save(dest / "image.png", format="PNG")
            if bg is not None:
                Image.fromarray(quantize(bg)).save(dest / "background-estimate.png")
            rows.append({"id": case["id"], "condition": condition["id"],
                         "image": str((dest / "image.png").relative_to(output)),
                         "original": str((folder / "before.png").relative_to(output)),
                         "source_sha256": case["sha256"], "image_size": case["image_size"],
                         "image_sha256": sha((dest / "image.png").read_bytes()),
                         "transform": condition, "transform_diagnostics": diagnostics,
                         "transform_duration_ms": elapsed})
    record = {"experiment": "contrast-01", "stage": "image_only_preprocessing",
              "conditions_sha256": sha(condition_bytes), "inputs_sha256": sha(manifest_bytes),
              "preprocess_code_sha256": sha(Path(__file__).read_bytes()),
              "versions": {"python": sys.version, "opencv": cv2.__version__, "numpy": np.__version__, "Pillow": Image.__version__},
              "spatial_transform": "identity; same source dimensions and pixel centers",
              "reference_geometry_read": False, "rows": rows}
    (output / "preprocessing.json").write_text(json.dumps(record, indent=2) + "\n")
    print(f"Prepared {len(rows)} fixed-condition inputs; no references or inference.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New run directory; never overwritten")
    run(parser.parse_args().output.resolve())
