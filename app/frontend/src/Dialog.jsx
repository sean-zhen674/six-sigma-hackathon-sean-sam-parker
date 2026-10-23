import { useEffect, useRef } from 'react'
import { TEXT } from './labels.js'

// A modal popup written by hand (the tour has its own, older copy of the same ideas).
// Focus moves into it when it opens and goes back to whatever had focus before when it closes.
// Escape, the Close button and a click on the dark backdrop close it. Tab stays inside it.
// While it is open the page behind does not scroll; the popup scrolls inside itself if it is tall.

export default function Dialog({ titleId, title, onClose, children }) {
  const box = useRef(null)

  useEffect(() => {
    const before = document.activeElement
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    box.current.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      if (before && before.focus) before.focus()
    }
  }, [])

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    // the real Tab stops inside the window; the window itself (tabIndex -1) is only where focus starts
    const items = [...box.current.querySelectorAll('button:not([disabled]), a[href]')]
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === box.current)) {
      e.preventDefault()
      lastItem.focus()
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault()
      firstItem.focus()
    }
  }

  function onBackdrop(e) {
    if (e.target === e.currentTarget) onClose() // only a click on the dark area, not inside the window
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onBackdrop}>
      <div
        ref={box}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="secondary" onClick={onClose}>{TEXT.closeLabel}</button>
        </div>
        {children}
      </div>
    </div>
  )
}
