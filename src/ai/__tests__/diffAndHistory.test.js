import { describe, expect, it } from 'vitest';
import {
  buildChangeGroups,
  decisionsFromGroups,
  resolveUpdatesFromFieldDecisions,
  setGroupStatus
} from '../diffGroups.js';
import { applyFieldUpdates } from '../documentFields.js';
import { createHistory, decide, redo, undo } from '../tailoringHistory.js';

const suggestions = [
  {
    id: 's1',
    documentType: 'cover',
    sectionId: 'cover-body',
    fieldId: 'paragraph-0',
    fieldPath: 'cover.paragraphs[0]',
    originalText: 'I design medical devices.',
    proposedText: 'I design regulated medical devices.',
    reason: 'Align to regulated products'
  },
  {
    id: 's2',
    documentType: 'cv',
    sectionId: 'profile',
    fieldId: 'summary',
    fieldPath: 'cv.profile.summary',
    originalText: 'Product developer with MedTech experience.',
    proposedText: 'Product developer with medical-device R&D experience.',
    reason: 'ATS wording'
  }
];

describe('word-level change grouping', () => {
  it('groups adjacent delete and insert as replace', () => {
    const groups = buildChangeGroups([{
      id: 'sx',
      documentType: 'cv',
      sectionId: 'profile',
      fieldId: 'title',
      fieldPath: 'cv.profile.title',
      originalText: 'Mechanical Engineer',
      proposedText: 'Senior Mechanical Engineer',
      reason: 'seniority'
    }]);
    expect(groups.some((group) => group.type === 'replace' || group.type === 'insert')).toBe(true);
  });

  it('accepting one suggestion does not apply others', () => {
    let groups = buildChangeGroups(suggestions);
    const first = groups.find((group) => group.suggestionId === 's1');
    groups = setGroupStatus(groups, first.id, 'accepted');
    const decisions = decisionsFromGroups(groups);
    const updates = resolveUpdatesFromFieldDecisions(suggestions, decisions);
    expect(updates).toHaveLength(1);
    expect(updates[0].fieldPath).toBe('cover.paragraphs[0]');
  });

  it('rejecting restores original text for that field', () => {
    let groups = buildChangeGroups(suggestions);
    const first = groups.find((group) => group.suggestionId === 's1');
    groups = setGroupStatus(groups, first.id, 'rejected');
    const decisions = decisionsFromGroups(groups);
    const updates = resolveUpdatesFromFieldDecisions(suggestions, decisions);
    expect(updates).toHaveLength(0);
    const docs = applyFieldUpdates({
      cover: { paragraphs: ['I design medical devices.'] },
      cv: { profile: { summary: 'Product developer with MedTech experience.' } }
    }, updates);
    expect(docs.cover.paragraphs[0]).toBe('I design medical devices.');
  });
});

describe('undo redo history', () => {
  it('supports undo/redo and clears redo after new action', () => {
    let history = createHistory();
    history = decide(history, 'cover.paragraphs[0]', 'accepted');
    history = decide(history, 'cv.profile.summary', 'rejected');
    history = undo(history);
    expect(history.present['cv.profile.summary']).toBeUndefined();
    history = redo(history);
    expect(history.present['cv.profile.summary']).toBe('rejected');
    history = undo(history);
    history = decide(history, 'cv.profile.summary', 'accepted');
    expect(history.future).toHaveLength(0);
  });
});

describe('save behaviour', () => {
  it('saves only accepted changes and leaves pending untouched', () => {
    let groups = buildChangeGroups(suggestions);
    const first = groups.find((group) => group.suggestionId === 's1');
    groups = setGroupStatus(groups, first.id, 'accepted');
    // s2 remains pending
    const decisions = decisionsFromGroups(groups);
    expect(decisions['cv.profile.summary']).toBe('pending');
    const updates = resolveUpdatesFromFieldDecisions(suggestions, decisions);
    const docs = applyFieldUpdates({
      cover: { paragraphs: ['I design medical devices.'] },
      cv: { profile: { summary: 'Product developer with MedTech experience.' } }
    }, updates);
    expect(docs.cover.paragraphs[0]).toBe('I design regulated medical devices.');
    expect(docs.cv.profile.summary).toBe('Product developer with MedTech experience.');
  });

  it('keeps cover and cv changes separated', () => {
    let groups = buildChangeGroups(suggestions);
    for (const group of groups) {
      if (group.documentType === 'cv') groups = setGroupStatus(groups, group.id, 'accepted');
    }
    const updates = resolveUpdatesFromFieldDecisions(suggestions, decisionsFromGroups(groups));
    expect(updates.every((item) => item.fieldPath.startsWith('cv.'))).toBe(true);
  });
});
