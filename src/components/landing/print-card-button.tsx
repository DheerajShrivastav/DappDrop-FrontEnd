'use client'

/**
 * AS-10: print (or save as PDF) the can/can't card on its own: opens the card, marks <html> so
 * print.css hides everything else, prints, then restores. A normal page print is unchanged.
 */
export function PrintCardButton() {
  const print = () => {
    const html = document.documentElement
    const details = document.querySelector<HTMLDetailsElement>('#can-cant details')
    const wasOpen = details?.open
    if (details) details.open = true
    html.classList.add('print-card')
    const done = () => {
      html.classList.remove('print-card')
      if (details && !wasOpen) details.open = false
      removeEventListener('afterprint', done)
    }
    addEventListener('afterprint', done)
    window.print()
  }
  return (
    <button
      type="button"
      onClick={print}
      className="inline-flex h-11 items-center rounded-sm border border-rule-strong px-4 text-small font-semibold text-ink can-hover:hover:border-ink"
    >
      Print or save as PDF
    </button>
  )
}
