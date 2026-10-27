// Vault themes: pure data read by the scene. Obsidian (default) and Porcelain (light toggle).
// Colours are sRGB hex unless named *Lin (linear, tuned under the theme's tone mapping).
// ink: false = light is additive (dark theme); true = lines/arcs/wallets are pigment (alpha), since
// additive light can't draw on paper.
export const THEMES = {
  obsidian: {
    tone: 'agx', exposure: 1.1,
    envBg: '#000000',
    env: [
      { color: '#E9EEF5', intensity: 1.6, pos: [3.5, 5, 6], size: [5, 3.5], soft: [0.5, 0.5] },
      { color: '#ffffff', intensity: 2.2, pos: [2.2, 2.5, -7], size: [0.35, 9] },
      { color: '#E9EEF5', intensity: 3.5, pos: [-5.5, 2.2, -4], size: [0.4, 9] },
      { color: '#ffffff', intensity: 3.2, pos: [-6, 1.5, 3], size: [0.25, 7] },
      { color: '#ffffff', intensity: 7, pos: [6, 2.6, 0.8], size: [0.25, 5] }, // static top-right edge line
      { color: '#ffffff', intensity: 4.5, pos: [0.3, 7, -1.5], size: [3, 0.7] },
      { color: '#8b9bb5', intensity: 0.25, pos: [0, -5, 0], size: [12, 12], soft: [0.5, 0.5] },
    ],
    skyLin: { base: [0.0015, 0.0015, 0.0018], haze: [0.003, 0.0034, 0.0044], halo: [0.006, 0.0068, 0.0085], back: [0.02, 0.022, 0.027], blade: [0.007, 0.0075, 0.009] },
    floorLin: { base: [0.0013, 0.0013, 0.0016], reflAdd: 0.38, reflMix: 0, shadow: 0, pool: 0.05 },
    glass: { atten: '#CFD8E3', attenDist: 2.4, env: 1.25, rough: 0.035, clearcoat: 0.6, dispersion: 3.0, edge: 0, edgePow: 1.6, edgeCol: '#000000', sweep: '#E9EEF5', rim: '#E9EEF5', fakeOpacity: 0.035 },
    reward: '#F2B45E', rewardBase: 0.55, rewardRim: 2.6, coinTop: 1.3, coinEdge: 0.5, core: 1,
    ring: '#E9EEF5', lock: '#F2B45E', mark: '#E9EEF5', chamber: '#E9EEF5', chamberI: 0.035,
    arc: '#F2B45E', head: '#F2B45E', walletIdle: '#E9EEF5', walletLanded: '#F7E6C8', host: '#F7E6C8',
    ink: false, arcK: 1, arcW: 1, dust: 1, dustCol: '#F3F6FF',
    post: { strength: 0.45, threshold: 0.85, grain: 0.028, vignette: 0.25 },
  },
  porcelain: {
    tone: 'neutral', exposure: 1.0,
    envBg: '#8E897F', // mid-grey room + black cards: the faces mirror something darker than the paper
    env: [
      { color: '#000000', intensity: 0, pos: [-5.5, 2.2, -4], size: [3.5, 10] },
      { color: '#000000', intensity: 0, pos: [6, 2.6, 0.8], size: [1.4, 7] },
      { color: '#FFFFFF', intensity: 9, pos: [6, 2.4, 2.4], size: [0.22, 6] }, // white strip beside the card: edge + glint
      { color: '#000000', intensity: 0, pos: [-6, 1.5, 3], size: [1.2, 8] },
      { color: '#000000', intensity: 0, pos: [2.2, 2.5, -7], size: [2.2, 10] },
      { color: '#FFFFFF', intensity: 0.4, pos: [3.5, 5, 6], size: [2.6, 1.8], soft: [0.5, 0.5] }, // dim window: no veil on the face
      { color: '#FFFFFF', intensity: 8.0, pos: [0.3, 7, -1.5], size: [3, 0.35] },
      { color: '#4A463F', intensity: 1, pos: [0, -5, 0], size: [16, 16] },
    ],
    skyLin: { base: [0.83, 0.8, 0.735], haze: [0.02, 0.019, 0.016], halo: [0, 0, 0], back: [-0.085, -0.082, -0.074], blade: [0, 0, 0] },
    floorLin: { base: [0.69, 0.662, 0.6], reflAdd: 0, reflMix: 0.42, shadow: 0.75, pool: 0.16 },
    // clear, thick glass: no roughness (the coins and paper stay sharp through it), little env haze,
    // neutral attenuation, and a crisp (high-exponent) fresnel edge instead of a broad grey falloff
    glass: { atten: '#F7F5F1', attenDist: 12, env: 0.55, rough: 0, clearcoat: 0.25, dispersion: 0.6, edge: 0.75, edgePow: 3.2, edgeCol: '#4A4640', sweep: '#FFFFFF', rim: '#2A2620', fakeOpacity: 0.05 },
    reward: '#C08032', rewardBase: 0.9, rewardRim: -0.5, coinTop: 1.08, coinEdge: 0.55, core: 0, // bronze: lit amber tops, darker bronze edges
    ring: '#2E2A24', lock: '#A35E10', mark: '#2B2721', chamber: '#57534D', chamberI: 0.36,
    arc: '#7A4609', head: '#B86A12', walletIdle: '#4A443A', walletLanded: '#A35F12', host: '#6E5130',
    ink: true, arcK: 0.62, arcW: 1.7, dust: 0, dustCol: '#000000',
    post: { strength: 0.06, threshold: 1.4, grain: 0.016, vignette: 0.05 },
  },
}
export const themeName = (n) => (n === 'porcelain' ? 'porcelain' : 'obsidian')
