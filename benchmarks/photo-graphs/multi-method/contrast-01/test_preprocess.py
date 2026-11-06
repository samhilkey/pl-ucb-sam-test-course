"""Offline tests of the experimental preprocessing, not recognition accuracy."""
import json
import builtins
import io
import socket
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

import preprocess


CONDITIONS = json.loads((preprocess.HERE / "conditions.json").read_text())["conditions"]


class PreprocessingTests(unittest.TestCase):
    def test_all_conditions_preserve_storage_frame_and_source_pixels(self):
        rgb = np.random.default_rng(11).integers(0, 256, (67, 83, 3), dtype=np.uint8)
        before = rgb.copy()
        for condition in CONDITIONS:
            result, diagnostics, _ = preprocess.transform(rgb, condition)
            self.assertEqual(result.shape, rgb.shape)
            self.assertEqual(result.dtype, np.uint8)
            np.testing.assert_array_equal(rgb, before)
            self.assertTrue(np.isfinite(result).all())
            self.assertTrue(np.isfinite(diagnostics["luminance_std"]))
            if condition["id"] == "original":
                np.testing.assert_array_equal(result, rgb)

    def test_flat_percentiles_do_not_divide_by_zero_or_invent_contrast(self):
        rgb = np.full((32, 32, 3), 173, dtype=np.uint8)
        for condition in CONDITIONS:
            if condition["id"] in ["percentile", "red", "green", "blue"]:
                result, diagnostics, _ = preprocess.transform(rgb, condition)
                np.testing.assert_array_equal(result, rgb)
                self.assertTrue(diagnostics["degenerate"])

    def test_tone_mapping_preserves_dark_ink_at_axis_and_grid_intersections(self):
        rgb = np.full((96, 96, 3), 210, dtype=np.uint8)
        rgb[:, 48:50] = 110  # a thin vertical axis
        rgb[24:26, :] = 145  # a thin grid line
        # Dark slanted student ink crosses both; do not remove rows/columns.
        for x in range(8, 88):
            rgb[x - 1:x + 2, x] = 25
        for condition in CONDITIONS:
            result, _, _ = preprocess.transform(rgb, condition)
            for x in [24, 49]:
                self.assertLess(float(result[x, x].mean()), float(result[x, x + 6].mean()), condition["id"])

    def test_single_channels_remove_chroma_without_reordering_pixels(self):
        rgb = np.full((16, 16, 3), 180, dtype=np.uint8)
        rgb[8, 8] = [5, 70, 120]
        for condition in CONDITIONS:
            if condition["id"] in ["red", "green", "blue", "grayscale"]:
                result, _, _ = preprocess.transform(rgb, condition)
                np.testing.assert_array_equal(result[..., 0], result[..., 1])
                np.testing.assert_array_equal(result[..., 1], result[..., 2])
                self.assertLess(result[8, 8, 0], result[0, 0, 0])

    def test_full_preparation_never_reads_evaluator_inputs_and_never_overwrites(self):
        original_open = builtins.open
        original_io_open = io.open
        def check(file):
            self.assertNotIn("references", str(file))
            self.assertNotIn("evaluation-policy", str(file))
        def guarded_open(file, *args, **kwargs):
            check(file)
            return original_open(file, *args, **kwargs)
        def guarded_io_open(file, *args, **kwargs):
            check(file)
            return original_io_open(file, *args, **kwargs)
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "run"
            with patch("builtins.open", guarded_open), patch("io.open", guarded_io_open), \
                 patch.object(socket.socket, "connect", side_effect=AssertionError("Network forbidden")):
                preprocess.run(output)
            record = json.loads((output / "preprocessing.json").read_text())
            self.assertEqual(len(record["rows"]), 16)
            self.assertFalse(record["reference_geometry_read"])
            for row in record["rows"]:
                with Image.open(output / row["image"]) as image:
                    self.assertEqual(list(image.size), row["image_size"])
                if row["condition"] == "original":
                    self.assertEqual((output / row["image"]).read_bytes(), (output / row["original"]).read_bytes())
            with self.assertRaises(FileExistsError):
                preprocess.run(output)


if __name__ == "__main__":
    unittest.main()
