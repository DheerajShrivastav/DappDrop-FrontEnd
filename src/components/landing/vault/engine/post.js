// Post: a compact HDR pipeline, smaller and more controllable than EffectComposer + UnrealBloomPass.
//   scene -> MSAA HalfFloat target -> soft-threshold prefilter -> dual-filter down/up mip chain (bloom)
//   -> composite: bloom, gentle edge chromatic aberration, vignette, tone mapping (renderer's),
//      sRGB output, then film grain in display space (also kills banding in the dark gradients).
import {
  WebGLRenderTarget, HalfFloatType, LinearFilter, ShaderMaterial, Mesh, BufferGeometry,
  BufferAttribute, OrthographicCamera, Vector2, CustomBlending, OneFactor, AddEquation,
} from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = (s(vec2(-1.,-1.)) + s(vec2(1.,-1.)) + s(vec2(-1.,1.)) + s(vec2(1.,1.))) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  c *= max(rq, br - uThreshold) / max(br, 1e-4);
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); // one bad pixel must never bloom across the frame
  gl_FragColor = vec4(min(c, vec3(24.0)), 1.0); // clamp fireflies
}`

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv - h).rgb;
  c += texture2D(tSrc, vUv + h).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  c += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(c * 0.125, 1.0);
}`

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight; varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 * uWeight, 1.0);
}`

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene, tBloom;
uniform float uBloom, uTime, uGrain, uVignette, uCA, uFade, uAspect, uHasBloom;
uniform vec3 uLift;
varying vec2 vUv;
// interleaved gradient noise, animated
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * r2 * uCA;
  vec3 col;
  col.r = texture2D(tScene, vUv - off).r;
  col.g = texture2D(tScene, vUv).g;
  col.b = texture2D(tScene, vUv + off).b;
  if (uHasBloom > 0.5) col += texture2D(tBloom, vUv).rgb * uBloom;
  vec2 vc = c * vec2(uAspect, 1.0);
  float vig = smoothstep(1.05, 0.15, length(vc) * 1.1);
  col *= mix(1.0, vig, uVignette);
  col += uLift; // tiny black lift so the darks read as "deep" rather than crushed
  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float n = ign(gl_FragCoord.xy + vec2(fract(uTime * 13.17) * 117.0, fract(uTime * 7.31) * 71.0));
  gl_FragColor.rgb += (n - 0.5) * uGrain;
}`

function fsTriangle() {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
  return g
}

const mat = (fragmentShader, uniforms, extra = {}) =>
  new ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra })

export class Post {
  constructor(renderer, { samples = 4, levels = 6, scale = 0.5, strength = 0.6, threshold = 0.9, knee = 0.5, grain = 0.035, vignette = 0.55, ca = 0.012, lift = [0.0, 0.0, 0.0] } = {}) {
    this.renderer = renderer
    this.levels = levels
    this.scale = scale
    const maxSamples = renderer.capabilities.maxSamples || 0
    this.rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: Math.min(samples, maxSamples), depthBuffer: true })
    this.mips = []
    for (let i = 0; i < levels; i++) {
      this.mips.push(new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }))
    }
    this.cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new Mesh(fsTriangle())
    this.quad.frustumCulled = false

    this.pre = mat(PREFILTER, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: threshold }, uKnee: { value: knee } })
    this.down = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new Vector2() } })
    this.up = mat(UP, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uWeight: { value: 1 } }, {
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, blendEquation: AddEquation,
    })
    this.comp = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.rt.texture },
        tBloom: { value: levels ? this.mips[0].texture : null },
        uBloom: { value: strength },
        uHasBloom: { value: levels ? 1 : 0 },
        uTime: { value: 0 },
        uGrain: { value: grain },
        uVignette: { value: vignette },
        uCA: { value: ca },
        uFade: { value: 1 },
        uAspect: { value: 1 },
        uLift: { value: lift },
      },
    })
    this.u = this.comp.uniforms
  }

  // [mesh, material] pairs so Stage.compile can warm the post programs too
  passes() { return [this.pre, this.down, this.up, this.comp].map((m) => [this.quad, m]) }

  setBloomEnabled(on) {
    this.bloomOn = on
    this.u.uHasBloom.value = on && this.levels ? 1 : 0
  }

  setSize(w, h) {
    this.rt.setSize(w, h)
    let mw = Math.max(1, Math.round(w * this.scale))
    let mh = Math.max(1, Math.round(h * this.scale))
    for (const m of this.mips) {
      m.setSize(mw, mh)
      mw = Math.max(1, mw >> 1)
      mh = Math.max(1, mh >> 1)
    }
    this.u.uAspect.value = w / h
  }

  pass(material, target) {
    this.quad.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quad, this.cam)
  }

  render(scene, camera, time) {
    const r = this.renderer
    r.setRenderTarget(this.rt)
    r.render(scene, camera)

    if (this.levels && this.bloomOn !== false) {
      const p = this.pre.uniforms
      p.tSrc.value = this.rt.texture
      p.uTexel.value.set(1 / this.rt.width, 1 / this.rt.height)
      this.pass(this.pre, this.mips[0])
      for (let i = 1; i < this.levels; i++) {
        const src = this.mips[i - 1]
        this.down.uniforms.tSrc.value = src.texture
        this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height)
        this.pass(this.down, this.mips[i])
      }
      const ac = r.autoClear
      r.autoClear = false
      for (let i = this.levels - 1; i > 0; i--) {
        const src = this.mips[i]
        this.up.uniforms.tSrc.value = src.texture
        this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height)
        this.pass(this.up, this.mips[i - 1])
      }
      r.autoClear = ac
    }
    this.u.uTime.value = time
    this.pass(this.comp, null)
  }

  dispose() {
    this.rt.dispose()
    for (const m of this.mips) m.dispose()
    for (const m of [this.pre, this.down, this.up, this.comp]) m.dispose()
    this.quad.geometry.dispose()
  }
}
