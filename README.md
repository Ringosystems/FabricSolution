# FabricSolution Landing - The Fabric Suite
Version: 0.5.0 (2026-06-10)

Scroll-activated 3D narrative for the Fabric Suite (DSCForge, ConfigFabric,
RepoFabric), modeled on the vectrfl.com glowing-path concept. Three.js +
GSAP ScrollTrigger + Lenis, UnrealBloom glow, draw-on tube shader, and a
chase camera riding one fluid route from the forge, along the assembly
line, down the library aisle, and into the endpoint field until the fog
takes it - following a freshly minted DSC v3 config the whole way.

## Run
Static site, ES modules via import map (CDN: jsdelivr + Google Fonts, so
an internet connection is required). Serve over HTTP (modules will not
load from file://):

    cd site
    python -m http.server 8080
    # or: npx serve .

Open http://localhost:8080

## Verify (headless devtools sweep)
    npm i playwright && npx playwright install chromium
    node tools/verify.cjs   # expects the server on 127.0.0.1:8123

Captures keyframes across the scroll range into ./shots, logs the facility
markers, the followed config, and ambient traffic, and reports console
errors. window.__fabric exposes { state, camera, scene, world } for
DevTools inspection; world.markers holds the facility timing.

## Layout
    index.html      hero, 4 flow steps (titles link to the one-pagers),
                    features, integration, CTA
    css/main.css    brand tokens (navy #0B2545 / teal #1FB6A6) per the
                    one-pagers, card reveal transitions, doc-link styles
    js/paths.js     fluid route control points (forge -> conveyor ->
                    library aisle -> device corridor -> fog) + glow tube
                    factory (draw-on shader, uv.x discard vs progress)
    js/scene.js     world build (striking forge ram, belt arms working
                    pieces, library picker arms ferrying boxes to the
                    line, ~110-device field flanking the route corridor),
                    route markers, traffic system, chase-cam rig
    js/main.js      renderer, bloom, Lenis/ScrollTrigger wiring, entrance,
                    card reveals, idle auto-advance, tab pause/resume
    docs/           the four marketing one-pagers the titles open

## Timing (master progress)
    feeders     0.02-0.16   step 01 DSCForge
    route       0.16-0.86   piecewise draw speed pins each facility moment
                            to its step card: conveyor 0.375, library
                            aisle 0.625, device field 0.80 (see
                            world.markers and KNOTS in js/scene.js)
    peer arcs   0.78-0.92   light across the field as the route enters it
    overview    0.84-1.00   pull-up reveal of the whole fabric

Traffic: a white, heartbeat-pulsing config rides the route draw head (the
one followed out of the forge; it gains its app box after RepoFabric),
while 8 ambient configs flow continuously along the drawn route, ~40%
carrying a box placed by the RepoFabric pickers.

Doc links: the DSCForge / ConfigFabric / RepoFabric titles (step cards and
nav) and the step 04 "One control plane" title open the matching
one-pager from docs/ in a new tab. The tour pauses while that tab is in
front (rAF freezes in background tabs) and resumes about 1.5 s after the
viewer returns.

Idle auto-advance: after 4 s without wheel/touch/pointer/key input the
tour scrolls itself (~55 s end to end), halts instantly on any input,
and resumes after the viewer goes idle again. Tune in js/main.js via
auto.idleMs and auto.tourSecs.

Reduced motion: Lenis, entrance, camera damping, card reveal transitions,
and idle auto-advance are disabled; content remains fully readable. Touch
devices: DPR cap 1.5, lower bloom.
