const fs = require('node:fs');
const {spawnSync,execFileSync} = require('node:child_process');
const path = require('node:path');
const exp = __dirname;
const worktree = path.resolve(exp,'../../..');
const root = worktree;
const comparisonBase = JSON.parse(fs.readFileSync(exp+'/provenance.json')).comparison_base;
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli';
const session='photo-branch-benchmark';
fs.mkdirSync(exp+'/results',{recursive:true});
function run(args){
 const p=spawnSync(cli,['-s='+session,...args],{cwd:worktree,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 const output=(p.stdout||'')+(p.stderr||'');
 fs.appendFileSync(exp+'/results/browser-cli.log',output+'\n');
 if(p.error||p.status!==0||output.includes('### Error'))throw p.error||new Error(output.split('### Ran Playwright code')[0]);
 const json=output.split('### Result\n')[1]?.split('\n###')[0];
 return json?JSON.parse(json):null;
}
const sources=Object.fromEntries(['star-photo.js','star-fit.js','pl-sketch.js'].map(name=>[name,execFileSync('git',['show',comparisonBase+':elements/pl-sketch/'+name],{cwd:root,encoding:'utf8'})]));
const check=require(root+'/tests/star-photo-branches.cjs').toString().replace('for (const fixture of fixtures) {','for (const fixture of fixtures.filter(f => f.id === "two-lines")) {');
const negative=`async (page) => {const sources=${JSON.stringify(sources)}; let served=0;
for(const [name,body] of Object.entries(sources)) await page.route(url=>new URL(url).pathname.endsWith('/'+name),route=>{served++;return route.fulfill({contentType:'application/javascript',body});});
try { await (${check})(page,{url:'http://localhost:3000/pl/course/1/question/10/preview',output:${JSON.stringify(exp+'/results/evidence')}});throw new Error('Old source unexpectedly passed');}
catch(error){if(error.message!=='two-lines: every traced branch reaches the fitter'||served!==3)throw error;
await page.locator('#hand-drawn-on-star-panel').screenshot({path:${JSON.stringify(exp+'/results/evidence/baseline-dropped-branch.png')}});
return {source_commit:${JSON.stringify(execFileSync('git',['rev-parse',comparisonBase],{cwd:root,encoding:'utf8'}).trim())},served_scripts:served,expected_failure:error.message};}}`;
try{
 run(['open','http://localhost:3000/pl/course/1/question/10/preview','--browser','chrome']);
 run(['snapshot']);
 if(!fs.existsSync(exp+'/results/negative-control.json')){
 const proof=run(['run-code',negative]);
 fs.writeFileSync(exp+'/results/negative-control.json',JSON.stringify(proof,null,2)+'\n');
 console.log('Negative control:',JSON.stringify(proof));
 } else console.log('Preserved passing negative control against master.');
 run(['close']);
 run(['open','http://localhost:3000/pl/course/1/question/10/preview','--browser','chrome']);
 run(['snapshot']);
 const catalog=JSON.parse(fs.readFileSync(worktree+'/benchmarks/photo-graphs/experiment-01/catalog.json'));
 const ids=catalog.cases.map(c=>c.id).filter(id=>!fs.existsSync(exp+'/results/raw/'+id+'.json'));
 const source=fs.readFileSync(exp+'/run_cases.js','utf8');
 for(let i=0;i<ids.length;i+=3){
  const result=run(['run-code',source.replaceAll('__CASE_IDS__',JSON.stringify(ids.slice(i,i+3)))]);
  console.log('Completed',JSON.stringify(result));
  if(result.some(r=>r.status!=='completed'))throw new Error('Benchmark case failed; inspect the archived raw result before continuing.');
 }
 const browser=run(['run-code',"async (page) => ({version:page.context().browser().version(),userAgent:await page.evaluate(()=>navigator.userAgent)})"]);
 fs.writeFileSync(exp+'/results/browser.json',JSON.stringify(browser,null,2)+'\n');
}finally{run(['close']);}
