/**
 * Command stack for accept/reject decisions on fieldPaths.
 */
export function createHistory() {
  return {
    past: [],
    present: {},
    future: []
  };
}

export function decide(history, fieldPath, status) {
  const previous = history.present[fieldPath] || 'pending';
  if (previous === status) return history;
  return {
    past: [...history.past, history.present],
    present: { ...history.present, [fieldPath]: status },
    future: []
  };
}

export function undo(history) {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  };
}

export function redo(history) {
  if (!history.future.length) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  };
}

export function countDecisions(decisions = {}) {
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  Object.values(decisions).forEach((status) => {
    if (status === 'accepted') accepted += 1;
    else if (status === 'rejected') rejected += 1;
    else pending += 1;
  });
  return { accepted, rejected, pending };
}

export function effectiveText(suggestion, decision) {
  if (decision === 'accepted') return suggestion.proposedText;
  return suggestion.originalText;
}
