// Substitute __SAVED_CASES__ with saved full-photo-flow native canvas states.
async (page) => {
  const cases = __SAVED_CASES__;
  const results = [];
  for (const c of cases) {
    await page.setViewportSize({width: 1600, height: 1200});
    await page.goto('http://localhost:3000/pl/course/1/question/10/preview', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => window.SketchInput?.instances?.['hand-drawn-off']);
    await page.evaluate(state => {
      window.SketchInput.instances['hand-drawn-on'].setState(JSON.stringify(state));
      const config = JSON.parse(atob(document.getElementById('hand-drawn-off-sketchresponse-data').textContent));
      window.StarFit.placeCurve(window.SketchInput.instances['hand-drawn-off'], config, 'sp2',
        window.StarFit.sampleCurve({lo: -2.2, hi: 2.2, f: x => x*x}, 16));
    }, c.state);
    let submitted = null;
    const onRequest = request => {
      if (request.method() !== 'POST') return;
      const fields = new URLSearchParams(request.postData() || '');
      const value = fields.get('hand-drawn-on-sketchresponse-submission');
      if (value) submitted = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    };
    page.on('request', onRequest);
    try {
      await page.getByRole('button', {name:'Save & Grade', exact:true}).click();
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => document.body.innerText.includes('Submitted answer'));
    } finally {
      page.off('request', onRequest);
    }
    const body = await page.locator('body').innerText();
    const fullText = await page.locator('body').textContent();
    const validationDetails = await page.locator('[data-bs-content], [data-content], [data-bs-title], [data-original-title], [title]').evaluateAll(els =>
      els.flatMap(el => [...el.attributes].map(a => a.value)).filter(text => text.includes('defined in the same range')));
    const overlapError = (fullText + validationDetails.join(' ')).includes('are defined in the same range');
    const screenshot = c.output + '/grading--' + c.id + '.png';
    await page.screenshot({path: screenshot, fullPage:true});
    results.push({id:c.id, mode:'submission replay of the saved full-photo-flow state',
      submitted_branch_count:submitted && submitted.gradeable.sp.length, overlap_error:overlapError,
      invalid_submission:body.includes('invalid, not gradable'), validation_details:validationDetails,
      expected_overlap_error:c.expectOverlapError, submitted, body_text:body, screenshot,
      grade_dom:await page.locator('[class*=score], [class*=grade], .alert').evaluateAll(els =>
        els.map(el=>({class:el.className,text:el.textContent.trim()})).filter(x=>x.text))});
  }
  return results;
}
