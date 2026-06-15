// main.js - renderer bootstrap, post pipeline, scroll wiring
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { buildWorld, updateWorld, smoothDamp } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// ---------- renderer ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR_CAP = isTouch ? 1.5 : 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
// near plane at 1 (not 0.1): nothing comes within 1 unit of the camera, and the
// tighter near/far ratio gives ~10x better depth precision, which keeps the
// wireframe edges from z-fighting their own faces out where the structures sit.
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 500);

const world = buildWorld(scene);

// ---------- selective bloom ----------
// The wireframe edges are bright but only 1px wide. UnrealBloom builds its glow
// from a chain of half-resolution mips, and at those low resolutions a thin line
// only lands on scattered texels, which blur into discrete beads that crawl and
// pulse as the scene animates. No amount of MSAA / depth fixing helps, because it
// happens inside the bloom downsampler, not the primary render.
//
// Fix: the box edges live on their own layer (BLOOM_EXCLUDE) that the bloom pass
// does not render. We bloom only the genuine light-work (route, screens, hero,
// hot bar, labels), then composite the crisp edges back on top. The edges stay
// exactly as bright as before, they just no longer feed the bloom that beads them.
const BLOOM_EXCLUDE = 1;
camera.layers.enable(BLOOM_EXCLUDE); // edges are part of the final composited image

const DPR = Math.min(window.devicePixelRatio, DPR_CAP);
const makeRT = () => new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: isTouch ? 0 : 4, // MSAA: smooth, stable edges through the post pipeline
});

const renderScene = new RenderPass(scene, camera);

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isTouch ? 0.7 : 0.92,   // strength
  0.45,                    // radius
  0.40                     // threshold
);
const bloomComposer = new EffectComposer(renderer, makeRT());
bloomComposer.renderToScreen = false;
bloomComposer.setPixelRatio(DPR);
bloomComposer.setSize(window.innerWidth, window.innerHeight);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloom);

