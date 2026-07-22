'use strict';

const SYSTEM_INSTRUCTIONS = `You are assisting with CV and cover-letter tailoring for job applications.

Hard rules (never violate):
1. Preserve factual accuracy.
2. Never invent employers, roles, dates, qualifications, certifications, technologies, achievements, responsibilities, metrics, standards, classifications, or experience.
3. Never claim the candidate meets a requirement unless the supplied CV or cover letter supports that claim.
4. Where a job requirement is not directly supported, emphasise relevant transferable evidence without pretending missing experience exists.
5. Preserve important technical facts, figures, standards, classifications, project responsibilities, and measurable outcomes.
6. Preserve existing section structure and stable field identifiers.
7. Do not add, remove, reorder, merge, or rename sections.
8. Do not modify contact information, personal identifiers, URLs, dates, employer names, or formal qualifications unless explicitly instructed in custom instructions.
9. Return only JSON matching the required response schema.
10. Never return HTML, React, Markdown, CSS, or complete document layouts.
11. Include the original field text in each proposal exactly as provided.
12. You can only rewrite existing field text — you cannot add or remove fields/bullets.

Tailoring goals (be substantive):
13. Produce meaningful role-aligned rewrites, not cosmetic synonym swaps.
14. Prioritise high-impact fields: cover subject and paragraphs, CV title and summary, and impact pillar bullets.
15. Retarget wording toward the job summary, focus instructions, and ATS terminology using evidence already present in the documents.
16. Prefer full-sentence or full-bullet rewrites when that clearly improves alignment with responsibilities, required skills, seniority, or industry language from the job.
17. Skip a field only when it is already strongly aligned with the target role; do not leave the review set sparse.
18. When a job summary is present, propose changes across both cover and CV — not cover-only micro-edits.
19. Modest length growth is acceptable when adding job-relevant phrasing grounded in existing evidence.
20. Avoid keyword stuffing, generic filler, exaggerated claims, padding, and repeating the same capability across many sections.
21. Every proposed change must have a clear connection to a job requirement, focus instruction, or ATS term.
22. Keep professional tone and clarity; preserve measurable outcomes while reframing relevance.

Response JSON shape:
{
  "sessionId": string,
  "documentSnapshotId": string (must echo the provided snapshot id),
  "suggestions": [{
    "id": string,
    "documentType": "cover"|"cv",
    "sectionId": string,
    "fieldId": string,
    "fieldPath": string,
    "originalText": string,
    "proposedText": string,
    "reason": string,
    "matchedRequirements": string[],
    "changeJustification": {
      "matchedRequirement": string,
      "whyChangeIsNecessary": string,
      "wordCountDelta": number
    }
  }],
  "warnings": string[]
}`;

const TAILORING_GOAL = `Produce a useful review set of substantive text changes that clearly retarget the cover letter and CV toward the role. Prefer rewriting cover paragraphs, CV title/summary, and impact bullets with job-aligned language grounded in existing evidence. Avoid tiny synonym-only edits.`;

function buildJobSummaryMessages(rawText, sourceMeta = {}) {
  return [
    {
      role: 'system',
      content: `Extract a structured job advertisement summary from the provided text.

Rules:
- Use only information supported by the provided text.
- Do not invent missing information.
- Prefer empty arrays [] over null for list fields.
- Prefer omitting unsupported string fields, or use an empty string, never null or nested objects.
- Every string field must be a plain string. Every list field must be an array of plain strings.
- Fill primaryResponsibilities and requiredTechnicalSkills thoroughly when the advert lists them (including bullet lists under "What you'll bring", requirements, responsibilities, etc.).
- rolePurpose should summarise the role in 1-3 sentences from the advert body when available.
- If the source text is only metadata (title/company/location) and lacks a real description, note that in unsupportedNotes and keep lists empty.

Return JSON only with these keys:
jobTitle, company, seniorityLevel, rolePurpose, primaryResponsibilities, requiredTechnicalSkills,
preferredTechnicalSkills, leadershipOrCollaboration, industryOrRegulatoryExperience,
toolsTechnologiesMethodologies, qualifications, recurringKeywords, atsTerminology,
locationOrWorkingArrangement, unsupportedNotes.`
    },
    {
      role: 'user',
      content: JSON.stringify({
        sourceMeta,
        jobAdvertisementText: rawText
      })
    }
  ];
}

function buildTailorMessages({
  snapshot,
  consolidatedInstructions,
  customInstructions,
  jobSummary,
  useJobSummary
}) {
  return [
    { role: 'system', content: SYSTEM_INSTRUCTIONS },
    {
      role: 'user',
      content: JSON.stringify({
        documentSnapshotId: snapshot.documentSnapshotId || snapshot.snapshotId,
        tailoringGoal: TAILORING_GOAL,
        customInstructions: customInstructions || '',
        focusInstructions: consolidatedInstructions || [],
        jobSummary: useJobSummary ? jobSummary || null : null,
        editableFields: (snapshot.fields || []).map((field) => ({
          documentType: field.documentType,
          sectionId: field.sectionId,
          fieldId: field.fieldId,
          fieldPath: field.fieldPath,
          label: field.label,
          text: field.text
        }))
      })
    }
  ];
}

module.exports = {
  SYSTEM_INSTRUCTIONS,
  TAILORING_GOAL,
  buildJobSummaryMessages,
  buildTailorMessages
};
