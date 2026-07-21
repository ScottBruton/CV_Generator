import { useState } from 'react';
import { formatCareerPathText } from '../../lib/careerPath.js';

export default function CareerPathDocument({ content, versionId }) {
  const [copyStatus, setCopyStatus] = useState('');

  if (!content) return null;

  const roles = content.roles || [];
  const plainText = formatCareerPathText(content);

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
      className="career-path-doc"
      id={`career-path-${versionId}`}
      data-version={versionId}
      aria-label="Career path for applications"
    >
      <div className="career-path-doc__toolbar">
        <div>
          <h2 className="career-path-doc__title">Career Path</h2>
          <p className="career-path-doc__hint">Copy-friendly text for job application forms. Not included in PDF export.</p>
        </div>
        <button type="button" className="shell-btn shell-btn--primary" onClick={handleCopy}>
          Copy all
        </button>
      </div>
      {copyStatus ? <p className="career-path-doc__status">{copyStatus}</p> : null}

      <div className="career-path-doc__body">
        {roles.map((role, index) => (
          <section className="career-path-role" key={`${role.company}-${index}`}>
            <h3 className="career-path-role__heading">{index + 1}. {role.company}</h3>
            <p>Company: {role.company}</p>
            <p>Job Title: {role.jobTitle}</p>
            <p>Starting Date: {role.startDate}</p>
            <p>End Date: {role.endDate}</p>
            <p className="career-path-role__section">Responsibilities / Key Accomplishments:</p>
            <ul className="career-path-role__list">
              {(role.accomplishments || []).filter(Boolean).map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
