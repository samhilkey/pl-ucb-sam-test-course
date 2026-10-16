// Capture painted native SVG geometry for early runs that sampled before paint.
async (page) => {
  const collector = 'http://127.0.0.1:8767';
  const catalog = await (await page.request.get(collector + '/catalog.json')).json();
  const outcomes = [];
  await page.goto('http://localhost:3000/pl/course/1/question/10/preview', {waitUntil:'networkidle'});
  for (const c of catalog.cases) {
    if (!catalog.completed.includes(c.id)) continue;
    const r = await (await page.request.get(collector + '/results/' + c.id)).json();
    if (!r.rendering || r.rendering.paths.length) continue;
    await page.evaluate(state => window.SketchInput.instances['hand-drawn-on'].setState(JSON.stringify(state)), r.rendering.state);
    await page.waitForFunction(() => [...document.querySelectorAll('#hand-drawn-on-si-container path.plugin-id-sp')].some(p=>p.getAttribute('d')));
    // An extra paint prevents an old path being sampled during a later setState.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    r.rendering.paths = await page.evaluate(() => [...document.querySelectorAll('#hand-drawn-on-si-container path.plugin-id-sp')].filter(p=>p.getAttribute('d')).map(path => {
      const length = path.getTotalLength();
      const count = Math.max(201, Math.min(1001, Math.ceil(length / 2)));
      const points = [];
      for (let i=0;i<=count;i++) {
        const p = path.getPointAtLength(length*i/count);
        points.push([p.x,p.y]);
      }
      return {d:path.getAttribute('d'),length,points};
    }));
    r.rendering.path_capture = 'Replayed original saved state through same native renderer after paint; no refitting';
    r.rendering.path_recaptured_utc = new Date().toISOString();
    await page.request.post(collector+'/results/'+c.id, {data:r});
    outcomes.push({id:c.id,paths:r.rendering.paths.length});
  }
  return outcomes;
}
