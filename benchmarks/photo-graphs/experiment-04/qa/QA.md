# Shape-preserving photo input verification

Feature source: ccada8f19f3eb5294c257a046db95877116dfb7e.
Additional real-grader regression: 29983ef, feat/photo-trace-shapes.
The follow-up changes tests and documentation only; production JS matches the benchmark snapshots.
Draft PR: https://github.com/samhilkey/pl-ucb-sam-test-course/pull/4
CI passed: https://github.com/samhilkey/pl-ucb-sam-test-course/actions/runs/39275970594

The default now retains simplified unsmoothed ink vertices, rather than always
fitting a mathematical function. Mathematical fitting remains optional per branch.
Native support anchors protect corners without changing the question's tool,
coordinate ranges, solution or grading rules. All work is on a feature branch.

Checks during implementation: 18 Node checks; 71 stale-confirmation assertions;
67 desktop/touch-emulated mobile workflow assertions; 139 expanded branch and
geometry assertions; 19 focused assertions including native editing, real-grader acceptance and actual
Save & Grade restoration. Sharp V, peak and plateau proposals agree with native
rendering within 1.19 SVG pixels; grading/rendering geometry differs by less
than 0.01 SVG pixels. JavaScript Standard, whitespace checks and GitHub CI pass.
Browser plugin unavailable; the established Chrome/Playwright CLI workflow was used.

The committed build was compared with merged master on all 33 frozen images in
experiment-04 on experiment/photo-trace-shapes. Both use the same native dialog,
axes and operator tracing guides, with no CSS overrides. Full fidelity rises
from 28/32 to 29/32: controlled 24/24 -> 24/24, generated paper-style 2/3 -> 3/3,
real 2/5 -> 2/5. Sparse-points real-05 has no continuous reference and is excluded.
All 66 runs complete with zero application errors. Experiments 01-03 are unchanged.

The extra pass is a generated paper-style cubic. Real photo performance remains
limited: conflicting-label error worsens 11.29 -> 23.21 normalized photo pixels;
piecewise examples improve 43.73 -> 27.56 and 21.70 -> 13.87 but still fail.
Preserving ink also preserves extraction mistakes. No LLM recognition, critical
number labels, vertical/loop support, or student learning evidence is added.
Ten trace branches have 800/801 finite diagnostic samples because floating-point
endpoint arithmetic exceeds the exact domain by less than 1e-12; native state
retains both endpoints. Raw data is unchanged and this is documented in the report.

Inspect the research report/gallery for screenshots, CSV, raw observations,
source snapshots, image hashes and protocol. Physical devices, Safari/Firefox,
assistive technologies and student usability remain untested.
