// verify.cjs - headless keyframe sweep for the FabricSolution landing
// Serve the site on 127.0.0.1:8123 first, e.g.:
//   python -m http.server 8123
// Then: node tools/verify.cjs
// Uses SwiftShader software GL so it runs without a GPU. Reduced-motion is
// emulated so Lenis does not fight programmatic scroll.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1180, height: 740 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  const mk = await page.evaluate(() => {
    const m = window.__fabric.world.markers;
    return { uCfg: +m.uCfg.toFixed(3), uRepo: +m.uRepo.toFixed(3), uField: +m.uField.toFixed(3),
             pCfg: +m.pCfg.toFixed(3), pRepo: +m.pRepo.toFixed(3), pField: +m.pField.toFixed(3) };
  });
  console.log('markers:', JSON.stringify(mk));
  const at = async (p, name) => {
    await page.evaluate((pp) => {
      const f = document.querySelector('#flow');
      const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(s + (e - s) * pp), behavior: 'instant' });
    }, p);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      prog: +window.__fabric.state.progress.toFixed(3),
      heroVis: window.__fabric.world.hero.g.visible,
      pk: window.__fabric.world.packets.filter(p => p.g.visible).length,
    }));
    await page.screenshot({ path: `shots/${name}.png` });
    console.log(name, JSON.stringify(r));
  };
  await at(0.10, 'v01-forge');
  await at(mk.pCfg, 'v02-belt');
  await at(mk.pRepo, 'v03-aisle');
  await at(0.72, 'v04-corridor');
  await at(0.92, 'v05-lift');
  await at(1.00, 'v06-finale');
  // packet motion check: same scroll, 2.5 s apart
  const a1 = await page.evaluate(() => window.__fabric.world.packets.map(p => +p.g.position.x.toFixed(1)));
  await page.waitForTimeout(2500);
  const a2 = await page.evaluate(() => window.__fabric.world.packets.map(p => +p.g.position.x.toFixed(1)));
  const moved = a1.filter((x, i) => Math.abs(x - a2[i]) > 0.3).length;
  console.log('packets moved over 2.5s:', moved, 'of', a1.length);
  console.log('errors:', errors.length ? errors : 'none');
  await b.close();
})();
