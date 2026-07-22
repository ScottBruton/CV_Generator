import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { analyseJobSummary, tailorDocuments } from '../../api/client';
import { chipsByCategory } from '../../ai/focusChips.js';
import { applyFieldUpdates, createClientSnapshot } from '../../ai/documentFields.js';
import {
  buildChangeGroups,
  decisionsFromGroups,
  resolveUpdatesFromFieldDecisions,
  setGroupStatus
} from '../../ai/diffGroups.js';
import { countDecisions } from '../../ai/tailoringHistory.js';
import DiffText from './DiffText.jsx';
import { appendDebugLog } from '../../lib/debugLog.js';

const SOURCE_TABS = [
  { id: 'url', label: 'URL' },
  { id: 'pdf', label: 'PDF' },
  { id: 'text', label: 'Pasted text' }
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function JobSummaryView({ summary }) {
  if (!summary) return null;
  const rows = [
    ['Job title', summary.jobTitle],
    ['Company', summary.company],
    ['Seniority', summary.seniorityLevel],
    ['Role purpose', summary.rolePurpose],
    ['Location / arrangement', summary.locationOrWorkingArrangement]
  ];
  const lists = [
    ['Primary responsibilities', summary.primaryResponsibilities],
    ['Required technical skills', summary.requiredTechnicalSkills],
    ['Preferred technical skills', summary.preferredTechnicalSkills],
    ['Leadership / collaboration', summary.leadershipOrCollaboration],
    ['Industry / regulatory', summary.industryOrRegulatoryExperience],
    ['Tools / methods', summary.toolsTechnologiesMethodologies],
    ['Qualifications', summary.qualifications],
    ['Keywords', summary.recurringKeywords],
    ['ATS terms', summary.atsTerminology]
  ];

  return (
    <Box className="ai-summary" sx={{ mt: 2, p: 2, border: '1px solid #dde3ef', borderRadius: 2, bgcolor: '#fff' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Extracted job summary</Typography>
      {rows.map(([label, value]) => value ? (
        <Typography key={label} variant="body2" sx={{ mb: 0.5 }}>
          <strong>{label}:</strong> {value}
        </Typography>
      ) : null)}
      {lists.map(([label, items]) => (items?.length ? (
        <Box key={label} sx={{ mt: 1 }}>
          <Typography variant="body2"><strong>{label}</strong></Typography>
          <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem' }}>
            {items.map((item) => <li key={item}><Typography variant="body2" component="span">{item}</Typography></li>)}
          </ul>
        </Box>
      ) : null))}
    </Box>
  );
}

export default function AiTailoringDialog({
  open,
  onClose,
  cover,
  cv,
  onSaveDocuments
}) {
  const fileInputRef = useRef(null);
  const categories = useMemo(() => chipsByCategory(), []);

  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedChips, setSelectedChips] = useState(() => new Set());
  const [sourceTab, setSourceTab] = useState('text');
  const [urlValue, setUrlValue] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [jobSummary, setJobSummary] = useState(null);
  const [useJobSummary, setUseJobSummary] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState(null);
  const [analysing, setAnalysing] = useState(false);

  const [snapshot, setSnapshot] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [groups, setGroups] = useState([]);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [reviewTab, setReviewTab] = useState('cover');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    setGenerateError('');
    setSaveError('');
    setSaveSuccess('');
  }, [open]);

  const canGenerate = Boolean(
    customInstructions.trim()
    || selectedChips.size
    || (useJobSummary && jobSummary)
  );

  const fieldDecisions = useMemo(() => decisionsFromGroups(groups), [groups]);
  const counts = useMemo(() => {
    const values = Object.values(fieldDecisions);
    if (!values.length && suggestions.length) {
      return { accepted: 0, rejected: 0, pending: suggestions.length };
    }
    return countDecisions(
      Object.fromEntries(suggestions.map((item) => [item.fieldPath, fieldDecisions[item.fieldPath] || 'pending']))
    );
  }, [fieldDecisions, suggestions]);

  const pendingGroups = groups.filter((group) => group.status === 'pending');
  const activeGroup = groups[activeGroupIndex] || pendingGroups[0] || groups[0] || null;

  function toggleChip(id) {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearJobSource() {
    setJobSummary(null);
    setUseJobSummary(false);
    setAnalyseStatus(null);
    setPdfFile(null);
  }

  async function runAnalysis() {
    setAnalysing(true);
    setAnalyseStatus(null);
    setJobSummary(null);
    setUseJobSummary(false);
    try {
      let payload;
      if (sourceTab === 'url') {
        if (!isValidHttpUrl(urlValue.trim())) {
          throw new Error('Enter a valid http(s) URL.');
        }
        payload = { source: 'url', url: urlValue.trim() };
      } else if (sourceTab === 'pdf') {
        if (!pdfFile) throw new Error('Choose a PDF file first.');
        if (pdfFile.type !== 'application/pdf') throw new Error('Only PDF files are accepted.');
        if (pdfFile.size > 6 * 1024 * 1024) throw new Error('PDF must be 6MB or smaller.');
        const dataUrl = await readFileAsDataUrl(pdfFile);
        payload = { source: 'pdf', pdfBase64: dataUrl, filename: pdfFile.name };
      } else {
        if (pasteText.trim().length < 280) {
          throw new Error('Pasted text is too short to analyse (minimum 280 characters).');
        }
        payload = { source: 'text', text: pasteText };
      }

      const result = await analyseJobSummary(payload);
      setJobSummary(result.jobSummary);
      setUseJobSummary(true);
      setAnalyseStatus({
        severity: result.warning ? 'warning' : 'success',
        message: result.warning
          ? `Job summary extracted with caveats: ${result.warning}`
          : 'Job summary extracted.'
      });
    } catch (error) {
      const message = error.message || 'Job analysis failed.';
      appendDebugLog('error', ['AI job-summary', message]);
      setAnalyseStatus({ severity: 'error', message });
    } finally {
      setAnalysing(false);
    }
  }

  function pushGroups(nextGroups) {
    setHistoryPast((past) => [...past, groups]);
    setHistoryFuture([]);
    setGroups(nextGroups);
  }

  function handleAccept(groupId) {
    pushGroups(setGroupStatus(groups, groupId, 'accepted'));
  }

  function handleReject(groupId) {
    pushGroups(setGroupStatus(groups, groupId, 'rejected'));
  }

  function handleUndo() {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) => [groups, ...future]);
    setGroups(previous);
  }

  function handleRedo() {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryFuture((future) => future.slice(1));
    setHistoryPast((past) => [...past, groups]);
    setGroups(next);
  }

  async function handleGenerate() {
    if (groups.some((group) => group.status !== 'pending') || suggestions.length) {
      const proceed = window.confirm('Starting a new generation will discard the current review session. Continue?');
      if (!proceed) return;
    }

    setGenerating(true);
    setGenerateError('');
    setSaveSuccess('');
    try {
      const nextSnapshot = createClientSnapshot(cover, cv);
      const result = await tailorDocuments({
        documentSnapshotId: nextSnapshot.documentSnapshotId,
        cover: nextSnapshot.cover,
        cv: nextSnapshot.cv,
        fields: nextSnapshot.fields,
        focusChipIds: [...selectedChips],
        customInstructions,
        useJobSummary: Boolean(useJobSummary && jobSummary),
        jobSummary: useJobSummary ? jobSummary : null
      });

      const nextGroups = buildChangeGroups(result.suggestions || []);
      setSnapshot(nextSnapshot);
      setSuggestions(result.suggestions || []);
      setWarnings(result.warnings || []);
      setGroups(nextGroups);
      setHistoryPast([]);
      setHistoryFuture([]);
      setActiveGroupIndex(0);
      setReviewTab('cover');
      if (!(result.suggestions || []).length) {
        setGenerateError('No material text changes were proposed. Adjust focus or instructions and try again.');
      }
    } catch (error) {
      const message = error.message || 'Tailoring failed.';
      appendDebugLog('error', ['AI tailor', message]);
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!snapshot || !counts.accepted) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      // Re-validate originals still match live docs
      const liveSnapshot = createClientSnapshot(cover, cv);
      for (const suggestion of suggestions) {
        if (fieldDecisions[suggestion.fieldPath] !== 'accepted') continue;
        const liveField = liveSnapshot.fields.find((field) => field.fieldPath === suggestion.fieldPath);
        if (!liveField || liveField.text !== suggestion.originalText) {
          throw new Error('Document changed since generation. Re-generate before saving.');
        }
      }

      const updates = resolveUpdatesFromFieldDecisions(suggestions, fieldDecisions);
      if (!updates.length) throw new Error('No accepted changes to save.');

      const nextDocs = applyFieldUpdates({ cover: snapshot.cover, cv: snapshot.cv }, updates);
      await onSaveDocuments(nextDocs);
      setSaveSuccess('Accepted changes saved.');
      onClose({ saved: true });
    } catch (error) {
      setSaveError(error.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    const dirty = groups.some((group) => group.status !== 'pending') || suggestions.length;
    if (dirty) {
      const proceed = window.confirm('Discard the current AI tailoring session? Live documents will remain unchanged.');
      if (!proceed) return;
    }
    onClose({ saved: false });
  }

  const reviewSuggestions = suggestions.filter((item) => item.documentType === reviewTab);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      aria-labelledby="ai-tailoring-title"
    >
      <DialogTitle id="ai-tailoring-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <AutoAwesomeIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">AI Tailored</Typography>
          <Typography variant="body2" color="text.secondary">
            Propose text changes only — layout stays unchanged. Nothing is saved until you click Save changes.
          </Typography>
        </Box>
        <IconButton aria-label="Close AI Tailoring" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {(analysing || generating || saving) ? <LinearProgress /> : null}

      <DialogContent dividers sx={{ bgcolor: '#f7f8fb' }}>
        <Stack spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>1. Tailoring instructions</Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              placeholder="Optional: emphasise leadership, more technical language, reduce repetition…"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>2. Tailoring focus</Typography>
            <Typography variant="caption" color="text.secondary">Role focus</Typography>
            <Stack direction="row" gap={1} sx={{ my: 1, flexWrap: 'wrap' }}>
              {categories.role.map((chip) => (
                <Chip
                  key={chip.id}
                  label={chip.label}
                  color={selectedChips.has(chip.id) ? 'primary' : 'default'}
                  variant={selectedChips.has(chip.id) ? 'filled' : 'outlined'}
                  onClick={() => toggleChip(chip.id)}
                  aria-pressed={selectedChips.has(chip.id)}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">Industry and capability focus</Typography>
            <Stack direction="row" gap={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {categories.capability.map((chip) => (
                <Chip
                  key={chip.id}
                  label={chip.label}
                  color={selectedChips.has(chip.id) ? 'primary' : 'default'}
                  variant={selectedChips.has(chip.id) ? 'filled' : 'outlined'}
                  onClick={() => toggleChip(chip.id)}
                  aria-pressed={selectedChips.has(chip.id)}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>3. Job advertisement</Typography>
            <Tabs value={sourceTab} onChange={(_, value) => setSourceTab(value)} aria-label="Job source">
              {SOURCE_TABS.map((tab) => <Tab key={tab.id} value={tab.id} label={tab.label} />)}
            </Tabs>
            <Box sx={{ mt: 2 }}>
              {sourceTab === 'url' ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    label="Job URL"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    error={Boolean(urlValue) && !isValidHttpUrl(urlValue.trim())}
                    helperText={urlValue && !isValidHttpUrl(urlValue.trim()) ? 'Enter a valid http(s) URL' : ' '}
                  />
                  <Button variant="contained" onClick={runAnalysis} disabled={analysing || !urlValue.trim()}>
                    Extract role
                  </Button>
                </Stack>
              ) : null}

              {sourceTab === 'pdf' ? (
                <Stack spacing={1}>
                  <Box
                    className="ai-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) setPdfFile(file);
                    }}
                    sx={{
                      border: '1px dashed #93a4c7',
                      borderRadius: 2,
                      p: 3,
                      textAlign: 'center',
                      bgcolor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="body2">
                      {pdfFile ? pdfFile.name : 'Drop a PDF here or click to browse'}
                    </Typography>
                    <input
                      ref={fileInputRef}
                      hidden
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </Box>
                  <Button variant="contained" onClick={runAnalysis} disabled={analysing || !pdfFile}>
                    Extract from PDF
                  </Button>
                </Stack>
              ) : null}

              {sourceTab === 'text' ? (
                <Stack spacing={1}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    label="Paste job advertisement"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    helperText={
                      pasteText.trim().length < 280
                        ? `${pasteText.trim().length} / 280 characters minimum — paste a bit more of the advert`
                        : `${pasteText.trim().length} characters — ready to analyse`
                    }
                    error={Boolean(pasteText) && pasteText.trim().length < 280}
                  />
                  <Alert severity="info">
                    After pasting, click <strong>Analyse role</strong> below. <strong>Save changes</strong> stays disabled until you generate and accept tailored edits.
                  </Alert>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={runAnalysis}
                    disabled={analysing || pasteText.trim().length < 280}
                  >
                    {analysing ? 'Analysing…' : 'Analyse role'}
                  </Button>
                </Stack>
              ) : null}
            </Box>

            {analyseStatus ? <Alert sx={{ mt: 2 }} severity={analyseStatus.severity}>{analyseStatus.message}</Alert> : null}
            {analysing ? <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}><CircularProgress size={18} /><Typography variant="body2">Analysing…</Typography></Stack> : null}

            <JobSummaryView summary={jobSummary} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
              <FormControlLabel
                control={(
                  <Switch
                    checked={Boolean(useJobSummary && jobSummary)}
                    disabled={!jobSummary}
                    onChange={(e) => setUseJobSummary(e.target.checked)}
                    slotProps={{ input: { 'aria-label': 'Use job summary when tailoring' } }}
                  />
                )}
                label="Use job summary when tailoring"
              />
              <Button color="inherit" onClick={clearJobSource} disabled={!jobSummary && !pdfFile && !urlValue && !pasteText}>
                Clear job source
              </Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>4. Generate tailored version</Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              disabled={!canGenerate || generating}
              onClick={handleGenerate}
            >
              Generate tailored version
            </Button>
            {generateError ? <Alert sx={{ mt: 2 }} severity="warning">{generateError}</Alert> : null}
            {warnings.length ? (
              <Alert sx={{ mt: 2 }} severity="info">
                {warnings.slice(0, 6).map((warning) => <div key={warning}>{warning}</div>)}
              </Alert>
            ) : null}
          </Box>

          {suggestions.length ? (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>5. Change review</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
                <Typography variant="body2">
                  Accepted {counts.accepted} · Rejected {counts.rejected} · Pending {counts.pending}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button onClick={handleUndo} disabled={!historyPast.length}>Undo</Button>
                <Button onClick={handleRedo} disabled={!historyFuture.length}>Redo</Button>
                <Button
                  onClick={() => setActiveGroupIndex((index) => Math.max(0, index - 1))}
                  disabled={activeGroupIndex <= 0}
                >
                  Previous change
                </Button>
                <Button
                  onClick={() => setActiveGroupIndex((index) => Math.min(groups.length - 1, index + 1))}
                  disabled={activeGroupIndex >= groups.length - 1}
                >
                  Next change
                </Button>
              </Stack>

              {activeGroup ? (
                <Alert
                  sx={{ mb: 2 }}
                  severity={activeGroup.status === 'accepted' ? 'success' : activeGroup.status === 'rejected' ? 'warning' : 'info'}
                  action={(
                    <Stack direction="row" spacing={1}>
                      <Button color="inherit" onClick={() => handleAccept(activeGroup.id)} aria-label="Accept change">Accept</Button>
                      <Button color="inherit" onClick={() => handleReject(activeGroup.id)} aria-label="Reject change">Reject</Button>
                    </Stack>
                  )}
                >
                  <strong>{activeGroup.type}</strong> · {activeGroup.fieldPath}
                  {activeGroup.reason ? ` — ${activeGroup.reason}` : ''}
                  {' '}[{activeGroup.status}]
                </Alert>
              ) : null}

              <Tabs value={reviewTab} onChange={(_, value) => setReviewTab(value)} aria-label="Review document">
                <Tab value="cover" label="Cover Letter" />
                <Tab value="cv" label="CV" />
              </Tabs>

              <Stack spacing={2} sx={{ mt: 2 }}>
                {reviewSuggestions.length ? reviewSuggestions.map((suggestion) => {
                  const decision = fieldDecisions[suggestion.fieldPath] || 'pending';
                  const showProposed = decision !== 'rejected';
                  return (
                    <Box
                      key={suggestion.id}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        border: activeGroup?.fieldPath === suggestion.fieldPath ? '2px solid #2f5bff' : '1px solid #dde3ef',
                        bgcolor: '#fff'
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">Original · {suggestion.label || suggestion.fieldPath}</Typography>
                        <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                          <DiffText originalText={suggestion.originalText} proposedText={suggestion.proposedText} mode="original" />
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Tailored · {decision}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                          {showProposed ? (
                            <DiffText originalText={suggestion.originalText} proposedText={suggestion.proposedText} mode="proposed" />
                          ) : suggestion.originalText}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Button size="small" variant="contained" color="success" onClick={() => {
                            const group = groups.find((item) => item.suggestionId === suggestion.id);
                            if (group) handleAccept(group.id);
                          }}>
                            Accept
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => {
                            const group = groups.find((item) => item.suggestionId === suggestion.id);
                            if (group) handleReject(group.id);
                          }}>
                            Reject
                          </Button>
                        </Stack>
                      </Box>
                    </Box>
                  );
                }) : (
                  <Typography variant="body2" color="text.secondary">No {reviewTab === 'cover' ? 'cover letter' : 'CV'} suggestions.</Typography>
                )}
              </Stack>
            </Box>
          ) : null}

          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
          {saveSuccess ? <Alert severity="success">{saveSuccess}</Alert> : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justify: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          {counts.accepted
            ? `${counts.accepted} accepted change(s) ready to save.`
            : 'Workflow: Analyse role → Generate tailored version → Accept edits → Save changes.'}
        </Typography>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!counts.accepted || saving}
          onClick={handleSave}
          title={!counts.accepted ? 'Accept at least one tailored change before saving' : 'Save accepted changes to Cover and CV'}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
