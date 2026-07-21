import { useEffect, useState } from 'react';

export default function JsonEditor({ content, onSave, status }) {
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    setText(JSON.stringify(content ?? {}, null, 2));
    setParseError('');
  }, [content]);

  function handleSave() {
    try {
      const parsed = JSON.parse(text);
      setParseError('');
      onSave(parsed);
    } catch (error) {
      setParseError(error.message);
    }
  }

  return (
    <div>
      <h3 className="shell-editor__title">Advanced JSON</h3>
      <p className="shell-editor__hint">Edit the raw document JSON. Invalid JSON will not save.</p>
      <label className="shell-field">
        <span>JSON</span>
        <textarea
          style={{ minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.72rem' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--primary" onClick={handleSave}>Save JSON</button>
      </div>
      {parseError ? <p className="shell-status is-error">{parseError}</p> : null}
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
