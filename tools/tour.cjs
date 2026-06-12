// tour.cjs - confirm the idle auto-tour dwells ~4s on the forge before launching
// along the route. Runs WITHOUT reduced-motion so autoAdvance is active; sends no
// input so the idle timer fires, then samples progress over time.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const page = await b.newPage({ viewport: { width: 760, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });

  // pre-position just below the dwell trigger (progress 0.08) WITHOUT user input
  // (programmatic scroll does not reset the idle timer), so the dwell engages fast.
  await page.evaluate(() => {
    const f = document.querySelector('#flow');
    const s = f.offsetTop - innerHeight, e = f.offsetTop + f.offsetHeight - innerHeight;
    scrollTo({ top: Math.round(s + (e - s) * 0.076), behavior: 'instant' });
  });

  const t0 = Date.now();
  const samples = [];
  for (let i = 0; i < 36; i++) {            // ~14.4s at 0.4s spacing
    const s = await page.evaluate(() => {
      const F = window.__fabric;
      return {
        text: +F.state.progress.toFixed(3),                          // drives the cards
        cam: +Math.max(0, F.state.progress - F.camHold.lag).toFixed(3), // drives the camera
      };
    });
    samples.push({ t: ((Date.now() - t0) / 1000).toFixed(1), ...s });
    await page.waitForTimeout(400);
  }
  // text should keep climbing; camera should plateau ~4s near 0.08 then catch up
  console.log(samples.map((s) => `${s.t}s txt=${s.text} cam=${s.cam}`).join('\n'));
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  await b.close();
})();
