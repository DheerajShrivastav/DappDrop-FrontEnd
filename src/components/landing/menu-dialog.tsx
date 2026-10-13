'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { track } from '@/lib/track'

/**
 * S1-02: the phone menu as a native <dialog> opened with showModal() (D-X3, ≈0.5 KB).
 *
 * - showModal() makes the rest of the page inert, so focus stays inside (focus trap).
 * - Esc closes it natively; the 'close' event syncs our state.
 * - Focus returns to the Menu button on close.
 * - aria-expanded / aria-controls on the trigger; links are 44 px tall.
 * - A click on a link or on the backdrop closes it.
 *
 * The links are server-rendered children; this island only owns open/close.
 */
export function MenuDialog({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const close = useCallback(() => dialogRef.current?.close(), [])

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const onClose = () => {
      setOpen(false)
      triggerRef.current?.focus()
    }
    // Close on a link click (in-page anchors) and on a click on the backdrop (the dialog itself).
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element
      if (t === d || t.closest('a')) d.close()
    }
    d.addEventListener('close', onClose)
    d.addEventListener('click', onClick)
    return () => {
      d.removeEventListener('close', onClose)
      d.removeEventListener('click', onClick)
    }
  }, [])

  const show = () => {
    dialogRef.current?.showModal()
    setOpen(true)
    track('menu_open')
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-haspopup="dialog"
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-rule-strong px-3 text-small max-[359px]:px-2 font-medium text-ink can-hover:hover:border-ink"
      >
        Menu
      </button>
      <dialog
        ref={dialogRef}
        id="site-menu"
        aria-label="Site menu"
        className="lp-menu m-0 ml-auto h-dvh max-h-none w-[min(22rem,100%)] max-w-none border-0 border-l border-rule bg-paper p-0 text-ink"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <span className="font-mono text-eyebrow uppercase text-ink-3">Menu</span>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-sm border border-rule-strong px-3 text-small font-semibold can-hover:hover:border-ink"
          >
            Close
          </button>
        </div>
        {children}
      </dialog>
    </>
  )
}