// composite: full crisp scene (incl. edges) + the bloom of the light-work only
const mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: bloomComposer.renderTarget2.texture },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }
  `,
}), 'baseTexture');

const composer = new EffectComposer(renderer, makeRT());
composer.setPixelRatio(DPR);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(renderScene);
composer.addPass(mixPass);
composer.addPass(new OutputPass());

// ---------- smooth scroll ----------
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ---------- master scroll progress over the flow section ----------
const state = {
  target: 0,
  progress: 0,
  velocity: 0,
  smoothTime: reducedMotion ? 0.001 : (isTouch ? 0.1 : 0.16),
  entrance: reducedMotion ? 1 : 0,
  entrancePlaying: !reducedMotion,
  parallax: new THREE.Vector2(),
  pointer: new THREE.Vector2(),
};

ScrollTrigger.create({
  trigger: '#flow',
  start: 'top bottom',
  end: 'bottom bottom',
  scrub: true,
  onUpdate: (self) => { state.target = self.progress; },
});

// per-step track fills and card reveals, timed to the scene's facility markers
const mk = world.markers;
// Each track bar fills as its facility is approached and reads FULL exactly when
// the card is centered on screen (== the camera's facility marker, post the -50vh
// card lift in CSS): forge 0.13, cfg 0.375, repo 0.625, field 0.875.
const stepWindows = [
  [0.02, 0.13],
  [0.21, 0.375],
  [0.46, 0.625],
  [0.68, 0.875],
];
// Each card fades in CARD_LEAD before its facility reaches focus, so the text is
// arriving WHILE the section scrolls into view rather than as it leaves. Raise
// CARD_LEAD to make the copy appear even earlier, lower it to appear later.
const CARD_LEAD = 0.16;
const cardThresholds = [0.02, mk.pCfg - CARD_LEAD, mk.pRepo - CARD_LEAD, mk.pField - CARD_LEAD];
const fills = [...document.querySelectorAll('.flow__track-fill')];
const cards = [...document.querySelectorAll('.flow__card')];

// ---------- hero entrance (vectr-style perspective drop-in) ----------
if (!reducedMotion) {
  gsap.set('.hero__title .hl, .hero__subtitle .hl', {
    opacity: 0,
    transformPerspective: 1000,
    x: 90,
    y: 60,
    rotateY: 38,
    rotateX: 18,
  });
  gsap.set('.hsbtn-in', { yPercent: 130 });
  const tl = gsap.timeline({ delay: 0.25 });
  tl.to('.hero__title .hl', {
    opacity: 1, x: 0, y: 0, rotateY: 0, rotateX: 0,
    duration: 1.4, stagger: 0.09, ease: 'expo.out',
  })
    .to('.hero__subtitle .hl', {
      opacity: 1, x: 0, y: 0, rotateY: 0, rotateX: 0,
      duration: 1.2, stagger: 0.08, ease: 'expo.out',
    }, '-=1.0')
    .to('.hsbtn-in', { yPercent: 0, duration: 0.9, ease: 'expo.out' }, '-=0.8');
}

// section reveals
gsap.utils.toArray('.feature, .integration__rows li').forEach((el) => {
  gsap.from(el, {
    opacity: 0, y: 28, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' },
    immediateRender: !reducedMotion,
  });
});

// ---------- easter egg: click the glowing rod on the forge ----------
// The raycaster tests only layer 2, which holds the invisible hit proxy around the
// forge rod (see scene.js). Clicking it pops the reactor-rod image onto the page
// and sends it floating away hastily.
const eggRay = new THREE.Raycaster();
eggRay.layers.set(2);
const eggNdc = new THREE.Vector2();
let lastEgg = 0;
function spawnRod(x, y) {
  const img = document.createElement('img');
  img.src = 'assets/egg/nuclear.gif';
  img.alt = '';
  img.className = 'egg-rod';
  img.style.left = `${x}px`;
  img.style.top = `${y}px`;
  document.body.appendChild(img);
  const dir = Math.random() < 0.5 ? -1 : 1;
  // pop in small with a quick pivot...
  gsap.fromTo(img,
    { opacity: 0, scale: 0.32, rotation: dir * -14, xPercent: -50, yPercent: -50 },
    { opacity: 1, scale: 0.85, rotation: 0, duration: 0.15, ease: 'back.out(2.6)' });
  // ...then rush toward the viewer (scale way up) while pivoting off the screen edge
  gsap.to(img, {
    scale: 4.6,
    x: dir * (window.innerWidth * 0.62),
    y: -window.innerHeight * 0.28,
    rotation: dir * 92,
    opacity: 0,
    duration: 0.8,
    delay: 0.13,
    ease: 'power3.in',          // accelerates as it comes at you
    onComplete: () => img.remove(),
  });
  // backstop: guarantee cleanup even if the rAF-driven tween is throttled
  setTimeout(() => img.remove(), 2600);
}
window.addEventListener('pointerdown', (e) => {
  if (!world.forgeItem) return;
  eggNdc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  eggRay.setFromCamera(eggNdc, camera);
  if (!eggRay.intersectObject(world.forgeItem, false).length) return;
  const now = performance.now();
  if (now - lastEgg < 250) return;  // debounce
  lastEgg = now;
  spawnRod(e.clientX, e.clientY);
});

// ---------- idle auto-advance: the tour rides itself until the viewer takes over ----------
const flowEl = document.querySelector('#flow');
// `pos` is a float accumulator for the auto-tour scroll target. Reading window.scrollY
// back each frame quantises to integer pixels, and at ~1-2px of advance per frame that
// rounding makes the step jitter between 1 and 2px (sometimes 0) - a visible stutter.
// Accumulating a float and commanding Lenis to it keeps the motion perfectly even.
const auto = { lastInput: performance.now(), idleMs: 4000, tourSecs: 55, dwellMs: 4000, pos: null };
const markInput = () => { auto.lastInput = performance.now(); auto.pos = null; };
['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, markInput, { passive: true }));

// reading a one-pager in another tab: rAF freezes there; resume the tour
// shortly after the viewer comes back
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    auto.lastInput = performance.now() - auto.idleMs + 1500;
    auto.pos = null; // reseed from wherever the page actually sits
  } else {
    auto.lastInput = performance.now();
  }
});

function autoAdvance(dt) {
  if (reducedMotion) return;
  if (performance.now() - auto.lastInput < auto.idleMs) { auto.pos = null; return; }
  const flowEnd = flowEl.offsetTop + flowEl.offsetHeight - window.innerHeight;
  if (auto.pos === null) auto.pos = window.scrollY; // seed once where the viewer left off
  if (auto.pos >= flowEnd - 1) return; // story complete; hand the page back
  const speed = flowEnd / auto.tourSecs; // px per second through the whole ride
  auto.pos = Math.min(flowEnd, auto.pos + speed * dt); // float accumulator, no read-back
  if (lenis) lenis.scrollTo(auto.pos, { immediate: true });
  else window.scrollTo(0, auto.pos);
}

// ---------- camera hold at the first location (text keeps flowing) ----------
// The camera pauses ~4s on the forge, but the TEXT is NOT paused: cards and track
// fills stay on state.progress, so the words advance into place during the hold.
// The camera tracks (state.progress - lag): lag grows to pin the camera on the
// forge through the hold, then eases back to 0 so the camera rejoins the text and
// the rest of the tour (including the finale) still plays in full. Idle-tour only.
const camHold = {
  lag: 0, until: 0, holdP: 0, started: false,
  progress(dt) {
    const now = performance.now();
    const p = state.progress;
    const idle = (now - auto.lastInput) >= auto.idleMs;
    if (p < 0.04) { this.lag = 0; this.until = 0; this.started = false; }
    else if (!this.started && idle && p >= 0.08 && p < 0.16) {
      this.started = true; this.holdP = p; this.until = now + auto.dwellMs;
    }
    if (this.started && idle && now < this.until) {
      this.lag = Math.max(this.lag, p - this.holdP);   // hold the camera on the forge
    } else if (this.lag > 1e-3) {
      this.lag *= Math.exp(-0.8 * dt);                  // ease the camera back into sync
      if (this.lag < 1e-3) this.lag = 0;
    }
    return Math.min(1, Math.max(0, p - this.lag));
  },
};

// ---------- pointer parallax ----------
if (!isTouch && !reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    state.pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1)
    );
  });
}

// ---------- adaptive quality: dial DPR + bloom down when the GPU can't hold 50fps ----------
// Post-processing dominates GPU cost here: the scene is drawn twice per frame (once
// for the bloom pass, once for the composite) at the device pixel ratio, so cost
// scales with DPR^2. When sustained frame time slips below ~50fps we step the
// effective resolution and bloom strength down a tier; when it sits comfortably
// above ~58fps for a while we climb a tier back up. The down/up gap plus a settle
// delay between changes keeps it from oscillating. (MSAA sample count is baked into
// the render targets at creation, so it's left alone — DPR already cuts cost faster.)
const BASE_DPR = Math.min(window.devicePixelRatio, DPR_CAP);
const BASE_BLOOM = bloom.strength;
const QUALITY = [
  { dpr: BASE_DPR,                        bloom: 1.00 },   // tier 0: full
  { dpr: Math.max(1.00, BASE_DPR * 0.80), bloom: 0.85 },
  { dpr: Math.max(0.85, BASE_DPR * 0.65), bloom: 0.70 },
  { dpr: Math.max(0.70, BASE_DPR * 0.50), bloom: 0.55 },   // tier 3: lightest
];
let qLevel = 0;
function applyQuality() {
  const q = QUALITY[qLevel];
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(w, h);
  bloomComposer.setPixelRatio(q.dpr); bloomComposer.setSize(w, h); // also resizes the bloom pass
  composer.setPixelRatio(q.dpr);      composer.setSize(w, h);
  bloom.strength = BASE_BLOOM * q.bloom;
}

const fpsMon = {
  frames: 0, accum: 0, sinceChange: 0, warmup: 2.5, goodRun: 0,
  sample(dtReal) {
    // warmup: skip the entrance animation + first-load texture decode hitches
    if (this.warmup > 0) { this.warmup -= dtReal; return; }
    this.frames += 1; this.accum += dtReal; this.sinceChange += dtReal;
    if (this.accum < 0.5) return;             // decide on ~0.5s windows
    const fps = this.frames / this.accum;
    this.frames = 0; this.accum = 0;
    if (this.sinceChange < 1.0) return;       // let the last change settle first
    if (fps < 50 && qLevel < QUALITY.length - 1) {
      qLevel += 1; applyQuality(); this.sinceChange = 0; this.goodRun = 0;
    } else if (fps > 58 && qLevel > 0) {
      this.goodRun += 1;                       // require a sustained good run before climbing back
      if (this.goodRun >= 4) { qLevel -= 1; applyQuality(); this.sinceChange = 0; this.goodRun = 0; }
    } else {
      this.goodRun = 0;
    }
  },
};

// ---------- RAF ----------
const clock = new THREE.Clock();
function raf() {
  const rawDt = clock.getDelta();    // true frame time, fed to the fps monitor
  const dt = Math.min(rawDt, 0.05);  // capped for a stable simulation step

  const d = smoothDamp(state.progress, state.target, state.velocity, state.smoothTime, dt);
  state.progress = d.value;
  state.velocity = d.velocity;

  if (state.entrancePlaying) {
    state.entrance = Math.min(1, state.entrance + dt / 1.8);
    if (state.entrance >= 1) state.entrancePlaying = false;
  }

  autoAdvance(dt);
  fpsMon.sample(rawDt);

  const k = 1 - Math.exp(-1.5 * dt);
  state.parallax.lerp(state.pointer, k);

  // camera rides the held progress; text (cards/fills below) rides state.progress
  updateWorld(world, camera, camHold.progress(dt), state.entrance, state.parallax);

  fills.forEach((f, i) => {
    const [a, b] = stepWindows[i];
    const v = Math.min(1, Math.max(0, (state.progress - a) / (b - a)));
    f.style.transform = `scaleX(${v})`;
  });
  cards.forEach((c, i) => {
    c.classList.toggle('is-live', state.progress >= cardThresholds[i]);
  });

  // pass 1: bloom only the light-work (edges hidden on the excluded layer)
  camera.layers.disable(BLOOM_EXCLUDE);
  bloomComposer.render();
  // pass 2: full crisp scene with edges, plus the bloom composited on top
  camera.layers.enable(BLOOM_EXCLUDE);
  composer.render();
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();   // re-applies size at the current quality tier (DPR + bloom)
  ScrollTrigger.refresh();
});

// expose a debug hook for devtools verification
window.__fabric = {
  state, camera, scene, world, composer, bloomComposer, bloom, renderer, BLOOM_EXCLUDE, camHold,
  applyQuality, QUALITY, fpsMon, qualityLevel: () => qLevel, setQuality: (n) => { qLevel = Math.max(0, Math.min(QUALITY.length - 1, n)); applyQuality(); },
};
