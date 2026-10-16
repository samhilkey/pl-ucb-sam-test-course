const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const provenance = JSON.parse(fs.readFileSync(__dirname + '/provenance.json'));
function load(commit) {
  const source = execFileSync('git', ['show', commit + ':elements/pl-sketch/star-fit.js'], {cwd:root, encoding:'utf8'});
  const context = {module:{exports:{}}};
  vm.runInNewContext(source, context);
  return context.module.exports;
}
const before = load(provenance.comparison_source_commit);
const after = load(provenance.source_commit);
const cases = [['left', -5, -1.08], ['right', 1.08, 5]].map(([id, lo, hi]) => {
  const points = Array.from({length:81}, (_, i) => {
    const x = lo + (hi-lo)*i/80;
    return [x, 0.8/(1-x*x)];
  });
  const measure = api => {
    const model = api.fit(points);
    const finite = points.filter(([x]) => Number.isFinite(model.f(x))).length;
    return {family:model.family, expression:model.expr, finite_trace_points:finite,
      total_trace_points:points.length, trace_domain_coverage:finite/points.length,
      native_samples:api.sampleCurve(model, 16).length};
  };
  return {id, lo, hi, before:measure(before), after:measure(after)};
});
if (!cases.every(c => c.before.trace_domain_coverage < 1 && c.after.trace_domain_coverage === 1 && c.after.native_samples === 17)) {
  throw new Error('The negative control did not distinguish partial and complete fits.');
}
const result = {comparison_source:provenance.comparison_source_commit, source:provenance.source_commit,
  formula:'y = 0.8 / (1 - x^2)', points_per_branch:81, cases};
fs.writeFileSync(__dirname + '/results/fit-coverage-control.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
