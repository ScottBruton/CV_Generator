'use strict';

const FOCUS_CHIPS = require('../../src/ai/focusChipsData.json');

/**
 * @param {string[]} selectedIds
 * @returns {{ chips: typeof FOCUS_CHIPS, consolidatedInstructions: string[] }}
 */
function resolveFocusChips(selectedIds = []) {
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

module.exports = {
  FOCUS_CHIPS,
  resolveFocusChips
};
