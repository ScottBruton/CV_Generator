'use strict';

const crypto = require('crypto');
const {
  JobSummaryRequestSchema,
  TailorRequestSchema,
  TailoringResultSchema,
  parseJobSummary
} = require('./schemas');
const { resolveFocusChips } = require('./focus-chips');
const { flattenEditableFields, createSnapshot } = require('./document-fields');
const { validateTailoringResult } = require('./validate-suggestions');
const { extractJobTextFromUrl } = require('./job-extract-url');
const { extractJobTextFromPdf } = require('./job-extract-pdf');
const { buildJobSummaryMessages, buildTailorMessages } = require('./prompt-builder');
const { createJsonCompletion } = require('./openai-client');
const { checkRateLimit } = require('./rate-limit');

const TEXT_MIN = 280;
const TEXT_MAX = 80_000;

function clientKey(req) {
  return req.socket?.remoteAddress || 'local';
}

function ensureRateLimit(req, route) {
  const result = checkRateLimit(`${clientKey(req)}:${route}`, { limit: 15, windowMs: 60_000 });
  if (!result.allowed) {
    const error = new Error('Rate limit exceeded. Please wait a moment and try again.');
    error.statusCode = 429;
    throw error;
  }
}

async function handleJobSummary(req, body) {
  ensureRateLimit(req, 'job-summary');
  const parsed = JobSummaryRequestSchema.parse(body);

  let rawText = '';
  let sourceMeta = { source: parsed.source };

  let extractionWarning;
  if (parsed.source === 'url') {
    const extracted = await extractJobTextFromUrl(parsed.url);
    rawText = extracted.text;
    extractionWarning = extracted.warning;
    sourceMeta = {
      ...sourceMeta,
      url: extracted.sourceUrl,
      title: extracted.title,
      extractionKind: extracted.extractionKind,
      extractedCharCount: rawText.length
    };
  } else if (parsed.source === 'pdf') {
    const extracted = await extractJobTextFromPdf({
      pdfBase64: parsed.pdfBase64,
      filename: parsed.filename
    });
    rawText = extracted.text;
    sourceMeta = {
      ...sourceMeta,
      filename: extracted.filename,
      extractedCharCount: rawText.length
    };
  } else {
    rawText = String(parsed.text || '').trim();
    if (rawText.length < TEXT_MIN) {
      const error = new Error(`Pasted text is too short. Provide at least ${TEXT_MIN} characters.`);
      error.statusCode = 400;
      throw error;
    }
    if (rawText.length > TEXT_MAX) {
      const error = new Error('Pasted text is too long.');
      error.statusCode = 400;
      throw error;
    }
    sourceMeta = { ...sourceMeta, extractedCharCount: rawText.length };
  }

  const json = await createJsonCompletion({
    messages: buildJobSummaryMessages(rawText, sourceMeta),
    schemaName: 'JobSummary',
    timeout: 120_000,
    maxRetries: 1
  });

  let summary;
  try {
    summary = parseJobSummary(json);
  } catch (error) {
    const detail = error?.issues
      ? error.issues.map((issue) => `${issue.path?.join('.') || 'field'}: ${issue.message}`).join('; ')
      : error.message;
    console.error('[ai/job-summary] schema', detail);
    const wrapped = new Error('The AI returned an invalid job summary format. Please try again, or paste the job text instead.');
    wrapped.statusCode = 422;
    throw wrapped;
  }

  const hasSignal = Boolean(
    summary.jobTitle
    || summary.company
    || summary.rolePurpose
    || summary.primaryResponsibilities.length
    || summary.requiredTechnicalSkills.length
  );
  if (!hasSignal) {
    const error = new Error('Could not produce a usable job summary from the provided source.');
    error.statusCode = 422;
    throw error;
  }

  const thinContent = !summary.rolePurpose
    && summary.primaryResponsibilities.length < 2
    && summary.requiredTechnicalSkills.length < 2;

  return {
    jobSummary: summary,
    sourceMeta,
    warning: extractionWarning
      || (thinContent
        ? 'Summary looks thin. The source likely did not include the full job description. Paste the full advert text for better results.'
        : undefined)
  };
}

async function handleTailor(req, body) {
  ensureRateLimit(req, 'tailor');
  const parsed = TailorRequestSchema.parse(body);

  const hasCustom = Boolean(String(parsed.customInstructions || '').trim());
  const { chips, consolidatedInstructions } = resolveFocusChips(parsed.focusChipIds);
  let jobSummary = null;
  if (parsed.useJobSummary && parsed.jobSummary) {
    try {
      jobSummary = parseJobSummary(parsed.jobSummary);
    } catch {
      const error = new Error('Stored job summary is invalid. Re-analyse the role, then try again.');
      error.statusCode = 400;
      throw error;
    }
  }
  const useJobSummary = Boolean(jobSummary);
  if (!hasCustom && !chips.length && !useJobSummary) {
    const error = new Error('Provide custom instructions, at least one focus chip, or an enabled job summary.');
    error.statusCode = 400;
    throw error;
  }

  const fields = parsed.fields?.length
    ? parsed.fields
    : flattenEditableFields(parsed.cover, parsed.cv);

  const snapshot = {
    snapshotId: parsed.documentSnapshotId,
    documentSnapshotId: parsed.documentSnapshotId,
    cover: parsed.cover,
    cv: parsed.cv,
    fields
  };

  // Ensure server-side fields match provided snapshot texts
  const recomputed = flattenEditableFields(parsed.cover, parsed.cv);
  const byPath = new Map(recomputed.map((field) => [field.fieldPath, field.text]));
  for (const field of fields) {
    if (byPath.has(field.fieldPath) && byPath.get(field.fieldPath) !== field.text) {
      const error = new Error('Document snapshot is out of date. Refresh and try again.');
      error.statusCode = 409;
      throw error;
    }
  }

  // Full CV + cover field set is large; Sol often needs several minutes.
  const json = await createJsonCompletion({
    messages: buildTailorMessages({
      snapshot,
      consolidatedInstructions,
      customInstructions: parsed.customInstructions,
      jobSummary,
      useJobSummary
    }),
    schemaName: 'TailoringResult',
    timeout: 480_000,
    maxRetries: 0
  });

  if (!json.sessionId) json.sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
  if (!json.documentSnapshotId) json.documentSnapshotId = parsed.documentSnapshotId;

  const result = TailoringResultSchema.parse(json);
  const validated = validateTailoringResult(snapshot, result);
  if (!validated.ok) {
    const error = new Error(validated.error);
    error.statusCode = 409;
    throw error;
  }

  return {
    sessionId: validated.sessionId,
    documentSnapshotId: validated.documentSnapshotId,
    suggestions: validated.suggestions,
    warnings: validated.warnings,
    focusChipsApplied: chips.map((chip) => chip.id)
  };
}

module.exports = {
  handleJobSummary,
  handleTailor,
  createSnapshot
};
