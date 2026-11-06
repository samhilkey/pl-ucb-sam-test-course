#!/usr/bin/env python3
"""Evaluation-only contact sheets and measured mask-attrition summary."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for name in ["/System/Library/Fonts/Supplemental/Arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def run(root):
    dest = root / "figures"
    dest.mkdir(exist_ok=False)
    result = json.loads((root / "evaluation.json").read_text())
    records = []
    for row in result["outcomes"]:
        g = json.loads((root / row["geometry"]).read_text())
        rejected = g["uncertainty"]["rejected_small_components"]
        rejected_pixels = sum(c["pixels_processing"] for c in rejected)
        records.append({"id": row["id"], "condition": row["condition"],
                        "dark_pixels": row["masks"]["dark"], "color_pixels": row["masks"]["color"],
                        "post_opening_or_color_union_pixels": row["masks"]["ink"] + rejected_pixels,
                        "rejected_small_component_pixels": rejected_pixels,
                        "rejected_small_components": len(rejected), "final_ink_pixels": row["masks"]["ink"],
                        "dark_reference_coverage_3px": row["metrics"]["mask_reference_coverage_within_3px_per_branch"]["dark"],
                        "final_reference_coverage_3px": row["metrics"]["reference_coverage"]["within_3px_per_branch"]})
    summary = {"method": "post-opening/color-union count = final ink count + disjoint rejected component pixel counts from unchanged recognizer",
               "caveat": "Color union is not necessarily a subset of the dark mask. Raw masks cover approximate reference centerlines, not a dense human ink segmentation.",
               "rows": records}
    (root / "mask-attrition.json").write_text(json.dumps(summary, indent=2) + "\n")

    cases = list(dict.fromkeys(row["id"] for row in result["outcomes"]))
    headers = ["Original photo", "Processed input", "Dark threshold mask", "Final ink mask", "Reference + prediction"]
    cell_w, cell_h, margin = 320, 226, 14
    for case in cases:
        rows = [r for r in result["outcomes"] if r["id"] == case]
        row_h = cell_h + 42
        sheet = Image.new("RGB", (margin * 2 + cell_w * len(headers), 105 + len(rows) * row_h), "white")
        draw = ImageDraw.Draw(sheet)
        draw.text((margin, 10), case + " — fixed downstream recognition", font=font(23), fill="black")
        draw.text((margin, 41), "Coverage uses approximate visible-ink centerlines at 3px; blue = reference, orange = extracted paths.", font=font(17), fill="#333333")
        for i, heading in enumerate(headers):
            draw.text((margin + i * cell_w, 78), heading, font=font(18), fill="black")
        for index, row in enumerate(rows):
            y = 105 + index * row_h
            metrics = row["metrics"]
            coverage = "/".join(f"{v*100:.1f}%" for v in metrics["reference_coverage"]["within_3px_per_branch"])
            fp = metrics["output_length_farther_than_5px_fraction"]
            fp_text = "n/a" if fp is None else f"{fp*100:.1f}%"
            draw.text((margin, y), f"{row['condition']} | coverage {coverage} | {metrics['inherited']['extracted_paths']} paths | off-reference length {fp_text}", font=font(18), fill="black")
            folder = root / case / row["condition"]
            files = [root / case / "before.png", folder / "image.png", folder / "recognition/dark.png", folder / "recognition/ink.png", folder / "recognition/reference-prediction-overlay.png"]
            for col, file in enumerate(files):
                with Image.open(file) as image:
                    image = image.convert("RGB")
                    image.thumbnail((cell_w - 10, cell_h - 8), Image.Resampling.LANCZOS if col not in [2, 3] else Image.Resampling.NEAREST)
                    x = margin + col * cell_w + (cell_w - 10 - image.width) // 2
                    yy = y + 30 + (cell_h - 8 - image.height) // 2
                    sheet.paste(image, (x, yy))
        sheet.save(dest / (case[:8] + "-comparison.png"))

    # Local overlap inspection: original beside each condition's evaluator overlay.
    policy = json.loads((Path(__file__).parent / "evaluation-policy.json").read_text())
    conditions = [r["condition"] for r in result["outcomes"] if r["id"] == cases[0]]
    regions = [(case, region) for case in cases for region in policy["overlap_regions"][case]]
    width, height = 170, 202
    sheet = Image.new("RGB", ((len(conditions) + 1) * width, 85 + len(regions) * height), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 8), "Axis/grid overlap regions — source photo and reference/prediction overlays", font=font(21), fill="black")
    for col, label in enumerate(["Source photo"] + conditions):
        draw.text((col * width + 6, 48), label, font=font(18), fill="black")
    for index, (case, region) in enumerate(regions):
        y = 85 + index * height
        draw.text((6, y), case[:8] + ": " + region["id"], font=font(16), fill="black")
        x0, y0 = region["pixel"]
        for col, condition in enumerate([None] + conditions):
            file = root / case / "before.png" if condition is None else root / case / condition / "recognition/reference-prediction-overlay.png"
            with Image.open(file) as image:
                crop = image.crop((x0 - 20, y0 - 20, x0 + 21, y0 + 21)).convert("RGB")
                crop = crop.resize((154, 154), Image.Resampling.NEAREST)
                sheet.paste(crop, (col * width + 6, y + 30))
    sheet.save(dest / "overlap-regions.png")
    print("Wrote two comparison sheets, overlap sheet and exact mask-attrition counts.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_directory", type=Path)
    run(parser.parse_args().run_directory.resolve())
