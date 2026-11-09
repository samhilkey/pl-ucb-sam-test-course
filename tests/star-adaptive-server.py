import base64
import importlib.util
import json
import unittest

spec = importlib.util.spec_from_file_location("adaptive_element", "/course/elements/pl-sketch/pl-sketch.py")
element = importlib.util.module_from_spec(spec)
spec.loader.exec_module(element)
HTML = '<pl-sketch answers-name="a" x-range="-3,3" y-range="-3,3" width="800" height="600" allow-hand-drawn="true" preserve-photo-geometry="true" editable-photo-draft-tool="poly" adaptive-photo-spline-tool="smooth"><pl-sketch-tool id="ink" type="free-draw"></pl-sketch-tool><pl-sketch-tool id="poly" type="polyline"></pl-sketch-tool><pl-sketch-tool id="smooth" type="spline"></pl-sketch-tool><pl-sketch-grade type="match-function" tool-id="ink,poly,smooth" function="x" x-range="-2,2"></pl-sketch-grade></pl-sketch>'


def data_for():
    data = {"answers_names": {}, "params": {}, "correct_answers": {}, "submitted_answers": {}, "raw_submitted_answers": {}, "format_errors": {}, "partial_scores": {}}
    element.prepare(HTML, data)
    c = data["params"]["a"]["config"]
    def point(x, y):
        return {"x": (x-c["xrange"][0])*c["width"]/(c["xrange"][1]-c["xrange"][0]), "y": (c["yrange"][1]-y)*c["height"]/(c["yrange"][1]-c["yrange"][0])}
    value = {"data": {"ink": [], "poly": [[point(-2, -2), point(0, 0)]], "smooth": [[point(0, 0), point(1, 1), point(2, 2)]]}, "gradeable": {"ink": [], "poly": [], "smooth": []}}
    payload = base64.b64encode(json.dumps(value).encode()).decode()
    data["raw_submitted_answers"]["a-sketchresponse-submission"] = payload
    data["submitted_answers"]["a-sketchresponse-submission"] = payload
    return data, value


class AdaptiveTests(unittest.TestCase):
    def test_complementary_native_parts_are_graded_as_one_full_domain(self):
        data, value = data_for()
        element.parse(HTML, data)
        self.assertFalse(data["format_errors"])
        submitted = json.loads(base64.b64decode(data["submitted_answers"]["a-sketchresponse-submission"]))
        self.assertEqual(submitted["data"], value["data"])
        self.assertTrue(submitted["gradeable"]["smooth"])
        element.grade(HTML, data)
        self.assertEqual(data["partial_scores"]["a"]["score"], 1)

    def test_changed_spline_anchor_changes_the_real_grade(self):
        data, value = data_for(); value["data"]["smooth"][0][1]["y"] += 100
        payload = base64.b64encode(json.dumps(value).encode()).decode()
        data["raw_submitted_answers"]["a-sketchresponse-submission"] = payload
        element.parse(HTML, data); self.assertFalse(data["format_errors"])
        element.grade(HTML, data)
        self.assertEqual(data["partial_scores"]["a"]["score"], 0)

    def test_corrupt_spline_state_cannot_become_a_gradeable_curve(self):
        for ps in [[{"x": float("nan"), "y": 1}, {"x": 2, "y": 3}], [{"x": 1, "y": 2}], "bad"]:
            with self.assertRaises((ValueError, TypeError)):
                element._adaptive_spline_gradeable([ps])


if __name__ == '__main__':
    unittest.main()
