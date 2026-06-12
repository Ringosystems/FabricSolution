// paths.js - curve layout and glow tube factory
// Concept per vectrfl.com teardown: TubeGeometry over CatmullRomCurve3,
// draw-on via uv.x discard against a scrubbed progress uniform,
// emissive hot tip pow() falloff feeding UnrealBloom.
import * as THREE from 'three';

// Classic Alien (1979) poster palette: a black void broken by a cool, slightly
// yellow bioluminescent phosphor-green glow. The glow ramp deep -> primary -> hot
// stays on the green / yellow-green arc so additive bloom flares the hot tip white.
// Key names are kept (teal*, navy*) so scene.js references need no rename.
export const COLORS = {
  navy0: 0x020503,      // void: near-black, faint green bias so tinted fog reads
  navy: 0x04110A,       // floor: very dark green-tinted ground
  panel: 0x102A1C,      // dark green-grey panel / build-box surfaces
  lineStroke: 0x2E5D3A, // dim green grid + structural edge stroke (kept just under bloom cutoff)
  teal: 0x7CFC2E,       // glow-primary: the signature radioactive Alien-egg green
  tealDeep: 0x3FB81C,   // glow-deep: denser green for secondary / peer lines
  tealLight: 0xE4FF8C,  // glow-hot: near-white yellow-green crack core
  ice: 0xF4FFE0,        // near-white green-tinted highlight
  nuclear: 0x66FF14,    // Simpsons reactor-rod green: vivid radioactive glow on the forge bar
};

const Y = 0.18; // line height above floor

const pts = (arr) => arr.map(([x, z]) => new THREE.Vector3(x, Y, z));

// --- Facility anchors (world x,z) ---
export const FORGE = new THREE.Vector3(-56, 0, -6);     // DSCForge
export const CONFIG = new THREE.Vector3(-28, 0, 21);    // ConfigFabric
export const REPO = new THREE.Vector3(10, 0, 25);       // RepoFabric
export const FLEET = new THREE.Vector3(46, 0, 25);      // endpoint field entry

// --- Step 01: three input feeders (prompt / GPO / scan) into the forge ---
export const feederPoints = [
  pts([[-70, -24], [-70, -16], [-66, -10], [-59.5, -7.2]]),
  pts([[-56, -28], [-56, -18], [-56, -9.6]]),
  pts([[-42, -24], [-42, -16], [-46, -10], [-52.5, -7.2]]),
];

// --- The route: one fluid curve, Forge -> ConfigFabric belt -> RepoFabric
//     aisle -> weaving down the device corridor until the fog takes it.
export const routePoints = pts([
  [-56, -6], [-55, 2], [-50, 10], [-43, 17],
  [-38, 20.8], [-28, 21], [-18, 21.2],          // along the conveyor
  [-8, 25.5], [0, 26.5], [6, 25.6],
  [10, 25], [15, 24.6],                          // down the library aisle
  [22, 22.5], [30, 22.8], [38, 24.6],
  [48, 25.8], [60, 24.8], [74, 26.2],            // weaving through the field
  [88, 25.2], [104, 26], [118, 25.4],            // gone into the fog
]);

export function peerArc(a, b, lift = 2.2) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  return [a.clone(), mid, b.clone()];
}

// ---------------------------------------------------------------------------
// Glow tube factory
// ---------------------------------------------------------------------------
const vertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uPulse;
  uniform float uProgress;   // draw head in [0,1]
  uniform float uOpacity;
  uniform float uDash;       // 0 = solid, >0 = dash frequency
  uniform float uHeadBoost;  // emissive multiplier at the head
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    if (vUv.x >= uProgress) discard;
    if (uDash > 0.0) {
      if (fract(vUv.x * uDash) > 0.62) discard;
    }
    // hot tip: brightest where uv.x approaches the draw head (vectr: (uv.x/ratio)^4 * 4)
    float head = pow(clamp(vUv.x / max(uProgress, 1e-4), 0.0, 1.0), 4.0) * uHeadBoost;
    float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.0);
    vec3 base = mix(uColor, uPulse, clamp(head * 0.4, 0.0, 1.0));
    vec3 col = (base + fresnel * 0.5) * (head + 1.0);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function makeGlowTube(points, {
  color = COLORS.teal,
  pulse = COLORS.tealLight,
  radius = 0.13,
  segments = 120,
  tension = 0.5,
  dash = 0,
  headBoost = 4.0,
  opacity = 1.0,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
  const geo = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPulse: { value: new THREE.Color(pulse) },
      uProgress: { value: 0 },
      uOpacity: { value: opacity },
      uDash: { value: dash },
      uHeadBoost: { value: headBoost },
    },
    transparent: opacity < 1.0,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 1.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.visible = false;
  return { mesh, curve, mat };
}

// Mirrored copy below the floor for the reflection read
export function makeMirror(tube, floorY = 0) {
  const m = tube.mesh.clone();
  m.material = tube.mat.clone();
  m.material.uniforms.uOpacity.value = 0.22;
  m.material.uniforms.uHeadBoost.value = 1.2;
  m.material.transparent = true;
  m.material.depthWrite = false;
  m.scale.y = -1;
  m.position.y = floorY * 2;
  m.renderOrder = 1;
  m.visible = false;
  return m;
}
