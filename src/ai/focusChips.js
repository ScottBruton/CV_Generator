import DEFAULT_FOCUS_CHIPS from './focusChipsData.json';

export function getFocusChips(chips = DEFAULT_FOCUS_CHIPS) {
  return Array.isArray(chips) ? chips : DEFAULT_FOCUS_CHIPS;
}

export function chipsByCategory(chips = DEFAULT_FOCUS_CHIPS) {
  const list = getFocusChips(chips);
  return {
    role: list.filter((chip) => chip.category === 'role'),
    capability: list.filter((chip) => chip.category === 'capability')
  };
}

export function resolveFocusChips(selectedIds = [], chips = DEFAULT_FOCUS_CHIPS) {
  const catalog = getFocusChips(chips);
  const idSet = new Set((selectedIds || []).map(String));
  const matched = catalog.filter((chip) => idSet.has(chip.id));
  const seen = new Set();
  const consolidatedInstructions = [];
  for (const chip of matched) {
    const key = chip.instruction.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    consolidatedInstructions.push(chip.instruction);
  }
  return { chips: matched, consolidatedInstructions };
}

export { DEFAULT_FOCUS_CHIPS as FOCUS_CHIPS };
