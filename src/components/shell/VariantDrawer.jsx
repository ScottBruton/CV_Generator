import { useEffect, useMemo, useState } from 'react';

const COLLAPSE_KEY = 'cv.drawer.collapsedCategories';

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCollapsed(map) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function sortByOrder(list) {
  return [...list].sort((a, b) => {
    const order = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    if (order !== 0) return order;
    if (a.isTemplate && !b.isTemplate) return -1;
    if (!a.isTemplate && b.isTemplate) return 1;
    return String(a.label).localeCompare(String(b.label));
  });
}

export default function VariantDrawer({
  open,
  variants,
  categories,
  activeVariantId,
  onClose,
  onSelect,
  onAdd,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorder,
  busy,
  debugConsoleOpen,
  onToggleDebugConsole
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [dragVariantId, setDragVariantId] = useState(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  const sortedCategories = useMemo(
    () => [...(categories || [])].sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      || String(a.label).localeCompare(String(b.label))),
    [categories]
  );

  const unassigned = useMemo(
    () => sortByOrder((variants || []).filter((variant) => !variant.categoryId)),
    [variants]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const category of sortedCategories) map[category.id] = [];
    for (const variant of variants || []) {
      if (variant.categoryId && map[variant.categoryId]) {
        map[variant.categoryId].push(variant);
      } else if (variant.categoryId && !map[variant.categoryId]) {
        // orphan category id → treat as unassigned in UI until fixed
      }
    }
    for (const id of Object.keys(map)) map[id] = sortByOrder(map[id]);
    return map;
  }, [variants, sortedCategories]);

  const orphanVariants = useMemo(
    () => sortByOrder(
      (variants || []).filter((variant) => variant.categoryId
        && !sortedCategories.some((category) => category.id === variant.categoryId))
    ),
    [variants, sortedCategories]
  );

  function toggleCollapsed(key) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function buildReorderPayload(nextUnassigned, nextGrouped, categoryOrderIds) {
    return {
      categoryOrder: categoryOrderIds,
      unassigned: nextUnassigned.map((item) => item.id),
      grouped: Object.fromEntries(
        Object.entries(nextGrouped).map(([id, list]) => [id, list.map((item) => item.id)])
      )
    };
  }

  function handleDrop(targetCategoryId, targetIndex) {
    if (!dragVariantId || !onReorder) return;
    const moving = (variants || []).find((variant) => variant.id === dragVariantId);
    if (!moving) return;

    const nextUnassigned = unassigned.filter((variant) => variant.id !== dragVariantId);
    const nextGrouped = {};
    for (const category of sortedCategories) {
      nextGrouped[category.id] = (grouped[category.id] || []).filter((variant) => variant.id !== dragVariantId);
    }

    const bucketKey = targetCategoryId || null;
    if (bucketKey) {
      const list = nextGrouped[bucketKey] || [];
      const index = Math.max(0, Math.min(targetIndex ?? list.length, list.length));
      list.splice(index, 0, moving);
      nextGrouped[bucketKey] = list;
    } else {
      const list = nextUnassigned;
      const index = Math.max(0, Math.min(targetIndex ?? list.length, list.length));
      list.splice(index, 0, { ...moving, categoryId: null });
      // mutate nextUnassigned in place via splice above — already nextUnassigned
    }

    onReorder(buildReorderPayload(
      bucketKey ? nextUnassigned : nextUnassigned,
      nextGrouped,
      sortedCategories.map((category) => category.id)
    ));
    setDragVariantId(null);
  }

  function renderVariantButton(variant, categoryId, index) {
    return (
      <li
        key={variant.id}
        draggable={!busy}
        onDragStart={(event) => {
          setDragVariantId(variant.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', variant.id);
        }}
        onDragEnd={() => setDragVariantId(null)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDrop(categoryId, index);
        }}
      >
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
    );
  }

  function renderSection(key, title, items, categoryId) {
    const isCollapsed = Boolean(collapsed[key]);
    return (
      <div
        key={key}
        className="drawer__category"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          handleDrop(categoryId, items.length);
        }}
      >
        <div className="drawer__category-header">
          <button
            type="button"
            className="drawer__category-toggle"
            aria-expanded={!isCollapsed}
            onClick={() => toggleCollapsed(key)}
          >
            <span className="drawer__category-chevron" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
            <span>{title}</span>
            <span className="drawer__category-count">{items.length}</span>
          </button>
          {categoryId ? (
            <div className="drawer__category-actions">
              {renamingId === categoryId ? (
                <>
                  <input
                    className="drawer__category-input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    aria-label="Rename category"
                  />
                  <button
                    type="button"
                    className="drawer__icon-btn"
                    disabled={busy || !renameValue.trim()}
                    onClick={() => {
                      onRenameCategory?.(categoryId, renameValue.trim());
                      setRenamingId(null);
                    }}
                  >
                    Save
                  </button>
                  <button type="button" className="drawer__icon-btn" onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="drawer__icon-btn"
                    disabled={busy}
                    onClick={() => {
                      setRenamingId(categoryId);
                      setRenameValue(title);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="drawer__icon-btn drawer__icon-btn--danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete category “${title}”? Variants move to Unassigned.`)) {
                        onDeleteCategory?.(categoryId);
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
        {isCollapsed ? null : (
          <ul className="drawer__list drawer__list--nested">
            {items.length ? items.map((variant, index) => renderVariantButton(variant, categoryId, index)) : (
              <li className="drawer__empty-drop">Drop variants here</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <>
      {open ? <button type="button" className="drawer-backdrop" aria-label="Close menu" onClick={onClose} /> : null}
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="drawer__header">
          <h2 className="drawer__title">Variants</h2>
          <p className="drawer__subtitle">Organize applications into categories. Drag to reorder or reassign.</p>
        </div>

        <div className="drawer__categories">
          {renderSection('unassigned', 'Unassigned', [...unassigned, ...orphanVariants], null)}
          {sortedCategories.map((category) => (
            renderSection(category.id, category.label, grouped[category.id] || [], category.id)
          ))}
        </div>

        <div className="drawer__footer">
          <div className="drawer__add-category">
            <input
              className="drawer__category-input"
              placeholder="New category name"
              value={newCategoryLabel}
              disabled={busy}
              onChange={(event) => setNewCategoryLabel(event.target.value)}
            />
            <button
              type="button"
              className="shell-btn shell-btn--drawer-secondary"
              disabled={busy || !newCategoryLabel.trim()}
              onClick={() => {
                onAddCategory?.(newCategoryLabel.trim());
                setNewCategoryLabel('');
              }}
            >
              Add category
            </button>
          </div>
          <button type="button" className="shell-btn shell-btn--primary" onClick={onAdd} disabled={busy}>
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
