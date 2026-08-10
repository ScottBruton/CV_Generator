'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FOCUS_CHIPS_PATH = path.join(ROOT, 'content', 'app', 'focus-chips.json');
const DEFAULT_FOCUS_CHIPS = require('../../src/ai/focusChipsData.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeChip(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const category = raw.category === 'capability' ? 'capability' : 'role';
  const label = String(raw.label || '').trim();
  const instruction = String(raw.instruction || '').trim();
  if (!label || !instruction) return null;
  let id = String(raw.id || '').trim();
  if (!id) {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `chip-${index}`;
    id = `${category === 'capability' ? 'cap' : 'role'}-${slug}`;
  }
  return { id, label, category, instruction };
}

function ensureFocusChipsFile() {
  if (!fs.existsSync(FOCUS_CHIPS_PATH)) {
    writeJson(FOCUS_CHIPS_PATH, DEFAULT_FOCUS_CHIPS);
  }
}

function getFocusChips() {
  ensureFocusChipsFile();
  const data = readJson(FOCUS_CHIPS_PATH, DEFAULT_FOCUS_CHIPS);
  if (!Array.isArray(data)) return [...DEFAULT_FOCUS_CHIPS];
  return data.map(normalizeChip).filter(Boolean);
}

function saveFocusChips(chips) {
  if (!Array.isArray(chips)) throw new Error('Focus chips must be an array.');
  const normalized = [];
  const seen = new Set();
  chips.forEach((raw, index) => {
    const chip = normalizeChip(raw, index);
    if (!chip) {
      throw new Error(`Focus chip at index ${index} needs label and instruction.`);
    }
    if (seen.has(chip.id)) {
      throw new Error(`Duplicate focus chip id "${chip.id}".`);
    }
    seen.add(chip.id);
    normalized.push(chip);
  });
  writeJson(FOCUS_CHIPS_PATH, normalized);
  return normalized;
}

/**
 * @param {string[]} selectedIds
 * @param {ReturnType<typeof getFocusChips>} [catalog]
 */
function resolveFocusChips(selectedIds = [], catalog = getFocusChips()) {
  const idSet = new Set((selectedIds || []).map(String));
  const chips = catalog.filter((chip) => idSet.has(chip.id));
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
  FOCUS_CHIPS_PATH,
  DEFAULT_FOCUS_CHIPS,
  getFocusChips,
  saveFocusChips,
  resolveFocusChips,
  /** @deprecated use getFocusChips() — kept for older require sites */
  get FOCUS_CHIPS() {
    return getFocusChips();
  }
};
