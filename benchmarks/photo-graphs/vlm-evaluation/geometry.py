"""Offline geometry; adapted from experiment-01/analyze_results.py and prepare_cases.py.

No production imports or writes. Distances never join independent branches.
"""
import math
import numpy as np


def resample(points, step=0.8):
    points = np.asarray(points, dtype=float)
    arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    if arc[-1] == 0:
        return points
    locations = np.linspace(0, arc[-1], max(2, math.ceil(arc[-1]/step)+1))
    return np.column_stack([np.interp(locations, arc, points[:, k]) for k in range(2)])


def nearest(points, branches):
    starts = np.concatenate([np.asarray(b)[:-1] for b in branches])
    ends = np.concatenate([np.asarray(b)[1:] for b in branches])
    vectors = ends-starts
    denominator = (vectors*vectors).sum(axis=1)
    denominator[denominator == 0] = 1
    distances = []
    for chunk in np.array_split(np.asarray(points), max(1, len(points)//150)):
        delta = chunk[:, None, :] - starts[None, :, :]
        t = np.clip((delta*vectors).sum(axis=2)/denominator, 0, 1)
        distances.extend(np.linalg.norm(delta-t[:, :, None]*vectors, axis=2).min(axis=1).tolist())
    return np.asarray(distances)


def compare(reference, prediction, threshold=10):
    if not reference:
        return {}
    if not prediction:
        return {"reference_coverage": 0.0}
    ref = np.concatenate([resample(b) for b in reference])
    pred = np.concatenate([resample(b) for b in prediction])
    forward, reverse = nearest(ref, prediction), nearest(pred, reference)
    return {
        "reference_to_output_p95": float(np.percentile(forward, 95)),
        "output_to_reference_p95": float(np.percentile(reverse, 95)),
        "bidirectional_p95": max(float(np.percentile(forward, 95)), float(np.percentile(reverse, 95))),
        "reference_coverage": float(np.mean(forward <= threshold)),
    }


def graph_coordinates(points, axes):
    origin = np.asarray(axes["origin"], dtype=float)
    basis = np.column_stack([(np.asarray(axes["x_marker"])-origin)/axes["x_value"],
                             (np.asarray(axes["y_marker"])-origin)/axes["y_value"]])
    return np.linalg.solve(basis, (np.asarray(points)-origin).T).T


def stroke_plan(prediction):
    """Preserve explicit breakpoints for future native adapters; this is not PL state.

    Split each stroke at every corner; no smooth segment spans that vertex.
    Each piece references original samples, so no coordinates are fabricated.
    """
    plans = []
    for branch in prediction["branches"]:
        last = len(branch["points"])-1
        corners = [i for i, p in enumerate(branch["points"]) if p["vertex_kind"] == "corner"]
        breaks = sorted({0, last, *corners})
        plans.append({"branch_id": branch["id"], "corner_indices": corners,
                      "pieces": [list(range(a, b+1)) for a, b in zip(breaks, breaks[1:])],
                      "endpoints": branch["endpoints"]})
    return plans
