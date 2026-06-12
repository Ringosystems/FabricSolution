// confirm.cjs - after the -50vh card lift: card center crossings should land on
// the facility markers, and at each facility's prominent moment the card should be
// up/readable (not stuck at the bottom). Screenshots saved for visual sign-off.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  if (!fs.existsSync('shots')) fs.mkdirSync('shots');
  const b = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await b.newPage({ viewport: { width: 1180, height: 740 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  // card-center crossing of screen center, with the real CSS (no override)
  const cross = await page.evaluate(async () => {
    const F = window.__fabric, f = document.querySelector('#flow');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const center = (i) => { const c = document.querySelectorAll('.flow__card')[i].getBoundingClientRect(); return ((c.top + c.bottom) / 2) / innerHeight; };
    const out = [null, null, null, null]; let prev = [null, null, null, null];
    for (let k = 0; k <= 200; k++) {
      const p = k / 200, s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(s + (e - s) * p), behavior: 'instant' });
      F.state.target = p; F.state.progress = p; F.state.velocity = 0; F.camHold.lag = 0;
      await sleep(4);
      for (let i = 0; i < 4; i++) { const y = center(i); if (out[i] === null && prev[i] !== null && prev[i] > 0.5 && y <= 0.5) out[i] = +p.toFixed(3); prev[i] = y; }
    }
    return out;
  });
  console.log('card-center crossings [forge, cfg, repo, plane]:', JSON.stringify(cross));
  console.log('expected facility markers:                       [0.125, 0.375, 0.625, 0.875]');

  const shot = async (p, name) => {
    const info = await page.evaluate((pp) => {
      const F = window.__fabric, f = document.querySelector('#flow');
      const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(s + (e - s) * pp), behavior: 'instant' });
      F.state.target = pp; F.state.progress = pp; F.state.velocity = 0; F.camHold.lag = 0;
      return null;
    }, p);
    await page.waitForTimeout(260);
    const r = await page.evaluate(() => {
      const F = window.__fabric;
      const cy = [...document.querySelectorAll('.flow__card')].map((c) => { const b = c.getBoundingClientRect(); return +(((b.top + b.bottom) / 2) / innerHeight).toFixed(2); });
      const projY = (o) => +(((1 - o.position.clone().project(F.camera).y) / 2)).toFixed(2);
      return { cardY: cy, facCfgY: projY(F.world.labels.cfg), opCfg: +F.world.labels.cfg.material.opacity.toFixed(2), opRepo: +F.world.labels.repo.material.opacity.toFixed(2) };
    });
    await page.screenshot({ path: `shots/confirm-${name}.png` });
    console.log(name.padEnd(16), JSON.stringify(r));
  };
  await shot(0.375, 'cfg-marker');
  await shot(0.42, 'cfg-prominent');
  await shot(0.625, 'repo-marker');
  await shot(0.875, 'plane');
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  await b.close();
})();
