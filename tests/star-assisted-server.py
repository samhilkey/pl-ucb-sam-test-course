"""Run inside the existing PrairieLearn container with its installed packages."""
import base64
import importlib.util
import json
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("photo_element", "/course/elements/pl-sketch/pl-sketch.py")
element = importlib.util.module_from_spec(spec)
spec.loader.exec_module(element)

HTML = '<pl-sketch answers-name="paper" allow-hand-drawn="true" preserve-photo-geometry="true"><pl-sketch-tool id="ink" type="free-draw" label="Ink"></pl-sketch-tool><pl-sketch-grade type="match-function" tool-id="ink" function="x**2"></pl-sketch-grade></pl-sketch>'


def data_for(html=HTML, branches=None):
    data = {"answers_names": {}, "params": {}, "correct_answers": {}, "submitted_answers": {}, "raw_submitted_answers": {}, "format_errors": {}, "partial_scores": {}}
    element.prepare(html, data)
    branches = branches if branches is not None else [[[100, 100], [160, 120], [220, 140], [280, 160]], [[100, 200], [160, 220], [220, 240], [280, 260]]]
    value = {"data": {"ink": [[{"x": x, "y": y} for x, y in b] for b in branches]}, "gradeable": {"ink": [{"spline": b} for b in branches]}}
    payload = base64.b64encode(json.dumps(value).encode()).decode()
    data["submitted_answers"]["paper-sketchresponse-submission"] = payload
    data["raw_submitted_answers"] = dict(data["submitted_answers"])
    return data


class AssistedServerTests(unittest.TestCase):
    def test_legacy_overlap_remains_invalid(self):
        html = HTML.replace(' preserve-photo-geometry="true"', '')
        data = data_for(html)
        element.parse(html, data)
        self.assertIn("Multiple", data["format_errors"]["paper"])
        self.assertNotIn("assistedPhotoGeometry", data["params"]["paper"]["config"])

    def test_opted_in_overlap_is_preserved_and_graded_incorrect(self):
        data = data_for()
        original = data["raw_submitted_answers"].copy()
        element.parse(HTML, data)
        self.assertFalse(data["format_errors"])
        element.grade(HTML, data)
        self.assertEqual(data["partial_scores"]["paper"]["score"], 0)
        self.assertIn("separate strokes", data["partial_scores"]["paper"]["feedback"][0]["feedback_text"])
        self.assertEqual(data["raw_submitted_answers"], original)

    def test_normal_submission_still_uses_existing_grader(self):
        data = data_for(branches=[[[100, 100], [160, 120], [220, 140], [280, 160]]])
        element.parse(HTML, data)
        with patch.object(element, "_grade_with_staging", return_value={"score": 0.25}) as grader:
            element.grade(HTML, data)
            grader.assert_called_once()
        self.assertEqual(data["partial_scores"]["paper"]["score"], 0.25)

    def test_corrupted_submission_is_still_invalid(self):
        data = data_for()
        data["raw_submitted_answers"]["paper-sketchresponse-submission"] = "bad"
        element.parse(HTML, data)
        self.assertIn("corrupted", data["format_errors"]["paper"])

    def test_opt_in_requires_camera_and_freeform(self):
        for html in [HTML.replace('allow-hand-drawn="true"', 'allow-hand-drawn="false"'), HTML.replace('type="free-draw"', 'type="spline"')]:
            with self.assertRaises(ValueError):
                data_for(html)


if __name__ == "__main__":
    unittest.main()
