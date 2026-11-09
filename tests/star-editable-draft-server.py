"""Opt-in native vertex editing: render and grade identical measured segments."""
import base64
import importlib.util
import json
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("draft_element", "/course/elements/pl-sketch/pl-sketch.py")
element = importlib.util.module_from_spec(spec)
spec.loader.exec_module(element)
HTML = '<pl-sketch answers-name="paper" allow-hand-drawn="true" preserve-photo-geometry="true" editable-photo-draft-tool="draft"><pl-sketch-tool id="ink" type="free-draw"></pl-sketch-tool><pl-sketch-tool id="draft" type="polyline"></pl-sketch-tool><pl-sketch-grade type="match-function" tool-id="ink,draft" function="x**2"></pl-sketch-grade></pl-sketch>'


def make(points, html=HTML):
    data = {"answers_names": {}, "params": {}, "correct_answers": {}, "submitted_answers": {}, "raw_submitted_answers": {}, "format_errors": {}, "partial_scores": {}}
    element.prepare(html, data)
    value = {"data": {"ink": [], "draft": [points, []]}, "gradeable": {"ink": [], "draft": [{"spline": [[0, 0], [10, 10], [20, 20], [30, 30]]}]}}
    key = "paper-sketchresponse-submission"
    data["raw_submitted_answers"][key] = base64.b64encode(json.dumps(value).encode()).decode()
    data["submitted_answers"][key] = data["raw_submitted_answers"][key]
    return data, value


class DraftTests(unittest.TestCase):
    def test_real_vertices_not_client_ideal_gradeable_determine_grading(self):
        points = [{"x": 120, "y": 20}, {"x": 130, "y": 24}, {"x": 110, "y": 30}, {"x": 10, "y": 100}]
        data, value = make(points)
        element.parse(HTML, data)
        self.assertFalse(data["format_errors"])
        actual = json.loads(base64.b64decode(data["submitted_answers"]["paper-sketchresponse-submission"]))
        self.assertEqual(actual["data"], value["data"])
        self.assertEqual(actual["gradeable"]["draft"][0]["spline"][::3], [[p["x"], p["y"]] for p in points])
        element.grade(HTML, data)
        self.assertEqual(data["partial_scores"]["paper"]["score"], 0)
        self.assertIn("saved", data["partial_scores"]["paper"]["feedback"][0]["feedback_text"])

    def test_corrected_monotone_draft_uses_native_grader(self):
        data, _ = make([{"x": 10, "y": 20}, {"x": 50, "y": 70}])
        element.parse(HTML, data)
        with patch.object(element, "_grade_with_staging", return_value={"score": 0.25}) as grader:
            element.grade(HTML, data)
            grader.assert_called_once()
        self.assertEqual(data["partial_scores"]["paper"]["score"], 0.25)

    def test_nonfinite_corrupt_or_single_vertex_draft_is_invalid(self):
        for points in [[{"x": float("nan"), "y": 3}, {"x": 2, "y": 3}], [{"x": True, "y": 3}, {"x": 2, "y": 3}], [{"x": 2, "y": 3}], "corrupt"]:
            data, _ = make(points)
            element.parse(HTML, data)
            self.assertIn("corrupted", data["format_errors"]["paper"])

    def test_configured_tool_must_be_editable_open_polyline_and_graded(self):
        for html in [HTML.replace('tool-id="ink,draft"', 'tool-id="ink"'), HTML.replace('type="polyline"', 'type="spline"'), HTML.replace('preserve-photo-geometry="true"', 'preserve-photo-geometry="false"')]:
            with self.assertRaises(ValueError):
                make([], html)

    def test_non_function_criterion_is_not_overridden_by_x_backtracking(self):
        html = HTML.replace('type="match-function" tool-id="ink,draft" function="x**2"', 'type="count" tool-id="draft" count="1"')
        data, _ = make([{"x": 10, "y": 20}, {"x": 30, "y": 30}, {"x": 20, "y": 40}], html)
        element.parse(html, data)
        with patch.object(element, "_grade_with_staging", return_value={"score": 0.5}) as grader:
            element.grade(html, data)
            grader.assert_called_once()


if __name__ == "__main__":
    unittest.main()
