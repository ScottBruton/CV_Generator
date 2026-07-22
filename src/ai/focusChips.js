import FOCUS_CHIPS from './focusChipsData.json';

export function getFocusChips() {
  return FOCUS_CHIPS;
}

export function chipsByCategory() {
  return {
    role: FOCUS_CHIPS.filter((chip) => chip.category === 'role'),
    capability: FOCUS_CHIPS.filter((chip) => chip.category === 'capability')
  };
}

export function resolveFocusChips(selectedIds = []) {
  const idSet = new Set((selectedIds || []).map(String));
  const chips = FOCUS_CHIPS.filter((chip) => idSet.has(chip.id));
  const seen = new Set();
  const consolidatedInstructions = [];
  for (const chip of chips) {
    const key = chip.instruction.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    consolidatedInstructions.push(chip.instruction);
  }
  return { chips, consolidatedInstructions };
}

export { FOCUS_CHIPS };
