const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const exp = __dirname;
const worktree = path.resolve(exp, '../../..');
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli';
const session = 'photo-coverage-benchmark';
fs.mkdirSync(exp + '/results', {recursive:true});
function run(args) {
  const p = spawnSync(cli, ['-s=' + session, ...args], {
    cwd:worktree, encoding:'utf8', timeout:180000, maxBuffer:16*1024*1024
  });
  const output = (p.stdout || '') + (p.stderr || '');
  fs.appendFileSync(exp + '/results/browser-cli.log', output + '\n');
  if (p.error || p.status !== 0 || output.includes('### Error')) {
    throw p.error || new Error(output.split('### Ran Playwright code')[0]);
  }
  const json = output.split('### Result\n')[1]?.split('\n###')[0];
  return json ? JSON.parse(json) : null;
}
try {
  run(['open', 'http://localhost:3000/pl/course/1/question/10/preview', '--browser', 'chrome']);
  run(['snapshot']);
  const catalog = JSON.parse(fs.readFileSync(worktree + '/benchmarks/photo-graphs/experiment-01/catalog.json'));
  const ids = catalog.cases.map(c => c.id).filter(id => !fs.existsSync(exp + '/results/raw/' + id + '.json'));
  const source = fs.readFileSync(exp + '/run_cases.js', 'utf8');
  for (let i = 0; i < ids.length; i += 3) {
    const result = run(['run-code', source.replaceAll('__CASE_IDS__', JSON.stringify(ids.slice(i, i+3)))]);
    console.log('Completed', JSON.stringify(result));
    if (result.some(r => r.status !== 'completed')) throw new Error('Benchmark case failed; inspect the archived raw result.');
  }
  const browser = run(['run-code', 'async (page) => ({version:page.context().browser().version(),userAgent:await page.evaluate(()=>navigator.userAgent)})']);
  fs.writeFileSync(exp + '/results/browser.json', JSON.stringify(browser, null, 2) + '\n');
} finally {
  run(['close']);
}
