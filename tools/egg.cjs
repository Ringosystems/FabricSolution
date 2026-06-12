// egg.cjs - verify the forge-rod easter egg: clicking the rod spawns the floating
// image; clicking empty space does not. Also seeds a placeholder image so the egg
// is visible until the real Simpsons frame is dropped in at assets/egg/nuclear.png.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  if (!fs.existsSync('shots')) fs.mkdirSync('shots');
  const b = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await b.newPage({ viewport: { width: 760, height: 1100 }, deviceScaleFactor: 2 });

  // seed a placeholder only if the real image is not present yet
  if (!fs.existsSync('assets/egg/nuclear.gif') && !fs.existsSync('assets/egg/nuclear.png')) {
    await page.goto('about:blank');
    const durl = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 480; c.height = 340;
      const x = c.getContext('2d');
      x.fillStyle = '#0a160b'; x.fillRect(0, 0, 480, 340);
      x.strokeStyle = '#66FF14'; x.lineWidth = 10; x.strokeRect(14, 14, 452, 312);
      x.fillStyle = '#66FF14'; x.textAlign = 'center';
      x.font = 'bold 46px monospace'; x.fillText('REACTOR ROD', 240, 160);
      x.font = '24px monospace'; x.fillText('(placeholder)', 240, 210);
      return c.toDataURL('image/png');
    });
    fs.writeFileSync('assets/egg/nuclear.png', Buffer.from(durl.split(',')[1], 'base64'));
    console.log('seeded placeholder assets/egg/nuclear.png');
  }

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // forge framing
  await page.evaluate(() => {
    const f = document.querySelector('#flow');
    const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
    scrollTo({ top: Math.round(s + (e - s) * 0.06), behavior: 'instant' });
  });
  await page.waitForTimeout(900);

  // project the forge rod hit-proxy to screen coords
  const p = await page.evaluate(() => {
    const F = window.__fabric;
    F.scene.updateMatrixWorld(true);
    const v = F.world.forgeItem.position.clone();
    v.setFromMatrixPosition(F.world.forgeItem.matrixWorld);
    v.project(F.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: +v.z.toFixed(3) };
  });
  console.log('rod screen pos', JSON.stringify(p));

  // clean forge frame first (verify the rod color)
  await page.screenshot({ path: 'shots/egg-0-forge.png' });

  // 1) click empty space -> no egg
  await page.mouse.click(40, 980);
  await page.waitForTimeout(120);
  const afterEmpty = await page.evaluate(() => document.querySelectorAll('.egg-rod').length);

  // 2) click the rod -> egg spawns, then flies toward the viewer and off
  await page.mouse.click(Math.round(p.x), Math.round(p.y));
  await page.waitForTimeout(170);
  const afterRod = await page.evaluate(() => document.querySelectorAll('.egg-rod').length);
  await page.screenshot({ path: 'shots/egg-1-popin.png' });
  await page.waitForTimeout(380);   // ~550ms in: mid fly-toward-viewer
  await page.screenshot({ path: 'shots/egg-2-fly.png' });

  // it should clean itself up after the animation
  await page.waitForTimeout(1700);
  const afterDone = await page.evaluate(() => document.querySelectorAll('.egg-rod').length);

  console.log(JSON.stringify({ afterEmptyClick: afterEmpty, afterRodClick: afterRod, afterAnimDone: afterDone }));
  console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  await b.close();
})();
