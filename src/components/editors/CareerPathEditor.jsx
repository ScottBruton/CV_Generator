import { useEffect, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';

function emptyRole() {
  return {
    company: '',
    jobTitle: '',
    startDate: '',
    endDate: '',
    accomplishments: ['']
  };
}

export default function CareerPathEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || null);

  useEffect(() => {
    setDraft(content || null);
  }, [content]);

  if (!draft) return <p>Loading career path…</p>;

  const roles = Array.isArray(draft.roles) ? draft.roles : [];

  function commit(next) {
    setDraft(next);
    onChange?.(next);
  }

  function updateMeta(key, value) {
    commit({ ...draft, [key]: value });
  }

  function updateRole(roleIndex, key, value) {
    const nextRoles = structuredClone(roles);
    nextRoles[roleIndex][key] = value;
    commit({ ...draft, roles: nextRoles });
  }

  function updateAccomplishment(roleIndex, itemIndex, value) {
    const nextRoles = structuredClone(roles);
    nextRoles[roleIndex].accomplishments[itemIndex] = value;
    commit({ ...draft, roles: nextRoles });
  }

  function addAccomplishment(roleIndex) {
    const nextRoles = structuredClone(roles);
    if (!Array.isArray(nextRoles[roleIndex].accomplishments)) nextRoles[roleIndex].accomplishments = [];
    nextRoles[roleIndex].accomplishments.push('');
    commit({ ...draft, roles: nextRoles });
  }

  function removeAccomplishment(roleIndex, itemIndex) {
    const nextRoles = structuredClone(roles);
    nextRoles[roleIndex].accomplishments.splice(itemIndex, 1);
    commit({ ...draft, roles: nextRoles });
  }

  function addRole() {
    commit({ ...draft, roles: [...roles, emptyRole()] });
  }

  function removeRole(roleIndex) {
    const nextRoles = structuredClone(roles);
    nextRoles.splice(roleIndex, 1);
    commit({ ...draft, roles: nextRoles });
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit Career Path</h3>
      <p className="shell-editor__hint">Tailor roles and accomplishments for application forms. This tab is not exported to PDF.</p>

      <label className="shell-field">
        <span>Label</span>
        <input value={draft.label || ''} onChange={(e) => updateMeta('label', e.target.value)} />
      </label>

      {roles.map((role, roleIndex) => (
        <div className="shell-editor__section" key={roleIndex}>
          <div className="shell-bullet__head">
            <h4 className="shell-editor__title" style={{ margin: 0 }}>Role {roleIndex + 1}</h4>
            <button type="button" className="shell-btn shell-btn--tiny shell-btn--danger" onClick={() => removeRole(roleIndex)}>
              Remove role
            </button>
          </div>

          <label className="shell-field">
            <span>Company</span>
            <input value={role.company || ''} onChange={(e) => updateRole(roleIndex, 'company', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>Job title</span>
            <input value={role.jobTitle || ''} onChange={(e) => updateRole(roleIndex, 'jobTitle', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>Starting date</span>
            <input value={role.startDate || ''} onChange={(e) => updateRole(roleIndex, 'startDate', e.target.value)} />
          </label>
          <label className="shell-field">
            <span>End date</span>
            <input value={role.endDate || ''} onChange={(e) => updateRole(roleIndex, 'endDate', e.target.value)} />
          </label>

          <p className="shell-editor__subheading-label">Responsibilities / Key Accomplishments</p>
          {(role.accomplishments || []).map((item, itemIndex) => (
            <div className="shell-bullet" key={itemIndex}>
              <div className="shell-bullet__head">
                <span className="shell-bullet__label">Item {itemIndex + 1}</span>
                <button
                  type="button"
                  className="shell-btn shell-btn--tiny shell-btn--danger"
                  onClick={() => removeAccomplishment(roleIndex, itemIndex)}
                >
                  Remove
                </button>
              </div>
              <AutoTextarea
                value={item}
                onChange={(e) => updateAccomplishment(roleIndex, itemIndex, e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="shell-btn shell-btn--tiny" onClick={() => addAccomplishment(roleIndex)}>
            + Accomplishment
          </button>
        </div>
      ))}

      <div className="shell-editor__actions">
        <button type="button" className="shell-btn shell-btn--secondary" onClick={addRole}>Add role</button>
        <button type="button" className="shell-btn shell-btn--primary" onClick={() => onSave(draft)}>Save career path</button>
      </div>
      {status ? <p className={`shell-status${status.error ? ' is-error' : ''}`}>{status.message}</p> : null}
    </div>
  );
}
