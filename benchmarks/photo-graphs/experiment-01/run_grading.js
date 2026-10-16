// Substitute __REPLAY_FUNCTION__ with the case runner using __CASE_IDS__ = [id]
// and the signature async (page, id), so each replay receives its selected case.
async (page) => {
  const collector='http://127.0.0.1:8767';
  const catalog=await (await page.request.get(collector+'/catalog.json')).json();
  const replay=__REPLAY_FUNCTION__;
  const outcomes=[];
  for(const id of ['controlled--02-parabola--clean','controlled--03-shifted-parabola--clean']) {
    await replay(page,id);
    const result={id:'probe-grade-'+(id.includes('shifted')?'shifted':'clean'),status:'completed',case_id:id,started_utc:new Date().toISOString()};
    result.before_submission=await page.evaluate(()=>{
      const si=window.SketchInput.instances['hand-drawn-off'];
      const config=JSON.parse(atob(document.getElementById('hand-drawn-off-sketchresponse-data').textContent));
      window.StarFit.placeCurve(si,config,'sp2',window.StarFit.sampleCurve({lo:-2.2,hi:2.2,f:x=>x*x},16));
      return {photo_answer:JSON.parse(window.SketchInput.instances['hand-drawn-on'].getState()),control_answer:JSON.parse(si.getState()),photo_expression:window.__starExperiment.model.expr};
    });
    await page.getByRole('button',{name:'Save & Grade',exact:true}).click();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(()=>document.body.innerText.includes('Submitted answer'));
    result.url=page.url();
    result.body_text=await page.locator('body').innerText();
    result.grade_dom=await page.locator('[class*=score], [class*=grade], .alert').evaluateAll(els=>els.map(el=>({class:el.className,text:el.textContent.trim()})).filter(x=>x.text));
    result.screenshot=catalog.evidence_dir+'/'+result.id+'.png';
    await page.screenshot({path:result.screenshot,fullPage:true});
    result.finished_utc=new Date().toISOString();
    await page.request.post(collector+'/results/'+result.id,{data:result});
    outcomes.push({id:result.id,text:result.body_text.slice(-9000),grade_dom:result.grade_dom});
  }
  return outcomes;
}
