import { describe, expect, it } from 'vitest';

function canUseSummary(jobSummary, useJobSummary) {
  return Boolean(useJobSummary && jobSummary);
}

function canGenerate({ customInstructions, selectedChips, useJobSummary, jobSummary }) {
  return Boolean(
    String(customInstructions || '').trim()
    || (selectedChips && selectedChips.size)
    || canUseSummary(jobSummary, useJobSummary)
  );
}

describe('job summary toggle gating', () => {
  it('keeps summary disabled contribution before extraction', () => {
    expect(canUseSummary(null, true)).toBe(false);
    expect(canGenerate({
      customInstructions: '',
      selectedChips: new Set(),
      useJobSummary: true,
      jobSummary: null
    })).toBe(false);
  });

  it('excludes disabled job summaries from generate enablement unless other inputs exist', () => {
    const summary = { jobTitle: 'Engineer' };
    expect(canUseSummary(summary, false)).toBe(false);
    expect(canGenerate({
      customInstructions: '',
      selectedChips: new Set(),
      useJobSummary: false,
      jobSummary: summary
    })).toBe(false);
    expect(canGenerate({
      customInstructions: '',
      selectedChips: new Set(['role-mechanical-engineer']),
      useJobSummary: false,
      jobSummary: summary
    })).toBe(true);
  });
});
