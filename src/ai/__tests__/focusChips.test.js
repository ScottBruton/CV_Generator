import { describe, expect, it } from 'vitest';
import { resolveFocusChips } from '../focusChips.js';

describe('focus chips', () => {
  it('includes only enabled chips in consolidated instructions', () => {
    const { chips, consolidatedInstructions } = resolveFocusChips([
      'role-mechanical-engineer',
      'cap-dfm',
      'missing-id'
    ]);
    expect(chips.map((chip) => chip.id)).toEqual(['role-mechanical-engineer', 'cap-dfm']);
    expect(consolidatedInstructions).toHaveLength(2);
    expect(consolidatedInstructions.join(' ')).toMatch(/mechanical design/i);
    expect(consolidatedInstructions.join(' ')).toMatch(/manufacture/i);
  });
});
