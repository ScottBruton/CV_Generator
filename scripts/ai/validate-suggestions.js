'use strict';

const { wordCount } = require('./document-fields');

/**
 * @param {object} snapshot
 * @param {import('zod').infer<typeof import('./schemas').TailoringResultSchema>} result
 */
function validateTailoringResult(snapshot, result) {
  const fieldByPath = new Map((snapshot.fields || []).map((field) => [field.fieldPath, field]));
  const warnings = [...(result.warnings || [])];
  const accepted = [];
  const seenPaths = new Set();

  if (result.documentSnapshotId !== snapshot.documentSnapshotId && result.documentSnapshotId !== snapshot.snapshotId) {
    return {
      ok: false,
      error: 'Stale document snapshot. Re-generate against the current documents.',
      suggestions: [],
      warnings
    };
  }

  for (const suggestion of result.suggestions || []) {
    const field = fieldByPath.get(suggestion.fieldPath);
    if (!field) {
      warnings.push(`Ignored unknown field path: ${suggestion.fieldPath}`);
      continue;
    }
    if (field.documentType !== suggestion.documentType) {
      warnings.push(`Ignored mismatched document type for ${suggestion.fieldPath}`);
      continue;
    }
    if (suggestion.originalText !== field.text) {
      warnings.push(`Ignored stale original text for ${suggestion.fieldPath}`);
      continue;
    }
    if (suggestion.proposedText === suggestion.originalText) {
      continue;
    }
    if (seenPaths.has(suggestion.fieldPath)) {
      warnings.push(`Ignored duplicate suggestion for ${suggestion.fieldPath}`);
      continue;
    }

    const delta = wordCount(suggestion.proposedText) - wordCount(suggestion.originalText);
    const justification = suggestion.changeJustification;
    if (delta > 25) {
      warnings.push(`Rejected verbose rewrite for ${suggestion.fieldPath} (+${delta} words).`);
      continue;
    }
    if (delta > 12 && (!justification || !String(justification.matchedRequirement || '').trim())) {
      warnings.push(`Rejected unsupported word-count increase for ${suggestion.fieldPath}.`);
      continue;
    }

    seenPaths.add(suggestion.fieldPath);
    accepted.push({
      ...suggestion,
      sectionId: suggestion.sectionId || field.sectionId,
      fieldId: suggestion.fieldId || field.fieldId,
      changeJustification: justification || {
        matchedRequirement: (suggestion.matchedRequirements || [])[0] || 'Selected tailoring focus',
        whyChangeIsNecessary: suggestion.reason || 'Improves role alignment',
        wordCountDelta: delta
      }
    });
  }

  return {
    ok: true,
    suggestions: accepted,
    warnings,
    sessionId: result.sessionId,
    documentSnapshotId: snapshot.documentSnapshotId || snapshot.snapshotId
  };
}

module.exports = {
  validateTailoringResult
};
