"""
Bridge: Sketch to Graph artifact JSON  ->  pl-sketch question inputs.

The artifact emits an equation in human notation ("y = 1.02x^3 - 3.01x").
pl-sketch's `function` attribute wants a Python expression in the variable x,
restricted to: + - * / **, parentheses, the constants e and pi, and the calls
abs sign sqrt log sin cos tan sinh cosh tanh asin acos atan atan2 asinh acosh atanh.

This module translates between them, and packages the result as the attribute
strings a question.html needs.
"""

import json
import math
import re

# Exactly the call names pl-sketch's parser accepts.
PL_ALLOWED_CALLS = {
    "abs", "sign", "sqrt", "log", "sin", "cos", "tan",
    "sinh", "cosh", "tanh", "asin", "acos", "atan", "atan2",
    "asinh", "acosh", "atanh",
}
PL_ALLOWED_NAMES = PL_ALLOWED_CALLS | {"x", "e", "pi"}


def to_pl_function(equation: str) -> str:
    """Translate the artifact's equation notation into pl-sketch syntax."""
    s = equation.strip()

    # 1. Drop a leading "y =".
    s = re.sub(r"^\s*y\s*=\s*", "", s)

    # 2. Unicode and alternate spellings for calls pl-sketch names differently.
    s = s.replace("√", "sqrt")      # the square-root sign
    # pl-sketch has log, not ln. The lookbehind rejects a preceding LETTER only
    # (so "asln(" is left alone) while still matching "2ln(", where \b would not.
    s = re.sub(r"(?<![A-Za-z])ln\s*\(", "log(", s)

    # 3. |expr| -> abs(expr). Innermost first, so nesting survives.
    while "|" in s:
        new = re.sub(r"\|([^|]*)\|", r"abs(\1)", s, count=1)
        if new == s:
            raise ValueError(f"unbalanced | in equation: {equation!r}")
        s = new

    # 4. Exponent: ^ -> **
    s = s.replace("^", "**")

    # 5. Implicit multiplication. The artifact writes 2x, 3sin(x), 1.5(x - 2),
    #    and e**(0.5x). Insert an explicit * where a number or a closing paren
    #    is immediately followed by a name or an opening paren.
    s = re.sub(r"(\d)\s*([A-Za-z(])", r"\1*\2", s)   # 2x, 3sin(, 1.5(
    s = re.sub(r"(\))\s*([A-Za-z0-9(])", r"\1*\2", s)  # )(  or )x
    #    ...and where the variable x is followed directly by a paren group.
    s = re.sub(r"\bx\s*\(", "x*(", s)

    # 5a. Step 5 also hits the ** we just made (e**(..) -> e***(..)); undo that.
    s = s.replace("***", "**")

    # 6. Collapse whitespace.
    s = re.sub(r"\s+", " ", s).strip()

    validate_pl_function(s)
    return s


def validate_pl_function(expr: str) -> None:
    """Raise if the expression uses anything pl-sketch would reject, or won't evaluate."""
    names = set(re.findall(r"[A-Za-z_][A-Za-z_0-9]*", expr))
    unknown = names - PL_ALLOWED_NAMES
    if unknown:
        raise ValueError(f"pl-sketch does not support: {sorted(unknown)} in {expr!r}")

    env = {n: getattr(math, n) for n in PL_ALLOWED_CALLS if hasattr(math, n)}
    env["abs"] = abs
    env["sign"] = lambda v: (v > 0) - (v < 0)
    env["e"] = math.e
    env["pi"] = math.pi

    ok = False
    for probe in (0.37, 1.41, 2.72, -1.13, 4.2):
        try:
            eval(expr, {"__builtins__": {}}, {**env, "x": probe})  # noqa: S307
            ok = True
            break
        except (ValueError, ZeroDivisionError, OverflowError):
            continue  # outside this function's domain; try another probe
        except Exception as exc:
            raise ValueError(f"{expr!r} is not a valid expression: {exc}") from exc
    if not ok:
        raise ValueError(f"{expr!r} did not evaluate at any probe point")


def split_domain_at_poles(lo, hi, poles, gap=1e-3):
    """pl-sketch draws a function as ONE continuous line, so a curve with a
    vertical asymptote has to be emitted as several intervals or the branches
    get joined across the pole."""
    cuts = sorted(p for p in (poles or []) if lo < p < hi)
    spans, start = [], lo
    for p in cuts:
        spans.append((start, p - gap))
        start = p + gap
    spans.append((start, hi))
    return [(a, b) for a, b in spans if b - a > gap * 10]


def initial_tags(data: dict, tool_id: str = "sp") -> list[str]:
    """The <pl-sketch-initial> tags that put the confirmed curve on the canvas."""
    fn = data["function"]
    expr = to_pl_function(fn["equation"])
    lo, hi = fn["domain"]
    spans = split_domain_at_poles(lo, hi, fn.get("vertical_asymptotes"))
    return [
        f'<pl-sketch-initial tool-id="{tool_id}" function="{expr}" '
        f'x-range="{a:.4g},{b:.4g}"></pl-sketch-initial>'
        for a, b in spans
    ]


def to_coordinates(points, max_points: int = 60) -> str:
    """The traced drawing as a `coordinates` string, for seeding a spline
    directly instead of going through the equation."""
    step = max(1, len(points) // max_points)
    kept = points[::step]
    if points and kept[-1] != points[-1]:
        kept.append(points[-1])
    return ",".join(f"({x:.4g},{y:.4g})" for x, y in kept)


def server_params(data: dict) -> dict:
    """What server.py should put into data["params"], so question.html can
    reference it with mustache."""
    fn = data["function"]
    lo, hi = fn["domain"]
    ax = data.get("axes", {})
    return {
        "fitted_fn": to_pl_function(fn["equation"]),
        "x_lo": lo,
        "x_hi": hi,
        "traced_coords": to_coordinates(data["curves"][0]["points"]) if data.get("curves") else "",
        "canvas_x_range": f'{ax.get("x_min", lo)},{ax.get("x_max", hi)}',
        "canvas_y_range": f'{ax.get("y_min", -5)},{ax.get("y_max", 5)}',
        "family": fn.get("family", ""),
        "rms": fn.get("rms_distance_from_drawing"),
    }


if __name__ == "__main__":
    import sys

    with open(sys.argv[1]) as fh:
        payload = json.load(fh)
    print("params for server.py:")
    print(json.dumps(server_params(payload), indent=2))
    print("\ntags for question.html:")
    for tag in initial_tags(payload):
        print(" ", tag)
