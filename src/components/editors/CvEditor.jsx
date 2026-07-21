import { useEffect, useState } from 'react';

function flattenBullets(body = []) {
  const lines = [];
  body.forEach((entry, entryIndex) => {
    if (entry?.heading || entry?.subheading) return;
    if (typeof entry === 'string') {
      lines.push({ path: [entryIndex], text: entry });
      return;
    }
    if (entry?.text) {
      lines.push({ path: [entryIndex, 'text'], text: entry.text, entryIndex });
    }
    (entry?.bullets || []).forEach((bullet, bulletIndex) => {
      const text = typeof bullet === 'string' ? bullet : bullet?.text || '';
      lines.push({ path: [entryIndex, 'bullets', bulletIndex], text, entryIndex, bulletIndex });
    });
  });
  return lines.slice(0, 24);
}

export default function CvEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || null);

  useEffect(() => {
    setDraft(content || null);
  }, [content]);

  if (!draft) return <p>Loading CV…</p>;

  const profile = draft.profile || {};
  const pillars = draft.impact?.pillars || [];

  function commit(next) {
    setDraft(next);
    onChange?.(next);
  }

  function updateProfile(key, value) {
    commit({
      ...draft,
      profile: { ...draft.profile, [key]: value }
    });
  }

  function updateMetaLabel(value) {
    commit({ ...draft, meta: { ...(draft.meta || {}), label: value } });
  }

  function updateBullet(pillarIndex, line, value) {
    const impact = structuredClone(draft.impact || { pillars: [] });
    const pillar = impact.pillars[pillarIndex];
    if (!pillar) return;
    const entry = pillar.body[line.entryIndex ?? line.path[0]];
    if (!entry) return;

    if (line.bulletIndex != null) {
      const bullet = entry.bullets[line.bulletIndex];
      if (typeof bullet === 'string') entry.bullets[line.bulletIndex] = value;
      else entry.bullets[line.bulletIndex] = { ...bullet, text: value };
    } else if (typeof entry === 'string') {
      pillar.body[line.path[0]] = value;
    } else {
      entry.text = value;
    }

    commit({ ...draft, impact });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit CV</h3>
      <p className="shell-editor__hint">Profile and key impact bullets. Use Advanced JSON for full structure.</p>

      <label className="shell-field">
        <span>CV label</span>
        <input value={draft.meta?.label || ''} onChange={(e) => updateMetaLabel(e.target.value)} />
      </label>
      <label className="shell-field">
        <span>First name</span>
        <input value={profile.firstName || ''} onChange={(e) => updateProfile('firstName', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Last name</span>
        <input value={profile.lastName || ''} onChange={(e) => updateProfile('lastName', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Title</span>
        <input value={profile.title || ''} onChange={(e) => updateProfile('title', e.target.value)} />
      </label>
      <label className="shell-field">
        <span>Summary</span>
        <textarea value={profile.summary || ''} onChange={(e) => updateProfile('summary', e.target.value)} />
      </label>

      {pillars.map((pillar, pillarIndex) => {
        const lines = flattenBullets(pillar.body);
        if (!lines.length) return null;
        return (
          <div key={pillar.variant || pillarIndex}>
            <h4 className="shell-editor__title" style={{ marginTop: 16 }}>{pillar.title || pillar.variant}</h4>
            {lines.map((line, index) => (
              <label className="shell-field" key={`${pillarIndex}-${index}`}>
                <span>Bullet {index + 1}</span>
                <textarea value={line.text} onChange={(e) => updateBullet(pillarIndex, line, e.target.value)} />
              </label>
            ))}
          </div>
        );
      })}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save CV</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
