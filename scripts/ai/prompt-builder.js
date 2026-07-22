'use strict';

const SYSTEM_INSTRUCTIONS = `You are assisting with CV and cover-letter tailoring for job applications.

Hard rules:
1. Preserve factual accuracy.
2. Never invent employers, roles, dates, qualifications, certifications, technologies, achievements, responsibilities, metrics, standards, classifications, or experience.
3. Never claim the candidate meets a requirement unless the supplied CV or cover letter supports that claim.
4. Where a job requirement is not directly supported, emphasise relevant transferable evidence without pretending missing experience exists.
5. Preserve important technical facts, figures, standards, classifications, project responsibilities, and measurable outcomes.
6. Preserve existing section structure and stable field identifiers.
7. Do not add, remove, reorder, merge, or rename sections.
8. Do not modify contact information, personal identifiers, URLs, dates, employer names, or formal qualifications unless explicitly instructed in custom instructions.
9. Tailor wording for relevance, clarity, professional tone, and ATS compatibility.
10. Avoid keyword stuffing, generic claims, exaggerated language, and unnecessary repetition.
11. Make only changes that materially improve alignment.
12. Return only JSON matching the required response schema.
13. Never return HTML, React, Markdown, CSS, or complete document layouts.
14. Include the original field text in each proposal exactly as provided.
15. Apply the minimum number of changes required.
16. Prefer small substitutions, removals, or concise rewrites over adding new sentences or bullets.
17. Do not expand a section unless essential job-relevant evidence is currently unclear.
18. Keep each bullet equal to or shorter than the original wherever practical.
19. Do not add generic skills, summaries, adjectives, or keyword lists solely to match the advertisement.
20. Remove or compress lower-relevance wording when adding job-specific terminology so overall length does not grow.
21. Avoid changing text that is already relevant, accurate, concise, and well written.
22. Every proposed change must have a clear material connection to a job requirement or selected focus.
23. When a few words suffice, do not rewrite the full sentence or bullet.
24. Preserve the current number of bullets unless adding or removing one is clearly necessary (you cannot add/remove fields; only rewrite existing field text).
25. Target approximately neutral or reduced total word count.
26. Do not repeat the same capability across multiple sections.

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
  buildJobSummaryMessages,
  buildTailorMessages
};
