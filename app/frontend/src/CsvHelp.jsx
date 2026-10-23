import Dialog from './Dialog.jsx'
import { COLUMN_MEANINGS, GUIDE_URL, OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from './format.js'
import { TEXT } from './labels.js'

// Help for people who upload their own spreadsheet file (CSV): a small link-style button that opens a popup.
// Plain text and links only. The template files live in public/ and are served next to index.html (relative links).
function ColumnList({ names }) {
  return (
    <ul className="col-list">
      {names.map((c) => <li key={c}><code>{c}</code>: {COLUMN_MEANINGS[c]}</li>)}
    </ul>
  )
}

/** `open` and `onOpenChange` come from App so that only one popup (this or the tour) is open at a time. */
export default function CsvHelp({ open, onOpenChange }) {
  return (
    <>
      <button type="button" className="link-button" onClick={() => onOpenChange(true)} aria-haspopup="dialog">
        {TEXT.csvButton}
      </button>
      {open && (
        <Dialog titleId="csv-title" title={TEXT.csvTitle} onClose={() => onOpenChange(false)}>
          <p>{TEXT.csvRows}</p>
          <p><strong>{TEXT.csvRequired}</strong></p>
          <ColumnList names={REQUIRED_COLUMNS} />
          <p>{TEXT.csvOptional}</p>
          <ColumnList names={OPTIONAL_COLUMNS} />
          <p>{TEXT.csvOther}<code> 2026-01-05T08:00:00</code>.</p>
          <p className="csv-links">
            <a href="./aeroprint_template.csv" download>Download template</a>
            <a href="./aeroprint_template_with_parameters.csv" download>Template with parameters</a>
            <a href={GUIDE_URL} target="_blank" rel="noreferrer">Full guide</a>
          </p>
        </Dialog>
      )}
    </>
  )
}
