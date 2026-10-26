"""Offline contract/integration tests. Synthetic fixtures are never model results."""
import base64
from contextlib import redirect_stdout
from copy import deepcopy
import csv
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common
import evaluate as evaluator
import geometry
import run_vlm_eval as runner
from jsonschema import Draft202012Validator, ValidationError
from PIL import Image, ImageChops

HERE = common.HERE
BAD = (ValueError, ValidationError)


def point(x, y, graph=None):
    return {"pixel": [x, y], "graph": graph, "uncertainty_px": None}


def vertex(x, y, graph=None, kind="sample"):
    return {**point(x, y, graph), "vertex_kind": kind}


def branch(points, ident="stroke-a"):
    return {"id": ident, "points": points, "endpoints": [
        {"point_index": 0, "kind": "open"}, {"point_index": len(points)-1, "kind": "uncertain"}], "confidence": 0.7}


def prediction(size=(100, 100)):
    axis = {"visible": False, "label": None, "line_px": None, "tick_labels": []}
    return {
        "schema_version": "1.1", "coordinate_frame": "original_image_pixels_top_left_xy",
        "image": {"width": size[0], "height": size[1]},
        "axes": {"origin_px": None, "x": deepcopy(axis), "y": deepcopy(axis)},
        "calibration": {"mapping": "affine", "status": "unavailable", "x_unit_vector_px": None,
                        "y_unit_vector_px": None, "uncertainty_px": None, "evidence": "Synthetic fixture: scale unavailable."},
        "branches": [], "isolated_points": [],
        "uncertainty": {"confidence": 0.3, "reasons": ["Synthetic fixture only; not recognition."],
                        "assistance_required": True, "clarification_request": None},
    }


def reliable():
    p = prediction()
    p["axes"]["origin_px"] = [20, 80]
    for name, line, tick in [("x", [[0,80],[99,80]], [30,80]), ("y", [[20,99],[20,0]], [20,70])]:
        p["axes"][name].update(visible=True, label=name, line_px=line,
                               tick_labels=[{"text": "1", "value": 1, "position_px": tick, "confidence": 0.8}])
    p["calibration"].update(status="reliable", x_unit_vector_px=[10,0], y_unit_vector_px=[0,-10])
    p["branches"] = [branch([vertex(30,70,[1,1]), vertex(35,65,[1.5,1.5],"corner"), vertex(40,60,[2,2])])]
    return p


def envelope(p, finish="stop", **fields):
    return json.dumps({"id": "offline-response", "model": "OFFLINE_MOCK", "usage": {"total_tokens": 42},
                       "choices": [{"finish_reason": finish, "message": {"content": json.dumps(p)}}], **fields})


def mock_image_only_response(url, payload, key, timeout):
    """Create generic point-only output from image dimensions, never references."""
    png = base64.b64decode(payload["messages"][1]["content"][1]["image_url"]["url"].split(",", 1)[1])
    with Image.open(io.BytesIO(png)) as im:
        size = im.size
    p = prediction(size)
    p["isolated_points"] = [point(size[0]*0.35, size[1]*0.65), point(size[0]*0.65, size[1]*0.4)]
    p["uncertainty"]["clarification_request"] = "Can you clarify whether these marks are connected?"
    return 200, envelope(p)


def write_mock_run(root, run_id="offline-mock"):
    args = runner.parser().parse_args(["--execute", "--model", "OFFLINE_MOCK", "--run-id", run_id, "--output-root", str(root)])
    with redirect_stdout(io.StringIO()):
        assert runner.run(args, send=mock_image_only_response) == 0
        return evaluator.evaluate(run_id, root)


class OfflineCase(unittest.TestCase):
    def setUp(self):
        def forbidden(*args, **kwargs):
            raise AssertionError("Network access forbidden in offline tests")
        self.enterContext(patch.object(socket.socket, "connect", forbidden))
        self.enterContext(patch.object(socket, "create_connection", forbidden))
        self.enterContext(patch("urllib.request.OpenerDirector.open", forbidden))
        self.enterContext(patch("urllib.request.urlopen", forbidden))
        self.enterContext(patch.dict(os.environ, {"VLM_API_KEY": "OFFLINE_TEST_KEY"}))


