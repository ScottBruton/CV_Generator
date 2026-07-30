export function formatEducationText(content) {
  const entries = content?.entries || [];
  return entries.map((entry, index) => {
    const lines = [
      `${index + 1}. ${entry.institution || 'Institution'}`,
      '',
      `Institution: ${entry.institution || ''}`,
      `Credential / Qualification: ${entry.credential || ''}`,
      `Starting Date: ${entry.startDate || ''}`,
      `End Date: ${entry.endDate || ''}`,
      '',
      'Details / Highlights:',
      '',
      ...(entry.details || []).filter(Boolean).map((item) => `• ${item}`),
      ''
    ];
    return lines.join('\n');
  }).join('\n').trimEnd() + (entries.length ? '\n' : '');
}
