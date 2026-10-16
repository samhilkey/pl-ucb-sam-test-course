#!/usr/bin/env python3
"""Package original browser evidence and a portable, local HTML result gallery."""
from pathlib import Path
import csv
import hashlib
import html
import json
import shutil

EXP = Path(__file__).resolve().parent


def main():
    evidence = EXP / 'results/evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    original_dir = Path('/tmp/star-step1-20261015/evidence')
    if original_dir.exists():
        for p in original_dir.glob('*.png'):
            shutil.copy2(p, evidence / p.name)
    manifest = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(evidence.glob('*.png'))]
    (EXP / 'results/evidence-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    rows = list(csv.DictReader((EXP / 'results/results.csv').open()))
    sections = []
    for r in rows:
        id = r['id']
        flag = 'PASS' if r['full_fidelity_pass'] == 'True' else 'FAIL' if r['full_fidelity_pass'] == 'False' else 'AMBIGUOUS'
        metric = f"{float(r['canvas_photo_bidirectional_p95_px']):.1f} px" if r['canvas_photo_bidirectional_p95_px'] else 'no continuous reference'
        pics = []
        for label, path in [('Photo and traced ink', f'results/evidence/{id}--photo.png'), ('Reference (pink), fitted model (orange), extracted points (cyan)', f'results/overlays/{id}.jpg'), ('Actual pl-sketch canvas', f'results/evidence/{id}--canvas.png')]:
            pics.append(f'<figure><a href="{path}"><img loading="lazy" src="{path}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>')
        sections.append(f'<details id="{id}"><summary><b>{flag}</b> · {html.escape(id)} · {metric}</summary><p>{html.escape(r["expression"])}<br>Branches: {r["output_branches"]}/{r["expected_branches"]}; ink hit: {r["ink_percent"]}%; rendering p95: {float(r["rendering_bidirectional_p95_svg_px"]):.2f} SVG px.</p><div class="images">{"".join(pics)}</div><p><a href="results/raw/{id}.json">Raw observation</a></p></details>')
    extra = ''.join(f'<li><a href="results/evidence/{name}">{label}</a></li>' for name, label in [
        ('ui-desktop-photo.png', 'Original desktop layout'), ('ui-mobile-photo.png', 'Original mobile layout'),
        ('probe-replaced-photo-stale-fit.png', 'Stale fit after photo replacement'),
        ('probe-empty-trace-stale-fit.png', 'Empty-trace error with old fit still visible'),
        ('probe-grade-clean.png', 'Native grading: clean parabola'), ('probe-grade-shifted.png', 'Native grading: shifted parabola')])
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STAR photo baseline · Experiment 01</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1280px;margin:40px auto;padding:0 20px;color:#19212a;background:#fbfaf7}h1{font-size:32px}summary{cursor:pointer;padding:15px 0}details{border-top:1px solid #bcc4c7;padding-bottom:10px}a{color:#125a86}figure{margin:0;min-width:0}img{max-width:100%;max-height:620px;object-fit:contain;background:white}figcaption{font-size:13px;color:#47515c}.images{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}p{max-width:900px}b{font-variant-numeric:tabular-nums}@media(max-width:800px){.images{grid-template-columns:1fr}}</style><h1>STAR photo baseline · Experiment 01</h1><p>33 images, 15 original drawings. Automated guided tracing through the live PrairieLearn question. <strong>These are engineering diagnostics, not student-study accuracy.</strong> Paper and real-photo references are approximate; real-image scales were supplied or normalized.</p><p><a href="REPORT.md">Read the report and priorities</a> · <a href="PROTOCOL.md">Protocol</a> · <a href="results/results.csv">All measurements (CSV)</a></p><p>The pass flag requires photo/model and photo/canvas p95 distance ≤10 pixels on a normalized 900-pixel-long-edge image, ≥90% reference coverage, and preservation of branch count. Rendering is also measured independently against the fitted model. Click an image to inspect it at full resolution.</p><ul>'''+extra+'</ul>'+''.join(sections)+'</html>'
    (EXP / 'gallery.html').write_text(page)
    print('Packaged', len(manifest), 'screenshots and', len(rows), 'gallery entries.')


if __name__ == '__main__':
    main()
