// timing.cjs - confirm each flow card's reveal threshold now fires while its
// facility is approaching focus (not as it leaves).
// Note: reduced-motion forces cards visually open, so we read the is-live CLASS
// (the JS toggle still runs) and screenshot the 3D framing at each progress.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  if (!fs.existsSync('shots')) fs.mkdirSync('shots');
  const b = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await b.newPage({ viewport: { width: 760, height: 1100 }, deviceScaleFactor: 2 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const at = async (p, name) => {
    await page.evaluate((pp) => {
      const f = document.querySelector('#flow');
      const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(s + (e - s) * pp), behavior: 'instant' });
    }, p);
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({
      prog: +window.__fabric.state.progress.toFixed(3),
      live: [...document.querySelectorAll('.flow__card')].map((c) => c.classList.contains('is-live')),
    }));
    await page.screenshot({ path: `shots/timing-${name}.png` });
    console.log(name.padEnd(14), JSON.stringify(r));
  };

  // ConfigFabric: card1 trigger (0.215) vs its focus (0.375)
  await at(0.215, 'cfg-trigger');
  await at(0.375, 'cfg-focus');
  // RepoFabric: card2 trigger (0.465) vs focus (0.625)
  await at(0.465, 'repo-trigger');
  await at(0.625, 'repo-focus');
  // field: card3 trigger (0.64) vs focus (0.80)
  await at(0.64, 'field-trigger');

  console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  await b.close();
})();
