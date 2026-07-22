export default function VariantDrawer({
  open,
  variants,
  activeVariantId,
  onClose,
  onSelect,
  onAdd,
  debugConsoleOpen,
  onToggleDebugConsole
}) {
  const sorted = [...(variants || [])].sort((a, b) => {
    if (a.isTemplate && !b.isTemplate) return -1;
    if (!a.isTemplate && b.isTemplate) return 1;
    return String(a.label).localeCompare(String(b.label));
  });

  return (
    <>
      {open ? <button type="button" className="drawer-backdrop" aria-label="Close menu" onClick={onClose} /> : null}
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="drawer__header">
          <h2 className="drawer__title">Variants</h2>
          <p className="drawer__subtitle">Default template and company applications</p>
        </div>
        <ul className="drawer__list">
          {sorted.map((variant) => (
            <li key={variant.id}>
              <button
                type="button"
                className={`drawer__item${variant.id === activeVariantId ? ' is-active' : ''}${variant.isTemplate ? ' is-template' : ''}`}
                onClick={() => onSelect(variant.id)}
              >
                <strong>{variant.label}</strong>
                <span>
                  {variant.coverId} · {variant.cvId} · {variant.portfolioId}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="drawer__footer">
          <button type="button" className="shell-btn shell-btn--primary" onClick={onAdd}>
            Add variant
          </button>
          <button
            type="button"
            className="shell-btn shell-btn--drawer-secondary"
            onClick={onToggleDebugConsole}
          >
            {debugConsoleOpen ? 'Hide debug console' : 'Show debug console'}
          </button>
        </div>
      </aside>
    </>
  );
}
