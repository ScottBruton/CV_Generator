export function assetUrl(src) {
  if (!src) return '';
  const clean = String(src).replace(/^\//, '');
  return `/${clean}`;
}

export function formatTimelineDateRange(step) {
  if (step.dateLabel) return step.dateLabel;
  const start = step.startDate || step.start || step.year || '';
  const end = step.isPresent || step.endDate === null
    ? 'Present'
    : (step.endDate || step.end || '');
  if (start && end && start !== end) return `${start}\u2013${end}`;
  return start || end || '';
}

export function lineText(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.text || '';
}
