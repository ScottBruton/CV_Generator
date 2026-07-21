import { useEffect, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';

function bulletText(bullet) {
  return typeof bullet === 'string' ? bullet : bullet?.text || '';
}

function setBulletText(bullet, value) {
  if (typeof bullet === 'string') return value;
  return { ...bullet, text: value };
}

function BulletRow({
  label,
  depth = 0,
  value,
  onChange,
  onRemove,
  onAddSub
}) {
  return (
    <div className={`shell-bullet${depth ? ' shell-bullet--sub' : ''}`}>
      <div className="shell-bullet__head">
        <span className="shell-bullet__label">{label}</span>
        <div className="shell-bullet__actions">
          {onAddSub ? (
            <button type="button" className="shell-btn shell-btn--tiny" onClick={onAddSub}>
              + Sub
            </button>
          ) : null}
          {onRemove ? (
            <button type="button" className="shell-btn shell-btn--tiny shell-btn--danger" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <AutoTextarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
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

  function withPillarBody(pillarIndex, mutator) {
    const impact = structuredClone(draft.impact || { pillars: [] });
    const pillar = impact.pillars[pillarIndex];
    if (!pillar) return;
    if (!Array.isArray(pillar.body)) pillar.body = [];
    mutator(pillar.body);
    commit({ ...draft, impact });
  }

  function updateEntryText(pillarIndex, entryIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (typeof entry === 'string') body[entryIndex] = value;
      else entry.text = value;
    });
  }

  function updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (!entry?.bullets) return;
      entry.bullets[bulletIndex] = setBulletText(entry.bullets[bulletIndex], value);
    });
  }

  function addTopBullet(pillarIndex) {
    withPillarBody(pillarIndex, (body) => {
      body.push({ text: '', bullets: [] });
    });
  }

  function addStandaloneBullet(pillarIndex, entryIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (!entry.bullets) entry.bullets = [];
      entry.bullets.push({ text: '' });
    });
  }

  function addSubBullet(pillarIndex, entryIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (typeof entry === 'string') {
        body[entryIndex] = { text: entry, bullets: [{ text: '' }] };
        return;
      }
      if (!entry.bullets) entry.bullets = [];
      entry.bullets.push({ text: '' });
    });
  }

  function removeEntry(pillarIndex, entryIndex) {
    withPillarBody(pillarIndex, (body) => {
      body.splice(entryIndex, 1);
    });
  }

  function removeNestedBullet(pillarIndex, entryIndex, bulletIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (!entry?.bullets) return;
      entry.bullets.splice(bulletIndex, 1);
    });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit CV</h3>
      <p className="shell-editor__hint">Profile and impact bullets. Nested items are sub-bullets.</p>

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
        <AutoTextarea value={profile.summary || ''} onChange={(e) => updateProfile('summary', e.target.value)} />
      </label>

      {pillars.map((pillar, pillarIndex) => (
        <div className="shell-editor__section" key={pillar.variant || pillarIndex}>
          <h4 className="shell-editor__title">{pillar.title || pillar.variant}</h4>

          {(pillar.body || []).map((entry, entryIndex) => {
            if (entry?.heading) {
              return (
                <p className="shell-editor__heading-label" key={entryIndex}>
                  {entry.heading}
                </p>
              );
            }
            if (entry?.subheading) {
              return (
                <p className="shell-editor__subheading-label" key={entryIndex}>
                  {entry.subheading}
                </p>
              );
            }

            const hasText = typeof entry === 'string' || Boolean(entry?.text);
            const bullets = entry?.bullets || [];
            const isStandaloneList = !hasText && bullets.length > 0;

            if (isStandaloneList) {
              return (
                <div className="shell-bullet-group" key={entryIndex}>
                  {bullets.map((bullet, bulletIndex) => (
                    <BulletRow
                      key={bulletIndex}
                      label={`Bullet ${bulletIndex + 1}`}
                      value={bulletText(bullet)}
                      onChange={(value) => updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value)}
                      onRemove={() => removeNestedBullet(pillarIndex, entryIndex, bulletIndex)}
                    />
                  ))}
                  <button
                    type="button"
                    className="shell-btn shell-btn--tiny"
                    onClick={() => addStandaloneBullet(pillarIndex, entryIndex)}
                  >
                    + Bullet
                  </button>
                </div>
              );
            }

            return (
              <div className="shell-bullet-group" key={entryIndex}>
                <BulletRow
                  label="Bullet"
                  value={typeof entry === 'string' ? entry : entry?.text || ''}
                  onChange={(value) => updateEntryText(pillarIndex, entryIndex, value)}
                  onRemove={() => removeEntry(pillarIndex, entryIndex)}
                  onAddSub={() => addSubBullet(pillarIndex, entryIndex)}
                />
                {bullets.map((bullet, bulletIndex) => (
                  <BulletRow
                    key={bulletIndex}
                    depth={1}
                    label={`Sub-bullet ${bulletIndex + 1}`}
                    value={bulletText(bullet)}
                    onChange={(value) => updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value)}
                    onRemove={() => removeNestedBullet(pillarIndex, entryIndex, bulletIndex)}
                  />
                ))}
              </div>
            );
          })}

          <button
            type="button"
            className="shell-btn shell-btn--tiny"
            onClick={() => addTopBullet(pillarIndex)}
          >
            + Bullet
          </button>
        </div>
      ))}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save CV</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
