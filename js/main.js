// main.js - renderer bootstrap, post pipeline, scroll wiring
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);

const world = buildWorld(scene);

// ---------- bloom ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isTouch ? 0.7 : 0.92,   // strength
  0.45,                    // radius
  0.32                     // threshold: only the boosted line heads + bright teal glow
);
composer.addPass(bloom);
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
const stepWindows = [
  [0.04, 0.24],
  [0.27, 0.49],
  [0.52, 0.74],
  [0.77, 0.96],
];
const cardThresholds = [0.02, mk.pCfg - 0.07, mk.pRepo - 0.07, mk.pField - 0.06];
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

// ---------- idle auto-advance: the tour rides itself until the viewer takes over ----------
const flowEl = document.querySelector('#flow');
const auto = { lastInput: performance.now(), idleMs: 4000, tourSecs: 55 };
const markInput = () => { auto.lastInput = performance.now(); };
['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, markInput, { passive: true }));

// reading a one-pager in another tab: rAF freezes there; resume the tour
// shortly after the viewer comes back
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    auto.lastInput = performance.now() - auto.idleMs + 1500;
  } else {
    auto.lastInput = performance.now();
  }
});

function autoAdvance(dt) {
  if (reducedMotion) return;
  if (performance.now() - auto.lastInput < auto.idleMs) return;
  const flowEnd = flowEl.offsetTop + flowEl.offsetHeight - window.innerHeight;
  const y = window.scrollY;
  if (y >= flowEnd - 1) return; // story complete; hand the page back
  const speed = flowEnd / auto.tourSecs; // px per second through the whole ride
  const next = Math.min(flowEnd, y + speed * dt);
  if (lenis) lenis.scrollTo(next, { immediate: true });
  else window.scrollTo(0, next);
}

// ---------- pointer parallax ----------
if (!isTouch && !reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    state.pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1)
    );
  });
}

// ---------- RAF ----------
const clock = new THREE.Clock();
function raf() {
  const dt = Math.min(clock.getDelta(), 0.05);

  const d = smoothDamp(state.progress, state.target, state.velocity, state.smoothTime, dt);
  state.progress = d.value;
  state.velocity = d.velocity;

  if (state.entrancePlaying) {
    state.entrance = Math.min(1, state.entrance + dt / 1.8);
    if (state.entrance >= 1) state.entrancePlaying = false;
  }

  autoAdvance(dt);

  const k = 1 - Math.exp(-1.5 * dt);
  state.parallax.lerp(state.pointer, k);

  updateWorld(world, camera, state.progress, state.entrance, state.parallax);

  fills.forEach((f, i) => {
    const [a, b] = stepWindows[i];
    const v = Math.min(1, Math.max(0, (state.progress - a) / (b - a)));
    f.style.transform = `scaleX(${v})`;
  });
  cards.forEach((c, i) => {
    c.classList.toggle('is-live', state.progress >= cardThresholds[i]);
  });

  composer.render();
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

// expose a debug hook for devtools verification
window.__fabric = { state, camera, scene, world };
