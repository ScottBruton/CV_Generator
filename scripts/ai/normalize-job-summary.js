'use strict';

function asString(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map(asString).filter(Boolean);
    return parts.length ? parts.join('; ') : undefined;
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return asString(value.text);
    if (typeof value.value === 'string') return asString(value.value);
    if (typeof value.name === 'string') return asString(value.name);
    if (typeof value.label === 'string') return asString(value.label);
    try {
      const json = JSON.stringify(value);
      return json && json !== '{}' && json !== '[]' ? json : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function asStringArray(value) {
  if (value == null) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes('\n')) {
      return trimmed.split(/\n+/).map((item) => item.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    }
    return [trimmed];
  }
  if (!Array.isArray(value)) {
    const single = asString(value);
    return single ? [single] : [];
  }
  return value.map(asString).filter(Boolean);
}

/**
 * Coerce messy model output into a JobSummary-shaped object before Zod parse.
 */
function normalizeJobSummary(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    jobTitle: asString(source.jobTitle ?? source.title),
    company: asString(source.company ?? source.companyName),
    seniorityLevel: asString(source.seniorityLevel ?? source.seniority),
    rolePurpose: asString(source.rolePurpose ?? source.summary ?? source.description),
    primaryResponsibilities: asStringArray(source.primaryResponsibilities ?? source.responsibilities),
    requiredTechnicalSkills: asStringArray(source.requiredTechnicalSkills ?? source.requiredSkills),
    preferredTechnicalSkills: asStringArray(source.preferredTechnicalSkills ?? source.preferredSkills),
    leadershipOrCollaboration: asStringArray(source.leadershipOrCollaboration ?? source.collaboration),
    industryOrRegulatoryExperience: asStringArray(source.industryOrRegulatoryExperience ?? source.industries),
    toolsTechnologiesMethodologies: asStringArray(source.toolsTechnologiesMethodologies ?? source.tools),
    qualifications: asStringArray(source.qualifications),
    recurringKeywords: asStringArray(source.recurringKeywords ?? source.keywords),
    atsTerminology: asStringArray(source.atsTerminology),
    locationOrWorkingArrangement: asString(source.locationOrWorkingArrangement ?? source.location),
    unsupportedNotes: asStringArray(source.unsupportedNotes)
  };
}

module.exports = {
  normalizeJobSummary,
  asString,
  asStringArray
};
