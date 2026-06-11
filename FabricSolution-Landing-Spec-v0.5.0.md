# FabricSolution Landing Experience - OpenSpec
Version: 0.5.0
Date: 2026-06-10
Status: AS-BUILT - v0.5.0 implemented, headless-verified, delivered to
C:\Dev\FabricSolution\site. GPU visual pass on dev workstation pending
(Claude in Chrome extension connection required).
Style references: https://www.vectrfl.com (motion/concept, teardown in
Section 7) and the Fabric Suite one-pagers in C:\Dev\FabricSolution
(brand/copy authority).

## 1. Purpose

When a visitor lands on the FabricSolution page, the system shall present a
scroll-activated 3D narrative that walks them through DSCForge, ConfigFabric,
and RepoFabric, following a freshly minted DSC v3 configuration from the
forge to the endpoint fleet, replicating the vectrfl.com glowing-path
concept using Three.js, GSAP ScrollTrigger, and Lenis, styled to the Fabric
Suite brand.

## 2. Scope

In scope:
- Single landing page (hero, scroll flow, features, integration, CTA, footer)
- WebGL scene: navy floor + grid, three input feeders, one fluid route from
  the forge into the fog past the endpoint field, field-wide peer arcs,
  route traffic (followed hero config + ambient configs), bloom-driven
  glow, phase-blended chase camera, idle auto-advance, one-pager doc links
- DOM layer synced to scroll progress (step cards 01-04 with track fills
  and approach-synced reveals)
- Desktop and mobile/tablet behavior (reduced effects on touch devices)

Out of scope (v0.2.0):
- CMS integration, forms backend, analytics
- Secondary pages (docs, pricing)
- Offline asset bundling (CDN import map; see Section 5)

## 3. Requirements (EARS)

### 3.1 Scene and path system
- R1: When the page loads, the system shall render a full-viewport WebGL
  canvas fixed behind the DOM content layer. [BUILT]
- R2: The system shall construct the line network as TubeGeometry meshes
  over CatmullRomCurve3 splines: three input feeders (prompt / GPO / scan)
  converging into the DSCForge facility, and ONE fluid curved route that
  leaves the forge, runs along the ConfigFabric conveyor, blazes down the
  RepoFabric library aisle, then weaves through the endpoint-field
  corridor until the fog takes it. Peer arcs span the field. [BUILT -
  revised v0.5.0 at user request: the separate WAN-pull segment and the
  dashed version-lock return arc were removed; the route is a single
  forge-to-fog curve]
- R3: While the user scrolls, the system shall reveal each path using a
  uv-progress fragment discard driven by a scrubbed ratio uniform (no
  geometry mutation). [BUILT]
- R4: The system shall apply an UnrealBloom post-process pass (strength
  0.92 desktop / 0.7 touch, radius 0.45, threshold 0.32), with path
  materials emitting boosted emissive near the draw head (pow(x,4) falloff)
  and a pulse color shift at the tip. [BUILT]
- R5: The system shall mirror path meshes below the floor plane with an
  attenuated mirror material (opacity 0.22) to simulate reflection;
  field-wide far peer arcs render without mirrors to bound draw calls.
  [BUILT]

### 3.2 Scroll and camera
- R6: While the user scrolls the flow section, the system shall map
  Lenis-smoothed scroll position through GSAP ScrollTrigger (scrub: true)
  to a master progress value in [0, 1]. [BUILT]
- R7: The system shall smooth-damp camera progress toward target progress
  (smoothTime 0.16 s desktop, 0.1 s touch, ~0 under reduced motion). [BUILT]
- R8: The system shall remap master progress into per-element windows, with
  the route draw running on a PIECEWISE speed map so each facility moment
  lands exactly when its step card is centered on screen:
  - feeders draw (staggered):      0.02-0.16
  - route draw:                    0.16-0.86, knotted so the conveyor is
                                   reached at 0.375, the library aisle at
                                   0.625, and the device field at 0.80
                                   (knots computed at build from sampled
                                   curve params uCfg/uRepo/uField)
  - peer arcs (staggered):         0.78-0.92
  - overview lift (finale):        0.84-1.00
  Facility labels materialize as the route approaches each facility, keyed
  to the same markers. [BUILT - measured: uCfg 0.25 / uRepo 0.50 /
  uField 0.723 mapping to progress 0.375 / 0.625 / 0.80 exactly]
- R9: While progress advances, the camera shall follow a phase-blended rig:
  hero establishing shot (-92, 74, -68) -> forge hover (FORGE -10, 32, -46
  rel.) -> oblique chase riding the route (pos = point - tangent * 30 +
  side * (10 + 16 * bank), y = 38, bank window keyed to the ConfigFabric
  marker) -> finale overview (-2, 104, -92 looking at 6, 0, 16), eased by
  the lift window. Quaternion slerp blends pointer-parallax framing.
  [BUILT]