class SemanticTests(OfflineCase):
    def valid(self, p):
        return common.validate_prediction(p, [100,100])

    def test_schema_and_valid_corner(self):
        Draft202012Validator.check_schema(common.read_json(HERE/"prediction.schema.json"))
        self.valid(reliable())

    def test_native_pixel_bounds_are_inclusive_only_at_last_center(self):
        for xy in [[0,0], [99,99]]:
            p = prediction(); p["isolated_points"] = [point(*xy)]; self.valid(p)
        for xy in [[99.001,1], [1,99.001], [100,1], [-0.001,1]]:
            with self.subTest(xy=xy), self.assertRaises(BAD):
                p = prediction(); p["isolated_points"] = [point(*xy)]; self.valid(p)

    def test_wrong_image_size(self):
        with self.assertRaises(BAD): common.validate_prediction(prediction(), [99,100])

    def test_nonfinite_coordinates_and_calibration(self):
        for value in [float("nan"), float("inf"), float("-inf"), 10**1000]:
            for target in ["pixel", "graph", "unit", "tick"]:
                p = reliable()
                if target in {"pixel", "graph"}: p["branches"][0]["points"][0][target][0] = value
                if target == "unit": p["calibration"]["x_unit_vector_px"][0] = value
                if target == "tick": p["axes"]["x"]["tick_labels"][0]["value"] = value
                with self.subTest(value=str(value)[:20], target=target), self.assertRaises(BAD): self.valid(p)

    def test_bad_endpoint_reference(self):
        for index in [1, 3, 100, -1]:
            p = reliable(); p["branches"][0]["endpoints"][0]["point_index"] = index
            with self.subTest(index=index), self.assertRaises(BAD): self.valid(p)

    def test_duplicate_endpoint_reference(self):
        p = reliable(); p["branches"][0]["endpoints"][1]["point_index"] = 0
        with self.assertRaises(BAD): self.valid(p)

    def test_duplicate_branch_ids(self):
        p = reliable(); p["branches"].append(deepcopy(p["branches"][0]))
        with self.assertRaises(BAD): self.valid(p)

    def test_corner_requires_explicit_kind_and_no_repeated_sample(self):
        p = reliable(); p["branches"][0]["points"][1]["vertex_kind"] = "bezier"
        with self.assertRaises(BAD): self.valid(p)
        p = reliable(); p["branches"][0]["points"][1] = deepcopy(p["branches"][0]["points"][0])
        with self.assertRaises(BAD): self.valid(p)

    def test_closed_stroke_has_no_endpoints(self):
        p = prediction(); b = branch([vertex(10,10), vertex(30,20), vertex(10,10)])
        p["branches"] = [b]
        with self.assertRaises(BAD): self.valid(p)
        b["endpoints"] = []; self.valid(p)

    def test_degenerate_transforms(self):
        for x, y in [([0,0],[0,-10]), ([10,0],[20,0]), ([1e6,0],[0,1e-6])]:
            p = reliable(); p["calibration"].update(x_unit_vector_px=x, y_unit_vector_px=y)
            with self.subTest(x=x,y=y), self.assertRaises(BAD): self.valid(p)

    def test_uncertain_transform_is_not_allowed_to_be_singular(self):
        p = prediction(); p["calibration"].update(status="uncertain", x_unit_vector_px=[1,1], y_unit_vector_px=[2,2])
        with self.assertRaises(BAD): self.valid(p)

    def test_partial_numeric_scale(self):
        p = prediction(); p["calibration"].update(status="uncertain", x_unit_vector_px=[10,0]); self.valid(p)

    def test_pixel_graph_consistency_fixed_one_pixel_tolerance(self):
        p = reliable(); p["branches"][0]["points"][0]["graph"][0] += 0.09; self.valid(p)
        p["branches"][0]["points"][0]["graph"][0] += 0.02
        with self.assertRaises(BAD): self.valid(p)

    def test_visible_axis_tick_consistency(self):
        p = reliable(); p["axes"]["x"]["tick_labels"][0]["position_px"][0] += 2
        with self.assertRaises(BAD): self.valid(p)
        p = reliable(); p["axes"]["x"]["tick_labels"] = []
        with self.assertRaises(BAD): self.valid(p)

    def test_axis_line_consistency_and_degeneracy(self):
        for line in [[[0,70],[99,70]], [[20,80],[20,80]]]:
            p = reliable(); p["axes"]["x"]["line_px"] = line
            with self.subTest(line=line), self.assertRaises(BAD): self.valid(p)

    def test_uncertain_calibration_forbids_graph_coordinates(self):
        p = prediction(); p["isolated_points"] = [point(5,5,[1,1])]
        with self.assertRaises(BAD): self.valid(p)

    def test_assistance_and_clarification(self):
        p = prediction(); p["uncertainty"]["assistance_required"] = False
        with self.assertRaises(BAD): self.valid(p)
        p = reliable(); p["uncertainty"].update(assistance_required=False, clarification_request="Clarify?")
        with self.assertRaises(BAD): self.valid(p)
        p = prediction(); p["uncertainty"]["reasons"] = []
        with self.assertRaises(BAD): self.valid(p)

    def test_strict_json_and_unsupported_schema(self):
        for text in ['{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}']:
            with self.subTest(text=text), self.assertRaises(ValueError): common.loads_json(text)
        p = prediction(); p["schema_version"] = "1.0"
        with self.assertRaises(BAD): self.valid(p)


