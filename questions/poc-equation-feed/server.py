import random


def generate(data):
    # Pick a random transformed parent function. In the real system this is
    # what the photo-fitter would recover from the student's hand drawing:
    # a parent (here, x**2) plus transformation parameters a, h, k.
    a = random.choice([1, 2, -1, -2])
    h = random.randint(-2, 2)
    k = random.randint(-2, 2)

    # Build the equation as a string, in the Python-expression syntax that
    # pl-sketch's `function` attribute expects. Parentheses around h and k
    # keep it valid when they are negative, e.g. (x - (-2)).
    target = f"{a}*(x - ({h}))**2 + ({k})"

    # A deliberately wrong "recovered" equation: same parent and same vertex,
    # but the wrong vertical stretch. Used in the second canvas to show that
    # grading still discriminates when the fit is off.
    wrong = f"{a * 3}*(x - ({h}))**2 + ({k})"

    # Plot window centred on the vertex so the curve stays on the canvas.
    data["params"]["x_lo"] = h - 2
    data["params"]["x_hi"] = h + 2

    # The equation the question is grading against.
    data["params"]["target_fn"] = target

    # The equation being fed onto the canvas. In the real pipeline these two
    # differ: target comes from the question author, fitted comes from the
    # student's photo.
    data["params"]["fitted_fn"] = target
    data["params"]["wrong_fn"] = wrong

    # A LaTeX version for the prompt text. Separate from the Python-syntax
    # version above because they are read by different things: one by MathJax,
    # one by pl-sketch's function parser.
    sign_h = "-" if h >= 0 else "+"
    data["params"]["target_latex"] = f"{a}(x {sign_h} {abs(h)})^2 + {k}"