- R10: When the pointer moves on desktop, the system shall apply a small
  parallax offset to the camera along its local right/up axes. [BUILT]
- R18 (v0.4.0): While the viewer provides no input (wheel, touch, pointer,
  or key) for 4 seconds and the flow story is not complete, the system
  shall auto-advance the scroll position at a rate that traverses the full
  flow in ~55 seconds, halting immediately on any viewer input and
  resuming after the idle threshold elapses again. Disabled under
  prefers-reduced-motion. [BUILT]

### 3.3 Route traffic (new in v0.5.0)
- R19: The system shall run continuous traffic along the route:
  - THE FOLLOWED CONFIG: a white, fully bright config block rides the
    route draw head - the freshly minted DSC v3 YAML the viewer follows
    out of the forge. It pulses like a heartbeat (double-beat scale +
    color cycle at ~0.73 Hz lub-dub), rotates slowly, and gains an app
    box on top after passing RepoFabric.
  - AMBIENT CONFIGS: 8 teal config blocks flow continuously along the
    drawn portion of the route at staggered speeds, independent of
    scroll; ~40% (i % 5 < 2) carry an app box once past the RepoFabric
    marker, matching the picker-arm narrative. Packets ahead of the draw
    head stay hidden. [BUILT - verified: 8/8 packets in motion over a
    2.5 s window, hero rides the head, boxes appear after uRepo]

### 3.4 DOM narrative layer
- R11: The system shall present a hero (H1, subtitle, scroll prompt) with a
  3D-perspective entrance animation matching the reference. [BUILT]
- R12: The system shall present four flow steps, each with number, title,
  description, and a track-fill bar scrubbed in sync with its on-screen
  window ([0.04-0.24], [0.27-0.49], [0.52-0.74], [0.77-0.96]):
  - 01 DSCForge authors and proves
  - 02 ConfigFabric assigns and enforces
  - 03 RepoFabric delivers
  - 04 One control plane [retitled v0.5.0 - user decision; description
    rewritten to match the finale visual: the followed config enforced
    across the field, one Entra sign-in / UPN audit trail / Gitea store /
    docker compose, version-lock ledger that fails closed]
  Copy sourced from the Fabric Suite one-pagers. [BUILT]
- R21 (v0.5.0): Step cards shall reveal (fade/rise, description staggered
  .18 s) exactly as the route approaches their facility - thresholds keyed
  to the facility markers (0.02, pCfg-0.07, pRepo-0.07, pField-0.06) - and
  hide again when scrolling back above the threshold. Reduced motion
  forces cards visible. [BUILT]
- R20 (v0.5.0): The DSCForge, ConfigFabric, and RepoFabric titles (step
  cards and header nav) and the step 04 title shall be links that open the
  matching marketing one-pager from site/docs/ in a new tab
  (target=_blank rel=noopener), with a hover affordance (teal dashed
  underline, glow, "view one-pager" hint). Hover alone cannot open a tab
  (browsers block non-gesture window.open), so activation is click. While
  the one-pager tab is in front the tour freezes (rAF suspends in
  background tabs); on return, a visibilitychange handler resumes the
  auto-advance ~1.5 s later. [BUILT - all four one-pagers copied verbatim
  into site/docs/: DSCForge-onepager.html, ConfigFabric-onepager.html,
  RepoFabric-comparison-onepager.html, FabricSolution.html]
- R13: When a flow step's window completes, the corresponding scene event
  shall be complete (feeder set drawn, route reaching that facility, peer
  arcs lit). [BUILT]
- R12a: The system shall present features (4 suite cards), an integration
  section (the four starred suite differentiators), a CTA, and a
  RingoSystems Heavy Industries footer. [BUILT]

### 3.5 Facilities and ambient machinery
- R22 (v0.3.0-v0.5.0): Facilities are working simulations, per reference
  imagery supplied by the user:
  - DSCForge: power-hammer forge - anvil, press column/head, a ram that
    strikes on an ambient cycle, a bright hot-bar workpiece feeding bloom,
    chimney, plus 3 input pylons.
  - ConfigFabric: assembly line - 26-unit conveyor the route runs along,
    morphing belt items (height/footprint/rotation change pass by pass, as
    if machined), six arms working PURPOSEFUL cycles: settle over a piece,
    double-dip, swivel along the belt (yaw sweep +-0.45, gaussian dip
    bumps at phase 0.28/0.62), two gantry portals.
  - RepoFabric: industrial library - eight shelf stacks with lit spine
    strips flanking the aisle the route blazes down, truss beams, and TWO
    PICKER ARMS that grab a box at the stack (dip at phase 0.08), swing to
    the line carrying a visible box (carry visible phase 0.11-0.54), place
    it (dip at 0.52), and swing back - opposite-phased so one is always
    working.
  - Endpoint fleet: ~110 devices (notebooks, monitors, tablets, emissive
    screens, 70% lit near / 55% lit far at mid-teal 0x49b3a6) flanking a
    clear route corridor at z ~= 25 and fading into the fog; peer links
    span the field (12 anchor arcs + ~48 nearest-neighbor arcs).
  [BUILT]

