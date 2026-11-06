# Checks that automation cannot claim

Record pass/fail, date, browser, screen/projector and the person checking. These
checks are **pending**, not completed by the agent.

## Actual presentation screen

1. Connect this Mac to the November 9 projector/display using the intended
   adapter. Confirm mirroring/extended-desktop choice and the actual resolution.
2. Open `http://127.0.0.1:3020/presentation` in Chrome. Enter full screen. At
   slides 1, 3, 4 and 5 confirm one complete slide fills the frame, no clipping,
   correct image proportions, and arrow/PageDown navigation.
3. From the back row, read the motivation text, both peak positions, the separate
   dot disclosure, “3.50 px” and its uncertainty caveat. Check glare/contrast on
   the gray paper photo and light native grid. Adjust projector/browser zoom,
   then repeat the workflow at that setting; do not assume a screenshot proves it.
4. In the primary question's lower canvas, read tick labels, axis values, review
   acknowledgment, native Select and Save & Grade. Check the dialog footer stays
   reachable when zoomed. Close/reopen without accidentally importing.
5. Rehearse the presenter script with a stopwatch. Fit the chosen live/manual
   preparation variant within 3–5 minutes. Label any pre-traced preparation.
6. Open the backup tab and PDF before speaking. Simulate the primary tab failing
   and switch within ten seconds. Explicitly call the fallback recorded evidence.

## Safari, only if it will be used

Safari 27.0.1 is installed, but its WebDriver refused a session because Allow
remote automation is disabled. That setting was not changed. Chrome 156 is the
tested route. To accept Safari manually:

1. Open the exact fresh question URL from PRESENTER.md in Safari. Confirm the
   correct title, lower wide-range canvas and manual photo button.
2. Upload `inputs/new-paper-01.png`, set O/X/Y and values3/3, trace the original
   curve and review both sharp peaks, endpoints and the off-origin minimum.
3. Verify acknowledgment is required. Confirm import, then add the separate dot
   manually with Other marks. Retain an existing test point.
4. Save & Grade, verify a savable 0% attempt, refresh and compare exact objects.
   Select/move only the curve, Save & Grade and refresh; both points must remain.
5. Replace a reviewed photograph and verify the previous proposal cannot import.
   Refresh while review is unsubmitted: only the saved native attempt should
   return, and the photo draft should clear.
6. Open the localhost3020 recorded backup and download both JSON records. If any
   check fails, use tested Chrome rather than changing the recognition code.

## Before leaving this Mac

- Use `feat/automatic-photo-recognition-cv` with the final local Step4F commit.
  Confirm clean Git status and all file hashes in the evidence manifest.
- Keep the existing Docker image/container/database; avoid a fresh image pull,
  database reset or course Sync before the talk.
- Confirm the new photo PNG, browser slides, six-page PDF, recorded backup,
  Node viewer/runtime helpers and presenter notes are readable locally.
- The new package is on an unpushed local branch. It is not on the deployed
  course and has not been validated on another computer. The zip is a recorded
  presentation/fallback bundle, not a complete PrairieLearn installation.
- Do not copy `.env.local`, key fragments or private environment files into the
  deck, zip, browser code or screenshots. Gemini is not needed for this demo.
