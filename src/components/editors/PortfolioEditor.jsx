import { useEffect, useState } from 'react';

export default function PortfolioEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || {});

  useEffect(() => {
    setDraft(content || {});
  }, [content]);

  const sheets = Array.isArray(draft.sheets)
    ? draft.sheets
    : [{ items: draft.items || [] }];

  function commit(next) {
    setDraft(next);
    onChange?.(next);
  }

  function updateLabel(value) {
    commit({ ...draft, label: value });
  }

  function updateItem(sheetIndex, itemIndex, key, value) {
    const nextSheets = Array.isArray(draft.sheets)
      ? structuredClone(draft.sheets)
      : [{ items: structuredClone(draft.items || []) }];
    nextSheets[sheetIndex].items[itemIndex][key] = value;
    commit({ ...draft, sheets: nextSheets });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit portfolio</h3>
      <p className="shell-editor__hint">Update titles and subtitles. Use Advanced JSON for images/layout.</p>

      <label className="shell-field">
        <span>Label</span>
        <input value={draft.label || ''} onChange={(e) => updateLabel(e.target.value)} />
      </label>

      {sheets.map((sheet, sheetIndex) => (
        <div key={sheetIndex}>
          {(sheet.items || []).map((item, itemIndex) => (
            <div key={item.id || itemIndex} style={{ marginBottom: 12 }}>
              <label className="shell-field">
                <span>Item title</span>
                <input
                  value={item.title || ''}
                  onChange={(e) => updateItem(sheetIndex, itemIndex, 'title', e.target.value)}
                />
              </label>
              <label className="shell-field">
                <span>Subtitle</span>
                <input
                  value={item.subtitle || ''}
                  onChange={(e) => updateItem(sheetIndex, itemIndex, 'subtitle', e.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      ))}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save portfolio</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
