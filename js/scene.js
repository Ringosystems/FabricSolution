// scene.js - world build + per-frame scroll mapping
// Window remaps mirror the vectr pattern: master progress sliced per element.
import * as THREE from 'three';
import {
  COLORS, FORGE, CONFIG, REPO, FLEET,
  feederPoints, routePoints, peerArc,
  makeGlowTube, makeMirror,
} from './paths.js';

export const remap = (v, a, b, c, d) =>
  c + (d - c) * Math.min(1, Math.max(0, (v - a) / (b - a)));

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const sstep = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const bump = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));

// SmoothDamp (Unity-style), matching the reference's damped camera progress
export function smoothDamp(current, target, velocity, smoothTime, dt) {
  const omega = 2 / Math.max(smoothTime, 1e-4);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const temp = (velocity + omega * change) * dt;
  velocity = (velocity - omega * temp) * exp;
  let value = target + (change + temp) * exp;
  if ((target - current > 0) === (value > target)) {
    value = target;
    velocity = (value - target) / dt;
  }
  return { value, velocity };
}

function blockMesh(w, h, d, fill = COLORS.panel, stroke = COLORS.lineStroke) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    // polygonOffset pushes the filled faces slightly back in the depth buffer so
    // the coincident wireframe edge lines win the depth test cleanly. Without it
    // the edge and face share a depth and precision splits each edge into a
    // strobing dashed pattern. Depth-only offset, nothing shifts on screen.
    new THREE.MeshBasicMaterial({
      color: fill,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color: stroke, transparent: true, opacity: 0.9 })
  );
  // layer 1 = bloom-excluded. These bright 1px edges bead under UnrealBloom's
  // mip downsample; keeping them out of the bloom pass (and compositing them back
  // crisp) removes the crawling blobs while leaving the edges fully bright.
  edges.layers.set(1);
  box.add(edges);
  box.position.y = h / 2;
  g.add(box);
  return g;
}

