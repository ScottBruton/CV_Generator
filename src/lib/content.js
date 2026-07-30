let exportImageTransform = null;

export function assetUrl(src) {
  if (!src) return '';
  const clean = String(src).replace(/^\//, '');
  const url = `/${clean}`;
  return exportImageTransform ? exportImageTransform(url) : url;
}

/** Used by print/export to rewrite image URLs through the compression endpoint. */
export function setExportImageTransform(transformFn) {
  exportImageTransform = typeof transformFn === 'function' ? transformFn : null;
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