### 3.6 Performance and fallback
- R14: The system shall render via WebGLRenderer with EffectComposer
  UnrealBloomPass. [BUILT]
- R15: If prefers-reduced-motion is set, the system shall disable smooth
  scroll, the hero entrance, camera damping, card reveal transitions, and
  idle auto-advance, presenting directly framed views per step with content
  fully readable. [BUILT]
- R16: The system shall sustain 60 fps on a mid-range desktop GPU; touch
  devices reduce bloom strength and DPR cap (1.5). Far-rank fleet devices
  render without edge geometry and far peer arcs without mirrors to bound
  draw calls. [PENDING GPU verification - AC6]

### 3.7 Theming
- R17: The system shall use the Fabric Suite brand token set from the
  one-pagers: navy-0 #061830, navy #0B2545, navy-2 #133b6b, panel #10243f,
  teal #1FB6A6, teal-d #0E8C80, teal-l #7fdcd2, ice #E9F9F7,
  line #33506f; facility fill #0e3a36 with teal edges. Type: Archivo
  (display 800, width 87%), IBM Plex Mono (eyebrows, labels, numbers).
  An embedded data-URI favicon carries the teal loop mark. [BUILT]

## 4. Acceptance criteria

- AC1: GIVEN the page is loaded on desktop Chrome
       WHEN the user scrolls from top to the end of the flow section
       THEN the three feeders draw into the forge, the route draws through
       the conveyor, the library aisle, and the device corridor into the
       fog with visible bloom glow, the peer arcs light the field, AND the
       camera follows without pops or orientation flips.
       [VERIFIED headless at the marker keyframes - exact progress
       mapping, zero console errors; GPU smoothness pass pending]
- AC2: GIVEN the user stops scrolling mid-flow
       WHEN no input occurs
       THEN camera motion settles smoothly (damped) with no oscillation.
       [PENDING GPU pass]
- AC3: GIVEN step 02 is active
       WHEN its progress window is 50 percent complete
       THEN its track-fill bar reads 50 percent and the route has advanced
       proportionally toward ConfigFabric. [VERIFIED]
- AC4: GIVEN any WebGL2-capable browser
       WHEN the page loads
       THEN the scene renders with bloom (no WebGPU dependency). [VERIFIED
       under SwiftShader software GL]
- AC5: GIVEN prefers-reduced-motion is enabled
       WHEN the page loads
       THEN no scroll-scrubbed camera flight smoothing or entrance occurs
       and content remains fully readable, with all cards visible.
       [VERIFIED - the headless harness runs in this mode]
- AC7 (v0.4.0): GIVEN the page is idle with no viewer input
       WHEN 4 seconds elapse
       THEN the scroll position begins advancing on its own, AND any
       wheel/touch/pointer/key input halts it within one frame.
       [VERIFIED headless without reduced-motion emulation]
- AC8 (v0.5.0): GIVEN the route is partially drawn
       WHEN time passes with no scroll change
       THEN the followed config pulses at the draw head and the ambient
       configs keep flowing along the drawn route, none ahead of the head,
       with ~40% carrying boxes after the RepoFabric marker.
       [VERIFIED - markers {0.375/0.625/0.80}, hero visible from p>0.16,
       packet count ramps 2 -> 8 with draw, 8/8 moved over 2.5 s]
- AC6: GIVEN Chrome DevTools performance capture during a full scroll
       WHEN measured on the dev workstation
       THEN long tasks stay under 50 ms and FPS does not drop below 50.
       [PENDING - requires real GPU via Claude in Chrome]

## 5. Architecture (as built)

- Static site, no build step: plain HTML + ES modules via import map. CDN
  dependencies: three@0.170.0, gsap@3.12.7, lenis@1.1.20 (jsdelivr) and
  Google Fonts (Archivo, IBM Plex Mono). Favicon embedded as a data URI.
