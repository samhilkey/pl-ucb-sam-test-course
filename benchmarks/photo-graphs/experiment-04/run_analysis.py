#!/usr/bin/env python3
"""Reuse the frozen analyzer inside the existing course container, away from /course."""
from pathlib import Path
import argparse
import io
import json
import subprocess
import tarfile
import tempfile

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[2]
REMOTE = "/tmp/photo-trace-analysis"


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="sam-test-course")
    args = parser.parse_args()
    catalog_file = EXP.parent / "experiment-01/catalog.json"
    catalog = json.loads(catalog_file.read_text())
    for mode in ["baseline", "trace"]:
        observations = list((EXP / mode / "results/raw").glob("*.json"))
        assert len(observations) == 33
        assert all(json.loads(p.read_text())["status"] == "completed" for p in observations)
    files = {
        EXP.parent / "experiment-01/prepare_cases.py",
        EXP.parent / "experiment-02/analyze_results.py",
        *(ROOT / c["image"].removeprefix("/course/") for c in catalog["cases"]),
        *(EXP.parent / "synthetic/references").glob("*.json"),
        *(EXP / "baseline/results/raw").glob("*.json"),
        *(EXP / "trace/results/raw").glob("*.json"),
    }
    with tempfile.TemporaryDirectory(prefix="photo-trace-analysis-") as temp:
        package = Path(temp) / "inputs.tar.gz"
        with tarfile.open(package, "w:gz") as archive:
            for path in sorted(files):
                archive.add(path, arcname=str(path.relative_to(ROOT)), recursive=False)
            # Only filesystem paths change in this disposable analysis copy.
            # Canonical catalog, calibration, references and guides stay frozen.
            for case in catalog["cases"]:
                case["image"] = case["image"].replace("/course/", REMOTE + "/", 1)
            body = (json.dumps(catalog) + "\n").encode()
            info = tarfile.TarInfo(str(catalog_file.relative_to(ROOT)))
            info.size = len(body)
            archive.addfile(info, io.BytesIO(body))
        run("docker", "exec", args.container, "mkdir", "-p", REMOTE)
        run("docker", "cp", str(package), args.container + ":" + REMOTE + "/inputs.tar.gz")
        run("docker", "exec", args.container, "tar", "xzf", REMOTE + "/inputs.tar.gz", "-C", REMOTE)
        remote_exp = REMOTE + "/" + str(EXP.relative_to(ROOT))
        analyzer = REMOTE + "/benchmarks/photo-graphs/experiment-02/analyze_results.py"
        for mode in ["baseline", "trace"]:
            results = remote_exp + "/" + mode + "/results"
            run("docker", "exec", args.container, "python3", analyzer,
                "--raw-dir", results + "/raw", "--output-dir", results)
            for name in ["results.csv", "summary.json", "overlays"]:
                target = EXP / mode / "results" / name
                if target.exists():
                    raise FileExistsError("Analysis output already exists: " + str(target))
                run("docker", "cp", args.container + ":" + results + "/" + name, str(target))


if __name__ == "__main__":
    main()
