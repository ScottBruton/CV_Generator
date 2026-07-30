import { useState } from 'react';
import { formatEducationText } from '../../lib/education.js';

export default function EducationDocument({ content, versionId }) {
  const [copyStatus, setCopyStatus] = useState('');

  if (!content) return null;

  const entries = content.entries || [];
  const plainText = formatEducationText(content);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyStatus('Copied to clipboard');
      window.setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      setCopyStatus(error.message || 'Copy failed');
    }
  }

  return (
    <article
      className="education-doc"
      id={`education-${versionId}`}
      data-version={versionId}
      aria-label="Education for applications"
    >
      <div className="education-doc__toolbar">
        <div>
          <h2 className="education-doc__title">Education</h2>
          <p className="education-doc__hint">Copy-friendly text for job application forms. Not included in PDF export.</p>
        </div>
        <button type="button" className="shell-btn shell-btn--primary" onClick={handleCopy}>
          Copy all
        </button>
      </div>
      {copyStatus ? <p className="education-doc__status">{copyStatus}</p> : null}

      <div className="education-doc__body">
        {entries.map((entry, index) => (
          <section className="education-entry" key={`${entry.institution}-${index}`}>
            <h3 className="education-entry__heading">{index + 1}. {entry.institution}</h3>
            <p>Institution: {entry.institution}</p>
            <p>Credential / Qualification: {entry.credential}</p>
            <p>Starting Date: {entry.startDate}</p>
            <p>End Date: {entry.endDate}</p>
            <p className="education-entry__section">Details / Highlights:</p>
            <ul className="education-entry__list">
              {(entry.details || []).filter(Boolean).map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
