import { useEffect, useState } from 'react';

export default function AddVariantDialog({ open, variants, categories, onClose, onCreate, busy }) {
  const [label, setLabel] = useState('');
  const [fromId, setFromId] = useState('default');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel('');
    setFromId((variants || []).find((item) => item.isTemplate)?.id || (variants || [])[0]?.id || 'default');
    setCategoryId('');
  }, [open, variants]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Add variant</h2>
        <p>Clone an existing variant’s cover, CV, and portfolio into a new editable config.</p>
        <label className="shell-field">
          <span>Name</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Acme" />
        </label>
        <label className="shell-field">
          <span>Clone from</span>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {(variants || []).map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.label}</option>
            ))}
          </select>
        </label>
        <label className="shell-field">
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Unassigned</option>
            {(categories || []).map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            className="shell-btn shell-btn--primary"
            disabled={busy || !label.trim()}
            onClick={() => onCreate({
              label: label.trim(),
              company: label.trim(),
              fromId,
              categoryId: categoryId || null
            })}
          >
            Create
          </button>
          <button type="button" className="shell-btn shell-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
