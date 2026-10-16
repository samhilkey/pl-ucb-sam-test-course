// Read this function with Playwright CLI run-code, substituting __CASE_IDS__
// with an array of catalog IDs. Results persist after every case.
async (page) => {
  const ids = __CASE_IDS__;
  const collector = 'http://127.0.0.1:8768';
  const catalog = await (await page.request.get(collector + '/catalog.json')).json();
  const outcomes = [];
  for (const id of ids) {
    const c = catalog.cases.find(x => x.id === id);
    if (!c) throw new Error('Unknown case: ' + id);
    const errors = [], warnings = [];
    const onConsole = msg => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    };
    const onError = error => errors.push(String(error));
    page.on('console', onConsole);
    page.on('pageerror', onError);
    let result = {id, collection: c.collection, drawing_id: c.drawing_id,
      variant: c.variant, started_utc: new Date().toISOString(), status: 'error'};
    try {
      await page.setViewportSize({width: 1600, height: 2200});
      await page.goto('http://localhost:3000/pl/course/1/question/10/preview', {waitUntil:'networkidle'});
      await page.locator('#hand-drawn-on-star-photo-btn').waitFor();
      result.page_identity = {url: page.url(), title: await page.title()};
      result.meaningful_page = await page.getByRole('heading', {name:'STAR: hand-drawn switch test', exact:true}).count() === 1;
      await page.locator('#hand-drawn-on-star-photo-btn').click();
      const panel = page.locator('#hand-drawn-on-star-panel');
      // Batch-only visibility adaptation. Native layout is captured separately.
      await panel.evaluate(el => {
        Object.assign(el.style, {position:'fixed',left:'20px',top:'20px',right:'auto',
          bottom:'auto',width:'1000px',height:'auto',maxHeight:'none',overflow:'visible',
          zIndex:'10000'});
      });
      await page.evaluate(() => {
        window.__starExperiment = {fits: []};
        const original = window.StarFit.fit;
        window.StarFit.fit = function(points, spec) {
          const t = performance.now();
          const model = original(points, spec);
          const end = performance.now();
          const b = window.__starExperiment;
          if (!b.fits.length) b.extractMs = t - b.readStarted;
          b.fits.push({points: JSON.parse(JSON.stringify(points)), model, ms: end - t});
          b.processingMs = end - b.readStarted;
          return model;
        };
        document.querySelector('#hand-drawn-on-star-ui .star-use')
          .addEventListener('click', () => {
            window.__starExperiment.readStarted = performance.now();
          }, true);
      });
      const loadStart = Date.now();
      await panel.locator('input[type=file]').setInputFiles(c.image);
      await panel.locator('.star-status').filter({hasText:'Place the axes, then trace your curve.'}).waitFor();
      result.image_load_wall_ms = Date.now() - loadStart;
      const canvas = panel.locator('.star-canvas');
      result.native_photo_size = await canvas.evaluate(el => [el.width, el.height]);
      const [nw, nh] = result.native_photo_size;
      const [w, h] = c.image_size;
      const toNative = p => [p[0] * nw / w, p[1] * nh / h];
      const screen = async p => {
        const b = await canvas.boundingBox();
        return [b.x + p[0] * b.width / nw, b.y + p[1] * b.height / nh];
      };
      const drag = async (from, to) => {
        const a = await screen(from), b = await screen(to);
        await page.mouse.move(a[0], a[1]);
        await page.mouse.down();
        await page.mouse.move(b[0], b[1], {steps: 6});
        await page.mouse.up();
      };
      await panel.locator('.star-xval').fill(String(c.axes.x_value));
      await panel.locator('.star-yval').fill(String(c.axes.y_value));
      const defaults = [[nw*.5,nh*.55],[nw*.75,nh*.55],[nw*.5,nh*.3]];
      const staging = [[nw*.1,nh*.9],[nw*.9,nh*.9],[nw*.1,nh*.1]];
      const targets = [c.axes.origin,c.axes.x_marker,c.axes.y_marker].map(toNative);
      for (let i=0;i<3;i++) await drag(defaults[i], staging[i]);
      for (let i=0;i<3;i++) await drag(staging[i], targets[i]);
      await panel.locator('.star-mode-curve').click();
      for (const branch of c.guide_branches) {
        const points = branch.map(toNative);
        const b = await canvas.boundingBox();
        for (let i=0;i<points.length;i++) {
          await page.mouse.move(b.x + points[i][0]*b.width/nw, b.y + points[i][1]*b.height/nh);
          if (i===0) await page.mouse.down();
        }
        await page.mouse.up();
      }
      await panel.locator('.star-use').click();
      result.photo_screenshot = catalog.evidence_dir + '/' + id + '--photo.png';
      await canvas.screenshot({path: result.photo_screenshot});
      const fit = await page.evaluate(() => {
        const b=window.__starExperiment;
        const data={fit_branches:b.fits.map(f=>f.points),
          fit_ms:b.fits.reduce((sum,f)=>sum+f.ms,0),
          extraction_ms:b.extractMs,processing_ms:b.processingMs,
          status_text:document.querySelector('#hand-drawn-on-star-ui .star-status').textContent,
          models:[]};
        for(const fit of b.fits){
          const m=fit.model;
          if(!m) continue;
          const samples=[];
          for(let i=0;i<=800;i++){
            const x=m.lo+(m.hi-m.lo)*i/800, y=m.f(x);
            if(Number.isFinite(y)) samples.push([x,y]);
          }
          data.models.push({family:m.family,degree:m.degree || null,expression:m.expr,
            reported_rmse:m.rmse,lo:m.lo,hi:m.hi,poles:m.poles || [],samples,
            parameters:m.spec || null});
        }
        return data;
      });
      Object.assign(result,fit);
      if (fit.models.length !== c.guide_branches.length) {
        result.status = 'no_fit';
      } else {
        await page.evaluate(() => {
          const original=window.StarFit.placeCurves;
          window.StarFit.placeCurves=function(...args){
            const t=performance.now();
            const r=original(...args);
            window.__starExperiment.transferMs=performance.now()-t;
            return r;
          };
        });
        await panel.locator('.star-confirm').click();
        await page.waitForFunction(n => [...document.querySelectorAll('#hand-drawn-on-si-container path.plugin-id-sp')].filter(p => p.getAttribute('d')).length === n, fit.models.length);
        result.rendering = await page.evaluate(() => {
          const si=window.SketchInput.instances['hand-drawn-on'];
          const config=JSON.parse(atob(document.getElementById('hand-drawn-on-sketchresponse-data').textContent));
          const state=JSON.parse(si.getState());
          const paths=[...document.querySelectorAll('#hand-drawn-on-si-container path.plugin-id-sp')].filter(p => p.getAttribute('d'));
          return {
            transfer_ms:window.__starExperiment.transferMs,
            panel_hidden:document.getElementById('hand-drawn-on-star-panel').hidden,
            config,state,gradeable:JSON.parse(si.getGradeable()),
            paths:paths.map(path=>{
              const length=path.getTotalLength();
              const count=Math.max(201,Math.min(1001,Math.ceil(length/2)));
              const points=[];
              for(let i=0;i<=count;i++){
                const p=path.getPointAtLength(length*i/count);
                points.push([p.x,p.y]);
              }
              return {d:path.getAttribute('d'),length,points};
            })
          };
        });
        result.canvas_screenshot = catalog.evidence_dir + '/' + id + '--canvas.png';
        await page.locator('#hand-drawn-on-si-container').screenshot({path:result.canvas_screenshot});
        result.status = result.rendering.panel_hidden ? 'completed' : 'confirmation_failed';
      }
    } catch(error) {
      result.error=String(error);
      result.error_stack=error.stack;
    } finally {
      result.console_errors=errors;
      result.warning_count=warnings.length;
      result.warning_categories=[...new Set(warnings.map(x=>x.startsWith('Failed to decode downloaded font')?'font_decode':x.startsWith('OTS parsing error')?'font_parse':x))];
      page.off('console',onConsole);
      page.off('pageerror',onError);
      result.finished_utc=new Date().toISOString();
      await page.request.post(collector+'/results/'+id,{data:result});
      outcomes.push({id,status:result.status,families:result.models?.map(m=>m.family),
        ink:result.status_text,fit_ms:result.fit_ms,error:result.error});
    }
  }
  return outcomes;
}
