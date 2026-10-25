import { blockHeading, calcBlock } from './calc.js'
import Histogram from './Histogram.jsx'
import { QUALITY, TEXT } from './labels.js'

// The toggle inside the Process Capable box: for each measurement, the steps that give its
// capability index (real numbers from the API) and a histogram of the baseline coupons.
// Everything shown is the API's answer; calc.js only picks words and rounds for display.

export default function Calculations({ result }) {
  return (
    <details className="calc-toggle" id="calc-toggle" open>
      <summary>{TEXT.calcToggle}</summary>
      <div className="calc-body">
        <p className="calc-intro">{TEXT.calcIntro} {TEXT.calcRounding}</p>
        {QUALITY.map((q) => {
          const block = calcBlock(q, result)
          return (
            <section key={q.key} className="calc-block" aria-labelledby={`calc-${q.key}`}>
              <h3 id={`calc-${q.key}`}>{blockHeading(q)}</h3>
              <div className="calc-grid">
                <div className="calc-steps">
                  <ol>
                    {block.steps.map((s) => (
                      <li key={s.title}>
                        <strong>{s.title}</strong>
                        <span className="calc-words">{s.words}</span>
                        <span className="calc-math">= {s.math}</span>
                      </li>
                    ))}
                  </ol>
                  {block.message && <p className="calc-message">{block.message}</p>}
                  {block.verdict && <p className="calc-verdict">{block.verdict}</p>}
                </div>
                <Histogram q={q} cap={result.capability[q.key]} />
              </div>
            </section>
          )
        })}
      </div>
    </details>
  )
}
