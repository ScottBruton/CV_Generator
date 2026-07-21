const CHOICES = [
  { id: 'all', label: 'Cover letter + CV + Portfolio', primary: true },
  { id: 'cv-portfolio', label: 'CV + Portfolio' },
  { id: 'cover', label: 'Cover letter only' },
  { id: 'cv', label: 'CV only' },
  { id: 'portfolio', label: 'Portfolio only' }
];

export default function ExportDialog({ open, onClose, onExport, busy }) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="export-title">What should we export?</h2>
        <p>Choose which documents to include for the selected variant.</p>
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