class GeometryTests(OfflineCase):
    def test_no_distance_bridge_between_branches(self):
        self.assertEqual(geometry.nearest([[5,0]], [[[0,0],[1,0]], [[9,0],[10,0]]])[0], 4)

    def test_bidirectional_distance_detects_extra_ink(self):
        metrics = geometry.compare([[[0,0],[10,0]]], [[[0,0],[100,0]]])
        self.assertAlmostEqual(metrics["reference_to_output_p95"], 0)
        self.assertGreater(metrics["output_to_reference_p95"], 80)

    def test_missing_output_has_zero_coverage_without_fabricated_distance(self):
        self.assertEqual(geometry.compare([[[0,0],[10,0]]], []), {"reference_coverage":0.0})

    def test_corner_breakpoint_plan_preserves_stroke_and_endpoint_references(self):
        p = reliable(); plan = geometry.stroke_plan(p)[0]
        self.assertEqual(plan["corner_indices"], [1])
        self.assertEqual(plan["pieces"], [[0,1],[1,2]])
        self.assertEqual(plan["endpoints"], p["branches"][0]["endpoints"])

    def test_adapted_metrics_match_frozen_baseline(self):
        baseline = HERE.parent/"experiment-01"
        with patch.object(sys, "path", [str(baseline), *sys.path]):
            spec = importlib.util.spec_from_file_location("frozen_baseline_analysis", baseline/"analyze_results.py")
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        ref = [[[0,0],[20,30],[40,10]], [[60,0],[80,20]]]
        pred = [[[0,1],[20,31],[40,11]], [[60,1],[80,21]]]
        actual, expected = geometry.compare(ref,pred), module.compare(ref,pred,10)
        for key in actual: self.assertAlmostEqual(actual[key], expected[key], places=10)


