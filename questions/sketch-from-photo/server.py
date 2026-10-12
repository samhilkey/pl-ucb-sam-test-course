import json

import artifact_to_plsketch as bridge


def generate(data):
    # In the finished system this JSON arrives from the student's session in the
    # Sketch to Graph interface, right after they press "This matches my sketch".
    # For the demo it is a file sitting next to this one, so the whole pipeline
    # downstream of the confirmation can be shown without the upload step.
    with open("graph.json") as fh:
        confirmed = json.load(fh)

    params = bridge.server_params(confirmed)
    for key, value in params.items():
        data["params"][key] = value

    # Split tags for a curve with vertical asymptotes. Joined into one string
    # because mustache cannot loop over a list and emit attributes.
    data["params"]["initial_tags"] = "\n    ".join(bridge.initial_tags(confirmed))

    # Feature coordinates, so the sketch can be graded on what hand grading
    # actually looks at: the key points, not the arc between them.
    for feature in confirmed.get("features", []):
        if feature["type"] == "local max":
            data["params"]["max_x"] = feature["x"]
            data["params"]["max_y"] = feature["y"]
        elif feature["type"] == "local min":
            data["params"]["min_x"] = feature["x"]
            data["params"]["min_y"] = feature["y"]

    data["params"]["description"] = confirmed.get("description", "")
    data["params"]["n_corrections"] = len(confirmed.get("corrections", []))
