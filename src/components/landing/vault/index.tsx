// Landing vault stage (3D centrepiece). Owned by the 3D build; contract: landing-studio/07-wow/build-contract.md.
// Server component: renders the decorative stage layer (posters, canvas host, scrim, in-scene labels)
// and a client island that lazy-loads the three.js scene after the LCP. Everything here is aria-hidden;
// the text equivalent lives in the page copy.
import styles from './vault.module.css'
import { VaultIsland } from './island'

const POSTER = '/landing/vault'

function Poster({ theme }: { theme: 'obsidian' | 'porcelain' }) {
  return (
    <picture className={`${styles.poster} ${styles[theme]}`} data-vault-poster={theme}>
      <source media="(orientation: portrait)" srcSet={`${POSTER}/${theme}-portrait.avif`} type="image/avif" />
      <img src={`${POSTER}/${theme}-landscape.avif`} alt="" loading="lazy" decoding="async" fetchPriority="low" />
    </picture>
  )
}

export function VaultStage() {
  return (
    <div className={styles.stage} data-vault-stage aria-hidden="true">
      <div className={styles.posters} data-vault-posters>
        <Poster theme="obsidian" />
        <Poster theme="porcelain" />
      </div>
      <canvas className={styles.placeholder} data-vault-placeholder tabIndex={-1} />
      <div className={styles.canvas} data-vault-canvas />
      <div className={styles.scrim} />
      <div className={styles.labels}>
        <span className={styles.label} data-wow-label="escrow">Escrow</span>
        <span className={styles.label} data-wow-label="ring">
          List public · <b>24 h</b>
        </span>
        <span className={styles.label} data-wow-label="example">Example</span>
      </div>
      <noscript>
        <style>{'[data-vault-posters]{display:block!important}'}</style>
      </noscript>
      <VaultIsland />
    </div>
  )
}