class InputBoundaryTests(OfflineCase):
    def test_six_paths_hashes_and_exact_pixels(self):
        manifest = common.load_manifest()
        self.assertEqual(len(manifest["cases"]), 6)
        for c in manifest["cases"]:
            self.assertFalse(Path(c["image"]).is_absolute())
            png = common.image_bytes(c)
            with Image.open(HERE/c["image"]) as original, Image.open(io.BytesIO(png)) as clean:
                self.assertFalse(clean.info)
                self.assertEqual(list(clean.size), c["image_size"])
                self.assertIsNone(ImageChops.difference(original.convert("RGB"), clean).getbbox())

    def test_portable_relocated_manifest(self):
        manifest = common.load_manifest()
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)/"repo/benchmarks/photo-graphs/vlm-evaluation"; base.mkdir(parents=True)
            shutil.copyfile(HERE/"pilot.json", base/"pilot.json")
            for c in manifest["cases"]:
                target = (base/c["image"]).resolve(); target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(HERE/c["image"], target)
            self.assertEqual(common.load_manifest(base/"pilot.json"), manifest)

    def test_changed_image_or_reference_metadata_in_manifest_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)/"pilot.json"; m = common.read_json(HERE/"pilot.json")
            m["cases"][0]["reference_branches"] = []
            common.write_json(p,m)
            with self.assertRaises(ValueError): common.load_manifest(p)
        c = common.read_json(HERE/"pilot.json")["cases"][0]; c["sha256"] = "0"*64
        with self.assertRaises(ValueError): common.image_bytes(c)

    def test_default_dry_run_reads_no_references_and_never_calls_transport(self):
        opened = []; original_open = Path.open
        def guarded(path, *args, **kwargs):
            self.assertNotIn(path.name, {"evaluation-policy.json","catalog.json","annotations.json"})
            self.assertNotIn("references", path.parts)
            opened.append(path.name)
            return original_open(path,*args,**kwargs)
        send = Mock(side_effect=AssertionError("Transport forbidden"))
        args = runner.parser().parse_args([])
        with patch.object(Path,"open",guarded), redirect_stdout(io.StringIO()):
            self.assertEqual(runner.run(args,send=send),0)
        send.assert_not_called(); self.assertIn("pilot.json",opened)

    def test_payload_has_no_case_identity_or_reference_sentinels(self):
        c = common.load_manifest()["cases"][0]
        poison = dict(c, equation="PRIVATE_EQUATION_SENTINEL", reference_branches="PRIVATE_TRACE_SENTINEL")
        payload = runner.build_payload(poison, common.image_bytes(c), (HERE/"prompts/transcribe-v1.1.txt").read_text(), common.read_json(HERE/"prediction.schema.json"), runner.parser().parse_args([]))
        text = json.dumps(payload)
        for secret in [c["id"], c["image"], c["sha256"], "PRIVATE_EQUATION_SENTINEL", "PRIVATE_TRACE_SENTINEL"]:
            self.assertNotIn(secret,text)


