#!/usr/bin/env python3
"""Analyze persisted browser observations. Run in the course Docker container."""
from pathlib import Path
from collections import Counter
import csv
import json
import re

import numpy as np
from PIL import Image, ImageDraw

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "experiment-01"))
from prepare_cases import frame_transform, resample

EXP = Path(__file__).resolve().parent


def dense(branches, step=0.8):
    return [resample(b, step) for b in branches if len(b) > 1]


def nearest(points, branches):
    """Exact point-to-segment distance; avoid treating distinct branches as joined."""
    starts = np.concatenate([np.asarray(b)[:-1] for b in branches])
    ends = np.concatenate([np.asarray(b)[1:] for b in branches])
    vectors = ends - starts
    denom = (vectors * vectors).sum(axis=1)
    denom[denom == 0] = 1
    distances = []
    for chunk in np.array_split(np.asarray(points), max(1, len(points) // 150)):
        delta = chunk[:, None, :] - starts[None, :, :]
        t = np.clip((delta * vectors).sum(axis=2) / denom, 0, 1)
        d = np.linalg.norm(delta - t[:, :, None] * vectors, axis=2).min(axis=1)
        distances.extend(d.tolist())
    return np.asarray(distances)


def compare(reference, predicted, threshold):
    if not reference or not predicted:
        return {}
    ref = np.concatenate(dense(reference))
    pred = np.concatenate(dense(predicted))
    a = nearest(ref, predicted)
    b = nearest(pred, reference)
    return {
        'reference_to_output_p95': float(np.percentile(a, 95)),
        'output_to_reference_p95': float(np.percentile(b, 95)),
        'bidirectional_p95': max(float(np.percentile(a, 95)), float(np.percentile(b, 95))),
        'reference_coverage': float(np.mean(a <= threshold)),
        'max_distance': max(float(a.max()), float(b.max())),
    }


def to_svg(points, config):
    p = np.asarray(points).copy()
    x0, x1 = config['xrange']
    y0, y1 = config['yrange']
    p[:, 0] = (p[:, 0] - x0) * config['width'] / (x1 - x0)
    p[:, 1] = (y1 - p[:, 1]) * config['height'] / (y1 - y0)
    return p


def from_svg(points, config):
    p = np.asarray(points).copy()
    x0, x1 = config['xrange']
    y0, y1 = config['yrange']
    p[:, 0] = x0 + p[:, 0] * (x1 - x0) / config['width']
    p[:, 1] = y1 - p[:, 1] * (y1 - y0) / config['height']
    return p


def main(raw_dir=None, output_dir=None):
    raw_dir = Path(raw_dir) if raw_dir else EXP / 'results/raw'
    output_dir = Path(output_dir) if output_dir else EXP / 'results'
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((EXP.parent / 'experiment-01/catalog.json').read_text())['cases']
    rows, details = [], []
    overlay_dir = output_dir / 'overlays'
    overlay_dir.mkdir(exist_ok=True, parents=True)
    for c in catalog:
        raw_file = raw_dir / (c['id'] + '.json')
        if not raw_file.exists():
            continue
        r = json.loads(raw_file.read_text())
        row = {k: c[k] for k in ['id', 'collection', 'drawing_id', 'variant', 'diagnostic_only', 'reference_status']}
        row.update(status=r['status'], expected_branches=c['reference_branch_count'])
        models = r.get('models') or ([r['model']] if r.get('model') else [])
        if not models:
            rows.append(row)
            continue
        m, rend = models[0], r.get('rendering', {})
        scale = 900 / max(c['image_size'])
        ref = [np.asarray(b) * scale for b in c['reference_branches']]
        model_photo = [frame_transform(model['samples'], c['axes'], inverse=True) for model in models]
        pred = [branch * scale for branch in model_photo]
        photo = compare(ref, pred, 10)
        extracted_photo = [frame_transform(points, c['axes'], inverse=True) for points in r.get('fit_branches', [r.get('fit_points', [])])]
        extraction = compare(ref, [branch * scale for branch in extracted_photo], 10)
        paths = [p['points'] for p in rend.get('paths', []) if len(p['points']) > 1]
        render = compare([to_svg(model['samples'], rend['config']) for model in models], paths, 3) if rend else {}
        canvas_photo = compare(ref, [frame_transform(from_svg(path, rend['config']), c['axes'], inverse=True) * scale for path in paths], 10) if paths else {}
        branch_count = sum(len(branch) > 1 for branch in rend.get('state', {}).get('data', {}).get('sp', []))
        ink = re.search(r'(\d+)%', r.get('status_text', ''))
        fidelity = bool(photo and photo['bidirectional_p95'] <= 10 and photo['reference_coverage'] >= 0.90)
        topology = branch_count == c['reference_branch_count']
        row.update(
            family=' | '.join(model['family'] for model in models), degree=' | '.join(str(model['degree']) for model in models), expression='; '.join(model['expression'] for model in models),
            model_rmse_graph_units=max(model['reported_rmse'] for model in models),
            finite_domain_sample_fraction=sum(len(model['samples']) for model in models) / (801 * len(models)),
            ink_percent=int(ink.group(1)) if ink else None,
            fit_ms=r.get('fit_ms'), extraction_ms=r.get('extraction_ms'),
            processing_ms=r.get('processing_ms'), transfer_ms=rend.get('transfer_ms'),
            image_load_wall_ms=r.get('image_load_wall_ms'),
            reference_to_model_p95_px=photo.get('reference_to_output_p95'),
            model_to_reference_p95_px=photo.get('output_to_reference_p95'),
            photo_bidirectional_p95_px=photo.get('bidirectional_p95'),
            reference_coverage_10px=photo.get('reference_coverage'),
            extraction_all_branches_p95_px=extraction.get('bidirectional_p95'),
            rendering_bidirectional_p95_svg_px=render.get('bidirectional_p95'),
            rendering_max_distance_svg_px=render.get('max_distance'),
            canvas_photo_bidirectional_p95_px=canvas_photo.get('bidirectional_p95'),
            canvas_reference_coverage_10px=canvas_photo.get('reference_coverage'),
            output_branches=branch_count, topology_pass=topology,
            photo_fidelity_pass=fidelity if photo else None,
            full_fidelity_pass=bool(fidelity and topology and canvas_photo and canvas_photo['bidirectional_p95'] <= 10 and canvas_photo['reference_coverage'] >= 0.90) if photo else None,
            rendering_pass=bool(render and render['bidirectional_p95'] <= 3),
            console_error_count=len(r.get('console_errors', [])),
        )
        if c['collection'] == 'controlled':
            original = json.loads((EXP.parent / 'synthetic/references' / (c['id'].replace('controlled--', '') + '.json')).read_text())
            errors = []
            for branch in original['branches']:
                calibrated = frame_transform(branch['image_pixel_points'], c['axes'])
                errors.extend(np.linalg.norm(calibrated - np.asarray(branch['graph_points']), axis=1))
            row['calibration_p95_graph_units'] = float(np.percentile(errors, 95))
        # Keep a visual diagnostic independent of STAR's own proposed model display.
        image_path = Path(c['image'])
        with Image.open(image_path) as original:
            im = original.convert('RGB')
        im.thumbnail((720, 720))
        factors = np.array(im.size) / np.array(c['image_size'])
        draw = ImageDraw.Draw(im)
        for b in c['reference_branches']:
            draw.line([tuple(p) for p in np.asarray(b) * factors], fill='#e51c9b', width=3)
        for branch in model_photo:
            draw.line([tuple(p) for p in branch * factors], fill='#ff8c00', width=2)
        for branch in extracted_photo:
            for x, y in branch * factors:
                draw.ellipse((x-1,y-1,x+1,y+1), fill='#00a4bd')
        im.save(overlay_dir / (c['id'] + '.jpg'), quality=90)
        rows.append(row)
        details.append({'id': c['id'], 'photo': photo, 'extraction_all_branches': extraction, 'rendering': render, 'canvas_photo': canvas_photo})
    fields = list(dict.fromkeys(k for row in rows for k in row))
    with (output_dir / 'results.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    groups = {}
    for collection in sorted({r['collection'] for r in rows}):
        subset = [r for r in rows if r['collection'] == collection]
        numeric = [r for r in subset if r.get('full_fidelity_pass') is not None]
        groups[collection] = {
            'images': len(subset), 'drawings': len({r['drawing_id'] for r in subset}),
            'completed': sum(r['status'] == 'completed' for r in subset),
            'fidelity_evaluable': len(numeric),
            'fidelity_pass': sum(bool(r['full_fidelity_pass']) for r in numeric),
            'rendering_pass': sum(bool(r.get('rendering_pass')) for r in subset),
            'topology_pass': sum(bool(r.get('topology_pass')) for r in subset),
        }
    timings = {}
    for key in ['image_load_wall_ms', 'extraction_ms', 'fit_ms', 'processing_ms', 'transfer_ms']:
        values = [r[key] for r in rows if r.get(key) is not None]
        if values:
            timings[key] = {stat: float(fn(values)) for stat, fn in [('median', np.median), ('p95', lambda v: np.percentile(v, 95)), ('max', max)]}
    summary = {'completed_cases': len(rows), 'groups': groups, 'timings': timings, 'status': dict(Counter(r['status'] for r in rows)), 'metrics': details}
    (output_dir / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    # Compact report table for the operator.
    for r in rows:
        print(r['id'], r.get('family'), r.get('degree'), 'photo', round(r.get('photo_bidirectional_p95_px') or -1, 2), 'coverage', round(r.get('reference_coverage_10px') or -1, 3), 'render', round(r.get('rendering_bidirectional_p95_svg_px') or -1, 2), 'branches', r.get('output_branches'), 'PASS', r.get('full_fidelity_pass'))
    print(json.dumps({'groups': groups, 'timings': timings}, indent=2))


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-dir')
    parser.add_argument('--output-dir')
    args = parser.parse_args()
    main(args.raw_dir, args.output_dir)
