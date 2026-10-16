// Run after a completed photo case; exercise the native editing lifecycle.
async (page) => {
  const collector='http://127.0.0.1:8767';
  const catalog=await (await page.request.get(collector+'/catalog.json')).json();
  const result={id:'probe-stale-fit',status:'completed',started_utc:new Date().toISOString(),checks:[]};
  const panel=page.locator('#hand-drawn-on-star-panel');
  const open=async()=>page.locator('#hand-drawn-on-star-photo-btn').click();
  const clearCanvas=async()=>page.evaluate(()=>{
    const si=window.SketchInput.instances['hand-drawn-on'];
    const state=JSON.parse(si.getState());
    state.data.sp=[];
    si.setState(JSON.stringify(state));
  });
  const state=async()=>page.evaluate(()=>JSON.parse(window.SketchInput.instances['hand-drawn-on'].getState()).data.sp);
  result.original_model=await page.evaluate(()=>({expression:window.__starExperiment.model.expr,lo:window.__starExperiment.model.lo,hi:window.__starExperiment.model.hi}));
  result.original_canvas=await state();
  const nonempty=curves=>curves.filter(branch=>branch.length);
  await open();
  await panel.locator('.star-clear').click();
  await clearCanvas();
  result.cleared_canvas=await state();
  const confirmVisible=await panel.locator('.star-confirm').isVisible();
  await panel.locator('.star-confirm').click();
  result.checks.push({action:'Clear trace, then confirm without rereading',confirm_visible:confirmVisible,canvas:await state()});
  await open();
  await panel.locator('.star-use').click();
  result.empty_trace_message=await panel.locator('.star-status').innerText();
  result.after_empty_trace_confirm_visible=await panel.locator('.star-confirm').isVisible();
  result.empty_trace_screenshot=catalog.evidence_dir+'/probe-empty-trace-stale-fit.png';
  await panel.screenshot({path:result.empty_trace_screenshot});
  const image=catalog.cases.find(c=>c.id==='controlled--01-line--clean').image;
  await panel.locator('input[type=file]').setInputFiles(image);
  await panel.locator('.star-status').filter({hasText:'Place the axes, then trace your curve.'}).waitFor();
  await clearCanvas();
  result.replacement_photo_fit_text=await panel.locator('.star-fit-eq').innerText();
  result.replacement_photo_confirm_visible=await panel.locator('.star-confirm').isVisible();
  result.replacement_screenshot=catalog.evidence_dir+'/probe-replaced-photo-stale-fit.png';
  await panel.screenshot({path:result.replacement_screenshot});
  await panel.locator('.star-confirm').click();
  result.checks.push({action:'Replace photo, then confirm without tracing or fitting',canvas:await state()});
  for(const check of result.checks) {
    const original=nonempty(result.original_canvas), current=nonempty(check.canvas);
    check.same_nonempty_curves_as_original=current.length===original.length && current.every((branch,i)=>branch.length===original[i].length && branch.every((p,j)=>Math.abs(p.x-original[i][j].x)<0.001 && Math.abs(p.y-original[i][j].y)<0.001));
  }
  result.finished_utc=new Date().toISOString();
  await page.request.post(collector+'/results/'+result.id,{data:result});
  return {original_model:result.original_model,empty_trace_message:result.empty_trace_message,checks:result.checks.map(c=>({action:c.action,curve_count:nonempty(c.canvas).length,same_nonempty_curves_as_original:c.same_nonempty_curves_as_original}))};
}
