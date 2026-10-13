// Procedural "product photography" environment: a black room with a few HDR softboxes,
// prefiltered with PMREM. No HDRI download; glass and metal get crisp, designed highlights.
// Panels: { color, intensity, pos, size, look?, soft? }  soft = feathered edges (broad gradient sheen)
import { Scene, Color, Mesh, PlaneGeometry, MeshBasicMaterial, ShaderMaterial, DoubleSide, PMREMGenerator } from 'three'

const softMat = (color, intensity, feather) =>
  new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uC: { value: new Color(color).multiplyScalar(intensity) }, uF: { value: feather } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform vec2 uF;
      void main(){ vec2 e = min(vUv, 1.0 - vUv); float a = smoothstep(0.0, uF.x, e.x) * smoothstep(0.0, uF.y, e.y);
        gl_FragColor = vec4(uC * a, 1.0); }`,
  })

export function studioEnv(renderer, panels, bg = '#000000') {
  const scene = new Scene()
  scene.background = new Color(bg)
  const geo = new PlaneGeometry(1, 1)
  for (const p of panels) {
    const mat = p.soft
      ? softMat(p.color, p.intensity, p.soft)
      : new MeshBasicMaterial({ color: new Color(p.color).multiplyScalar(p.intensity), side: DoubleSide })
    const m = new Mesh(geo, mat)
    m.position.set(...p.pos)
    m.scale.set(p.size[0], p.size[1], 1)
    m.lookAt(...(p.look || [0, 0, 0]))
    scene.add(m)
  }
  const pm = new PMREMGenerator(renderer)
  const rt = pm.fromScene(scene, 0.0, 0.1, 100)
  pm.dispose()
  geo.dispose()
  scene.traverse((o) => o.material && o.material.dispose())
  return rt // caller owns it: use rt.texture, dispose rt
}
