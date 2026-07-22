import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateTailoringResult } = require('../validate-suggestions');
const { TailoringResultSchema } = require('../schemas');
const { resolveFocusChips } = require('../focus-chips');

describe('tailoring validation', () => {
  const snapshot = {
    snapshotId: 'snap_1',
    documentSnapshotId: 'snap_1',
    fields: [
      {
        documentType: 'cover',
        sectionId: 'cover-body',
        fieldId: 'paragraph-0',
        fieldPath: 'cover.paragraphs[0]',
        text: 'Original paragraph.'
      }
    ]
  };

  it('rejects invalid AI response schemas', () => {
    expect(() => TailoringResultSchema.parse({ suggestions: [{ id: 1 }] })).toThrow();
  });

  it('rejects unknown field identifiers', () => {
    const result = validateTailoringResult(snapshot, {
      sessionId: 'sess',
      documentSnapshotId: 'snap_1',
      suggestions: [{
        id: 's1',
        documentType: 'cover',
        sectionId: 'x',
        fieldId: 'y',
        fieldPath: 'cover.missing',
        originalText: 'Original paragraph.',
        proposedText: 'Changed.',
        reason: 'test'
      }],
      warnings: []
    });
    expect(result.suggestions).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/unknown field/i);
  });

  it('rejects original-text mismatches', () => {
    const result = validateTailoringResult(snapshot, {
      sessionId: 'sess',
      documentSnapshotId: 'snap_1',
      suggestions: [{
        id: 's1',
        documentType: 'cover',
        sectionId: 'cover-body',
        fieldId: 'paragraph-0',
        fieldPath: 'cover.paragraphs[0]',
        originalText: 'Stale text',
        proposedText: 'Changed.',
        reason: 'test'
      }],
      warnings: []
    });
    expect(result.suggestions).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/stale original/i);
  });

  it('detects stale snapshot ids', () => {
    const result = validateTailoringResult(snapshot, {
      sessionId: 'sess',
      documentSnapshotId: 'snap_other',
      suggestions: [],
      warnings: []
    });
    expect(result.ok).toBe(false);
  });
});

describe('prompt chip consolidation helpers', () => {
  it('excludes disabled chips', () => {
    const { chips } = resolveFocusChips(['cap-regulated']);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('cap-regulated');
  });
});
