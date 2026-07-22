import { diffWords } from 'diff';

/**
 * Build navigable change groups from suggestions.
 * Word-level adjacent delete+insert pairs become replace groups for display/navigation.
 * Decisions are applied at suggestion/field level (see suggestionId).
 */
export function buildChangeGroups(suggestions = []) {
  const groups = [];

  suggestions.forEach((suggestion, suggestionIndex) => {
    const parts = diffWords(suggestion.originalText || '', suggestion.proposedText || '');
    let index = 0;
    let createdForSuggestion = false;

    while (index < parts.length) {
      const part = parts[index];
      const next = parts[index + 1];

      if (part.removed && next?.added) {
        groups.push(makeGroup(suggestion, suggestionIndex, groups.length, 'replace', part.value, next.value));
        createdForSuggestion = true;
        index += 2;
        continue;
      }
      if (part.added) {
        groups.push(makeGroup(suggestion, suggestionIndex, groups.length, 'insert', '', part.value));
        createdForSuggestion = true;
        index += 1;
        continue;
      }
      if (part.removed) {
        groups.push(makeGroup(suggestion, suggestionIndex, groups.length, 'delete', part.value, ''));
        createdForSuggestion = true;
        index += 1;
        continue;
      }
      index += 1;
    }

    if (!createdForSuggestion && suggestion.originalText !== suggestion.proposedText) {
      groups.push(makeGroup(
        suggestion,
        suggestionIndex,
        groups.length,
        'replace',
        suggestion.originalText,
        suggestion.proposedText
      ));
    }
  });

  return groups;
}

function makeGroup(suggestion, suggestionIndex, ordinal, type, originalText, proposedText) {
  return {
    id: `${suggestion.id || `s${suggestionIndex}`}-g${ordinal}`,
    suggestionId: suggestion.id,
    documentType: suggestion.documentType,
    sectionId: suggestion.sectionId,
    fieldId: suggestion.fieldId,
    fieldPath: suggestion.fieldPath,
    type,
    originalText,
    proposedText,
    status: 'pending',
    reason: suggestion.reason || '',
    matchedRequirements: suggestion.matchedRequirements || [],
    fullOriginal: suggestion.originalText,
    fullProposed: suggestion.proposedText
  };
}

export function getWordDiffParts(originalText, proposedText) {
  return diffWords(originalText || '', proposedText || '');
}

/** Collapse group statuses to field/suggestion decisions. Pending wins over accepted for save safety. */
export function decisionsFromGroups(groups = []) {
  const bySuggestion = new Map();
  for (const group of groups) {
    const current = bySuggestion.get(group.suggestionId) || [];
    current.push(group.status || 'pending');
    bySuggestion.set(group.suggestionId, current);
  }

  const fieldDecisions = {};
  for (const group of groups) {
    const statuses = bySuggestion.get(group.suggestionId) || ['pending'];
    if (statuses.some((status) => status === 'pending')) fieldDecisions[group.fieldPath] = 'pending';
    else if (statuses.every((status) => status === 'accepted')) fieldDecisions[group.fieldPath] = 'accepted';
    else if (statuses.every((status) => status === 'rejected')) fieldDecisions[group.fieldPath] = 'rejected';
    else fieldDecisions[group.fieldPath] = 'pending';
  }
  return fieldDecisions;
}

export function resolveUpdatesFromFieldDecisions(suggestions = [], fieldDecisions = {}) {
  const updates = [];
  for (const suggestion of suggestions) {
    const decision = fieldDecisions[suggestion.fieldPath];
    if (decision !== 'accepted') continue;
    updates.push({
      fieldPath: suggestion.fieldPath,
      text: suggestion.proposedText
    });
  }
  return updates;
}

export function setGroupsStatusForSuggestion(groups, suggestionId, status) {
  return groups.map((group) => (
    group.suggestionId === suggestionId ? { ...group, status } : group
  ));
}

export function setGroupStatus(groups, groupId, status) {
  const target = groups.find((group) => group.id === groupId);
  if (!target) return groups;
  // Accept/reject applies to the whole suggestion/field for coherent text application
  return setGroupsStatusForSuggestion(groups, target.suggestionId, status);
}
