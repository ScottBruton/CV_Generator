import { useEffect, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';

function bulletText(bullet) {
  return typeof bullet === 'string' ? bullet : bullet?.text || '';
}

function setBulletText(bullet, value) {
  if (typeof bullet === 'string') return value;
  return { ...bullet, text: value };
}

/** Body entry classifiers — heading/subheading keys win over text. */
function entryType(entry) {
  if (entry == null) return 'empty';
  if (typeof entry === 'string') return 'parent';
  if (Object.prototype.hasOwnProperty.call(entry, 'heading')) return 'heading';
  if (Object.prototype.hasOwnProperty.call(entry, 'subheading')) return 'subheading';
  const hasText = Boolean(entry.text);
  const bullets = entry.bullets || [];
  if (!hasText && bullets.length > 0) return 'standalone';
  return 'parent';
}

function metaOf(entry) {
  if (!entry || typeof entry === 'string') return {};
  const {
    text,
    heading,
    subheading,
    bullets,
    bulletsInline,
    plain,
    ...rest
  } = entry;
  return rest;
}

function sectionEnd(body, startIndex, mode) {
  for (let i = startIndex + 1; i < body.length; i += 1) {
    const type = entryType(body[i]);
    if (type === 'heading') return i;
    if (mode === 'subheading' && type === 'subheading') return i;
  }
  return body.length;
}

function owningIndex(body, fromIndex, type) {
  for (let i = fromIndex; i >= 0; i -= 1) {
    if (entryType(body[i]) === type) return i;
  }
  return -1;
}

function asBullet(entry) {
  if (typeof entry === 'string') return { text: entry };
  return {
    ...metaOf(entry),
    text: entry.text || entry.subheading || entry.heading || ''
  };
}

/** Top-level bullet list entry (renders as a real bullet on the CV). */
function asStandaloneList(bullets) {
  return {
    bullets: (Array.isArray(bullets) ? bullets : [bullets]).map((b) => asBullet(b))
  };
}

/** Merge adjacent standalone bullet lists so same-level items stay one continuous list. */
function coalesceAdjacentStandalones(body) {
  let i = 0;
  while (i < body.length - 1) {
    if (entryType(body[i]) === 'standalone' && entryType(body[i + 1]) === 'standalone') {
      body[i].bullets.push(...body[i + 1].bullets);
      body.splice(i + 1, 1);
      continue;
    }
    i += 1;
  }
}

/**
 * After indent→outdent, a list item can be left as a parent with no subs
 * (shows as "BULLET" with + Sub-bullet). Convert those back into the
 * neighbouring standalone list when present.
 */
function rejoinEmptyParentsIntoLists(body) {
  for (let i = 0; i < body.length; i += 1) {
    if (entryType(body[i]) !== 'parent') continue;
    const entry = body[i];
    if (typeof entry === 'string') continue;
    if ((entry.bullets || []).length > 0) continue;

    const prev = body[i - 1];
    const next = body[i + 1];
    const touchesList =
      (prev && entryType(prev) === 'standalone') ||
      (next && entryType(next) === 'standalone');
    if (!touchesList) continue;

    body[i] = asStandaloneList([asBullet(entry)]);
  }
  coalesceAdjacentStandalones(body);
}

function normalizePillarBody(body) {
  rejoinEmptyParentsIntoLists(body);
  coalesceAdjacentStandalones(body);
}

/** How many body entries move with this item (heading/subheading include children). */
function blockSpan(body, entryIndex) {
  const type = entryType(body[entryIndex]);
  if (type === 'heading') return sectionEnd(body, entryIndex, 'heading') - entryIndex;
  if (type === 'subheading') return sectionEnd(body, entryIndex, 'subheading') - entryIndex;
  return 1;
}

/** Move a body block (and children) to a body insertion index. */
function moveBodyBlock(body, fromIndex, toIndex) {
  const span = blockSpan(body, fromIndex);
  if (toIndex > fromIndex && toIndex < fromIndex + span) return;
  if (toIndex === fromIndex || toIndex === fromIndex + span) return;
  const chunk = body.splice(fromIndex, span);
  const adjusted = toIndex > fromIndex ? toIndex - span : toIndex;
  body.splice(adjusted, 0, ...chunk);
}

function sameDragSource(a, b) {
  if (!a || !b) return false;
  return (
    a.pillarIndex === b.pillarIndex &&
    a.kind === b.kind &&
    a.entryIndex === b.entryIndex &&
    a.bulletIndex === b.bulletIndex
  );
}

function asParentEntry(bullet) {
  if (typeof bullet === 'string') return { text: bullet, bullets: [] };
  return {
    ...metaOf(bullet),
    text: bullet.text || '',
    bullets: Array.isArray(bullet.bullets) ? bullet.bullets : []
  };
}

function findPrevContentIndex(body, entryIndex) {
  let prev = entryIndex - 1;
  while (prev >= 0 && (entryType(body[prev]) === 'heading' || entryType(body[prev]) === 'subheading')) {
    prev -= 1;
  }
  return prev;
}

/** Nest a bullet under the previous top-level bullet / parent. */
function nestBulletUnderPrevious(body, entryIndex, bullet, trailingParents = []) {
  const prev = findPrevContentIndex(body, entryIndex);
  if (prev < 0) return false;

  const prevEntry = body[prev];
  const prevType = entryType(prevEntry);
  const moved = asBullet(bullet);

  if (prevType === 'standalone') {
    const last = prevEntry.bullets.pop();
    const parentObj = asParentEntry(last);
    parentObj.bullets = [...(parentObj.bullets || []), moved];
    if (prevEntry.bullets.length === 0) {
      body.splice(prev, 1, parentObj, ...trailingParents);
    } else {
      body.splice(prev + 1, 0, parentObj, ...trailingParents);
    }
    return true;
  }

  if (prevType === 'parent') {
    let parent = prevEntry;
    if (typeof parent === 'string') {
      parent = { text: parent, bullets: [] };
      body[prev] = parent;
    }
    if (!parent.bullets) parent.bullets = [];
    parent.bullets.push(moved);
    if (trailingParents.length) {
      body.splice(prev + 1, 0, ...trailingParents);
    }
    return true;
  }

  return false;
}

function BulletRow({
  label,
  depth = 0,
  value,
  onChange,
  onRemove,
  onIndent,
  onOutdent,
  onAddSub,
  canIndent = false,
  canOutdent = false,
  draggable = false,
  dragging = false,
  dropActive = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDropBefore
}) {
  return (
    <div
      className={[
        'shell-bullet',
        depth ? `shell-bullet--depth-${depth}` : '',
        dragging ? 'shell-bullet--dragging' : '',
        dropActive ? 'shell-bullet--drop-target' : ''
      ].filter(Boolean).join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {onDropBefore ? (
        <div
          className={`shell-drop-slot${dropActive ? ' is-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragOver?.(e);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDropBefore(e);
          }}
        />
      ) : null}
      <div className="shell-bullet__head">
        <div className="shell-bullet__title">
          {draggable ? (
            <span
              className="shell-drag-handle"
              draggable
              title="Drag to move"
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              ⋮⋮
            </span>
          ) : null}
          <span className="shell-bullet__label">{label}</span>
        </div>
        <div className="shell-bullet__actions">
          <button
            type="button"
            className="shell-btn shell-btn--tiny"
            disabled={!canOutdent}
            onClick={onOutdent}
            title="Outdent"
          >
            ←
          </button>
          <button
            type="button"
            className="shell-btn shell-btn--tiny"
            disabled={!canIndent}
            onClick={onIndent}
            title="Indent"
          >
            →
          </button>
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

function AddRow({ children }) {
  return <div className="shell-editor__add-row">{children}</div>;
}

function BodyDropSlot({ active, onDragOver, onDrop }) {
  return (
    <div
      className={`shell-drop-slot shell-drop-slot--body${active ? ' is-active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop?.(e);
      }}
    />
  );
}

export default function CvEditor({ content, onSave, onChange, status }) {
  const [draft, setDraft] = useState(content || null);
  const [dragSource, setDragSource] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  useEffect(() => {
    if (!content) {
      setDraft(null);
      return;
    }
    const next = structuredClone(content);
    let merged = false;
    for (const pillar of next.impact?.pillars || []) {
      if (!Array.isArray(pillar.body)) continue;
      const before = JSON.stringify(pillar.body);
      normalizePillarBody(pillar.body);
      if (JSON.stringify(pillar.body) !== before) merged = true;
    }
    setDraft(next);
    // Heal split lists / orphan parents left after indent↔outdent
    if (merged) onChange?.(next);
  }, [content, onChange]);

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
    normalizePillarBody(pillar.body);
    commit({ ...draft, impact });
  }

  function updateHeading(pillarIndex, entryIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      body[entryIndex] = { ...metaOf(body[entryIndex]), heading: value };
    });
  }

  function updateSubheading(pillarIndex, entryIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      const prev = body[entryIndex] || {};
      body[entryIndex] = { ...metaOf(prev), subheading: value, ...(prev.tier ? { tier: prev.tier } : {}) };
    });
  }

  function updateEntryText(pillarIndex, entryIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (typeof entry === 'string') body[entryIndex] = value;
      else body[entryIndex] = { ...entry, text: value };
    });
  }

  function updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (!entry?.bullets) return;
      entry.bullets[bulletIndex] = setBulletText(entry.bullets[bulletIndex], value);
    });
  }

  function insertAt(pillarIndex, index, item) {
    withPillarBody(pillarIndex, (body) => {
      body.splice(index, 0, item);
    });
  }

  /** Insert a top-level bullet at index (merge into adjacent standalone list when possible). */
  function insertTopBullet(pillarIndex, index) {
    withPillarBody(pillarIndex, (body) => {
      const prev = body[index - 1];
      if (prev && entryType(prev) === 'standalone') {
        prev.bullets.push({ text: '' });
        return;
      }
      const next = body[index];
      if (next && entryType(next) === 'standalone') {
        next.bullets.unshift({ text: '' });
        return;
      }
      body.splice(index, 0, asStandaloneList([{ text: '' }]));
    });
  }

  function addTopBullet(pillarIndex) {
    withPillarBody(pillarIndex, (body) => {
      const last = body[body.length - 1];
      if (last && entryType(last) === 'standalone') {
        last.bullets.push({ text: '' });
        return;
      }
      body.push(asStandaloneList([{ text: '' }]));
    });
  }

  function addTopHeading(pillarIndex) {
    withPillarBody(pillarIndex, (body) => {
      body.push({ heading: '' });
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
      if (entryType(entry) === 'standalone' && entry.bullets.length === 0) {
        body.splice(entryIndex, 1);
      }
    });
  }

  /** Indent: heading → subheading → top-level bullet → sub-bullet */
  function indentEntry(pillarIndex, entryIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      const type = entryType(entry);

      if (type === 'heading') {
        body[entryIndex] = { ...metaOf(entry), subheading: entry.heading || '' };
        return;
      }

      if (type === 'subheading') {
        // Level 3 = top-level bullet; join the list below/above when present
        const bullet = { ...metaOf(entry), text: entry.subheading || '' };
        const next = body[entryIndex + 1];
        if (next && entryType(next) === 'standalone') {
          next.bullets.unshift(bullet);
          body.splice(entryIndex, 1);
          return;
        }
        const prev = body[entryIndex - 1];
        if (prev && entryType(prev) === 'standalone') {
          prev.bullets.push(bullet);
          body.splice(entryIndex, 1);
          return;
        }
        body[entryIndex] = asStandaloneList([bullet]);
        return;
      }

      if (type === 'parent') {
        const nested = typeof entry === 'string' ? [] : [...(entry.bullets || [])];
        const movedBullet = asBullet(entry);
        const trailing = nested.map((b) => asStandaloneList([b]));
        const snapshot = structuredClone(entry);
        body.splice(entryIndex, 1);
        if (!nestBulletUnderPrevious(body, entryIndex, movedBullet, trailing)) {
          body.splice(entryIndex, 0, snapshot);
        }
      }
    });
  }

  function indentStandaloneBullet(pillarIndex, entryIndex, bulletIndex) {
    withPillarBody(pillarIndex, (body) => {
      const list = body[entryIndex];
      if (entryType(list) !== 'standalone') return;

      if (bulletIndex > 0) {
        const bullet = list.bullets[bulletIndex];
        const prevBullet = list.bullets[bulletIndex - 1];
        const after = list.bullets.slice(bulletIndex + 1);
        const before = list.bullets.slice(0, bulletIndex - 1);

        const parentObj = asParentEntry(prevBullet);
        parentObj.bullets = [...(parentObj.bullets || []), asBullet(bullet)];

        const replacements = [];
        if (before.length) replacements.push(asStandaloneList(before));
        replacements.push(parentObj);
        if (after.length) replacements.push(asStandaloneList(after));
        body.splice(entryIndex, 1, ...replacements);
        return;
      }

      // First bullet in list: nest under previous content entry
      const bullet = list.bullets[0];
      const rest = list.bullets.slice(1);
      const trailing = rest.length ? [asStandaloneList(rest)] : [];
      const snapshot = structuredClone(list);
      body.splice(entryIndex, 1);
      if (!nestBulletUnderPrevious(body, entryIndex, bullet, trailing)) {
        body.splice(entryIndex, 0, snapshot);
      }
    });
  }

  /** Outdent: sub-bullet → top-level bullet → subheading → heading */
  function outdentEntry(pillarIndex, entryIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      const type = entryType(entry);

      if (type === 'subheading') {
        body[entryIndex] = { ...metaOf(entry), heading: entry.subheading || '' };
        return;
      }

      if (type === 'parent') {
        const text = typeof entry === 'string' ? entry : entry.text || '';
        const bullets = typeof entry === 'string' ? [] : [...(entry.bullets || [])];
        body[entryIndex] = { ...metaOf(typeof entry === 'string' ? {} : entry), subheading: text };
        if (bullets.length) {
          body.splice(entryIndex + 1, 0, asStandaloneList(bullets));
        }
      }
    });
  }

  function outdentSubBullet(pillarIndex, entryIndex, bulletIndex) {
    withPillarBody(pillarIndex, (body) => {
      const entry = body[entryIndex];
      if (!entry?.bullets?.[bulletIndex]) return;
      const [bullet] = entry.bullets.splice(bulletIndex, 1);
      const item = asBullet(bullet);

      const next = body[entryIndex + 1];
      if (next && entryType(next) === 'standalone') {
        next.bullets.unshift(item);
      } else {
        body.splice(entryIndex + 1, 0, asStandaloneList([item]));
      }

      // List-item parents must return to the shared bullet list when no subs remain
      if (entryType(entry) === 'parent' && (entry.bullets || []).length === 0) {
        body[entryIndex] = asStandaloneList([asBullet(entry)]);
      } else if (entryType(entry) === 'standalone' && entry.bullets.length === 0) {
        body.splice(entryIndex, 1);
      }
    });
  }

  function outdentStandaloneBullet(pillarIndex, entryIndex, bulletIndex) {
    withPillarBody(pillarIndex, (body) => {
      const list = body[entryIndex];
      if (entryType(list) !== 'standalone') return;
      const [bullet] = list.bullets.splice(bulletIndex, 1);
      const after = list.bullets.splice(bulletIndex);
      const text = bulletText(bullet);
      const pieces = [{ ...metaOf(typeof bullet === 'object' ? bullet : {}), subheading: text }];
      if (after.length) pieces.push(asStandaloneList(after));
      body.splice(entryIndex + 1, 0, ...pieces);
      if (list.bullets.length === 0) body.splice(entryIndex, 1);
    });
  }

  function canIndentEntry(body, entryIndex) {
    const type = entryType(body[entryIndex]);
    if (type === 'heading' || type === 'subheading') return true;
    if (type === 'parent') {
      const prev = findPrevContentIndex(body, entryIndex);
      if (prev < 0) return false;
      const prevType = entryType(body[prev]);
      return prevType === 'parent' || prevType === 'standalone';
    }
    return false;
  }

  function canIndentStandaloneBullet(body, entryIndex, bulletIndex) {
    if (bulletIndex > 0) return true;
    const prev = findPrevContentIndex(body, entryIndex);
    if (prev < 0) return false;
    const prevType = entryType(body[prev]);
    return prevType === 'parent' || prevType === 'standalone';
  }

  function canOutdentEntry(body, entryIndex) {
    const type = entryType(body[entryIndex]);
    return type === 'subheading' || type === 'parent';
  }

  function beginDrag(source, event) {
    setDragSource(source);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(source));
  }

  function endDrag() {
    setDragSource(null);
    setDropTarget(null);
  }

  function setDropHint(target) {
    setDropTarget((prev) => (JSON.stringify(prev) === JSON.stringify(target) ? prev : target));
  }

  function applyDrop(target) {
    if (!dragSource || dragSource.pillarIndex !== target.pillarIndex) {
      endDrag();
      return;
    }

    withPillarBody(dragSource.pillarIndex, (body) => {
      const src = dragSource;

      if (src.kind === 'block') {
        if (target.kind === 'under' && target.entryIndex === src.entryIndex) return;
        let toIndex = target.bodyIndex;
        if (target.kind === 'under') {
          const mode = entryType(body[target.entryIndex]) === 'heading' ? 'heading' : 'subheading';
          toIndex = sectionEnd(body, target.entryIndex, mode);
        } else if (target.kind === 'standalone') {
          // Place whole block before this bullet list
          toIndex = target.entryIndex;
        }
        if (typeof toIndex !== 'number') return;
        moveBodyBlock(body, src.entryIndex, toIndex);
        return;
      }

      if (src.kind === 'standalone') {
        const fromList = body[src.entryIndex];
        if (entryType(fromList) !== 'standalone') return;
        if (src.bulletIndex < 0 || src.bulletIndex >= fromList.bullets.length) return;
        const [bullet] = fromList.bullets.splice(src.bulletIndex, 1);

        if (target.kind === 'standalone') {
          let toEntry = target.entryIndex;
          let toBullet = target.bulletIndex;
          // Adjust if same list and removing shifted later indices
          if (toEntry === src.entryIndex && toBullet > src.bulletIndex) toBullet -= 1;
          if (fromList.bullets.length === 0) {
            body.splice(src.entryIndex, 1);
            if (toEntry > src.entryIndex) toEntry -= 1;
          }
          const toList = body[toEntry];
          if (!toList || entryType(toList) !== 'standalone') {
            body.splice(toEntry, 0, asStandaloneList([bullet]));
          } else {
            toList.bullets.splice(toBullet, 0, bullet);
          }
          return;
        }

        if (target.kind === 'body' || target.kind === 'under') {
          let toIndex = target.bodyIndex;
          if (target.kind === 'under') {
            const mode = entryType(body[target.entryIndex]) === 'heading' ? 'heading' : 'subheading';
            toIndex = sectionEnd(body, target.entryIndex, mode);
          }
          if (fromList.bullets.length === 0) {
            body.splice(src.entryIndex, 1);
            if (toIndex > src.entryIndex) toIndex -= 1;
          }
          const prev = body[toIndex - 1];
          if (prev && entryType(prev) === 'standalone') {
            prev.bullets.push(bullet);
          } else if (body[toIndex] && entryType(body[toIndex]) === 'standalone') {
            body[toIndex].bullets.unshift(bullet);
          } else {
            body.splice(toIndex, 0, asStandaloneList([bullet]));
          }
          return;
        }

        if (target.kind === 'sub') {
          if (fromList.bullets.length === 0) body.splice(src.entryIndex, 1);
          let parentIndex = target.entryIndex;
          if (fromList.bullets.length === 0 && src.entryIndex < parentIndex) parentIndex -= 1;
          const parent = body[parentIndex];
          if (!parent || entryType(parent) !== 'parent') {
            body.splice(parentIndex + 1, 0, asStandaloneList([bullet]));
            return;
          }
          if (!parent.bullets) parent.bullets = [];
          parent.bullets.splice(target.bulletIndex, 0, asBullet(bullet));
        }
        return;
      }

      if (src.kind === 'sub') {
        const parent = body[src.entryIndex];
        if (!parent?.bullets?.[src.bulletIndex]) return;
        const [bullet] = parent.bullets.splice(src.bulletIndex, 1);

        if (target.kind === 'sub') {
          let toEntry = target.entryIndex;
          let toBullet = target.bulletIndex;
          if (toEntry === src.entryIndex && toBullet > src.bulletIndex) toBullet -= 1;
          const toParent = body[toEntry];
          if (!toParent) return;
          if (!toParent.bullets) toParent.bullets = [];
          toParent.bullets.splice(toBullet, 0, bullet);
          return;
        }

        if (target.kind === 'standalone') {
          const toList = body[target.entryIndex];
          if (toList && entryType(toList) === 'standalone') {
            toList.bullets.splice(target.bulletIndex, 0, asBullet(bullet));
          }
          return;
        }

        if (target.kind === 'body' || target.kind === 'under') {
          let toIndex = target.bodyIndex;
          if (target.kind === 'under') {
            const mode = entryType(body[target.entryIndex]) === 'heading' ? 'heading' : 'subheading';
            toIndex = sectionEnd(body, target.entryIndex, mode);
          }
          const prev = body[toIndex - 1];
          if (prev && entryType(prev) === 'standalone') {
            prev.bullets.push(asBullet(bullet));
          } else if (body[toIndex] && entryType(body[toIndex]) === 'standalone') {
            body[toIndex].bullets.unshift(asBullet(bullet));
          } else {
            body.splice(toIndex, 0, asStandaloneList([bullet]));
          }
        }
      }
    });

    endDrag();
  }

  function isDropActive(target) {
    return Boolean(dragSource && dropTarget && JSON.stringify(dropTarget) === JSON.stringify(target));
  }

  function isDragging(source) {
    return sameDragSource(dragSource, source);
  }

  function renderSectionAddRows(pillarIndex, body, entryIndex) {
    const next = body[entryIndex + 1];
    const closesSub = !next || entryType(next) === 'heading' || entryType(next) === 'subheading';
    const closesHeading = !next || entryType(next) === 'heading';
    const rows = [];

    if (closesSub) {
      const subIdx = owningIndex(body, entryIndex, 'subheading');
      if (subIdx !== -1 && sectionEnd(body, subIdx, 'subheading') === entryIndex + 1) {
        const end = entryIndex + 1;
        rows.push(
          <AddRow key={`add-subheading-${subIdx}-${entryIndex}`}>
            <button
              type="button"
              className="shell-btn shell-btn--tiny"
              onClick={() => insertTopBullet(pillarIndex, end)}
            >
              + Bullet
            </button>
            <button
              type="button"
              className="shell-btn shell-btn--tiny"
              onClick={() => insertAt(pillarIndex, end, { subheading: '' })}
            >
              + Subheading
            </button>
          </AddRow>
        );
      }
    }

    if (closesHeading) {
      const headingIdx = owningIndex(body, entryIndex, 'heading');
      if (headingIdx !== -1 && sectionEnd(body, headingIdx, 'heading') === entryIndex + 1) {
        const end = entryIndex + 1;
        const subClosedHere = rows.length > 0;
        rows.push(
          <AddRow key={`add-heading-${headingIdx}-${entryIndex}`}>
            {!subClosedHere ? (
              <>
                <button
                  type="button"
                  className="shell-btn shell-btn--tiny"
                  onClick={() => insertTopBullet(pillarIndex, end)}
                >
                  + Bullet
                </button>
                <button
                  type="button"
                  className="shell-btn shell-btn--tiny"
                  onClick={() => insertAt(pillarIndex, end, { subheading: '' })}
                >
                  + Subheading
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="shell-btn shell-btn--tiny"
              onClick={() => insertAt(pillarIndex, end, { heading: '' })}
            >
              + Heading
            </button>
          </AddRow>
        );
      }
    }

    return rows;
  }

  return (
    <div>
      <h3 className="shell-editor__title">Edit CV</h3>
      <p className="shell-editor__hint">
        Drag ⋮⋮ to move an item (and its children). Drop on a gap to place it, or on a heading/subheading to move it under that section. Use ← → to change level.
      </p>

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

      {pillars.map((pillar, pillarIndex) => {
        const body = pillar.body || [];
        return (
          <div className="shell-editor__section" key={pillar.variant || pillarIndex}>
            <h4 className="shell-editor__title">{pillar.title || pillar.variant}</h4>

            <BodyDropSlot
              active={isDropActive({ pillarIndex, kind: 'body', bodyIndex: 0 })}
              onDragOver={() => setDropHint({ pillarIndex, kind: 'body', bodyIndex: 0 })}
              onDrop={() => applyDrop({ pillarIndex, kind: 'body', bodyIndex: 0 })}
            />

            {body.map((entry, entryIndex) => {
              const type = entryType(entry);
              const blockSource = { pillarIndex, kind: 'block', entryIndex };
              const nodes = [];

              if (type === 'heading' || type === 'subheading') {
                const underTarget = { pillarIndex, kind: 'under', entryIndex };
                nodes.push(
                  <BulletRow
                    key={`${type}-${entryIndex}`}
                    label={type === 'heading' ? 'Heading' : 'Subheading'}
                    depth={type === 'heading' ? 0 : 1}
                    value={type === 'heading' ? (entry.heading || '') : (entry.subheading || '')}
                    onChange={(value) => (
                      type === 'heading'
                        ? updateHeading(pillarIndex, entryIndex, value)
                        : updateSubheading(pillarIndex, entryIndex, value)
                    )}
                    onRemove={() => removeEntry(pillarIndex, entryIndex)}
                    onIndent={() => indentEntry(pillarIndex, entryIndex)}
                    onOutdent={type === 'heading' ? () => {} : () => outdentEntry(pillarIndex, entryIndex)}
                    canIndent
                    canOutdent={type !== 'heading'}
                    draggable
                    dragging={isDragging(blockSource)}
                    dropActive={isDropActive(underTarget)}
                    onDragStart={(e) => beginDrag(blockSource, e)}
                    onDragEnd={endDrag}
                    onDragOver={() => {
                      if (dragSource && dragSource.kind !== 'sub') setDropHint(underTarget);
                    }}
                    onDrop={() => {
                      if (dragSource && dragSource.kind !== 'sub') applyDrop(underTarget);
                    }}
                  />
                );
              } else if (type === 'standalone') {
                const bullets = entry.bullets || [];
                nodes.push(
                  <div className="shell-bullet-group" key={`st-${entryIndex}`}>
                    {bullets.map((bullet, bulletIndex) => {
                      const source = { pillarIndex, kind: 'standalone', entryIndex, bulletIndex };
                      const beforeTarget = { pillarIndex, kind: 'standalone', entryIndex, bulletIndex };
                      return (
                        <BulletRow
                          key={bulletIndex}
                          label={`Bullet ${bulletIndex + 1}`}
                          depth={2}
                          value={bulletText(bullet)}
                          onChange={(value) => updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value)}
                          onRemove={() => removeNestedBullet(pillarIndex, entryIndex, bulletIndex)}
                          onIndent={() => indentStandaloneBullet(pillarIndex, entryIndex, bulletIndex)}
                          onOutdent={() => outdentStandaloneBullet(pillarIndex, entryIndex, bulletIndex)}
                          canIndent={canIndentStandaloneBullet(body, entryIndex, bulletIndex)}
                          canOutdent
                          draggable
                          dragging={isDragging(source)}
                          dropActive={isDropActive(beforeTarget)}
                          onDragStart={(e) => beginDrag(source, e)}
                          onDragEnd={endDrag}
                          onDragOver={() => setDropHint(beforeTarget)}
                          onDropBefore={() => applyDrop(beforeTarget)}
                        />
                      );
                    })}
                    <BodyDropSlot
                      active={isDropActive({
                        pillarIndex,
                        kind: 'standalone',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                      onDragOver={() => setDropHint({
                        pillarIndex,
                        kind: 'standalone',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                      onDrop={() => applyDrop({
                        pillarIndex,
                        kind: 'standalone',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                    />
                    <AddRow>
                      <button
                        type="button"
                        className="shell-btn shell-btn--tiny"
                        onClick={() => addStandaloneBullet(pillarIndex, entryIndex)}
                      >
                        + Bullet
                      </button>
                    </AddRow>
                  </div>
                );
              } else {
                const bullets = entry?.bullets || [];
                nodes.push(
                  <div className="shell-bullet-group" key={`p-${entryIndex}`}>
                    <BulletRow
                      label="Bullet"
                      depth={2}
                      value={typeof entry === 'string' ? entry : entry?.text || ''}
                      onChange={(value) => updateEntryText(pillarIndex, entryIndex, value)}
                      onRemove={() => removeEntry(pillarIndex, entryIndex)}
                      onIndent={() => indentEntry(pillarIndex, entryIndex)}
                      onOutdent={() => outdentEntry(pillarIndex, entryIndex)}
                      onAddSub={() => addSubBullet(pillarIndex, entryIndex)}
                      canIndent={canIndentEntry(body, entryIndex)}
                      canOutdent={canOutdentEntry(body, entryIndex)}
                      draggable
                      dragging={isDragging(blockSource)}
                      onDragStart={(e) => beginDrag(blockSource, e)}
                      onDragEnd={endDrag}
                    />
                    {bullets.map((bullet, bulletIndex) => {
                      const source = { pillarIndex, kind: 'sub', entryIndex, bulletIndex };
                      const beforeTarget = { pillarIndex, kind: 'sub', entryIndex, bulletIndex };
                      return (
                        <BulletRow
                          key={bulletIndex}
                          depth={3}
                          label={`Sub-bullet ${bulletIndex + 1}`}
                          value={bulletText(bullet)}
                          onChange={(value) => updateNestedBullet(pillarIndex, entryIndex, bulletIndex, value)}
                          onRemove={() => removeNestedBullet(pillarIndex, entryIndex, bulletIndex)}
                          onIndent={() => {}}
                          onOutdent={() => outdentSubBullet(pillarIndex, entryIndex, bulletIndex)}
                          canIndent={false}
                          canOutdent
                          draggable
                          dragging={isDragging(source)}
                          dropActive={isDropActive(beforeTarget)}
                          onDragStart={(e) => beginDrag(source, e)}
                          onDragEnd={endDrag}
                          onDragOver={() => setDropHint(beforeTarget)}
                          onDropBefore={() => applyDrop(beforeTarget)}
                        />
                      );
                    })}
                    <BodyDropSlot
                      active={isDropActive({
                        pillarIndex,
                        kind: 'sub',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                      onDragOver={() => setDropHint({
                        pillarIndex,
                        kind: 'sub',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                      onDrop={() => applyDrop({
                        pillarIndex,
                        kind: 'sub',
                        entryIndex,
                        bulletIndex: bullets.length
                      })}
                    />
                    <AddRow>
                      <button
                        type="button"
                        className="shell-btn shell-btn--tiny"
                        onClick={() => addSubBullet(pillarIndex, entryIndex)}
                      >
                        + Sub-bullet
                      </button>
                    </AddRow>
                  </div>
                );
              }

              const afterBody = { pillarIndex, kind: 'body', bodyIndex: entryIndex + 1 };

              return (
                <div key={`wrap-${entryIndex}`}>
                  {nodes}
                  <BodyDropSlot
                    active={isDropActive(afterBody)}
                    onDragOver={() => setDropHint(afterBody)}
                    onDrop={() => applyDrop(afterBody)}
                  />
                  {renderSectionAddRows(pillarIndex, body, entryIndex)}
                </div>
              );
            })}

            <AddRow>
              <button
                type="button"
                className="shell-btn shell-btn--tiny"
                onClick={() => addTopHeading(pillarIndex)}
              >
                + Heading
              </button>
              <button
                type="button"
                className="shell-btn shell-btn--tiny"
                onClick={() => addTopBullet(pillarIndex)}
              >
                + Bullet
              </button>
            </AddRow>
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