function labelSprite(text, color = '#E4FF8C') {
  const pad = 18, fs = 44;
  const cnv = document.createElement('canvas');
  const ctx = cnv.getContext('2d');
  ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`;
  cnv.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  cnv.height = fs + pad * 2;
  const c2 = cnv.getContext('2d');
  c2.font = `600 ${fs}px "IBM Plex Mono", monospace`;
  c2.fillStyle = color;
  c2.textBaseline = 'middle';
  c2.fillText(text, pad, cnv.height / 2);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
  }));
  spr.scale.set(cnv.width / 26, cnv.height / 26, 1);
  spr.renderOrder = 5;
  return spr;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(COLORS.navy0);
  scene.fog = new THREE.Fog(COLORS.navy0, 90, 240);

  // Floor: matte navy plane + faint teal grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshBasicMaterial({
      color: COLORS.navy, transparent: true, opacity: 0.88, depthWrite: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(600, 120, COLORS.lineStroke, COLORS.lineStroke);
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.position.y = 0.02;
  grid.renderOrder = 2;
  scene.add(grid);

  // --- Facilities ---
  const facilities = new THREE.Group();
  const anim = { ram: null, robots: [], items: [] };

  // DSCForge: power-hammer forge - press head, ram striking a hot bar on an anvil
  const forge = new THREE.Group();
  const anvil = blockMesh(7, 2.6, 5, 0x0C3A18, COLORS.teal);
  forge.add(anvil);
  const column = blockMesh(3.6, 16, 3, 0x0C3A18, COLORS.teal);
  column.position.set(0, 0, 3.4);
  forge.add(column);
  const head = blockMesh(6.2, 4, 5, 0x0C3A18, COLORS.teal);
  head.position.y = 12;
  forge.add(head);
  const ram = blockMesh(2.2, 6, 2.2, 0x0C3A18, COLORS.teal);
  ram.position.y = 5.6;
  forge.add(ram);
  anim.ram = ram;
  const hotBar = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.5, 1.3),
    new THREE.MeshBasicMaterial({ color: COLORS.nuclear })
  );
  hotBar.position.set(0.4, 2.95, 0.4);
  hotBar.rotation.y = 0.35;
  hotBar.renderOrder = 3;
  forge.add(hotBar);
  // invisible, never-rendered click target around the rod. Layer 2 is never in the
  // camera's layer mask, so it never draws, but the easter-egg raycaster tests only
  // layer 2, giving a forgiving hit area for "click the rod on the forge".
  const forgeHit = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 4.5, 3.5),
    new THREE.MeshBasicMaterial()
  );
  forgeHit.position.copy(hotBar.position);
  forgeHit.layers.set(2);
  forge.add(forgeHit);
  const chimney = blockMesh(1.4, 8, 1.4, 0x0C3A18, COLORS.teal);
  chimney.position.set(-3.6, 0, 3.4);
  chimney.children[0].position.y += 14;
  forge.add(chimney);
  forge.position.copy(FORGE);
  facilities.add(forge);

  // input pylons (plain language AI chat / GPResults / automated config extract)
  const pylonAt = [[-70, -24], [-56, -28], [-42, -24]];
  pylonAt.forEach(([x, z]) => {
    const p = blockMesh(4, 3.4, 4);
    p.position.set(x, 0, z);
    facilities.add(p);
  });

  // Floating source icons hovering over each feed pylon. The supplied line-art
  // PNGs are keyed at load (blank/white space -> transparent) and recolored to the
  // phosphor green, then shown on the bloom-excluded layer so the thin strokes stay
  // crisp instead of beading like the wireframes did.
  const feederIcons = [];
  const FEED_ICONS = [
    { url: 'assets/feeders/aichat.png',   x: -70, z: -24, seed: 0.17 }, // plain language AI chat
    { url: 'assets/feeders/gpresult.png', x: -56, z: -28, seed: 0.61 }, // GPResults
    { url: 'assets/feeders/extract.png',  x: -42, z: -24, seed: 0.93 }, // automated configuration extract
  ];
  FEED_ICONS.forEach(({ url, x, z, seed }) => {
    const baseY = 6.6;
    const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    const spr = new THREE.Sprite(mat);
    spr.layers.set(1);   // bloom-excluded: crisp linework, no bloom beading
    spr.renderOrder = 6;
    spr.position.set(x, baseY, z);
    spr.scale.set(5.6, 5.6, 1);
    const img = new Image();
    img.onload = () => {
      const cnv = document.createElement('canvas');
      cnv.width = img.width; cnv.height = img.height;
      const cx = cnv.getContext('2d');
      cx.drawImage(img, 0, 0);
      const px = cx.getImageData(0, 0, cnv.width, cnv.height);
      const d = px.data;
      const GR = 0x7c, GG = 0xfc, GB = 0x2e;   // glow-primary phosphor green
      // Keep only the dark strokes. A threshold (not a linear ramp) drops white
      // backgrounds AND baked-in checkerboard greys, which one source PNG carries
      // as real pixels rather than true alpha. smoothstep across LO..HI keeps soft
      // antialiased edges; existing alpha is still honoured for genuine transparency.
      const LO = 0.38, HI = 0.58;
      for (let i = 0; i < d.length; i += 4) {
        const luma = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        let k = (luma - LO) / (HI - LO);
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const keep = 1 - k * k * (3 - 2 * k);   // dark -> 1, light/checker -> 0
        d[i] = GR; d[i + 1] = GG; d[i + 2] = GB;
        d[i + 3] = Math.round(255 * (d[i + 3] / 255) * keep);
      }
      cx.putImageData(px, 0, 0);
      const tex = new THREE.CanvasTexture(cnv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
      mat.opacity = 1;
      mat.needsUpdate = true;
      const tall = 5.6;
      spr.scale.set(tall * (img.width / img.height), tall, 1);
    };
    img.src = url;
    scene.add(spr);
    feederIcons.push({ spr, baseY, seed });
  });
  anim.feederIcons = feederIcons;

  // Robot arm factory. kind 'belt' works the conveyor in place;
  // kind 'shelf' swings between a shelf and the line carrying a build box.
  const makeRobot = (lean, kind = 'belt') => {
    const g = new THREE.Group();
    const base = blockMesh(1.9, 1.2, 1.9, 0x0C3A18, COLORS.teal);
    g.add(base);
    const armRig = new THREE.Group();
    armRig.position.y = 1.2;
    const lower = blockMesh(0.9, 3.6, 0.9, 0x0C3A18, COLORS.teal);
    armRig.add(lower);
    const elbow = new THREE.Group();
    elbow.position.y = 3.5;
    const upper = blockMesh(0.75, 3.0, 0.75, 0x0C3A18, COLORS.teal);
    elbow.add(upper);
    elbow.rotation.z = -lean * 1.7;
    const wrist = blockMesh(1.1, 0.8, 1.1, 0x102A1C, COLORS.tealLight);
    wrist.position.y = 2.9;
    elbow.add(wrist);
    armRig.add(elbow);
    armRig.rotation.z = lean;
    g.add(armRig);
    const rec = { g, rig: armRig, elbow, lean, kind, baseYaw: 0, yawShelf: 0, yawLine: 0, off: Math.random(), carry: null };
    if (kind === 'shelf') {
      const carry = blockMesh(1.0, 1.0, 1.0, 0x102A1C, COLORS.tealLight);
      carry.position.set(0, 3.4, 0);
      carry.visible = false;
      elbow.add(carry);
      rec.carry = carry;
    }
    anim.robots.push(rec);
    return rec;
  };

  // ConfigFabric: assembly line - conveyor with robot arms either side, gantries over
  const line = new THREE.Group();
  const conveyor = blockMesh(26, 1.0, 4, 0x0C3A18, COLORS.teal);
  line.add(conveyor);
  // items riding the belt, machined by the arms (anim.items morph)
  [-9, -3, 3.5, 9.5].forEach((x, i) => {
    const item = blockMesh(1.6, 1.0, 1.6, 0x102A1C, COLORS.tealLight);
    item.position.set(x, 1.0, (i % 2) * 0.6 - 0.3);
    line.add(item);
    anim.items.push(item);
  });
  [-8, 0, 8].forEach((x) => {
    const rA = makeRobot(0.55, 'belt');
    rA.g.position.set(x, 0, 4.6);
    rA.g.rotation.y = Math.PI; // face the belt
    rA.baseYaw = Math.PI;
    line.add(rA.g);
    const rB = makeRobot(0.55, 'belt');
    rB.g.position.set(x + 4, 0, -4.6);
    rB.baseYaw = 0;
    line.add(rB.g);
  });
  // gantry portals
  [-6, 5].forEach((x) => {
    [-6, 6].forEach((z) => {
      const post = blockMesh(0.7, 7, 0.7);
      post.position.set(x, 0, z);
      line.add(post);
    });
    const beam = blockMesh(0.7, 0.7, 13.2);
    beam.position.set(x, 0, 0);
    beam.children[0].position.y += 6.6;
    line.add(beam);
  });
  line.position.copy(CONFIG);
  facilities.add(line);

  // RepoFabric: industrial library - shelf stacks flanking the aisle the route runs down
  const library = new THREE.Group();
  const shelfX = [-7, -2.5, 2, 6.5];
  shelfX.forEach((x) => {
    [-7.5, 7.5].forEach((z) => {
      const shelf = blockMesh(2.2, 6.2, 8.5, 0x0C3A18, COLORS.teal);
      shelf.position.set(x, 0, z);
      library.add(shelf);
      [1.8, 3.6].forEach((y) => {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(2.3, 0.32, 7.6),
          new THREE.MeshBasicMaterial({ color: COLORS.tealDeep })
        );
        strip.position.set(x, y, z);
        library.add(strip);
      });
    });
  });
  // two picker arms: shelf -> line with a build box, and back for the next
  const pickA = makeRobot(0.5, 'shelf');
  pickA.g.position.set(-4.7, 0, -4.4);
  pickA.yawShelf = Math.PI;  // stack side (-z)
  pickA.yawLine = 0;         // aisle side (+z)
  pickA.g.rotation.y = pickA.yawShelf;
  pickA.off = 0.1;
  library.add(pickA.g);
  const pickB = makeRobot(0.5, 'shelf');
  pickB.g.position.set(4.4, 0, 4.4);
  pickB.yawShelf = 0;        // stack side (+z)
  pickB.yawLine = Math.PI;   // aisle side (-z)
  pickB.g.rotation.y = pickB.yawShelf;
  pickB.off = 0.62;
  library.add(pickB.g);
  // truss beams over the hall
  [-8.5, 8].forEach((x) => {
    const truss = blockMesh(0.6, 0.6, 22);
    truss.position.set(x, 0, 0);
    truss.children[0].position.y += 8.2;
    library.add(truss);
    [-10.4, 10.4].forEach((z) => {
      const post = blockMesh(0.6, 8.2, 0.6);
      post.position.set(x, 0, z);
      library.add(post);
    });
  });
  library.position.copy(REPO);
  facilities.add(library);

  // Endpoint fleet: a vast array of devices extending into the fog,
  // flanking the route corridor at z ~= 25.
  const glowMat = new THREE.MeshBasicMaterial({ color: COLORS.tealLight });
  const farGlowMat = new THREE.MeshBasicMaterial({ color: 0x5FB04A });
  const dimGlowMat = new THREE.MeshBasicMaterial({ color: COLORS.tealDeep });
  const shellMat = new THREE.MeshBasicMaterial({ color: COLORS.panel });
  const makeDevice = (kind, edges, brightP = 0.7) => {
    const lit = edges ? glowMat : farGlowMat;
    const g = new THREE.Group();
    const fill = 0x0C3A18;
    if (kind === 0) {
      const base = edges ? blockMesh(2.7, 0.28, 1.9, fill, COLORS.teal)
        : new THREE.Group();
      if (!edges) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.28, 1.9), shellMat);
        m.position.y = 0.14; base.add(m);
      }
      g.add(base);
      const lid = new THREE.Group();
      lid.position.set(0, 0.25, -0.92);
      const lidSlab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.9, 0.14), shellMat);
      lidSlab.position.y = 0.95;
      lid.add(lidSlab);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), Math.random() < brightP ? lit : dimGlowMat);
      screen.position.set(0, 0.95, 0.08);
      lid.add(screen);
      lid.rotation.x = -0.32;
      g.add(lid);
    } else if (kind === 1) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), shellMat);
      stand.position.y = 0.5;
      g.add(stand);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.16), shellMat);
      slab.position.y = 1.9;
      g.add(slab);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.45), Math.random() < brightP ? lit : dimGlowMat);
      screen.position.set(0, 1.9, 0.1);
      g.add(screen);
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.3, 0.12), shellMat);
      const tilt = new THREE.Group();
      slab.position.y = 1.15;
      tilt.add(slab);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.0), Math.random() < brightP ? lit : dimGlowMat);
      screen.position.set(0, 1.15, 0.08);
      tilt.add(screen);
      tilt.rotation.x = -0.42;
      g.add(tilt);
    }
    return g;
  };
  const fleet = new THREE.Group();
  const fleetUnits = [];
  const farUnits = [];
  // near rank: the 12 peer-arc anchors, rows leaving the route corridor open
  const nearRows = [18, 22.5, 30];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const d = makeDevice((r + c) % 3, true);
      d.position.set(42 + c * 4.4, 0, nearRows[r]);
      d.rotation.y = -Math.PI / 2 + (Math.sin(r * 7 + c * 3) * 0.12);
      fleet.add(d);
      fleetUnits.push(d);
    }
  }
  // far ranks: ever-extending field fading into the fog (plain shells, no edges)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 13; c++) {
      const x = 42 + c * 4.6;
      const z = 4 + r * 4.9;
      if (x < 60 && z > 16 && z < 32) continue;   // near-rank footprint
      if (z > 23.2 && z < 27.8) continue;          // route corridor stays clear
      const d = makeDevice((r * 5 + c) % 3, false, 0.55);
      d.position.set(x + Math.sin(r * 13 + c) * 0.7, 0, z + Math.cos(c * 11 + r) * 0.7);
      d.rotation.y = -Math.PI / 2 + Math.sin(r * 3 + c * 5) * 0.2;
      fleet.add(d);
      farUnits.push(d.position.clone().setY(0.18));
    }
  }
  facilities.add(fleet);
  scene.add(facilities);

  // --- Labels ---
  const labels = {
    forge: labelSprite('DSCForge'),
    cfg: labelSprite('ConfigFabric'),
    repo: labelSprite('RepoFabric'),
  };
  labels.forge.position.set(FORGE.x, 19, FORGE.z);
  labels.cfg.position.set(CONFIG.x, 11, CONFIG.z);
  labels.repo.position.set(REPO.x, 13, REPO.z);
  Object.values(labels).forEach((l) => scene.add(l));

  // --- Glow lines ---
  const lines = { feeders: [], route: null, peers: [] };
  const addTube = (tube, withMirror = true) => {
    scene.add(tube.mesh);
    if (withMirror) {
      const mir = makeMirror(tube);
      scene.add(mir);
      tube.mirror = mir;
    } else {
      tube.mirror = null;
    }
    return tube;
  };

  feederPoints.forEach((p) => {
    lines.feeders.push(addTube(makeGlowTube(p, { radius: 0.11, segments: 60, headBoost: 3.0 })));
  });
  lines.route = addTube(makeGlowTube(routePoints, { radius: 0.16, segments: 360, headBoost: 4.5 }));

  const fp = (i) => fleetUnits[i].children[0].getWorldPosition(new THREE.Vector3()).setY(0.18);
  fleet.updateMatrixWorld(true);
  [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 9], [2, 6], [6, 10], [3, 7], [7, 11], [9, 8], [10, 11]]
    .forEach(([a, b]) => {
      lines.peers.push(addTube(makeGlowTube(peerArc(fp(a), fp(b)), {
        radius: 0.07, segments: 24, headBoost: 2.0, color: COLORS.tealDeep,
      })));
    });
  // field-wide peer mesh: link most devices to a nearby neighbor (no mirrors, lighter tubes)
  {
    const nearAnchors = fleetUnits.map((u, i) => fp(i));
    const all = nearAnchors.concat(farUnits);
    const used = new Set();
    let made = 0;
    for (let i = 12; i < all.length && made < 48; i += 1) {
      if (i % 3 === 1) continue;
      let best = -1; let bestD = 1e9;
      for (let j = 0; j < all.length; j += 1) {
        if (j === i) continue;
        const key = i < j ? i + '-' + j : j + '-' + i;
        if (used.has(key)) continue;
        const d2 = all[i].distanceToSquared(all[j]);
        if (d2 < bestD) { bestD = d2; best = j; }
      }
      if (best >= 0 && bestD < 90) {
        const key = i < best ? i + '-' + best : best + '-' + i;
        used.add(key);
        lines.peers.push(addTube(makeGlowTube(peerArc(all[i], all[best], 1.8), {
          radius: 0.05, segments: 16, headBoost: 1.5, color: COLORS.tealDeep, opacity: 0.85,
        }), false));
        made += 1;
      }
    }
  }

  // --- Route markers: where the curve meets each facility / the field ---
  const markers = { uCfg: 0, uRepo: 0, uField: 1 };
  {
    let dC = 1e9; let dR = 1e9; let fieldSet = false;
    const P = new THREE.Vector3();
    for (let i = 0; i <= 400; i += 1) {
      const u = i / 400;
      lines.route.curve.getPoint(u, P);
      const dc = (P.x - CONFIG.x) ** 2 + (P.z - CONFIG.z) ** 2;
      const dr = (P.x - REPO.x) ** 2 + (P.z - REPO.z) ** 2;
      if (dc < dC) { dC = dc; markers.uCfg = u; }
      if (dr < dR) { dR = dr; markers.uRepo = u; }
      if (!fieldSet && P.x >= 42) { markers.uField = u; fieldSet = true; }
    }
  }
  // master-progress window of the route draw. The draw speed is piecewise so
  // each facility moment lands exactly when its step card is centered on screen.
  const ROUTE_W = [0.16, 0.86];
  markers.pCfg = 0.375;
  markers.pRepo = 0.625;
  markers.pField = 0.80;
  const KNOTS = [
    [ROUTE_W[0], 0],
    [markers.pCfg, markers.uCfg],
    [markers.pRepo, markers.uRepo],
    [markers.pField, markers.uField],
    [ROUTE_W[1], 1],
  ];
  markers.routeU = (p) => {
    if (p <= KNOTS[0][0]) return 0;
    if (p >= KNOTS[KNOTS.length - 1][0]) return 1;
    for (let i = 1; i < KNOTS.length; i += 1) {
      if (p <= KNOTS[i][0]) {
        const [pa, ua] = KNOTS[i - 1];
        const [pb, ub] = KNOTS[i];
        return ua + (ub - ua) * ((p - pa) / (pb - pa));
      }
    }
    return 1;
  };

  const W = {
    feeders: [0.02, 0.16],
    route: ROUTE_W,
    peers: [markers.pField - 0.02, markers.pField + 0.12],
    overviewLift: [0.84, 1.0],
  };

  // --- Traffic on the route: the followed config + ambient configs ---
  const heroMat = new THREE.MeshBasicMaterial({ color: 0xE4FF8C });
  const hero = new THREE.Group();
  const heroCore = blockMesh(1.5, 1.5, 1.5, 0xE4FF8C, COLORS.tealLight);
  heroCore.children[0].material = heroMat;
  hero.add(heroCore);
  const heroBox = blockMesh(1.15, 1.15, 1.15, 0x102A1C, COLORS.tealLight);
  heroBox.position.y = 1.6;
  heroBox.visible = false;
  hero.add(heroBox);
  hero.visible = false;
  scene.add(hero);

  const packetMat = new THREE.MeshBasicMaterial({ color: COLORS.tealLight });
  const packets = [];
  for (let i = 0; i < 8; i += 1) {
    const g = new THREE.Group();
    const core = blockMesh(1.0, 1.0, 1.0, 0x0C3A18, COLORS.tealLight);
    core.children[0].material = packetMat;
    g.add(core);
    const box = blockMesh(0.85, 0.85, 0.85, 0x102A1C, COLORS.teal);
    box.position.y = 1.1;
    box.visible = false;
    g.add(box);
    g.visible = false;
    scene.add(g);
    packets.push({ g, box, u0: i / 8, speed: 0.035 + (i % 3) * 0.007, hasBox: i % 5 < 2 });
  }

  return {
    lines, labels, fleetUnits, anim, markers, W,
    hero: { g: hero, mat: heroMat, box: heroBox },
    packets,
    forgeItem: forgeHit,
    colorA: new THREE.Color(0xDFFFA8),
    colorB: new THREE.Color(0xF8FFE6),
  };
}

// ---------------------------------------------------------------------------
// Per-frame scroll mapping + ambient machinery
// ---------------------------------------------------------------------------
const V = new THREE.Vector3();
const LOOK = new THREE.Vector3();
const qFollow = new THREE.Quaternion();
const qOffset = new THREE.Quaternion();
const TWO_PI = Math.PI * 2;

export function updateWorld(world, camera, progress, entrance, parallax) {
  const { lines, labels, anim, markers, W, hero, packets } = world;

  // ambient machinery
  const t = performance.now() / 1000;
  if (anim.ram) {
    anim.ram.position.y = 5.6 - 2.2 * Math.pow(Math.abs(Math.sin(t * 1.5)), 10);
  }
  anim.robots.forEach((r, i) => {
    if (r.kind === 'belt') {
      // work a piece on the belt: settle over it, dip twice, shift along
      const ph = (t * 0.22 + r.off) % 1;
      const dip = bump(ph, 0.28, 0.07) + bump(ph, 0.62, 0.07);
      r.g.rotation.y = r.baseYaw + 0.45 * Math.sin(ph * TWO_PI);
      r.rig.rotation.z = r.lean + 0.32 * dip;
      r.elbow.rotation.z = -r.lean * 1.7 - 0.78 * dip + 0.1 * Math.sin(ph * TWO_PI * 2);
    } else {
      // shelf picker: grab at the stack, swing to the line, place, swing back
      const ph = (t * 0.16 + r.off) % 1;
      const swing = sstep(0.16, 0.42, ph) - sstep(0.6, 0.88, ph);
      r.g.rotation.y = r.yawShelf + (r.yawLine - r.yawShelf) * swing;
      const dip = bump(ph, 0.08, 0.055) + bump(ph, 0.52, 0.055);
      r.rig.rotation.z = r.lean + 0.45 * dip;
      r.elbow.rotation.z = -r.lean * 1.7 - 0.85 * dip;
      if (r.carry) r.carry.visible = ph > 0.11 && ph < 0.54;
    }
  });
  anim.items.forEach((it, i) => {
    // the line machines each piece: height and footprint change pass by pass
    const ph = t * 0.5 + i * 1.7;
    it.scale.set(
      1 + 0.18 * Math.sin(ph * 0.7 + 1),
      0.62 + 0.42 * (0.5 + 0.5 * Math.sin(ph)),
      1 + 0.18 * Math.cos(ph * 0.9)
    );
    it.rotation.y = 0.5 * Math.sin(ph * 0.45);
  });
  // feed-source icons bob up/down at irregular intervals: three incommensurate
  // sines per icon with a per-icon seed, so peaks land unevenly and the trio
  // never falls into sync.
  if (anim.feederIcons) {
    anim.feederIcons.forEach((ic) => {
      const s = ic.seed;
      const bob = 0.50 * Math.sin(t * (0.55 + s * 0.5) + s * 6.3)
                + 0.30 * Math.sin(t * (0.91 + s * 0.7) + s * 11.1)
                + 0.20 * Math.sin(t * (1.43 + s * 0.9) + s * 2.7);
      ic.spr.position.y = ic.baseY + 0.95 * bob;
    });
  }

  const pFeed = remap(progress, ...W.feeders, 0, 1);
  const pRoute = markers.routeU(progress);
  const pPeers = remap(progress, ...W.peers, 0, 1);
  const pLift = remap(progress, ...W.overviewLift, 0, 1);

  lines.feeders.forEach((tube, i) => {
    const stag = clamp01(pFeed * 1.3 - i * 0.15);
    tube.mat.uniforms.uProgress.value = stag;
    tube.mesh.visible = stag > 0;
    if (tube.mirror) {
      tube.mirror.material.uniforms.uProgress.value = stag;
      tube.mirror.visible = stag > 0;
    }
  });
  const setLine = (tube, v) => {
    tube.mat.uniforms.uProgress.value = v;
    tube.mesh.visible = v > 0;
    if (tube.mirror) {
      tube.mirror.material.uniforms.uProgress.value = v;
      tube.mirror.visible = v > 0;
    }
  };
  setLine(lines.route, pRoute);
  lines.peers.forEach((tube, i) => setLine(tube, clamp01(pPeers * 2.4 - i * 0.018)));

  // labels materialize as the route approaches each facility
  labels.forge.material.opacity =
    remap(progress, 0.02, 0.06, 0, 1) * remap(progress, markers.pCfg - 0.06, markers.pCfg, 1, 0.35);
  labels.cfg.material.opacity =
    remap(progress, markers.pCfg - 0.05, markers.pCfg, 0, 1) * remap(progress, markers.pRepo - 0.05, markers.pRepo, 1, 0.35);
  labels.repo.material.opacity =
    remap(progress, markers.pRepo - 0.05, markers.pRepo, 0, 1) * remap(progress, markers.pField + 0.04, markers.pField + 0.1, 1, 0.35);

  // --- traffic: the freshly minted config we follow, plus ambient flow ---
  const drawn = pRoute;
  if (drawn > 0.004 && drawn < 0.999) {
    hero.g.visible = true;
    lines.route.curve.getPoint(drawn, V);
    hero.g.position.set(V.x, 0.55, V.z);
    const beat = Math.pow(Math.max(Math.sin(t * 4.6), 0), 4)
      + 0.55 * Math.pow(Math.max(Math.sin(t * 4.6 - 0.85), 0), 6);
    const s = 1 + 0.32 * Math.min(beat, 1.2);
    hero.g.scale.set(s, s, s);
    hero.mat.color.lerpColors(world.colorA, world.colorB, Math.min(beat, 1));
    hero.g.rotation.y = t * 0.7;
    hero.box.visible = drawn > markers.uRepo;
  } else {
    hero.g.visible = drawn >= 0.999;
    if (hero.g.visible) {
      lines.route.curve.getPoint(0.999, V);
      hero.g.position.set(V.x, 0.55, V.z);
    }
  }
  packets.forEach((pk) => {
    if (drawn < 0.03) { pk.g.visible = false; return; }
    const u = (pk.u0 + t * pk.speed) % 1;
    if (u >= drawn - 0.005) { pk.g.visible = false; return; }
    pk.g.visible = true;
    lines.route.curve.getPoint(u, V);
    pk.g.position.set(V.x, 0.5, V.z);
    pk.g.rotation.y = t * 0.5 + pk.u0 * 7;
    pk.box.visible = pk.hasBox && u > markers.uRepo;
  });

  // --- Camera rig: phase-blended aerial framing ---
  const HERO_POS = new THREE.Vector3(-92, 74, -68);
  const HERO_LOOK = new THREE.Vector3(-30, 0, 8);
  const FEED_POS = new THREE.Vector3(FORGE.x - 10, 32, FORGE.z - 46);
  const FEED_LOOK = FORGE.clone().setY(1);
  const END_POS = new THREE.Vector3(-2, 104, -92);
  const END_LOOK = new THREE.Vector3(6, 0, 16);

  const wFeed = remap(progress, 0.0, 0.05, 0, 1);
  const wRoute = remap(progress, 0.14, 0.21, 0, 1);

  const pos = V.copy(HERO_POS).lerp(FEED_POS, wFeed);
  LOOK.copy(HERO_LOOK).lerp(FEED_LOOK, wFeed);

  if (wRoute > 0) {
    const rp = lines.route.curve.getPoint(pRoute, new THREE.Vector3());
    const rl = lines.route.curve.getPoint(clamp01(pRoute + 0.05), new THREE.Vector3());
    const tan = lines.route.curve.getTangent(pRoute, new THREE.Vector3()).setY(0).normalize();
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    const bank = remap(progress, markers.pCfg - 0.09, markers.pCfg - 0.01, 0, 1)
      * remap(progress, markers.pCfg + 0.04, markers.pCfg + 0.12, 1, 0);
    const chase = rp.clone()
      .addScaledVector(tan, -30)
      .addScaledVector(side, 10 + 16 * bank);
    chase.y = 38;
    rl.addScaledVector(tan, 10);
    pos.lerp(chase, wRoute);
    LOOK.lerp(rl, wRoute);
  }
  if (pLift > 0) {
    const k = 1 - Math.pow(1 - pLift, 2);
    pos.lerp(END_POS, k);
    LOOK.lerp(END_LOOK, k);
  }

  const ease = 1 - Math.pow(1 - entrance, 3);
  pos.y += 42 * (1 - ease);
  camera.position.copy(pos);
  camera.lookAt(LOOK);
  qFollow.copy(camera.quaternion);

  V.setFromMatrixColumn(camera.matrixWorld, 0);
  camera.position.addScaledVector(V, parallax.x * 1.6);
  V.setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(V, parallax.y * 1.0);
  camera.lookAt(LOOK);
  qOffset.copy(camera.quaternion).slerp(qFollow, 0.35);
  camera.quaternion.copy(qOffset);
}
