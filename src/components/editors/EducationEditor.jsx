import { useEffect, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';

function emptyEntry() {
  return {
    institution: '',
    credential: '',
    startDate: '',
    endDate: '',
    details: ['']
  };
}

export default function EducationEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || null);

  useEffect(() => {
    setDraft(content || null);
  }, [content]);

  if (!draft) return <p>Loading education…</p>;

  const entries = Array.isArray(draft.entries) ? draft.entries : [];

  function commit(next) {
    setDraft(next);
    onChange?.(next);
  }

  function updateMeta(key, value) {
    commit({ ...draft, [key]: value });
  }

  function updateEntry(entryIndex, key, value) {
    const nextEntries = structuredClone(entries);
    nextEntries[entryIndex][key] = value;
    commit({ ...draft, entries: nextEntries });
  }

  function updateDetail(entryIndex, itemIndex, value) {
    const nextEntries = structuredClone(entries);
    nextEntries[entryIndex].details[itemIndex] = value;
    commit({ ...draft, entries: nextEntries });
  }

  function addDetail(entryIndex) {
    const nextEntries = structuredClone(entries);
    if (!Array.isArray(nextEntries[entryIndex].details)) nextEntries[entryIndex].details = [];
    nextEntries[entryIndex].details.push('');
    commit({ ...draft, entries: nextEntries });
  }

  function removeDetail(entryIndex, itemIndex) {
    const nextEntries = structuredClone(entries);
    nextEntries[entryIndex].details.splice(itemIndex, 1);
    commit({ ...draft, entries: nextEntries });
  }

  function addEntry() {
    commit({ ...draft, entries: [...entries, emptyEntry()] });
  }

  function removeEntry(entryIndex) {
    const nextEntries = structuredClone(entries);
    nextEntries.splice(entryIndex, 1);
    commit({ ...draft, entries: nextEntries });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit Education</h3>
      <p className="shell-editor__hint">Tailor education entries for application forms. This tab is not exported to PDF.</p>

      <label className="shell-field">
        <span>Label</span>
        <input value={draft.label || ''} onChange={(e) => updateMeta('label', e.target.value)} />
      </label>

      {entries.map((entry, entryIndex) => (
        <div className="shell-editor__section" key={entryIndex}>
          <div className="shell-bullet__head">
            <h4 className="shell-editor__title" style={{ margin: 0 }}>Entry {entryIndex + 1}</h4>
            <button type="button" className="shell-btn shell-btn--tiny shell-btn--danger" onClick={() => removeEntry(entryIndex)}>
              Remove entry
            </button>
          </div>

          <label className="shell-field">
            <span>Institution</span>
            <input value={entry.institution || ''} onChange={(e) => updateEntry(entryIndex, 'institution', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>Credential / Qualification</span>
            <input value={entry.credential || ''} onChange={(e) => updateEntry(entryIndex, 'credential', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>Starting date</span>
            <input value={entry.startDate || ''} onChange={(e) => updateEntry(entryIndex, 'startDate', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>End date</span>
            <input value={entry.endDate || ''} onChange={(e) => updateEntry(entryIndex, 'endDate', e.target.value)} />
          </label>

          <p className="shell-editor__subheading-label">Details / Highlights</p>
          {(entry.details || []).map((item, itemIndex) => (
            <div className="shell-bullet" key={itemIndex}>
              <div className="shell-bullet__head">
                <span className="shell-bullet__label">Item {itemIndex + 1}</span>
                <button
                  type="button"
                  className="shell-btn shell-btn--tiny shell-btn--danger"
                  onClick={() => removeDetail(entryIndex, itemIndex)}
                >
                  Remove
                </button>
              </div>
              <AutoTextarea
                value={item}
                onChange={(e) => updateDetail(entryIndex, itemIndex, e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="shell-btn shell-btn--tiny" onClick={() => addDetail(entryIndex)}>
            + Detail
          </button>
        </div>
      ))}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--secondary" onClick={addEntry}>Add entry</button>
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save education</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
