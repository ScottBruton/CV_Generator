'use strict';

const crypto = require('crypto');

function clone(value) {
  return structuredClone(value);
}

function flattenEditableFields(cover = {}, cv = {}) {
  const fields = [];

  const push = (documentType, sectionId, fieldId, fieldPath, text, label) => {
    const value = text == null ? '' : String(text);
    if (!value.trim()) return;
    fields.push({ documentType, sectionId, fieldId, fieldPath, text: value, label });
  };

  push('cover', 'cover-meta', 'subject', 'cover.subject', cover.subject, 'Cover subject');
  (cover.paragraphs || []).forEach((paragraph, index) => {
    push('cover', 'cover-body', `paragraph-${index}`, `cover.paragraphs[${index}]`, paragraph, `Cover paragraph ${index + 1}`);
  });
  push('cover', 'cover-meta', 'closing', 'cover.closing', cover.closing, 'Cover closing');

  const profile = cv.profile || {};
  push('cv', 'profile', 'title', 'cv.profile.title', profile.title, 'CV title');
  push('cv', 'profile', 'summary', 'cv.profile.summary', profile.summary, 'CV summary');

  const pillars = cv.impact?.pillars || [];
  pillars.forEach((pillar, pillarIndex) => {
    const pillarKey = pillar.variant || `pillar-${pillarIndex}`;
    (pillar.body || []).forEach((entry, entryIndex) => {
      if (typeof entry === 'string') {
        push('cv', `impact-${pillarKey}`, `body-${entryIndex}`, `cv.impact.pillars[${pillarIndex}].body[${entryIndex}]`, entry, `${pillar.title || pillarKey} item`);
        return;
      }
      if (!entry || entry.heading || entry.subheading) return;
      if (entry.text) {
        push(
          'cv',
          `impact-${pillarKey}`,
          `body-${entryIndex}-text`,
          `cv.impact.pillars[${pillarIndex}].body[${entryIndex}].text`,
          entry.text,
          `${pillar.title || pillarKey} text`
        );
      }
      (entry.bullets || []).forEach((bullet, bulletIndex) => {
        const text = typeof bullet === 'string' ? bullet : bullet?.text;
        const path = typeof bullet === 'string'
          ? `cv.impact.pillars[${pillarIndex}].body[${entryIndex}].bullets[${bulletIndex}]`
          : `cv.impact.pillars[${pillarIndex}].body[${entryIndex}].bullets[${bulletIndex}].text`;
        push(
          'cv',
          `impact-${pillarKey}`,
          `body-${entryIndex}-bullet-${bulletIndex}`,
          path,
          text,
          `${pillar.title || pillarKey} bullet`
        );
      });
    });
  });

  const groups = cv.skills?.groups || [];
  groups.forEach((group, groupIndex) => {
    (group.subskills || []).forEach((skill, skillIndex) => {
      push(
        'cv',
        'skills',
        `skill-${groupIndex}-${skillIndex}`,
        `cv.skills.groups[${groupIndex}].subskills[${skillIndex}].name`,
        skill?.name,
        `${group.heading || 'Skill'} name`
      );
    });
  });

  return fields;
}

function parsePath(fieldPath) {
  const parts = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let match;
  while ((match = re.exec(fieldPath))) {
    if (match[1]) parts.push(match[1]);
    else parts.push(Number(match[2]));
  }
  return parts;
}

function getAtPath(root, fieldPath) {
  const parts = parsePath(fieldPath);
  let cursor = root;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setAtPath(root, fieldPath, value) {
  const parts = parsePath(fieldPath);
  if (!parts.length) return;

  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    if (cursor[part] == null) cursor[part] = typeof next === 'number' ? [] : {};
    if (next === 'text' && typeof cursor[part] === 'string') {
      cursor[part] = { text: cursor[part] };
    }
    cursor = cursor[part];
  }

  const last = parts[parts.length - 1];
  if (last === 'text' && cursor && typeof cursor === 'object' && !Array.isArray(cursor)) {
    cursor.text = value;
    return;
  }

  if (typeof cursor[last] === 'object' && cursor[last] && 'text' in cursor[last]) {
    cursor[last] = { ...cursor[last], text: value };
    return;
  }

  cursor[last] = value;
}

function applyFieldUpdates(docs, updates = []) {
  const cover = clone(docs.cover || {});
  const cv = clone(docs.cv || {});
  const roots = { cover, cv };

  for (const update of updates) {
    const path = String(update.fieldPath || '');
    const rootKey = path.startsWith('cover.') ? 'cover' : path.startsWith('cv.') ? 'cv' : null;
    if (!rootKey) continue;
    setAtPath(roots[rootKey], path.slice(rootKey.length + 1), update.text);
  }

  return roots;
}

function getFieldText(docs, fieldPath) {
  const path = String(fieldPath || '');
  const rootKey = path.startsWith('cover.') ? 'cover' : path.startsWith('cv.') ? 'cv' : null;
  if (!rootKey) return undefined;
  const value = getAtPath(docs[rootKey], path.slice(rootKey.length + 1));
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text;
  return undefined;
}

function createSnapshot(cover, cv) {
  const coverClone = clone(cover || {});
  const cvClone = clone(cv || {});
  const fields = flattenEditableFields(coverClone, cvClone);
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ cover: coverClone, cv: cvClone, fields: fields.map((f) => ({ p: f.fieldPath, t: f.text })) }))
    .digest('hex')
    .slice(0, 16);
  const snapshotId = `snap_${hash}_${Date.now().toString(36)}`;
  return {
    snapshotId,
    documentSnapshotId: snapshotId,
    cover: coverClone,
    cv: cvClone,
    fields
  };
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

module.exports = {
  flattenEditableFields,
  applyFieldUpdates,
  getFieldText,
  createSnapshot,
  wordCount,
  parsePath,
  getAtPath,
  setAtPath
};
