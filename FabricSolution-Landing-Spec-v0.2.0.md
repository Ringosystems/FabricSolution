# FabricSolution Landing Experience - OpenSpec
Version: 0.2.0
Date: 2026-06-10
Status: AS-BUILT - v0.2.0 implemented, headless-verified, delivered to
C:\Dev\FabricSolution\site. GPU visual pass on dev workstation pending.
Style references: https://www.vectrfl.com (motion/concept, teardown in
Section 7) and the Fabric Suite one-pagers in C:\Dev\FabricSolution
(brand/copy authority).

## 1. Purpose

When a visitor lands on the FabricSolution page, the system shall present a
scroll-activated 3D narrative that walks them through DSCForge, ConfigFabric,
and RepoFabric, closing visually into the unified Fabric Suite loop,
replicating the vectrfl.com glowing-path concept using Three.js, GSAP
ScrollTrigger, and Lenis, styled to the Fabric Suite brand.

## 2. Scope

In scope:
- Single landing page (hero, scroll flow, features, integration, CTA, footer)
- WebGL scene: navy floor + grid, three input feeders, one main route,
  WAN-pull segment, 12 peer arcs, dashed version-lock return arc,
  bloom-driven glow, phase-blended chase camera
- DOM layer synced to scroll progress (step cards 01-04 with track fills)
- Desktop and mobile/tablet behavior (reduced effects on touch devices)

Out of scope (v0.2.0):
- CMS integration, forms backend, analytics
- Secondary pages (docs, pricing)
- Offline asset bundling (CDN import map; see Section 5)

## 3. Requirements (EARS)

### 3.1 Scene and path system
- R1: When the page loads, the system shall render a full-viewport WebGL
  canvas fixed behind the DOM content layer. [BUILT]
- R2: The system shall construct the line network as TubeGeometry meshes over
  CatmullRomCurve3 splines: three input feeders (prompt / GPO / scan)
  converging into the DSCForge facility, one main route visiting
  ConfigFabric and RepoFabric, a WAN-pull segment into the endpoint fleet,
  twelve peer arcs across the fleet grid, and a dashed version-lock return
  arc from the fleet back to ConfigFabric. [BUILT - revised from v0.1.0
  per the suite narrative: the loop is the differentiator]
- R3: While the user scrolls, the system shall reveal each path using a
  uv-progress fragment discard driven by a scrubbed ratio uniform (no
  geometry mutation). Dashed lines use a fract(uv.x * freq) discard. [BUILT]
- R4: The system shall apply an UnrealBloom post-process pass (strength
  0.92 desktop / 0.7 touch, radius 0.45, threshold 0.32), with path
  materials emitting boosted emissive near the draw head (pow(x,4) falloff)
  and a pulse color shift at the tip. [BUILT]
- R5: The system shall mirror path meshes below the floor plane with an
  attenuated mirror material (opacity 0.22) to simulate reflection. [BUILT]

### 3.2 Scroll and camera
- R6: While the user scrolls the flow section, the system shall map
  Lenis-smoothed scroll position through GSAP ScrollTrigger (scrub: true)
  to a master progress value in [0, 1]. [BUILT]
- R7: The system shall smooth-damp camera progress toward target progress
  (smoothTime 0.16 s desktop, 0.1 s touch, ~0 under reduced motion). [BUILT]
- R8: The system shall remap master progress into per-element windows:
  - feeders draw (staggered):      0.02-0.17
  - main route draw:               0.17-0.66
  - WAN pull into fleet:           0.60-0.66
  - peer arcs (staggered):         0.62-0.74
  - version-lock return arc:       0.74-0.90
  - overview lift (finale):        0.86-1.00
  Facility labels fade in/out on their own sub-windows. [BUILT - measured]
