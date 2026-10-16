# Photo confirmation regression check

Start local PrairieLearn and load this course, then run:

```bash
node tests/star-photo-confirmation.cjs
```

Requires Node.js, Playwright CLI (`playwright-cli` on PATH), and Chrome. No benchmark datasets are needed: the check creates small line images in memory and exercises the actual `star-photo-test` question through its upload, tracing, fitting, and native canvas controls.

Optional environment variables:

- `PL_PHOTO_TEST_CLI`: path to the Playwright CLI executable or a wrapper.
- `PL_PHOTO_TEST_URL`: question preview URL if the local course/question IDs differ.
- `PL_PHOTO_TEST_OUTPUT`: directory for screenshots (defaults to `/tmp/pl-sketch-photo-confirmation`).

The check covers photo replacement, clearing/undoing/adding strokes, calibration changes, search width, polynomial degree, family changes, failed reads/refits, slow/out-of-order uploads, invalid images, recovery, and successful native canvas transfer. Display-only controls must preserve a valid proposal. The photo panel is expanded during this state regression check so its existing scroll layout does not conceal tracing controls.
