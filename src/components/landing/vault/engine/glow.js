// Glow primitives, both one draw call, additive, HDR so bloom picks them up.
// setInk(true) switches either one to alpha blending for light themes (additive light is invisible on paper):
// the same colour then reads as ink/pigment with the same soft falloff. Default output is unchanged.
//  GlowLines  - instanced screen-space-width segments (anti-aliased, constant pixel width at any distance)
//  GlowPoints - point sprites with a soft core + halo, per-point size/colour/intensity
import {
  InstancedBufferGeometry, InstancedBufferAttribute, BufferAttribute, BufferGeometry, ShaderMaterial,
  Mesh, Points, AdditiveBlending, NormalBlending, Vector2, DynamicDrawUsage,
} from 'three'

function setInk(obj, on) {
  const m = obj.material
  if (!!m.uniforms.uInk.value === on) return
  m.uniforms.uInk.value = on ? 1 : 0
  m.blending = on ? NormalBlending : AdditiveBlending
  m.transparent = on || !obj.refracted // ink lines draw over the glass (not refracted)
  m.needsUpdate = true
}

const LINE_VS = /* glsl */ `
attribute vec3 aA; attribute vec3 aB; attribute vec4 aC; attribute vec2 aW;
uniform vec2 uRes; uniform float uDpr;
varying vec2 vUv; varying vec4 vC;
void main() {
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(aA, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(aB, 1.0);
  vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float t = position.x;
  vec4 c = mix(ca, cb, t);
  float w = mix(aW.x, aW.y, t) * uDpr;
  c.xy += n * position.y * w / uRes * c.w;
  gl_Position = c;
  vUv = vec2(t, position.y);
  vC = aC;
}`

const LINE_FS = /* glsl */ `
varying vec2 vUv; varying vec4 vC;
uniform float uHot, uInk;
void main() {
  float d = abs(vUv.y);
  float a = 1.0 - d; a *= a;
  if (uInk > 0.5) { gl_FragColor = vec4(vC.rgb, clamp(vC.a * a, 0.0, 1.0)); return; }
  float hot = smoothstep(0.55, 1.0, 1.0 - d) * uHot;
  vec3 col = mix(vC.rgb, vec3(1.0), hot);
  gl_FragColor = vec4(col * vC.a * a, 1.0);
}`

export class GlowLines extends Mesh {
  constructor(count, { hot = 0.35, depthTest = true, refracted = false } = {}) {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const mk = (n) => new InstancedBufferAttribute(new Float32Array(count * n), n).setUsage(DynamicDrawUsage)
    g.setAttribute('aA', mk(3))
    g.setAttribute('aB', mk(3))
    g.setAttribute('aC', mk(4))
    g.setAttribute('aW', mk(2))
    g.instanceCount = count
    const m = new ShaderMaterial({
      vertexShader: LINE_VS,
      fragmentShader: LINE_FS,
      uniforms: { uRes: { value: new Vector2(1, 1) }, uDpr: { value: 1 }, uHot: { value: hot }, uInk: { value: 0 } },
      // refracted: live in the opaque list (still additive) so they render into the transmission
      // pass and are seen *through* glass, bent and dispersed, instead of being hidden by its depth.
      transparent: !refracted,
      depthWrite: false,
      depthTest,
      blending: AdditiveBlending,
    })
    super(g, m)
    this.frustumCulled = false
    this.count = count
    this.A = g.attributes.aA.array
    this.B = g.attributes.aB.array
    this.C = g.attributes.aC.array
    this.W = g.attributes.aW.array
    this.refracted = refracted
  }
  setInk(on) { setInk(this, on) }
  set(i, a, b, col, intensity, wa, wb = wa) {
    const A = this.A, B = this.B, C = this.C, W = this.W
    A[i * 3] = a[0]; A[i * 3 + 1] = a[1]; A[i * 3 + 2] = a[2]
    B[i * 3] = b[0]; B[i * 3 + 1] = b[1]; B[i * 3 + 2] = b[2]
    C[i * 4] = col[0]; C[i * 4 + 1] = col[1]; C[i * 4 + 2] = col[2]; C[i * 4 + 3] = intensity
    W[i * 2] = wa; W[i * 2 + 1] = wb
  }
  intensity(i, v) { this.C[i * 4 + 3] = v }
  commit(geomOnly = false) {
    const a = this.geometry.attributes
    a.aC.needsUpdate = true
    if (!geomOnly) { a.aA.needsUpdate = true; a.aB.needsUpdate = true; a.aW.needsUpdate = true }
  }
  resize(w, h, dpr) {
    // half-resolution in NDC units: pixel offset * 2 / res
    this.material.uniforms.uRes.value.set(w * dpr * 0.5, h * dpr * 0.5)
    this.material.uniforms.uDpr.value = dpr
  }
}

const PT_VS = /* glsl */ `
attribute float aSize; attribute vec4 aC;
uniform float uDpr, uScale, uTime, uDrift;
varying vec4 vC;
void main() {
  vec3 p = position;
  if (uDrift > 0.0) {
    float s = aC.a * 37.0 + float(gl_VertexID) * 0.137;
    p += uDrift * vec3(sin(uTime * 0.11 + s), sin(uTime * 0.07 + s * 1.7) * 0.6, cos(uTime * 0.09 + s * 1.3));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uDpr * (uScale / max(0.1, -mv.z));
  vC = aC;
}`

const PT_FS = /* glsl */ `
varying vec4 vC;
uniform float uCore, uInk;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float halo = exp(-r * r * 5.0);
  float core = exp(-r * r * 60.0) * uCore;
  if (uInk > 0.5) { gl_FragColor = vec4(vC.rgb / max(vC.a, 1e-4), clamp((halo * 0.45 + core * 0.35) * vC.a, 0.0, 1.0)); return; }
  gl_FragColor = vec4(vC.rgb * (halo + core), 1.0);
}`

export class GlowPoints extends Points {
  // aC.a holds intensity; colour * intensity is written, additive.
  constructor(count, { scale = 10, core = 1.5, drift = 0, refracted = false } = {}) {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage))
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1).setUsage(DynamicDrawUsage))
    g.setAttribute('aC', new BufferAttribute(new Float32Array(count * 4), 4).setUsage(DynamicDrawUsage))
    const m = new ShaderMaterial({
      vertexShader: PT_VS.replace('vC = aC;', 'vC = vec4(aC.rgb * aC.a, aC.a);'),
      fragmentShader: PT_FS,
      uniforms: { uDpr: { value: 1 }, uScale: { value: scale }, uCore: { value: core }, uTime: { value: 0 }, uDrift: { value: drift }, uInk: { value: 0 } },
      transparent: !refracted,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    super(g, m)
    this.frustumCulled = false
    this.P = g.attributes.position.array
    this.S = g.attributes.aSize.array
    this.C = g.attributes.aC.array
    this.refracted = refracted
  }
  setInk(on) { setInk(this, on) }
  set(i, p, size, col, intensity) {
    this.P[i * 3] = p[0]; this.P[i * 3 + 1] = p[1]; this.P[i * 3 + 2] = p[2]
    this.S[i] = size
    this.C[i * 4] = col[0]; this.C[i * 4 + 1] = col[1]; this.C[i * 4 + 2] = col[2]; this.C[i * 4 + 3] = intensity
  }
  commit() {
    const a = this.geometry.attributes
    a.position.needsUpdate = true; a.aSize.needsUpdate = true; a.aC.needsUpdate = true
  }
  resize(w, h, dpr) { this.material.uniforms.uDpr.value = dpr }
}
