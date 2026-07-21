import { useEffect, useRef, useState } from 'react';
import { uploadCoverLogo } from '../../api/client';
import { assetUrl } from '../../lib/content.js';
import AutoTextarea from './AutoTextarea.jsx';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export default function CoverEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || {});
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setDraft(content || {});
  }, [content]);

  if (!draft) return null;

  const paragraphs = Array.isArray(draft.paragraphs) ? draft.paragraphs : [''];
  const logoSrc = draft.companyLogo ? assetUrl(draft.companyLogo) : '';

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

  async function handleLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatus({ error: true, message: 'Please choose an image file.' });
      return;
    }

    setUploading(true);
    setUploadStatus({ message: 'Uploading logo…' });
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await uploadCoverLogo({
        filename: file.name,
        mimeType: file.type,
        data: dataUrl
      });
      updateField('companyLogo', uploaded.path);
      setUploadStatus({ message: 'Logo selected. Save cover to keep it.' });
    } catch (error) {
      setUploadStatus({ error: true, message: error.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
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

      <div className="shell-field">
        <span>Company logo</span>
        <div className="shell-file-row">
          <input
            value={draft.companyLogo || ''}
            onChange={(e) => updateField('companyLogo', e.target.value)}
            placeholder="assets/cover/example.jpg"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleLogoFile}
          />
          <button
            type="button"
            className="shell-btn shell-btn--tiny"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Browse…'}
          </button>
        </div>
        {logoSrc ? (
          <img className="shell-logo-preview" src={logoSrc} alt="Company logo preview" />
        ) : null}
        {uploadStatus ? (
          <p className={`shell-status${uploadStatus.error ? ' is-error' : ''}`} style={{ marginTop: 6 }}>
            {uploadStatus.message}
          </p>
        ) : null}
      </div>

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
          <AutoTextarea value={paragraph} onChange={(e) => updateParagraph(index, e.target.value)} />
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
