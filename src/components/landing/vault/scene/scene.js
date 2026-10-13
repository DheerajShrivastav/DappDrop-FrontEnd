// Landing vault scene (Concept 1 "Monolith"), ported from landing-studio/07-wow/prototypes.
// Build contract: landing-studio/07-wow/build-contract.md. Lazy chunk: loaded by ../island.tsx only.
// One glass block; the reward is the only warm thing in the room. Story value T (see engine/story.js):
//   Hero   - the reward rests, glowing, in the upper chamber; one band of key light sweeps the face on load
//   Fund   - the stack settles to the chamber floor; "the Seal": a lock line draws across the face, flares, settles
//   Prove  - five abstract tick marks etch onto the face; a hairline ring closes around the base (24 h list)
//   Claim  - the lock line goes dark; discs lift out and burst into arcs to wallet points on the floor;
//            the last one returns to a dim host point behind the block (unclaimed comes back)
// Units: 1 = the block's width. Block base on y = 0.
import {
  Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D, Vector3, Color,
  MeshPhysicalMaterial, ShaderMaterial, SphereGeometry, PlaneGeometry, CylinderGeometry,
  BackSide, InstancedBufferAttribute, MathUtils, AgXToneMapping, NeutralToneMapping,
} from 'three'
import { THEMES, themeName } from './themes.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { Stage } from '../engine/stage.js'
import { Post } from '../engine/post.js'
import { createStory } from '../engine/story.js'
import { Rig, Pointer } from '../engine/rig.js'
import { GlowLines, GlowPoints } from '../engine/glow.js'
import { studioEnv } from '../engine/env.js'
import { createLabels } from '../engine/labels.js'

const { clamp, smoothstep, lerp } = MathUtils
const sat = (x) => clamp(x, 0, 1)
const win = (x, a, b) => sat((x - a) / (b - a))
const glide = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) // power2.inOut
const lin = (hex) => new Color(hex).toArray() // Color() converts sRGB hex to linear working space

// ---- dimensions (AD units) ----
const W = 1, H = 1.45, D = 0.62, BEVEL = 0.05
const LOCK_Y = 0.62 * H
const DISCS = 12, DISC_R = 0.16, DISC_T = 0.022, DISC_GAP = 0.008, DISC_Y0 = 0.14
const RING_R = 0.95
const HERO_LIFT = 0.07 // hero: the stack sits just above the chamber floor (soft glow beneath); Fund seats it
const WALLETS = 24
const SEGS = 28, TAIL = 0.42


const QUALITY = {
  high: {
    glass: 'transmission', reflect: 0.5, dust: 180, breathe: 0.22,
    post: { samples: 4, levels: 6, scale: 0.5, strength: 0.45, threshold: 0.85, knee: 0.4, grain: 0.028, vignette: 0.25, ca: 0 },
  },
  // weaker desktop GPUs (Intel/AMD iGPU, unknown): transmission at half res, no live reflection
  medium: {
    glass: 'transmission', reflect: 0, dust: 120, breathe: 0.22, dprCap: 1.25,
    post: { samples: 4, levels: 5, scale: 0.5, strength: 0.45, threshold: 0.85, knee: 0.4, grain: 0.026, vignette: 0.25, ca: 0 },
  },
  low: {
    glass: 'fake', reflect: 0, dust: 60, breathe: 0,
    post: { samples: 4, levels: 4, scale: 0.25, strength: 0.4, threshold: 0.85, knee: 0.4, grain: 0.022, vignette: 0.25, ca: 0 },
  },
}

// Camera keys on the story axis T (0 hero, 1-2 fund, 2-3 prove, 3-4 claim).
// shift = lens shift (fraction of viewport): vault right of the copy on desktop, bottom half on phone.
const KEYS = [
  { T: 0.0, pos: [1.6, 1.75, 4.5], tgt: [0, 0.62, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.3] },
  { T: 1.0, pos: [1.25, 1.45, 3.95], tgt: [0, 0.72, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.24] },
  { T: 1.6, pos: [0.9, 0.9, 3.4], tgt: [0, 0.72, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.17] },
  { T: 1.92, pos: [0.88, 0.9, 3.42], tgt: [0, 0.72, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.17] }, // holds through the Seal
  { T: 2.45, pos: [-1.4, 1.0, 3.6], tgt: [0, 0.62, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.17] },
  { T: 3.0, pos: [-1.3, 1.25, 3.9], tgt: [0, 0.55, 0], fov: 32, shift: [0.2, 0], shiftP: [0, -0.17] },
  { T: 3.45, pos: [-0.7, 2.5, 5.6], tgt: [0, 0.6, 0.8], fov: 34, shift: [0.18, 0], shiftP: [0, -0.24] },
  { T: 4.0, pos: [0.2, 3.9, 5.8], tgt: [0, 0.3, 1.0], fov: 34, shift: [0.17, 0], shiftP: [0, -0.22] },
]

