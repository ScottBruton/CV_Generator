import { useEffect, useState } from 'react';

export default function CoverEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || {});

  useEffect(() => {
    setDraft(content || {});
  }, [content]);

  if (!draft) return null;

  const paragraphs = Array.isArray(draft.paragraphs) ? draft.paragraphs : [''];

  function commit(next) {
    setDraft(next);
    onChange?.(next);
  }

  function updateField(key, value) {
    commit({ ...draft, [key]: value });
  }

  function updateParagraph(index, value) {
    const nextParagraphs = [...(draft.paragraphs || [''])];
    nextParagraphs[index] = value;
    commit({ ...draft, paragraphs: nextParagraphs });
  }

  function addParagraph() {
    commit({ ...draft, paragraphs: [...(draft.paragraphs || []), ''] });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit cover letter</h3>
      <p className="shell-editor__hint">Update the fields below, then save.</p>

      <label className="shell-field">
        <span>Label</span>
        <input value={draft.label || ''} onChange={(e) => updateField('label', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Recipient</span>
        <input value={draft.recipient || ''} onChange={(e) => updateField('recipient', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Company</span>
        <input value={draft.company || ''} onChange={(e) => updateField('company', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Company logo path</span>
        <input value={draft.companyLogo || ''} onChange={(e) => updateField('companyLogo', e.target.value)} placeholder="assets/cover/example.jpg" />
      </label>
      <label className="shell-field">
        <span>Subject</span>
        <input value={draft.subject || ''} onChange={(e) => updateField('subject', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Closing</span>
        <input value={draft.closing || ''} onChange={(e) => updateField('closing', e.target.value)} />
      </label>

      {paragraphs.map((paragraph, index) => (
        <label className="shell-field" key={index}>
          <span>Paragraph {index + 1}</span>
          <textarea value={paragraph} onChange={(e) => updateParagraph(index, e.target.value)} />
        </label>
      ))}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--secondary" onClick={addParagraph}>Add paragraph</button>
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save cover</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