class RunnerTests(OfflineCase):
    def setUp(self):
        super().setUp()
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(self.temp)
        self.case = common.read_json(HERE/"pilot.json")["cases"][0]

    def args(self, *extra):
        return runner.parser().parse_args(["--execute","--model","OFFLINE_MOCK","--run-id","test-run","--output-root",self.temp,"--case",self.case["id"],*extra])

    def run_one(self, send, *extra):
        with redirect_stdout(io.StringIO()): result = runner.run(self.args(*extra),send=send)
        record = common.read_json(self.root/"predictions/test-run/records"/(self.case["id"]+".json"))
        return result, record

    def test_validated_response_metadata_usage_latency_and_mock_label(self):
        status, record = self.run_one(Mock(return_value=(200,envelope(prediction(self.case["image_size"])))))
        self.assertEqual(status,0); self.assertEqual(record["status"],"validated")
        self.assertEqual(record["usage"],{"total_tokens":42}); self.assertGreaterEqual(record["latency_ms"],0)
        meta = common.read_json(self.root/"predictions/test-run/run.json")
        self.assertEqual(meta["source_kind"],"mock"); self.assertEqual(meta["schema_version"],"1.1")
        self.assertIn("common.py",meta["code_sha256"]); self.assertIn("prompt_version",meta)

    def test_invalid_json_and_truncation_preserve_raw_without_prediction(self):
        raw = envelope(prediction(self.case["image_size"]),finish="length")
        status, record = self.run_one(Mock(return_value=(200,raw)))
        self.assertEqual(status,1); self.assertEqual(record["status"],"invalid_response")
        self.assertEqual(record["usage"],{"total_tokens":42})
        self.assertEqual((self.root/"predictions/test-run/raw"/(self.case["id"]+".txt")).read_text(),raw)
        self.assertFalse(list((self.root/"predictions/test-run/validated").iterdir()))

    def test_malformed_json_is_an_error(self):
        status, record = self.run_one(Mock(return_value=(200,'{"invalid":')))
        self.assertEqual(status,1); self.assertEqual(record["status"],"invalid_response")

    def test_refusal_is_saved_without_validated_prediction(self):
        raw = json.dumps({"choices":[{"finish_reason":"stop","message":{"refusal":"Offline refusal fixture","content":None}}]})
        status, record = self.run_one(Mock(return_value=(200,raw)))
        self.assertEqual(status,1); self.assertIn("refused",record["error"]["message"])
        self.assertFalse(list((self.root/"predictions/test-run/validated").iterdir()))

    def test_bad_semantics_are_not_silently_repaired(self):
        p = prediction(self.case["image_size"]); p["isolated_points"] = [point(1200,10)]
        status, record = self.run_one(Mock(return_value=(200,envelope(p))))
        self.assertEqual(status,1); self.assertEqual(record["status"],"invalid_response")

    def test_http_error_redacts_echoed_credential(self):
        secret = "OFFLINE_SECRET_DO_NOT_SAVE"
        with patch.dict(os.environ,{"VLM_API_KEY":secret}):
            status, record = self.run_one(Mock(return_value=(429,json.dumps({"error":secret}))))
        self.assertEqual(status,1); self.assertEqual(record["status"],"api_error"); self.assertTrue(record["raw_redacted"])
        for path in (self.root/"predictions/test-run").rglob('*'):
            if path.is_file(): self.assertNotIn(secret,path.read_text())

    def test_timeout_saved_as_error(self):
        status, record = self.run_one(Mock(side_effect=TimeoutError("offline simulated timeout")))
        self.assertEqual(status,1); self.assertEqual(record["error"]["type"],"TimeoutError")
        self.assertGreaterEqual(record["latency_ms"],0)

    def test_failure_does_not_stop_other_cases(self):
        send = Mock(side_effect=[TimeoutError("offline timeout"), *[(200,envelope(prediction(c["image_size"]))) for c in common.read_json(HERE/"pilot.json")["cases"][1:]]])
        args = runner.parser().parse_args(["--execute","--model","OFFLINE_MOCK","--run-id","all","--output-root",self.temp])
        with redirect_stdout(io.StringIO()): self.assertEqual(runner.run(args,send=send),1)
        self.assertEqual(send.call_count,6)
        self.assertEqual(len(list((self.root/"predictions/all/records").iterdir())),6)

    def test_run_directory_is_never_overwritten(self):
        send = Mock(return_value=(200,envelope(prediction(self.case["image_size"]))))
        self.run_one(send)
        with self.assertRaises(FileExistsError), redirect_stdout(io.StringIO()): runner.run(self.args(),send=send)

    def test_http_wire_adapter_is_mocked_and_captures_error_body(self):
        reqs = []
        def fake_open(req,timeout):
            reqs.append(req)
            raise HTTPError(req.full_url,429,"offline error",{},io.BytesIO(b'{"error":"offline"}'))
        with patch("urllib.request.OpenerDirector.open",lambda _,req,timeout: fake_open(req,timeout)):
            self.assertEqual(runner.post_json("https://example.invalid/v1/chat/completions",{"model":"mock"},"fake-key",5),(429,'{"error":"offline"}'))
        self.assertEqual(reqs[0].get_header("Authorization"),"Bearer fake-key")

    def test_endpoint_rejects_embedded_credentials(self):
        for url in ["https://user:secret@example.invalid/v1","https://example.invalid/v1?key=secret","http://remote.invalid/v1"]:
            with self.subTest(url=url), self.assertRaises(ValueError): runner.endpoint_url(url)


