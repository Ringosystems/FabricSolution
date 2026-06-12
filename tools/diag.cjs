// diag.cjs - verify the feed-source icons (load, key-to-green, bob) + bloom fix.
// Serve first: python -m http.server 8123 --directory .  then: node tools/diag.cjs
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800); // let the icon textures decode + process

  const setScroll = async (p) => {
    await page.evaluate((pp) => {
      const f = document.querySelector('#flow');
      const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(s + (e - s) * pp), behavior: 'instant' });
    }, p);
    await page.waitForTimeout(850);
  };

  // sweep the early forge moment to locate the feed pylons + their icons
  for (const p of [0.02, 0.05, 0.08, 0.11]) {
    await setScroll(p);
    await page.screenshot({ path: `shots/feed-p${String(p).replace('.', '')}.png` });
  }

  // hold one view, two frames ~0.5s apart, to confirm the icons bob
  await setScroll(0.05);
  await page.screenshot({ path: 'shots/feed-bob-0.png' });
  await page.waitForTimeout(550);
  await page.screenshot({ path: 'shots/feed-bob-1.png' });

  const info = await page.evaluate(() => {
    const ic = window.__fabric.world.anim.feederIcons || [];
    return {
      iconCount: ic.length,
      loaded: ic.map((i) => !!i.spr.material.map),
      ys: ic.map((i) => +i.spr.position.y.toFixed(2)),
      visible: ic.map((i) => i.spr.visible && i.spr.material.opacity > 0),
    };
  });
  console.log('icons', JSON.stringify(info));
  console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
  await b.close();
})();