- R9: While progress advances, the camera shall follow a phase-blended rig:
  hero establishing shot (-92, 74, -68) -> forge hover (FORGE -10, 32, -46
  rel.) -> oblique chase riding the route (pos = point - tangent * 30 +
  side * (10 + 16 * bank), y = 38, lookAt point +0.06 ahead +tangent * 10)
  -> finale overview (-2, 104, -92 looking at 6, 0, 16), eased by the lift
  window. Quaternion slerp blends pointer-parallax framing. [BUILT - revised
  from v0.1.0: curve-point camera produced a horizonless 72-degree top-down
  view; the oblique chase cam restores the reference's aerial reading]
- R10: When the pointer moves on desktop, the system shall apply a small
  parallax offset to the camera along its local right/up axes. [BUILT]

### 3.3 DOM narrative layer
- R11: The system shall present a hero (H1, subtitle, scroll prompt) with a
  3D-perspective entrance animation matching the reference. [BUILT]
- R12: The system shall present four flow steps, each with number, title,
  description, and a track-fill bar scrubbed in sync with that step's
  progress window ([0.02-0.17], [0.17-0.45], [0.45-0.74], [0.74-0.95]):
  - 01 DSCForge authors and proves
  - 02 ConfigFabric assigns and enforces
  - 03 RepoFabric delivers
  - 04 The loop locks closed
  Copy sourced from the Fabric Suite one-pagers (suite overview, product
  cards, version-lock footnotes). [BUILT - placeholder resolved]
- R13: When a flow step's window completes, the corresponding scene event
  shall be complete (feeder set drawn, route reaching that facility, peer
  arcs lit, lock arc closed). [BUILT]
- R12a (new): The system shall present features (4 suite cards), an
  integration section (the four starred suite differentiators), a CTA, and
  a RingoSystems Heavy Industries footer. [BUILT]

### 3.4 Performance and fallback
- R14: The system shall render via WebGLRenderer with EffectComposer
  UnrealBloomPass. [BUILT - WebGPU/TSL path dropped for v0.2.0; the WebGL
  pipeline is the primary, not a fallback]
- R15: If prefers-reduced-motion is set, the system shall disable smooth
  scroll, the hero entrance, and camera damping, presenting directly framed
  views per step with content fully readable. [BUILT]
- R16: The system shall sustain 60 fps on a mid-range desktop GPU; touch
  devices reduce bloom strength and DPR cap (1.5). [PENDING GPU
  verification - AC6]

### 3.5 Theming
- R17: The system shall use the Fabric Suite brand token set from the
  one-pagers (Q3 resolved: rebrand, not reference palette):
  navy-0 #061830, navy #0B2545, navy-2 #133b6b, panel #10243f,
  teal #1FB6A6, teal-d #0E8C80, teal-l #7fdcd2, ice #E9F9F7,
  line #33506f; facility fill #0e3a36 with teal edges (extruded one-pager
  motif). Type: Archivo (display 800, width 87%), IBM Plex Mono (eyebrows,
  labels, numbers). [BUILT]

## 4. Acceptance criteria

- AC1: GIVEN the page is loaded on desktop Chrome
       WHEN the user scrolls from top to the end of the flow section
       THEN the three feeders draw into the forge, the route draws through
       ConfigFabric and RepoFabric, the pull/peer arcs light the fleet, the
       dashed lock arc closes the loop with visible bloom glow, AND the
       camera follows without pops or orientation flips.
       [VERIFIED headless at progress 0/.10/.30/.55/.68/.85/1.0 - exact
       progress mapping, zero console errors; GPU smoothness pass pending]
- AC2: GIVEN the user stops scrolling mid-flow
       WHEN no input occurs
       THEN camera motion settles smoothly (damped) with no oscillation.
       [PENDING GPU pass]
- AC3: GIVEN step 02 is active
       WHEN its progress window is 50 percent complete
       THEN its track-fill bar reads 50 percent and the route has advanced
       proportionally toward ConfigFabric. [VERIFIED - fills scrub against
       the same master progress]
- AC4: GIVEN any WebGL2-capable browser
       WHEN the page loads
       THEN the scene renders with bloom (no WebGPU dependency). [VERIFIED
       under SwiftShader software GL]
- AC5: GIVEN prefers-reduced-motion is enabled
       WHEN the page loads
       THEN no scroll-scrubbed camera flight smoothing or entrance occurs
       and content remains fully readable. [VERIFIED - the headless harness
       runs in this mode]
- AC6: GIVEN Chrome DevTools performance capture during a full scroll
       WHEN measured on the dev workstation
       THEN long tasks stay under 50 ms and FPS does not drop below 50.
       [PENDING - requires real GPU; software-GL numbers not representative]

## 5. Architecture (as built)

- Static site, no build step (Q1 resolved: plain HTML + ES modules via
  import map). CDN dependencies: three@0.170.0, gsap@3.12.7, lenis@1.1.20
  (jsdelivr) and Google Fonts (Archivo, IBM Plex Mono). Internet required;
  vendoring locally is a possible v0.3 item.