class EvaluationTests(OfflineCase):
    def setUp(self):
        super().setUp()
        self.temp = self.enterContext(tempfile.TemporaryDirectory()); self.root = Path(self.temp).resolve()

    def test_six_case_mock_run_csv_overlays_and_sparse_review(self):
        summary = write_mock_run(self.root)
        self.assertEqual(summary["source_kind"],"mock"); self.assertEqual(summary["status_counts"],{"validated":6})
        report = self.root/"reports/offline-mock"
        self.assertEqual(len(list((self.root/"overlays/offline-mock").glob('*.png'))),6)
        self.assertIn("MOCK TEST ONLY",(report/"REPORT.md").read_text())
        sparse = next(r for r in summary["rows"] if r["id"]=="real--05-sparse-points-shadow")
        self.assertIsNone(sparse["expected_branches"]); self.assertIsNone(sparse["geometry_fidelity_pass"])
        self.assertIsNone(sparse["reference_coverage_10px_at_900"]); self.assertIsNone(sparse["branch_count_match"])
        review = next(r for r in summary["qualitative"] if r["id"]==sparse["id"])
        self.assertTrue(review["point_only_output"]); self.assertFalse(review["connecting_curve_proposed"])
        self.assertTrue(review["clarification_requested"])
        self.assertEqual(review["isolated_points_preserved"],"unverified")
        self.assertEqual(review["invented_connecting_curves"],"unverified")
        self.assertEqual(summary["groups"]["real"]["quantitative_eligible"],1)
        with (report/"results.csv").open() as f: self.assertEqual(len(list(csv.DictReader(f))),6)
        with (report/"qualitative-review.csv").open() as f: self.assertEqual(len(list(csv.DictReader(f))),6)
        for path in (self.root/"overlays/offline-mock").glob('*.png'):
            with Image.open(path) as im: self.assertGreater(im.width,500); self.assertGreater(im.height,100)

    def test_sparse_proposed_curve_stays_qualitative(self):
        rule = next(c for c in common.read_json(HERE/"evaluation-policy.json")["cases"] if c["diagnostic_only"])
        p = prediction(); p["branches"] = [branch([vertex(10,10),vertex(50,50)])]
        review = evaluator.qualitative(p,rule)
        self.assertTrue(review["connecting_curve_proposed"])
        self.assertEqual(review["invented_connecting_curves"],"unverified")

    def test_reference_hash_change_is_rejected(self):
        policy = common.read_json(HERE/"evaluation-policy.json")
        policy["reference_catalog"]["sha256"] = "0"*64
        # Relative paths retain the original meaning via a temporary sibling policy.
        policy["reference_catalog"]["path"] = os.path.relpath(HERE.parent/"experiment-01/catalog.json",self.root)
        policy["reference_annotations"]["path"] = os.path.relpath(HERE.parent/"experiment-01/annotations.json",self.root)
        path = self.root/"policy.json"; common.write_json(path,policy)
        with self.assertRaisesRegex(ValueError,"checksum changed"):
            evaluator.load_references(path, common.load_manifest())

    def test_invalid_artifact_cannot_be_scored_as_success(self):
        write_mock_run(self.root)
        path = next((self.root/"predictions/offline-mock/validated").glob('*.json')); path.write_text('{}')
        with redirect_stdout(io.StringIO()): summary = evaluator.evaluate("offline-mock",self.root,report_id="integrity-check")
        row = next(r for r in summary["rows"] if r["id"]==path.stem)
        self.assertEqual(row["status"],"artifact_error"); self.assertIsNone(row["geometry_fidelity_pass"])

    def test_failed_run_retains_metric_columns_and_unscored_status(self):
        case = common.read_json(HERE/"pilot.json")["cases"][0]
        args = runner.parser().parse_args(["--execute","--model","OFFLINE_MOCK","--run-id","failed","--output-root",self.temp,"--case",case["id"]])
        with redirect_stdout(io.StringIO()):
            self.assertEqual(runner.run(args,send=Mock(return_value=(200,'{'))),1)
            summary = evaluator.evaluate("failed",self.root)
        row = summary["rows"][0]
        self.assertEqual(row["status"],"invalid_response")
        self.assertIsNone(row["geometry_fidelity_pass"])
        self.assertEqual(summary["groups"]["controlled"]["unscored_missing_or_invalid"],1)
        with (self.root/"reports/failed/results.csv").open() as f:
            reader = csv.DictReader(f)
            self.assertIn("bidirectional_p95_native_px",reader.fieldnames)
            self.assertEqual(next(reader)["bidirectional_p95_native_px"],"")

    def test_existing_manual_review_is_preserved(self):
        write_mock_run(self.root)
        path = self.root/"reports/offline-mock/qualitative-review.csv"; before = path.read_bytes()
        with self.assertRaisesRegex(ValueError,"already exists"): evaluator.evaluate("offline-mock",self.root)
        self.assertEqual(path.read_bytes(),before)

    def test_controlled_axis_error_is_independent_of_geometry(self):
        p = reliable()
        ref = {"image_size":[100,100],"reference_branch_count":1,"reference_branches":[[[30,70],[40,60]]],
               "axes":{"origin":[20,80],"x_marker":[30,80],"y_marker":[20,70],"x_value":1,"y_value":1},"true_features":[]}
        rule = {"scoring":{"curve_geometry":True,"branch_count":True,"numeric_axes":True}}
        scores = evaluator.score_prediction(p,ref,rule)
        self.assertEqual(scores["origin_error_native_px"],0)
        self.assertEqual(scores["calibration_p95_graph_units"],0)
        self.assertEqual(scores["reported_graph_coordinate_p95_error"],0)
        self.assertTrue(scores["geometry_fidelity_pass"])


if __name__ == "__main__":
    unittest.main()
