const CHOICES = [
  { id: 'all', label: 'Cover letter + CV + Portfolio', primary: true },
  { id: 'cv-portfolio', label: 'CV + Portfolio' },
  { id: 'cover', label: 'Cover letter only' },
  { id: 'cv', label: 'CV only' },
  { id: 'portfolio', label: 'Portfolio only' }
];

const MAX_SIZE_OPTIONS = [
  { id: '', label: 'No limit (best quality)' },
  { id: '5', label: '5 MB (common application limit)' },
  { id: '2', label: '2 MB' }
];

export default function ExportDialog({ open, onClose, onExport, busy, maxMb, onMaxMbChange }) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="export-title">What should we export?</h2>
        <p>Choose which documents to include for the selected variant.</p>

        <label className="shell-field" style={{ marginBottom: 12 }}>
          <span>Max PDF file size</span>
          <select
            value={maxMb}
            disabled={busy}
            onChange={(e) => onMaxMbChange?.(e.target.value)}
          >
            {MAX_SIZE_OPTIONS.map((option) => (
              <option key={option.id || 'none'} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        {maxMb ? (
          <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#5a6478' }}>
            Text and styles stay high quality. Only images are compressed to stay under {maxMb} MB.
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={`shell-btn ${choice.primary ? 'shell-btn--primary' : 'shell-btn--secondary'}`}
              disabled={busy}
              onClick={() => onExport(choice.id)}
              style={choice.primary ? undefined : { background: '#fff', borderColor: '#cfd6e4', color: '#11172f', textAlign: 'left' }}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="shell-btn shell-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
