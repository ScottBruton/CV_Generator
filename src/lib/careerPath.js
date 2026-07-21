export function formatCareerPathText(content) {
  const roles = content?.roles || [];
  return roles.map((role, index) => {
    const lines = [
      `${index + 1}. ${role.company || 'Company'}`,
      '',
      `Company: ${role.company || ''}`,
      `Job Title: ${role.jobTitle || ''}`,
      `Starting Date: ${role.startDate || ''}`,
      `End Date: ${role.endDate || ''}`,
      '',
      'Responsibilities / Key Accomplishments:',
      '',
      ...(role.accomplishments || []).filter(Boolean).map((item) => `• ${item}`),
      ''
    ];
    return lines.join('\n');
  }).join('\n').trimEnd() + (roles.length ? '\n' : '');
}