- Files (C:\Dev\FabricSolution\site):
  - index.html       hero, 4 flow steps (linked titles), features,
                     integration, CTA, footer
  - css/main.css     brand tokens, card reveal transitions, doc-link
                     affordance, reduced-motion rules
  - js/paths.js      fluid route control points, glow-tube factory
  - js/scene.js      world build, route markers + piecewise timing KNOTS,
                     traffic system, purposeful arm choreography,
                     chase-cam rig, smoothDamp
  - js/main.js       renderer, bloom, Lenis/ScrollTrigger wiring,
                     entrance, card reveals, idle auto-advance,
                     visibilitychange pause/resume, window.__fabric hook
                     (now includes world)
  - tools/verify.cjs marker-aware Playwright sweep (keyframes, hero,
                     packet motion, console errors)
  - docs/            the four marketing one-pagers (verbatim copies)
  - README.md        run/verify instructions, timing table, traffic and
                     doc-link notes

## 6. Verification status

1. Headless (DONE, sandbox): Playwright Chromium (SwiftShader). Marker
   mapping exact (0.375/0.625/0.80); screenshots reviewed at forge, belt,
   aisle, corridor, lift, finale; hero config rides the head; ambient
   packets all moving; card-sync confirmed at the aisle moment; zero
   console/page errors across all runs.
2. GPU pass (PENDING, dev workstation): Claude in Chrome scripted sweep
   on http://localhost:8080 - markers presence (cache check), FPS during
   the auto-advance flight, screenshots at the marker keyframes, doc-link
   fetch checks, AC2/AC6. Blocked on the extension connection; ready to
   run the moment it connects.
3. Reduced-motion exercised by the harness; mobile emulation pending.

## 7. Reference teardown (vectrfl.com)

- Astro static site; bundles: CommonScripts (scene + UI), renderer.js
  (BloomNode/UnrealBloom TSL port), vendor (three + gsap + ScrollTrigger +
  lenis).
- Paths: explicit 2D control-point arrays lifted to y=0.15; draw-on via
  uv().x discard vs scrubbed ratio uniform; emissive boost
  uv().x.div(ratio).pow(4).mul(4) for the hot tip; MRT emissive feeds
  bloom.
- Camera: rides curve at y=66, lookAt point ahead; remap windows; entrance
  ease-out cubic drop-in; pointer parallax; quaternion slerp between
  follow and offset framing.
- DOM: .hero with perspective text entrance, .flow with 4 steps and
  track-fill bars.

## 8. Resolved requirements questions

- Q1: Plain static HTML / ES modules via import map (no Astro).
- Q2: C:\Dev\FabricSolution\site (subfolder of the marketing repo).
- Q3: Fabric Suite brand (navy/teal from the one-pagers).
- Q4: Product facilities the path visits. v0.5.0 resolution: the loop
  visual (dashed lock arc) was removed at user request in favor of a
  single forge-to-fog journey; step 04 retitled "One control plane"
  (user decision) with the control-plane copy carrying the version-lock
  message in text.

## 9. Backlog (follow-up candidates)

- Vendor CDN dependencies locally for offline/intranet hosting.
- Junction pulse event when the route reaches each facility (R13 polish).
- Mobile-emulation verification pass; bloom mip tuning per device class.
- Real reflective floor (Reflector) behind a quality toggle.
- Sync picker-arm place moments to individual ambient packets passing the
  library (currently narrative-synced, not frame-synced).

## 10. Version history

- 0.1.0 (2026-06-10): Initial draft from vectrfl.com teardown; placeholder
  copy pending marketing docs access.
- 0.2.0 (2026-06-10): As-built. Marketing copy integrated; Q1-Q4 resolved;
  line network extended; camera rig redesigned to oblique chase after
  headless screenshot review; delivered with verification harness.
- 0.3.0 (2026-06-10): Facility geometry upgraded per reference imagery -
  forge simulation with striking ram, robot-arm assembly line, industrial
  library aisle, ever-extending ~110-device field. Ambient machinery
  animation added.
- 0.4.0 (2026-06-10): Favicon embedded. Robot arms articulated. Peer links
  extended field-wide (~60 arcs). Far screens retuned. Idle auto-advance
  added (R18/AC7).
- 0.5.0 (2026-06-10): Route redesigned as ONE fluid curve forge -> conveyor
  -> library aisle -> device corridor -> fog; WAN-pull segment and dashed
  version-lock arc REMOVED (user request). Piecewise route timing pins
  facility moments to card centers (R8). Traffic system added: followed
  heartbeat config riding the draw head + 8 ambient configs, ~40% boxed
  after RepoFabric (R19/AC8). Card reveals synced to approach (R21).
  Purposeful arm choreography: belt double-dip work cycles with morphing
  items; RepoFabric picker arms ferrying boxes shelf -> line (R22). Step
  04 retitled "One control plane" with rewritten description (user
  decision). Titles link to the one-pagers in site/docs/ with tab
  pause/resume (R20); all four marketing HTMLs copied into site/docs/.
  Marker-aware verify harness shipped. Headless verification clean.
