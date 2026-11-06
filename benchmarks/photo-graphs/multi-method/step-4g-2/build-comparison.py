"""Offline evidence montage only; requires Pillow. No recognition or network."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
cases = [
    ("Original handwritten photograph", root / "step-4g-1/results/IMG_1670--source.png",
     "Same exact pixels sent to CV and Gemini"),
    ("CV automatic: failed", root / "step-4g-1/results/IMG_1670--overlay.png",
     "3 px coverage 53.94%; p95 ref-to-output 11.69 px"),
    ("Gemini automatic: failed", root / "step-4g-2/results/gemini-raw-overlay.png",
     "3 px coverage 1.33%; p95 ref-to-output 503.35 px"),
    ("Manually assisted: prior passing result",
     root / "step-4f/results/new-paper-01--desktop--manual-overlay.png",
     "Manual calibration + tracing; 3 px coverage 91.27%"),
]
try:
    title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 26)
    note = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 19)
except OSError:
    title = ImageFont.load_default(size=26)
    note = ImageFont.load_default(size=19)
canvas = Image.new("RGB", (1800, 1740), "white")
draw = ImageDraw.Draw(canvas)
for index, (label, file, caption) in enumerate(cases):
    x, y = (index % 2) * 900 + 24, (index // 2) * 830 + 15
    draw.text((x, y), label, fill="#172936", font=title)
    photo = Image.open(file).convert("RGB")
    photo.thumbnail((852, 744))
    canvas.paste(photo, (x, y + 44))
    draw.text((x, y + 792), caption, fill="#172936", font=note)
draw.text(
    (24, 1680),
    "Exploratory source-pixel metrics against approximate visual annotations; "
    "not general recognition accuracy.",
    fill="#344955", font=note,
)
draw.text(
    (24, 1708),
    "Orange = returned paths; Gemini markers: red corners, green endpoints, "
    "magenta isolated point. No coordinate repair.",
    fill="#344955", font=note,
)
canvas.save(root / "step-4g-2/results/method-comparison.png")
