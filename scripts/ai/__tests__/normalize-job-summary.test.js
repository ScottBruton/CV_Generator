import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeJobSummary } = require('../normalize-job-summary');
const { JobSummarySchema } = require('../schemas');

describe('normalizeJobSummary', () => {
  it('coerces nulls and objects into schema-safe values', () => {
    const normalized = normalizeJobSummary({
      jobTitle: null,
      company: { name: 'RHL' },
      rolePurpose: null,
      primaryResponsibilities: ['Lead concepts', { text: 'DFM delivery' }],
      requiredTechnicalSkills: null,
      recurringKeywords: 'CAD'
    });
    const parsed = JobSummarySchema.parse(normalized);
    expect(parsed.jobTitle).toBeUndefined();
    expect(parsed.company).toBe('RHL');
    expect(parsed.primaryResponsibilities).toEqual(['Lead concepts', 'DFM delivery']);
    expect(parsed.requiredTechnicalSkills).toEqual([]);
    expect(parsed.recurringKeywords).toEqual(['CAD']);
  });
});
