const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const exp = __dirname;
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli';
function run(args) {
  const p = spawnSync(cli, ['-s=photo-coverage-gallery', ...args], {
    cwd:path.resolve(exp, '../../..'), encoding:'utf8', timeout:180000, maxBuffer:8*1024*1024
  });
  const output = (p.stdout || '') + (p.stderr || '');
  if (p.error || p.status !== 0 || output.includes('### Error')) throw p.error || new Error(output);
  const result = output.split('### Result\n')[1]?.split('\n###')[0];
  return result ? JSON.parse(result) : null;
}
async function inspect(page, output) {
  const errors = [];
  page.on('console', msg => {if (msg.type() === 'error') errors.push(msg.text());});
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({width:1600, height:1200});
  await page.goto('http://127.0.0.1:8769/experiment-03/gallery.html');
  const identity = {url:page.url(), title:await page.title(), heading:await page.locator('h1').innerText()};
  if (!identity.title.includes('Complete-branch fitting') || await page.locator('details').count() !== 33) throw new Error('Wrong or incomplete gallery');
  await page.locator('img').evaluateAll(images => images.forEach(img => {img.loading = 'eager';}));
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  const changed = page.locator('#real--04-piecewise-curved-section');
  await changed.locator('summary').click();
  await changed.screenshot({path:output + '/gallery--changed-model.png'});
  const images = await page.locator('img').evaluateAll(elements => elements.map(i => ({src:i.getAttribute('src'), loaded:i.complete && i.naturalWidth > 0})));
  await page.setViewportSize({width:390, height:844});
  await changed.screenshot({path:output + '/gallery--mobile.png'});
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (!noOverflow || errors.length) throw new Error('Gallery overflow or console error: ' + JSON.stringify(errors));
  return {identity, entries:33, loaded_images:images.length, images, mobile_viewport:[390,844], mobile_no_horizontal_overflow:noOverflow, console_errors:errors};
}
try {
  run(['open', 'http://127.0.0.1:8769/experiment-03/gallery.html', '--browser', 'chrome']);
  run(['snapshot']);
  const result = run(['run-code', 'async (page) => (' + inspect.toString() + ')(page, ' + JSON.stringify(exp + '/results/evidence') + ')']);
  fs.writeFileSync(exp + '/results/gallery-qa.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({entries:result.entries, images:result.loaded_images, mobile_no_horizontal_overflow:result.mobile_no_horizontal_overflow, console_errors:result.console_errors}));
} finally {
  run(['close']);
}
