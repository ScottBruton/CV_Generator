'use strict';

const { z } = require('zod');
const { normalizeJobSummary } = require('./normalize-job-summary');

/** Soft schema used after normalization — all values already coerced. */
const JobSummarySchema = z.object({
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  seniorityLevel: z.string().optional(),
  rolePurpose: z.string().optional(),
  primaryResponsibilities: z.array(z.string()).default([]),
  requiredTechnicalSkills: z.array(z.string()).default([]),
  preferredTechnicalSkills: z.array(z.string()).default([]),
  leadershipOrCollaboration: z.array(z.string()).default([]),
  industryOrRegulatoryExperience: z.array(z.string()).default([]),
  toolsTechnologiesMethodologies: z.array(z.string()).default([]),
  qualifications: z.array(z.string()).default([]),
  recurringKeywords: z.array(z.string()).default([]),
  atsTerminology: z.array(z.string()).default([]),
  locationOrWorkingArrangement: z.string().optional(),
  unsupportedNotes: z.array(z.string()).default([])
});

function parseJobSummary(input) {
  const normalized = normalizeJobSummary(input);
  // Never throw on AI shape quirks — normalization is the source of truth.
  return {
    jobTitle: normalized.jobTitle,
    company: normalized.company,
    seniorityLevel: normalized.seniorityLevel,
    rolePurpose: normalized.rolePurpose,
    primaryResponsibilities: normalized.primaryResponsibilities || [],
    requiredTechnicalSkills: normalized.requiredTechnicalSkills || [],
    preferredTechnicalSkills: normalized.preferredTechnicalSkills || [],
    leadershipOrCollaboration: normalized.leadershipOrCollaboration || [],
    industryOrRegulatoryExperience: normalized.industryOrRegulatoryExperience || [],
    toolsTechnologiesMethodologies: normalized.toolsTechnologiesMethodologies || [],
    qualifications: normalized.qualifications || [],
    recurringKeywords: normalized.recurringKeywords || [],
    atsTerminology: normalized.atsTerminology || [],
    locationOrWorkingArrangement: normalized.locationOrWorkingArrangement,
    unsupportedNotes: normalized.unsupportedNotes || []
  };
}

const ChangeJustificationSchema = z.object({
  matchedRequirement: z.string(),
  whyChangeIsNecessary: z.string(),
  wordCountDelta: z.number()
});

const TailoringSuggestionSchema = z.object({
  id: z.string().min(1),
  documentType: z.enum(['cover', 'cv']),
  sectionId: z.string().min(1),
  fieldId: z.string().min(1),
  fieldPath: z.string().min(1),
  originalText: z.string(),
  proposedText: z.string(),
  reason: z.string().default(''),
  matchedRequirements: z.array(z.string()).optional(),
  changeJustification: ChangeJustificationSchema.optional()
});

const TailoringResultSchema = z.object({
  sessionId: z.string().min(1),
  documentSnapshotId: z.string().min(1),
  suggestions: z.array(TailoringSuggestionSchema).default([]),
  warnings: z.array(z.string()).default([])
});

const optionalNullableString = z.preprocess(
  (value) => (value == null || value === '' ? undefined : String(value)),
  z.string().optional()
);

const JobSummaryRequestSchema = z.object({
  source: z.enum(['url', 'pdf', 'text']),
  url: optionalNullableString,
  text: optionalNullableString,
  pdfBase64: optionalNullableString,
  filename: optionalNullableString
}).superRefine((value, ctx) => {
  if (value.source === 'url' && !value.url) {
    ctx.addIssue({ code: 'custom', message: 'URL is required.', path: ['url'] });
  }
  if (value.source === 'text' && !String(value.text || '').trim()) {
    ctx.addIssue({ code: 'custom', message: 'Pasted text is required.', path: ['text'] });
  }
  if (value.source === 'pdf' && !value.pdfBase64) {
    ctx.addIssue({ code: 'custom', message: 'PDF data is required.', path: ['pdfBase64'] });
  }
  if (value.source === 'url' && value.url) {
    try {
      const parsed = new URL(value.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        ctx.addIssue({ code: 'custom', message: 'URL must be http or https.', path: ['url'] });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid URL.', path: ['url'] });
    }
  }
});

const TailorRequestSchema = z.object({
  documentSnapshotId: z.string().min(1),
  cover: z.record(z.string(), z.any()),
  cv: z.record(z.string(), z.any()),
  fields: z.array(z.object({
    documentType: z.enum(['cover', 'cv']),
    sectionId: z.string(),
    fieldId: z.string(),
    fieldPath: z.string(),
    text: z.string(),
    label: z.string().optional()
  })).min(1),
  focusChipIds: z.array(z.string()).default([]),
  customInstructions: z.preprocess((value) => (value == null ? '' : String(value)), z.string()).default(''),
  useJobSummary: z.boolean().default(false),
  jobSummary: z.any().optional().nullable()
});

module.exports = {
  JobSummarySchema,
  TailoringSuggestionSchema,
  TailoringResultSchema,
  JobSummaryRequestSchema,
  TailorRequestSchema,
  ChangeJustificationSchema,
  parseJobSummary
};
