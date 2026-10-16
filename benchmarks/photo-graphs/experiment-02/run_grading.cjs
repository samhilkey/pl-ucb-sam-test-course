const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const exp = __dirname
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
const run = args => {
  const result = spawnSync(cli, ['-s=photo-branch-grading', ...args], {
    cwd: path.resolve(exp, '../../..'), encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024
  })
  const output = (result.stdout || '') + (result.stderr || '')
  fs.appendFileSync(exp + '/results/grading-cli.log', output + '\n')
  if (result.error || result.status !== 0 || output.includes('### Error')) throw result.error || new Error(output.split('### Ran Playwright code')[0])
  const json = output.split('### Result\n')[1]?.split('\n###')[0]
  return json ? JSON.parse(json) : null
}
const cases = [
  ['controlled--06-reciprocal--clean', false],
  ['real--01-multiple-lines-graph-paper', true]
].map(([id, expectOverlapError]) => ({
  id, expectOverlapError, output: exp + '/results/evidence',
  state: JSON.parse(fs.readFileSync(exp + '/results/raw/' + id + '.json')).rendering.state
}))
try {
  run(['open', 'http://localhost:3000/pl/course/1/question/10/preview', '--browser', 'chrome'])
  run(['snapshot'])
  const source = fs.readFileSync(exp + '/run_grading.js', 'utf8').replaceAll('__SAVED_CASES__', JSON.stringify(cases))
  const results = run(['run-code', source])
  fs.writeFileSync(exp + '/results/grading.json', JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify(results.map(r => ({ id: r.id, submittedBranches: r.submitted_branch_count, overlapError: r.overlap_error }))))
  if (results.some(r => r.submitted_branch_count !== 2 || r.overlap_error !== r.expected_overlap_error)) throw new Error('Unexpected submission result; inspect results/grading.json')
} finally {
  run(['close'])
}