// Sky colours are theme uniforms (shared by the dome and the floor's horizon blend).
const SKY = /* glsl */ `
  uniform vec3 uSkyBase, uSkyHaze, uSkyHalo, uSkyBack;
  vec3 sky(vec3 d) {
    vec3 c = uSkyBase;
    float hz = max(0.0, 1.0 - dot(normalize(vec3(d.x, d.y * 2.0, d.z)), normalize(vec3(-0.25, 0.2, -1.0))));
    c += uSkyHaze * exp(-hz * 3.5) + uSkyHalo * exp(-hz * 26.0);
    // a soft, tall backlight on the 'wall' behind the block (from the hero view): the glass reads against it
    float bh = atan(d.x, -d.z) - atan(-0.32, 0.94); float bv = d.y + 0.02;
    c += uSkyBack * exp(-(bh * bh) / 0.010 - (bv * bv) / 0.06);
    return c;
  }`

// Mount is split into short tasks (QA M1: one 80-150 ms task under 4x throttle). Between construction
// steps we yield to the main thread: scheduler.yield() where available, else a 0 ms timeout.
const yieldTask = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)))
const mark = (n) => { try { performance.mark(`vault:${n}`) } catch {} }

/**
 * Mount the vault scene.
 * @param {{ stage: HTMLElement, canvasHost: HTMLElement, tier?: 'high'|'medium'|'low', still?: number|null,
 *   watchdog?: boolean, grain?: boolean, onFail?: (why: string) => void, onFirstFrame?: () => void }} o
 */
