import { useEffect, useRef, useState } from 'react'
import { TOUR_STEPS } from './tour.js'

// A small modal dialog written by hand. Focus moves into it when it opens and goes back to
// whatever had focus before when it closes. Escape closes it; Tab stays inside it.

export default function Tour({ onClose }) {
  const [step, setStep] = useState(0)
  const box = useRef(null)
  const last = TOUR_STEPS.length - 1
  const s = TOUR_STEPS[step]

  useEffect(() => {
    const before = document.activeElement
    box.current.focus()
    return () => {
      if (before && before.focus) before.focus()
    }
  }, [])

  // A step with a target scrolls that part of the page into view and outlines it. The window then
  // sits at the bottom of the screen, so the highlighted part stays visible above it. If the part
  // is not on the page (no results yet), the step just shows its text.
  const target = s.target ? document.getElementById(s.target) : null
  useEffect(() => {
    if (!target) return undefined
    target.classList.add('tour-target')
    target.scrollIntoView({ block: 'start' })
    return () => target.classList.remove('tour-target')
  }, [target])

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    // the real Tab stops inside the window; the window itself (tabIndex -1) is only where focus starts; the README link on the last step is a stop too
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

  return (
    <div className={`tour-backdrop${target ? ' docked' : ''}`}>
      <div
        ref={box}
        className="tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <p className="tour-count">Step {step + 1} of {TOUR_STEPS.length}</p>
        <h2 id="tour-title">{s.title}</h2>
        <p id="tour-text">{s.text}</p>
        {s.link && (
          <p className="tour-link">
            <a href={s.link.href} target="_blank" rel="noopener noreferrer">
              {s.link.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        )}
        <div className="tour-buttons">
          <button type="button" className="secondary" onClick={onClose}>Skip</button>
          <span className="tour-spacer" />
          <button type="button" className="secondary" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
          {step < last
            ? <button type="button" onClick={() => setStep(step + 1)}>Next</button>
            : <button type="button" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  )
}
