#!/usr/bin/env python3
"""Generate deterministic graph-photo fixtures and their geometric references.

Requires Pillow and NumPy. Both are available in the running PrairieLearn image.
This generator does not read or modify the real student-work images.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, __version__ as pillow_version


SIZE = 1200
ORIGIN = np.array([600.0, 600.0])
UNIT = 100.0
SUPER_SAMPLE = 2
SEED = 20261015


def feature(kind, x, y, label, offset=(18, 18)):
    return {"kind": kind, "graph": [x, y], "label": label, "label_offset_px": list(offset)}


CASES = [
    {
        "id": "01-line",
        "title": "Straight line",
        "expression": "0.5*x + 1",
        "function": lambda x: 0.5 * x + 1,
        "domains": [[-4.4, 4.4]],
        "features": [feature("x_intercept", -2, 0, "(-2, 0)", (-97, 20)), feature("y_intercept", 0, 1, "(0, 1)")],
        "purpose": "Basic calibration, slope, and intercept preservation",
    },
    {
        "id": "02-parabola",
        "title": "Parabola",
        "expression": "x**2",
        "function": lambda x: x**2,
        "domains": [[-2.1, 2.1]],
        "features": [feature("minimum", 0, 0, "(0, 0)")],
        "purpose": "Smooth curve; compatible with the existing x**2 grading target",
    },
    {
        "id": "03-shifted-parabola",
        "title": "Deliberately shifted vertex",
        "expression": "x**2 + 1",
        "function": lambda x: x**2 + 1,
        "domains": [[-1.9, 1.9]],
        "features": [feature("minimum", 0, 1, "(0, 1)")],
        "purpose": "Preserve a shifted vertex instead of correcting it to the question's answer",
        "instructor_target_for_error_preservation_test": "x**2",
    },
    {
        "id": "04-absolute-value",
        "title": "V-shaped graph",
        "expression": "abs(x) - 1",
        "function": lambda x: np.abs(x) - 1,
        "domains": [[-4.2, 4.2]],
        "features": [feature("corner_minimum", 0, -1, "(0, -1)"), feature("x_intercept", -1, 0, "(-1, 0)", (-110, -38))],
        "purpose": "Preserve a sharp corner instead of smoothing it into a parabola",
    },
    {
        "id": "05-cubic",
        "title": "Maximum and minimum",
        "expression": "x**3 - 3*x",
        "function": lambda x: x**3 - 3 * x,
        "domains": [[-2.2, 2.2]],
        "features": [feature("local_maximum", -1, 2, "(-1, 2)", (-103, -39)), feature("local_minimum", 1, -2, "(1, -2)")],
        "purpose": "Preserve both turning points and their locations",
    },
    {
        "id": "06-reciprocal",
        "title": "Two separate branches",
        "expression": "2/x",
        "function": lambda x: 2 / x,
        "domains": [[-4.4, -0.45], [0.45, 4.4]],
        "features": [feature("labeled_point", -1, -2, "(-1, -2)", (-125, 18)), feature("labeled_point", 1, 2, "(1, 2)")],
        "asymptotes": [{"kind": "vertical", "x": 0}, {"kind": "horizontal", "y": 0}],
        "purpose": "Preserve two branches and the gap at x=0; known limitation of the current single-stroke fitter",
    },
]

VARIANTS = [
    {"id": "clean", "corners": [[0, 0], [1199, 0], [1199, 1199], [0, 1199]], "brightness": 1.0, "shadow": 0.0, "blur_px": 0.0, "jpeg_quality": 96},
    {"id": "perspective", "corners": [[90, 115], [1110, 35], [1160, 1105], [40, 1160]], "brightness": 0.98, "shadow": 0.0, "blur_px": 0.2, "jpeg_quality": 92},
    {"id": "shadow", "corners": [[0, 0], [1199, 0], [1199, 1199], [0, 1199]], "brightness": 0.94, "shadow": 0.38, "blur_px": 0.25, "jpeg_quality": 90},
    {"id": "blur-dim", "corners": [[45, 55], [1150, 80], [1130, 1165], [65, 1135]], "brightness": 0.79, "shadow": 0.12, "blur_px": 1.25, "jpeg_quality": 65},
]


def font(size, italic=False):
    names = ["DejaVuSans-Oblique.ttf", "DejaVuSans.ttf"] if italic else ["DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def paper_pixels(points):
    pts = np.asarray(points, dtype=float)
    return ORIGIN + pts * [UNIT, -UNIT]


def project(points, matrix):
    pts = np.asarray(points, dtype=float)
    homogeneous = np.column_stack([pts, np.ones(len(pts))]) @ matrix.T
    return homogeneous[:, :2] / homogeneous[:, 2:]


def homography(corners):
    source = [[0, 0], [SIZE - 1, 0], [SIZE - 1, SIZE - 1], [0, SIZE - 1]]
    rows, values = [], []
    for (x, y), (u, v) in zip(source, corners):
        rows.extend([[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]])
        values.extend([u, v])
    return np.append(np.linalg.solve(rows, values), 1.0).reshape(3, 3)


def make_drawing(case, seed):
    """Record the actual jittered centerline, distinct from its ideal function."""
    rng = np.random.default_rng(seed)
    branches = []
    for lo, hi in case["domains"]:
        # Include exact feature x values so corners and labeled points survive sampling.
        extra_x = [f["graph"][0] for f in case["features"] if lo <= f["graph"][0] <= hi]
        xs = np.unique(np.concatenate([np.linspace(lo, hi, 441), extra_x]))
        ys = case["function"](xs)
        pixels = paper_pixels(np.column_stack([xs, ys]))
        t = np.linspace(0, 1, len(xs))
        phase = rng.uniform(0, 2 * math.pi, 4)
        jitter = np.column_stack([
            0.55 * np.sin(t * 31 + phase[0]) + 0.30 * np.sin(t * 79 + phase[1]),
            0.70 * np.sin(t * 39 + phase[2]) + 0.35 * np.sin(t * 91 + phase[3]),
        ])
        damping = np.ones(len(xs))
        for f in case["features"]:
            if lo <= f["graph"][0] <= hi:
                damping *= 1 - np.exp(-((xs - f["graph"][0]) / 0.10) ** 2)
        pixels += jitter * damping[:, None]
        actual_graph = (pixels - ORIGIN) / [UNIT, -UNIT]
        branches.append({"graph_points": actual_graph, "paper_pixel_points": pixels})
    return branches


def draw_paper(case, branches, seed):
    scale = SUPER_SAMPLE
    canvas = Image.new("RGB", (SIZE * scale, SIZE * scale), (248, 246, 237))
    draw = ImageDraw.Draw(canvas)

    def line(points, fill, width):
        draw.line([(float(x * scale), float(y * scale)) for x, y in points], fill=fill, width=max(1, round(width * scale)))

    def text(x, y, value, size=23, fill=(72, 69, 64), anchor=None):
        draw.text((x * scale, y * scale), value, font=font(round(size * scale), italic=True), fill=fill, anchor=anchor)

    for pos in np.arange(100, 1101, 50):
        major = pos % 100 == 0
        color = (187, 202, 211) if major else (219, 226, 226)
        line([(pos, 100), (pos, 1100)], color, 0.8 if major else 0.5)
        line([(100, pos), (1100, pos)], color, 0.8 if major else 0.5)
    line([(100, 600), (1125, 600)], (74, 70, 63), 2.1)
    line([(600, 1100), (600, 75)], (74, 70, 63), 2.1)
    line([(1110, 592), (1125, 600), (1110, 608)], (74, 70, 63), 2.1)
    line([(592, 90), (600, 75), (608, 90)], (74, 70, 63), 2.1)
    for value in range(-4, 5):
        if value == 0:
            continue
        x, y = 600 + value * UNIT, 600 - value * UNIT
        line([(x, 594), (x, 606)], (82, 77, 69), 1.5)
        line([(594, y), (606, y)], (82, 77, 69), 1.5)
        text(x, 619, str(value), 23, anchor="mt")
        text(578, y, str(value), 23, anchor="rm")
    text(578, 625, "0", 23)
    text(1137, 597, "x", 34, anchor="lm")
    text(601, 51, "y", 34, anchor="mm")

    for branch in branches:
        # A faint wider stroke and narrower core approximate pencil ink without
        # changing the known centerline or joining separate branches.
        line(branch["paper_pixel_points"], (139, 134, 124), 3.6)
        line(branch["paper_pixel_points"], (53, 50, 45), 2.2)
    for f in case["features"]:
        px, py = paper_pixels([f["graph"]])[0]
        r = 3.4 * scale
        draw.ellipse((px * scale - r, py * scale - r, px * scale + r, py * scale + r), fill=(59, 54, 48))
        dx, dy = f["label_offset_px"]
        text(px + dx, py + dy, f["label"], 25)

    canvas = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    pixels = np.asarray(canvas, dtype=float).copy()
    rng = np.random.default_rng(seed)
    texture = rng.normal(0, 0.8, (SIZE, SIZE, 1))
    pixels = np.clip(pixels + texture, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels)


def camera_image(paper, variant, matrix, seed):
    inverse = np.linalg.inv(matrix)
    inverse /= inverse[2, 2]
    warped = paper.transform((SIZE, SIZE), Image.Transform.PERSPECTIVE, tuple(inverse.flat)[:8], resample=Image.Resampling.BICUBIC, fillcolor=(101, 87, 70))
    pixels = np.asarray(warped, dtype=float).copy()
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    # Soft diagonal edge and a broad cast shadow; geometry remains unchanged.
    diagonal = 1 / (1 + np.exp((xx - 0.62 * yy - 120) / 43))
    patch = np.exp(-(((xx - 900) / 480) ** 2 + ((yy - 240) / 390) ** 2))
    shade = variant["brightness"] * (1 - variant["shadow"] * (0.7 * diagonal + 0.3 * patch))
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 0.55 if variant["id"] == "clean" else 1.2, (SIZE, SIZE, 1))
    pixels = np.clip(pixels * shade[:, :, None] + noise, 0, 255).astype(np.uint8)
    output = Image.fromarray(pixels)
    if variant["blur_px"]:
        output = output.filter(ImageFilter.GaussianBlur(variant["blur_px"]))
    return output


def rounded(points):
    return np.asarray(points).round(6).tolist()


def reference(case, branches, variant, matrix, image_name, seed):
    inv = np.linalg.inv(matrix)
    inv /= inv[2, 2]
    markers = {"O": [0, 0], "X": [1, 0], "Y": [0, 1]}
    scale = min(1, 900 / SIZE)  # Current StarPhoto.showPhoto downscaling.
    result = {
        "schema_version": 1,
        "source_type": "programmatically_generated_synthetic",
        "original_drawing_id": case["id"],
        "variant": variant["id"],
        "image": "../images/" + image_name,
        "seed": seed,
        "purpose": case["purpose"],
        "ideal_function": case["expression"],
        "domains": case["domains"],
        "branch_count": len(branches),
        "asymptotes": case.get("asymptotes", []),
        "image_size": [SIZE, SIZE],
        "paper_graph_frame": {"origin_px": ORIGIN.tolist(), "pixels_per_x_unit": UNIT, "pixels_per_y_unit": UNIT, "y_pixels_increase_downward": True, "x_range": [-5, 5], "y_range": [-5, 5]},
        "camera": {**variant, "paper_to_image_homography": matrix.tolist(), "image_to_paper_homography": inv.tolist()},
        "calibration_markers": {},
        "features": [],
        "branches": [],
        "reference_limits": "Points describe the drawn stroke centerline before rasterization. Stroke width, anti-aliasing, blur, JPEG compression, and feature-label ink are not separate segmentation masks. Ideal function and actual jittered geometry are distinct.",
        "star_preview": {"scale": scale, "size": [round(SIZE * scale), round(SIZE * scale)], "note": "Marker positions below account for the current 900-pixel longest-edge image resize, not CSS display scaling."},
    }
    if "instructor_target_for_error_preservation_test" in case:
        result["instructor_target_for_error_preservation_test"] = case["instructor_target_for_error_preservation_test"]
    for name, graph in markers.items():
        paper_point = paper_pixels([graph])
        image_point = project(paper_point, matrix)[0]
        result["calibration_markers"][name] = {"graph": graph, "paper_px": rounded(paper_point[0]), "image_px": rounded(image_point), "star_preview_px": rounded(image_point * scale)}
    for f in case["features"]:
        image_point = project(paper_pixels([f["graph"]]), matrix)[0]
        result["features"].append({**f, "image_px": rounded(image_point), "star_preview_px": rounded(image_point * scale)})
    for branch in branches:
        image_points = project(branch["paper_pixel_points"], matrix)
        result["branches"].append({"graph_points": rounded(branch["graph_points"]), "paper_pixel_points": rounded(branch["paper_pixel_points"]), "image_pixel_points": rounded(image_points), "star_preview_pixel_points": rounded(image_points * scale)})
        assert np.max(np.abs(project(image_points, inv) - branch["paper_pixel_points"])) < 1e-6
        assert np.isfinite(image_points).all()
        assert (image_points >= 0).all() and (image_points < SIZE).all()
    assert np.max(np.abs(project(np.array([[0, 0], [1199, 0], [1199, 1199], [0, 1199]]), matrix) - variant["corners"])) < 1e-6
    return result


def contact_sheet(root, entries):
    cell_w, cell_h = 340, 395
    sheet = Image.new("RGB", (4 * cell_w, 6 * cell_h + 80), "#f0eee8")
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), "STAR synthetic graph fixtures", fill="#252525", font=font(28))
    draw.text((20, 49), "Code-generated images; each row is one drawing with four camera variants.", fill="#555555", font=font(17))
    for i, item in enumerate(entries):
        x, y = (i % 4) * cell_w + 10, (i // 4) * cell_h + 90
        with Image.open(root / item["image"]) as im:
            im.thumbnail((320, 320), Image.Resampling.LANCZOS)
            sheet.paste(im, (x, y))
        draw.text((x, y + 329), item["drawing_id"], fill="#252525", font=font(18))
        draw.text((x, y + 353), item["variant"], fill="#555555", font=font(17))
    sheet.save(root / "contact-sheet.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent / "synthetic")
    args = parser.parse_args()
    root = args.output_dir
    (root / "images").mkdir(parents=True, exist_ok=True)
    (root / "references").mkdir(parents=True, exist_ok=True)
    entries = []
    for index, case in enumerate(CASES):
        seed = SEED + index * 100
        branches = make_drawing(case, seed)
        paper = draw_paper(case, branches, seed)
        for variant_index, variant in enumerate(VARIANTS):
            photo_seed = seed + variant_index + 1
            stem = case["id"] + "--" + variant["id"]
            image_name = stem + ".jpg"
            matrix = homography(variant["corners"])
            photo = camera_image(paper, variant, matrix, photo_seed)
            image_path = root / "images" / image_name
            photo.save(image_path, quality=variant["jpeg_quality"], subsampling=0)
            with Image.open(image_path) as check:
                check.verify()
            data = reference(case, branches, variant, matrix, image_name, photo_seed)
            data["image_sha256"] = hashlib.sha256(image_path.read_bytes()).hexdigest()
            reference_path = root / "references" / (stem + ".json")
            reference_path.write_text(json.dumps(data, indent=2) + "\n")
            entries.append({"id": stem, "drawing_id": case["id"], "title": case["title"], "variant": variant["id"], "image": "images/" + image_name, "reference": "references/" + reference_path.name, "sha256": data["image_sha256"], "branch_count": len(branches)})
    manifest = {"schema_version": 1, "kind": "synthetic_graph_photo_fixtures", "seed": SEED, "generator": "../generate_synthetic.py", "dependencies": {"Pillow": pillow_version, "numpy": np.__version__}, "image_count": len(entries), "original_drawing_count": len(CASES), "split_policy": "Keep all variants of an original_drawing_id in the same evaluation split; 24 images are six drawings, not 24 independent drawings.", "cases": entries}
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    contact_sheet(root, entries)
    print(f"Generated {len(entries)} images and references in {root}")
    print("Checked JPEG decoding, finite in-bounds coordinates, corner mappings, and homography round trips.")


if __name__ == "__main__":
    main()