- Files (Q2 resolved: C:\Dev\FabricSolution\site):
  - index.html       hero, 4 flow steps, features, integration, CTA, footer
  - css/main.css     brand tokens, layout, reduced-motion rules
  - js/paths.js      curve control points, glow-tube factory (shader)
  - js/scene.js      world build, window remap table, chase-cam rig,
                     smoothDamp
  - js/main.js       renderer, bloom, Lenis/ScrollTrigger wiring, entrance,
                     RAF, resize, window.__fabric debug hook
  - tools/verify.cjs Playwright headless sweep (keyframes + console errors)
  - README.md        run/verify instructions, window table
- Scene centerpiece (Q4 resolved): stylized product facilities the path
  visits - forge block + chimney and 3 input pylons (DSCForge), stacked
  slabs (ConfigFabric), depot + antenna (RepoFabric), 3x4 endpoint fleet
  grid - extruded from the one-pager motif diagrams, with canvas-sprite
  mono labels including "version lock - fails closed".

## 6. Verification status

1. Headless (DONE, sandbox): Playwright Chromium (SwiftShader), reduced
   motion, instant scroll to 7 keyframes; screenshots reviewed; progress
   mapping exact; zero console/page errors. Iterated camera rig twice from
   screenshot evidence (top-down -> oblique chase; finale widened).
2. GPU pass (PENDING, dev workstation): serve site, Claude in Chrome
   scripted sweep, side-by-side against vectrfl.com, DevTools performance
   trace (AC6), bloom/exposure tuning on real hardware.
3. Reduced-motion and mobile-emulation passes (PARTIAL: reduced-motion
   exercised by the harness; mobile emulation pending).

## 7. Reference teardown (vectrfl.com)

- Astro static site; bundles: CommonScripts (scene + UI), renderer.js
  (BloomNode/UnrealBloom TSL port), vendor (three + gsap + ScrollTrigger +
  lenis).
- Paths: explicit 2D control-point arrays lifted to y=0.15; four red feeder
  splines, main blue route of 7 control points, final straight segment.
- Draw-on: uv().x discard vs scrubbed ratio uniform; emissive boost
  uv().x.div(ratio).pow(4).mul(4) for the hot tip; MRT emissive feeds bloom.
- Camera: rides curve at y=66, lookAt point ahead; remap windows
  (0-0.17, 0.17-0.74, 0.72-0.85, 0.74-0.9); entrance ease-out cubic drop-in;
  pointer parallax; quaternion slerp between follow and offset framing.
- Idle behavior at progress 0: feeder lines self-animate on randomized
  spawn timers (range-window discard) as an attract loop.
- DOM: .hero with perspective text entrance, .flow with 4 steps and
  track-fill bars, sticky-stack sections further down.

## 8. Resolved requirements questions

- Q1: Plain static HTML / ES modules via import map (no Astro). Lowest
  friction to serve, verify, and host anywhere.
- Q2: C:\Dev\FabricSolution\site (subfolder of the marketing repo).
- Q3: Fabric Suite brand (navy/teal from the one-pagers). The dark navy
  scene reads better under bloom than the reference's light palette, and
  the one-pager motif panels are literally this aesthetic.
- Q4: Product facilities the path visits, extruded from the one-pager
  motif diagrams, with the dashed version-lock return arc as the signature
  element closing the loop at step 04.

## 9. Backlog (v0.3 candidates)

- Idle attract loop on feeders at progress 0 (reference parity).
- Vendor CDN dependencies locally for offline/intranet hosting.
- Junction pulse event when the route reaches each facility (R13 polish).
- Mobile-emulation verification pass; bloom mip tuning per device class.
- Real reflective floor (Reflector) behind a quality toggle.

## 10. Version history

- 0.1.0 (2026-06-10): Initial draft from vectrfl.com teardown; placeholder
  copy pending marketing docs access.
- 0.2.0 (2026-06-10): As-built. Marketing copy integrated from the Fabric
  Suite one-pagers; Q1-Q4 resolved; line network extended (pull, peers,
  lock arc); camera rig redesigned to oblique chase after headless
  screenshot review; windows measured and locked; delivered to
  C:\Dev\FabricSolution\site with headless verification harness.