export async function mount({ stage: stageEl, canvasHost, tier = 'high', still = null, watchdog = true, grain = true, onFail, onFirstFrame }) {
  const Q = { ...(QUALITY[tier] || QUALITY.high) }
  if (!grain) Q.post = { ...Q.post, grain: 0 }
  let themeKey = themeName(document.documentElement.dataset.theme)
  let TH = THEMES[themeKey]
  const C = {} // linear colours of the current theme, read every frame
  mark('mount-start')
  const story = createStory({ still })
  await yieldTask()
  const stage = new Stage(canvasHost, { tier, track: story.sections, onFail, watchdog, dprCap: Q.dprCap, toneMapping: AgXToneMapping, exposure: 1.1 })
  // shared theme uniforms
  const SU = { uSkyBase: { value: new Vector3() }, uSkyHaze: { value: new Vector3() }, uSkyHalo: { value: new Vector3() }, uSkyBack: { value: new Vector3() } }
  const { renderer } = stage
  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 0.05, 200)
  const labels = createLabels(stageEl)

  // Env: a procedural studio (softboxes/cards placed for the camera angles), built per theme in applyTheme().
  scene.environmentIntensity = 1.0

  mark('stage')
  await yieldTask()
  // ---------- backdrop ----------
  const dome = new Mesh(
    new SphereGeometry(80, 48, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: { ...SU, uBlade: { value: new Vector3() } },
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: /* glsl */ `varying vec3 vD; uniform vec3 uBlade; ${SKY}
        void main(){
          vec3 d = normalize(vD);
          vec3 c = sky(d);
          // two far, faint light blades: barely there directly, but the glass bends and splits them
          float az = atan(d.x, -d.z);
          float bl = smoothstep(0.012, 0.0, abs(az + 0.5)) + 0.6 * smoothstep(0.008, 0.0, abs(az - 0.28));
          bl *= smoothstep(0.0, 0.1, d.y) * smoothstep(0.5, 0.08, d.y);
          gl_FragColor = vec4(max(c + uBlade * bl, vec3(0.0)), 1.0);
        }`,
    }),
  )
  scene.add(dome)

  mark('backdrop')
  await yieldTask()
  // ---------- floor (glossy black; real-time reflection on desktop only) ----------
  const floorShader = {
    name: 'Floor',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uReflect: { value: 0 }, uPool: { value: 0 }, uRing: { value: 0 }, uRingOn: { value: 0 },
      uFloorBase: { value: new Vector3() }, uPoolCol: { value: new Vector3() }, uRingCol: { value: new Vector3() },
      uReflAdd: { value: 0 }, uReflMix: { value: 0 }, uShadow: { value: 0 }, uPoolK: { value: 0 }, uInk: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
      void main(){ vUv = textureMatrix * vec4(position,1.0); vW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uReflect, uPool, uRing, uRingOn;
      uniform vec3 uFloorBase, uPoolCol, uRingCol; uniform float uReflAdd, uReflMix, uShadow, uPoolK, uInk;
      varying vec4 vUv; varying vec3 vW;
      ${SKY}
      const float PI2 = 6.2831853;
      // light on dark themes, pigment on light ones
      vec3 over(vec3 col, vec3 c, float a) { return mix(col + c * a, mix(col, c, clamp(a, 0.0, 1.0)), uInk); }
      void main(){
        vec2 p = vW.xz; float r = length(p);
        vec3 col = uFloorBase;
        #ifdef REFLECT
          vec2 puv = vUv.xy / vUv.w;
          vec3 refl = vec3(0.0);
          float blur = 0.0015 + r * 0.0025;
          float rot = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * PI2;
          for (int i = 0; i < 12; i++) {
            float fi = float(i); float a = fi * 2.39996 + rot;
            refl += texture2D(tDiffuse, puv + vec2(cos(a), sin(a)) * blur * sqrt((fi + 0.5) / 12.0) * 2.0).rgb;
          }
          // fade with distance from the block's foot: reads as a gloss floor, not a mirror
          vec2 e = smoothstep(vec2(0.0), vec2(0.06), puv) * smoothstep(vec2(1.0), vec2(0.94), puv);
          float rf = uReflect * exp(-max(0.0, r - 0.5) * 1.1) * e.x * e.y;
          col += refl / 12.0 * uReflAdd * rf;
          col = mix(col, refl / 12.0, uReflMix * rf);
        #endif
        // soft contact shadow around the block's footprint (light themes; zero on dark ones)
        vec2 q0 = abs(p) - vec2(0.5, 0.31);
        float sd = max(length(max(q0, 0.0)) + min(max(q0.x, q0.y), 0.0), 0.0);
        col *= 1.0 - uShadow * (exp(-sd * 10.0) * 0.5 + exp(-sd * 2.0) * 0.4);
        // ember pool under the block once it holds the reward
        vec2 q = p / vec2(0.75, 0.55);
        col += uPoolCol * uPool * (exp(-dot(q, q) * 1.6) * uPoolK);
        // the 24 h ring: a hairline that draws 0 -> 360 deg from the front, with a bright leading end
        float a01 = fract(atan(p.x, p.y) / PI2 + 1.0);
        float aa = fwidth(r);
        float hair = 1.0 - smoothstep(0.0, aa * 1.3, abs(r - ${RING_R.toFixed(3)}));
        float drawn = step(a01, uRing);
        float ld = (a01 - uRing) * 40.0;
        float lead = exp(-ld * ld) * step(0.001, uRing) * (1.0 - step(0.999, uRing));
        col = over(col, uRingCol, hair * uRingOn * (drawn * 0.9 + lead * 2.5));
        vec3 farC = sky(normalize(vW - cameraPosition));
        // infinity cove: a few units out, the gloss floor melts into the backlit 'wall' (no horizon line)
        col = mix(farC, col, smoothstep(7.0, 1.4, length(p - vec2(0.0, 0.6))));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }
  let floor
  const floorGeo = new PlaneGeometry(120, 120)
  if (Q.reflect) {
    floorShader.fragmentShader = '#define REFLECT\n' + floorShader.fragmentShader
    floor = new Reflector(floorGeo, { shader: floorShader, textureWidth: 512, textureHeight: 512, clipBias: 0.001, multisample: 0 })
    // With a transmissive object in view, onBeforeRender can fire twice a frame: render the reflection once.
    const orig = floor.onBeforeRender
    let stamp = -1
    floor.onBeforeRender = function (...a) {
      if (stamp === stage.frameCount) return
      stamp = stage.frameCount
      orig.apply(this, a)
    }
    // The reflection camera clones the main camera's layers; keep it on layer 0 (no thin glows in the blur).
    const getRC = floor.getReflectionCamera
    floor.getReflectionCamera = function (c) { const rc = getRC.call(this, c); rc.layers.set(0); return rc }
    floor.material.uniforms.uReflect.value = 1
  } else {
    floor = new Mesh(floorGeo, new ShaderMaterial({ uniforms: floorShader.uniforms, vertexShader: floorShader.vertexShader, fragmentShader: floorShader.fragmentShader }))
    floorShader.uniforms.textureMatrix.value = new Object3D().matrix
  }
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  const FU = floor.material.uniforms
  Object.assign(FU, SU) // the Reflector clones uniforms: re-share the sky ones

  mark('floor')
  await yieldTask()
  // ---------- the block ----------
  const block = new Group()
  scene.add(block)
  const sweep = { y: { value: -10 }, amt: { value: 0 }, col: { value: new Vector3() }, rim: { value: new Vector3() }, ink: { value: 0 }, edge: { value: 0 }, edgeCol: { value: new Vector3() } }
  const injectSweep = (mat, fakeGlass) => {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uSweepY = sweep.y
      s.uniforms.uSweepAmt = sweep.amt
      s.uniforms.uSweepCol = sweep.col
      s.uniforms.uRimCol = sweep.rim
      s.uniforms.uInkG = sweep.ink
      s.uniforms.uEdge = sweep.edge
      s.uniforms.uEdgeCol = sweep.edgeCol
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSweepY;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvSweepY = (modelMatrix * vec4(transformed, 1.0)).y;')
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSweepY, uSweepAmt, uInkG, uEdge; uniform vec3 uSweepCol, uRimCol, uEdgeCol; varying float vSweepY;')
        .replace('#include <opaque_fragment>', `
          float frS = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          // light themes: tinted, darker edges (fresnel-weighted), so the glass is drawn by its edges on paper
          outgoingLight = mix(outgoingLight, uEdgeCol, clamp(uEdge * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 1.6), 0.0, 1.0));
          float bd = (vSweepY - uSweepY) / 0.035; float band = exp(-bd * bd); // never pow() a negative base
          outgoingLight += uSweepCol * band * (0.05 + 0.5 * frS) * uSweepAmt;
          ${fakeGlass ? 'float rim = pow(frS, 1.6); outgoingLight = mix(outgoingLight + uRimCol * rim * 0.9, mix(outgoingLight, uRimCol, rim * 0.9), uInkG); diffuseColor.a = clamp(diffuseColor.a + rim * 0.6 + band * uSweepAmt * 0.3, 0.0, 1.0);' : ''}
          #include <opaque_fragment>`)
    }
  }
  let glassMat
  if (Q.glass === 'transmission') {
    glassMat = new MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.035, transmission: 1, thickness: 0.9, ior: 1.52,
      dispersion: 3.0, attenuationColor: new Color('#CFD8E3'), attenuationDistance: 2.4,
      clearcoat: 0.6, clearcoatRoughness: 0.08, specularIntensity: 1, envMapIntensity: 1.25,
    })
  } else {
    // Phone: no transmission pass. Thin, mostly clear shell + fresnel rim (AD §1 cheaper fallback).
    glassMat = new MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.035,
      clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 0.55, depthWrite: false,
    })
  }
  injectSweep(glassMat, Q.glass !== 'transmission')
  const glass = new Mesh(new RoundedBoxGeometry(W, H, D, 8, BEVEL), glassMat)
  glass.position.y = H / 2
  glass.renderOrder = 2
  block.add(glass)

  // The hollow chamber: faint hairlines just inside the glass (refracted with it, so it reads as depth)
  const chamber = new GlowLines(12, { hot: 0.3, refracted: Q.glass === 'transmission' })
  {
    const x = W / 2 - 0.12, y0 = 0.12, y1 = H - 0.12, z = D / 2 - 0.12
    const c = [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z], [-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]]
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    E.forEach(([a, b], i) => chamber.set(i, c[a], c[b], [1, 1, 1], 0, 0.55))
  }
  block.add(chamber)

  mark('block')
  await yieldTask()
  // ---------- the reward: 12 thin discs of ember light ----------
  const discGeo = new CylinderGeometry(DISC_R, DISC_R, DISC_T, 56, 1)
  discGeo.setAttribute('aGlow', new InstancedBufferAttribute(new Float32Array(DISCS), 1))
  const discMat = new ShaderMaterial({
    uniforms: { uCol: { value: new Vector3() }, uBase: { value: 0.55 }, uRim: { value: 2.6 }, uTopK: { value: 1.25 }, uEdgeK: { value: 0.55 } },
    vertexShader: /* glsl */ `
      attribute float aGlow; varying float vGlow; varying vec3 vN; varying vec3 vV; varying float vTop;
      void main(){
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz; vGlow = aGlow; vTop = abs(normal.y);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uBase, uRim, uTopK, uEdgeK; varying float vGlow; varying vec3 vN; varying vec3 vV; varying float vTop;
      void main(){
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        // coin read: a brighter top face (an ellipse from above), a darker, rim-shaded edge band
        float top = smoothstep(0.5, 0.9, vTop);
        vec3 face = uCol * (uBase + fr * uRim) * uTopK;
        vec3 edge = uCol * (uBase + fr * uRim) * uEdgeK;
        vec3 c = mix(edge, face, top) * vGlow;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
  const discs = new InstancedMesh(discGeo, discMat, DISCS)
  discs.frustumCulled = false
  scene.add(discs)
  const glowAttr = discGeo.attributes.aGlow
  const dummy = new Object3D()

  // inner light (refracted): grows when the reward is in, steps up at the seal
  const core = new GlowPoints(3, { scale: 6, core: 0.2, refracted: Q.glass === 'transmission' })
  block.add(core)

  // the lock line (on the surface), and five abstract task marks (surface, cool key light)
  const marks = new GlowLines(6, { hot: 0.25 })
  block.add(marks)
  const LX0 = -W / 2 + 0.05, LX1 = W / 2 - 0.05, FZ = D / 2 + 0.002
  const markX = (i) => 0.12 + i * 0.065
  const MY0 = LOCK_Y + 0.13, MY1 = LOCK_Y + 0.36

  mark('reward')
  await yieldTask()
  // ---------- wallets, host, arcs ----------
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const wallets = []
  for (let i = 0; i < WALLETS; i++) {
    const a = lerp(-1.32, 1.32, i / (WALLETS - 1)) + (rnd() - 0.5) * 0.08
    const r = (i % 2 ? 2.55 : 1.85) + (rnd() - 0.5) * 0.3
    wallets.push(new Vector3(Math.sin(a) * r, 0.012, Math.cos(a) * r * 0.92 + 0.15))
  }
  const HOST = new Vector3(-0.35, 0.012, -2.3)
  // arcs: discs 0..10 burst into two arcs each (22 wallets claim); disc 11 goes home to the host.
  // Two wallets never receive: the picture never implies everyone qualified.
  const order = Array.from({ length: WALLETS }, (_, i) => i).sort(() => rnd() - 0.5)
  const ARCS = 23
  const arcs = []
  const P0 = new Vector3(0, H + 0.32, 0)
  for (let k = 0; k < 11; k++) {
    for (let j = 0; j < 2; j++) {
      const wi = order[k * 2 + j]
      arcs.push({ disc: k, to: wallets[wi], wi, start: 0.13 + k * 0.026 + j * 0.012, dur: 0.3 })
    }
  }
  arcs.push({ disc: 11, to: HOST, wi: -1, start: 0.88, dur: 0.12 })
  for (const a of arcs) {
    const dir = a.to.clone().setY(0).normalize()
    const lift = a.wi < 0 ? 0.35 : 0.5
    a.c = [P0, P0.clone().addScaledVector(dir, 0.25).setY(H + 0.32 + lift), a.to.clone().multiplyScalar(0.72).setY(0.25 + lift * 0.9), a.to.clone().setY(0.02)]
  }
  const trails = new GlowLines(ARCS * SEGS, { hot: 0.35 })
  const heads = new GlowPoints(ARCS, { scale: 5, core: 3 })
  const points = new GlowPoints(WALLETS + 1, { scale: 5, core: 2.5 })
  scene.add(trails, heads, points)
  const bez = (s, c, out) => {
    const u = 1 - s
    return out.set(0, 0, 0).addScaledVector(c[0], u * u * u).addScaledVector(c[1], 3 * u * u * s)
      .addScaledVector(c[2], 3 * u * s * s).addScaledVector(c[3], s * s * s)
  }

  mark('wallets')
  await yieldTask()
  // ---------- air ----------
  const dustI = []
  const dust = new GlowPoints(Q.dust, { scale: 4, core: 0.2, drift: tier === 'low' ? 0 : 0.12 })
  for (let i = 0; i < Q.dust; i++) {
    const r = 0.8 + Math.pow(rnd(), 0.6) * 4.5, a = rnd() * Math.PI * 2
    dust.set(i, [Math.cos(a) * r, 0.1 + rnd() * 2.6, Math.sin(a) * r - 0.6], 0.5 + rnd() * 1.1, [0.9, 0.92, 1.0], 0.02 + rnd() * 0.05)
    dustI.push(dust.C[i * 4 + 3])
  }
  dust.commit()
  scene.add(dust)

  // thin glows render on layer 1 only (main camera), so they never smear into the floor blur
  for (const o of [trails, heads, dust]) o.layers.set(1)
  camera.layers.enable(1)

  mark('air')
  await yieldTask()
  // ---------- post, rig, story ----------
  const post = new Post(renderer, Q.post)
  const rig = new Rig(camera, KEYS, { parallax: 0.12, portraitFit: 0.42, portraitFov: 38 / 32, portraitDolly: 1.45, lambda: 2.8, breathe: Q.breathe })
  const pointer = new Pointer()
  stage.onDegrade(() => { post.setBloomEnabled(false); FU.uReflect.value = 0 })
  // Phone framing: keep the vault clear of the hero copy, which runs to ~64 % on a 320 x 640 screen
  // (layout.md designed for 52 %). Measured from the hero's text block, relative to the fixed stage.
  const heroSafeTop = (h) => {
    const block = document.querySelector('[data-beat="hero"]')?.firstElementChild
    if (!block) return 0
    return (block.getBoundingClientRect().bottom + window.scrollY + 16) / h
  }
  stage.onResize((w, h, dpr) => {
    post.setSize(Math.round(w * dpr), Math.round(h * dpr))
    rig.resize(w, h)
    rig.setSafeTop(w < h ? heroSafeTop(h) : 0)
    for (const o of [chamber, marks, trails, heads, points, core, dust]) o.resize(w, h, dpr)
    if (Q.reflect) floor.getRenderTarget().setSize(Math.round(w * dpr * Q.reflect), Math.round(h * dpr * Q.reflect))
  })

  // ---------- themes: everything below is data from monolith-themes.js ----------
  const v3 = (u, a) => u.value.set(a[0], a[1], a[2])
  let envTex = null
  const applyTheme = (name) => {
    themeKey = themeName(name)
    TH = THEMES[themeKey]
    for (const k of ['reward', 'ring', 'lock', 'mark', 'chamber', 'arc', 'head', 'walletIdle', 'walletLanded', 'host']) C[k] = lin(TH[k])
    // tone mapping lives only in the final composite pass: switching it recompiles one tiny shader
    renderer.toneMapping = TH.tone === 'neutral' ? NeutralToneMapping : AgXToneMapping
    renderer.toneMappingExposure = TH.exposure
    post.comp.needsUpdate = true
    const old = envTex
    envTex = studioEnv(renderer, TH.env, TH.envBg)
    scene.environment = envTex.texture
    old?.dispose()
    const S = TH.skyLin, F = TH.floorLin
    v3(SU.uSkyBase, S.base); v3(SU.uSkyHaze, S.haze); v3(SU.uSkyHalo, S.halo); v3(SU.uSkyBack, S.back)
    v3(dome.material.uniforms.uBlade, S.blade)
    v3(FU.uFloorBase, F.base); v3(FU.uPoolCol, C.reward); v3(FU.uRingCol, C.ring)
    FU.uReflAdd.value = F.reflAdd; FU.uReflMix.value = F.reflMix; FU.uShadow.value = F.shadow; FU.uPoolK.value = F.pool; FU.uInk.value = TH.ink ? 1 : 0
    const G = TH.glass
    if (Q.glass === 'transmission') {
      glassMat.attenuationColor.set(G.atten); glassMat.attenuationDistance = G.attenDist
    } else glassMat.opacity = G.fakeOpacity
    glassMat.envMapIntensity = G.env
    v3(sweep.col, lin(G.sweep)); v3(sweep.rim, lin(G.rim)); sweep.ink.value = TH.ink ? 1 : 0
    sweep.edge.value = G.edge || 0; v3(sweep.edgeCol, lin(G.edgeCol || '#000000'))
    v3(discMat.uniforms.uCol, C.reward); discMat.uniforms.uBase.value = TH.rewardBase; discMat.uniforms.uRim.value = TH.rewardRim
    discMat.uniforms.uTopK.value = TH.coinTop; discMat.uniforms.uEdgeK.value = TH.coinEdge
    for (const o of [chamber, marks, trails, heads, points, core]) o.setInk(TH.ink)
    for (let i = 0; i < 12; i++) { chamber.C.set([...C.chamber, TH.chamberI], i * 4); chamber.W.fill(TH.ink ? 0.85 : 0.55) }
    chamber.commit()
    const dc = lin(TH.dustCol)
    for (let i = 0; i < Q.dust; i++) dust.C.set([...dc, dustI[i] * TH.dust], i * 4)
    dust.commit(); dust.visible = TH.dust > 0
    const P = TH.post, low = tier === 'low'
    post.u.uBloom.value = P.strength * (low ? 0.9 : 1); post.pre.uniforms.uThreshold.value = P.threshold
    post.u.uGrain.value = grain ? P.grain * (low ? 0.8 : 1) : 0; post.u.uVignette.value = P.vignette
    forceFrame = true // redraw on the render-on-demand tier
  }

  // hero light sweep: once, 1.8 s, as soon as the scene is up (skipped if the visitor has scrolled on)
  let sweepT = still != null ? 99 : 0
  let lastTs = -1, lastSweep = -1, forceFrame = true
  const tmp = new Vector3(), tmpB = new Vector3(), lab = new Vector3()
  const recv = new Float32Array(WALLETS + 1)

  stage.onFrame((dt, time) => {
    pointer.update(dt)
    const T = rig.update(story.T(), dt, time, pointer)
    const fund = sat(T - 1), prove = sat(T - 2), rel = sat(T - 3)

    // light sweep
    if (sweepT < 1.8) sweepT += dt * stage.timeScale
    const sw = sat(sweepT / 1.8)
    const sweeping = sw < 1 && T < 0.4
    sweep.y.value = lerp(H + 0.15, -0.15, glide(sw))
    sweep.amt.value = sweeping ? Math.sin(sw * Math.PI) * 1.2 : 0

    // Render on demand on the low tier: nothing time-based is running, so only redraw on change.
    if (tier === 'low' && !forceFrame && Math.abs(T - lastTs) < 1e-5 && !sweeping && lastSweep === sweep.amt.value) return
    lastTs = T
    lastSweep = sweep.amt.value
    forceFrame = false

    // --- the reward stack ---
    const drop = glide(win(fund, 0, 0.6))
    const spread = Math.sin(drop * Math.PI) * 0.012 // a compact stack at rest; it eases open slightly as it seats
    // Hero: the stack rests, glowing, in the upper chamber (visible on the first screen); Fund: it settles.
    const lift = (1 - drop) * HERO_LIFT + Math.sin(time * 0.6) * 0.006 * (1 - drop)
    const seal = win(fund, 0.6, 0.75)
    const flare = fund >= 0.75 ? Math.exp(-(fund - 0.75) * 30) : 0
    let inCount = 0
    for (let i = 0; i < DISCS; i++) {
      const k = DISCS - 1 - i // claim order: top disc first
      let y = DISC_Y0 + i * (DISC_T + DISC_GAP + spread) + lift
      let scale = 1
      let g = 1.0 + 0.35 * seal + 0.15 * Math.sin(time * 0.5 + i * 0.7) * (1 - drop)
      const leave = k < 11 ? 0.06 + k * 0.026 : 0.84
      const r = win(rel, leave, leave + 0.08)
      if (r > 0) {
        y = lerp(y, H + 0.32, glide(r))
        scale = 1 - smoothstep(r, 0.45, 0.9)
        g += r * 0.8
      }
      dummy.position.set(0, y, 0)
      dummy.rotation.set(0, 0, 0)
      const sc = Math.max(scale, 1e-4)
      dummy.scale.set(sc, 1, sc)
      dummy.updateMatrix()
      discs.setMatrixAt(i, dummy.matrix)
      glowAttr.array[i] = g
      if (r < 1 && y < H) inCount++
    }
    discs.instanceMatrix.needsUpdate = true
    glowAttr.needsUpdate = true
    const held = (inCount / DISCS) * (0.45 + 0.55 * drop)
    for (let i = 0; i < 3; i++) core.set(i, [0, DISC_Y0 + 0.08 + i * 0.12, 0], 80, C.reward, held * (0.016 + 0.012 * seal + 0.02 * flare) * TH.core)
    core.commit()
    FU.uPool.value = held * (0.8 + 0.4 * seal)

    // --- lock line + task marks ---
    const open = win(rel, 0.0, 0.06)
    const lockI = (seal > 0 ? 2.2 * (seal < 1 ? 1 : 0.16 + 0.84 * flare) : 0) * (1 - open)
    marks.set(0, [LX0, LOCK_Y, FZ], [lerp(LX0, LX1, glide(seal)), LOCK_Y, FZ], C.lock, lockI * (TH.ink ? 0.9 : 1), TH.ink ? 1.4 : 1.15)
    for (let i = 0; i < 5; i++) {
      const m = win(prove, i * 0.075, i * 0.075 + 0.06)
      marks.set(i + 1, [markX(i), MY0, FZ], [markX(i), lerp(MY0, MY1, glide(m)), FZ], C.mark, (m > 0 ? 1.4 * (1 - rel * 0.5) : 0) * (TH.ink ? 0.7 : 1), 0.7)
    }
    marks.commit()

    // --- 24 h ring ---
    const ring = win(prove, 0.4, 0.95)
    FU.uRing.value = ring
    FU.uRingOn.value = win(prove, 0.36, 0.42) * (1 - 0.5 * win(rel, 0.0, 0.2))

    // --- arcs, wallet points, host ---
    const wOn = win(T, 2.9, 3.15)
    recv.fill(-1)
    let ai = 0
    for (let s = 0; s < arcs.length; s++) {
      const a = arcs[s]
      const u = (rel - a.start) / a.dur
      const head = sat(u), tail = sat(u - TAIL)
      const live = u > 0 && tail < 1
      for (let j = 0; j < SEGS; j++) {
        if (!live) { trails.intensity(ai++, 0); continue }
        bez(lerp(tail, head, j / SEGS), a.c, tmp)
        bez(lerp(tail, head, (j + 1) / SEGS), a.c, tmpB)
        const q = (j + 1) / SEGS
        trails.set(ai++, [tmp.x, tmp.y, tmp.z], [tmpB.x, tmpB.y, tmpB.z], C.arc, (0.2 + 4.2 * q * q) * TH.arcK, (0.6 + 1.5 * (j / SEGS)) * TH.arcW, (0.6 + 1.5 * q) * TH.arcW)
      }
      if (live && u < 1) { bez(head, a.c, tmp); heads.set(s, [tmp.x, tmp.y, tmp.z], TH.ink ? 15 : 12, C.head, TH.ink ? 2.2 : 2.4) }
      else heads.set(s, [0, -50, 0], 0, C.head, 0)
      recv[a.wi < 0 ? WALLETS : a.wi] = u
    }
    for (let i = 0; i <= WALLETS; i++) {
      const p = i < WALLETS ? wallets[i] : HOST
      const u = recv[i]
      const landed = u >= 1
      // on landing: warm to ember, then settle to warm white (the scroll-scrubbed "600 ms")
      const emberMix = landed ? Math.exp(-(u - 1) * 5.4) : 0
      let col = i < WALLETS ? C.walletIdle : C.host
      let inten = i < WALLETS ? 0.4 * wOn : 0.2 * wOn
      if (landed) {
        const L = i < WALLETS ? C.walletLanded : C.host
        col = [lerp(L[0], C.reward[0], emberMix), lerp(L[1], C.reward[1], emberMix), lerp(L[2], C.reward[2], emberMix)]
        inten = 1.1 + emberMix * 1.2
      }
      if (TH.ink) inten *= landed ? 1.1 : 1.6
      points.set(i, [p.x, p.y + 0.01, p.z], (landed ? 14 : 9) + emberMix * 6, col, inten)
    }
    trails.commit()
    heads.commit()
    points.commit()

    // --- in-scene labels (DOM, aria-hidden; the same words are in the section text) ---
    const { w, h } = stage
    labels.set('escrow', lab.set(W / 2, LOCK_Y, D / 2), win(T, 1.55, 1.75) * (1 - win(T, 2.1, 2.3)), camera, w, h, 18, -12)
    const ra = ring * Math.PI * 2
    labels.set('ring', lab.set(Math.sin(ra) * RING_R, 0, Math.cos(ra) * RING_R), win(prove, 0.42, 0.48) * (1 - win(rel, 0.0, 0.08)), camera, w, h, 12, -10)
    labels.set('example', lab.copy(wallets[order[3]]), win(rel, 0.3, 0.4) * (1 - win(rel, 0.9, 0.98)), camera, w, h, 10, 8)

    dust.material.uniforms.uTime.value = time
    post.render(scene, camera, time)
  })

  mark('post')
  await yieldTask()
  applyTheme(themeKey)
  mark('theme')
  await yieldTask()
  rig.update(story.T(), 0, 0, null)
  await stage.compile(scene, camera, post.passes())
  mark('compiled')
  await yieldTask()
  stage.onFrame(() => { if (onFirstFrame) { const f = onFirstFrame; onFirstFrame = null; f() } })
  stage.start()

  // live re-colour from the page's theme toggle
  const onTheme = (e) => {
    const next = themeName(e?.detail?.theme ?? document.documentElement.dataset.theme)
    if (next !== themeKey) { applyTheme(next); stage.requestRender() }
  }
  window.addEventListener('dappdrop:themechange', onTheme)
  // After the claim beat the stage scrolls away *with* the claim section (no dead stretch of a fixed,
  // emptying stage before the next section on phones): translate it by how far the claim section's
  // bottom has passed the viewport bottom.
  const claimEl = document.querySelector('[data-beat="claim"]')
  let lastShift = -1
  const follow = () => {
    if (!claimEl) return
    const shift = Math.max(0, Math.round(innerHeight - claimEl.getBoundingClientRect().bottom))
    if (shift === lastShift) return
    lastShift = shift
    stageEl.style.transform = shift ? `translate3d(0, ${-shift}px, 0)` : ''
    // feather the stage's bottom edge while it leaves, so there is no seam against the page
    const mask = shift ? 'linear-gradient(to bottom, #000 72%, transparent)' : ''
    stageEl.style.maskImage = mask
    stageEl.style.webkitMaskImage = mask
  }
  follow()
  // while paused the loop is stopped, but the story still follows the visitor's scroll
  const onScroll = () => { follow(); if (stage.paused) stage.requestRender() }
  window.addEventListener('scroll', onScroll, { passive: true })

  return {
    stats: () => ({ ...stage.stats(), counts: { discs: DISCS, wallets: WALLETS, arcs: ARCS, trailSegments: ARCS * SEGS, dust: Q.dust } }),
    goto: (T) => { story.goto(T); rig.snap(T) },
    glide: (T, d) => story.glide(T, d),
    snap: () => rig.snap(story.T()),
    skipIntro: () => { sweepT = 99 },
    setPaused: (p) => stage.setPaused(p),
    setTheme: (name) => { applyTheme(name); stage.requestRender() },
    resetFrames: () => stage.resetFrames(),
    dispose() {
      window.removeEventListener('dappdrop:themechange', onTheme)
      window.removeEventListener('scroll', onScroll)
      stageEl.style.transform = ''
      stageEl.style.maskImage = ''
      stageEl.style.webkitMaskImage = ''
      story.dispose()
      pointer.dispose()
      post.dispose()
      envTex?.dispose()
      if (Q.reflect) floor.dispose()
      scene.traverse((o) => {
        o.geometry?.dispose()
        const m = o.material
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
      })
      stage.dispose()
    },
  }
}
