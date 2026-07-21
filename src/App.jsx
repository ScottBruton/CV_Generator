import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import {
  createVariant,
  exportPdf,
  fetchBootstrap,
  fetchContent,
  saveContent,
  setActiveVariant
} from './api/client';
import DocTabs from './components/shell/DocTabs.jsx';
import VariantDrawer from './components/shell/VariantDrawer.jsx';
import AddVariantDialog from './components/shell/AddVariantDialog.jsx';
import DocumentPreview from './components/documents/DocumentPreview.jsx';
import CoverEditor from './components/editors/CoverEditor.jsx';
import CvEditor from './components/editors/CvEditor.jsx';
import PortfolioEditor from './components/editors/PortfolioEditor.jsx';
import CareerPathEditor from './components/editors/CareerPathEditor.jsx';
import JsonEditor from './components/editors/JsonEditor.jsx';
import ExportDialog from './components/export/ExportDialog.jsx';
import PrintApp from './print/PrintApp.jsx';

function saveKindForDoc(doc) {
  if (doc === 'cover') return 'cover';
  if (doc === 'portfolio') return 'portfolio';
  if (doc === 'career-path') return 'career-path';
  return 'cv';
}

function EditorShell() {
  const [bootstrap, setBootstrap] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState('cv');
  const [editorMode, setEditorMode] = useState('fields');
  const [editorOpen, setEditorOpen] = useState(true);
  const [coverContent, setCoverContent] = useState(null);
  const [cvContent, setCvContent] = useState(null);
  const [portfolioContent, setPortfolioContent] = useState(null);
  const [careerPathContent, setCareerPathContent] = useState(null);
  const [sharedProfile, setSharedProfile] = useState(null);
  const [editContent, setEditContent] = useState(null);
  const [status, setStatus] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activeVariant = bootstrap?.activeVariant || null;

  const loadVariantBundle = useCallback(async (variant) => {
    const [cover, cv, portfolio, careerPath, shared] = await Promise.all([
      fetchContent('cover', variant.coverId),
      fetchContent('cv', variant.cvId),
      fetchContent('portfolio', variant.portfolioId),
      fetchContent('career-path', variant.careerPathId || 'default'),
      fetchContent('shared-profile', 'shared')
    ]);
    setCoverContent(cover.content);
    setCvContent(cv.content);
    setPortfolioContent(portfolio.content);
    setCareerPathContent(careerPath.content);
    setSharedProfile(shared.content);
    return {
      cover: cover.content,
      cv: cv.content,
      portfolio: portfolio.content,
      careerPath: careerPath.content
    };
  }, []);

  const syncEditorForDoc = useCallback((doc, bundle) => {
    if (doc === 'cover') setEditContent(bundle.cover);
    else if (doc === 'portfolio') setEditContent(bundle.portfolio);
    else if (doc === 'career-path') setEditContent(bundle.careerPath);
    else setEditContent(bundle.cv);
  }, []);

  const refresh = useCallback(async (nextBootstrap) => {
    const data = nextBootstrap || await fetchBootstrap();
    setBootstrap(data);
    const variant = data.activeVariant;
    if (!variant) return;
    const bundle = await loadVariantBundle(variant);
    syncEditorForDoc(activeDoc, bundle);
  }, [activeDoc, loadVariantBundle, syncEditorForDoc]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  useEffect(() => {
    if (!coverContent && !cvContent && !portfolioContent && !careerPathContent) return;
    syncEditorForDoc(activeDoc, {
      cover: coverContent,
      cv: cvContent,
      portfolio: portfolioContent,
      careerPath: careerPathContent
    });
  }, [activeDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setAddOpen(false);
        setExportOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const labels = useMemo(() => ({
    cover: coverContent?.label || bootstrap?.catalog?.covers?.find((item) => item.id === activeVariant?.coverId)?.label || 'Cover Letter',
    cv: cvContent?.meta?.label || bootstrap?.catalog?.cvs?.find((item) => item.id === activeVariant?.cvId)?.label || 'CV',
    portfolio: portfolioContent?.label || bootstrap?.catalog?.portfolios?.find((item) => item.id === activeVariant?.portfolioId)?.label || 'Portfolio',
    careerPath: 'Career Path'
  }), [activeVariant, bootstrap, coverContent, cvContent, portfolioContent]);

  const previewCover = activeDoc === 'cover' && editContent ? editContent : coverContent;
  const previewCv = activeDoc === 'cv' && editContent ? editContent : cvContent;
  const previewPortfolio = activeDoc === 'portfolio' && editContent ? editContent : portfolioContent;
  const previewCareerPath = activeDoc === 'career-path' && editContent ? editContent : careerPathContent;

  async function handleSelectVariant(id) {
    setBusy(true);
    setStatus(null);
    try {
      const data = await setActiveVariant(id);
      setDrawerOpen(false);
      await refresh(data.bootstrap);
    } catch (err) {
      setStatus({ error: true, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateVariant(payload) {
    setBusy(true);
    try {
      const data = await createVariant(payload);
      setAddOpen(false);
      setDrawerOpen(false);
      await refresh(data.bootstrap);
      setStatus({ message: `Created variant “${data.variant.label}”.` });
    } catch (err) {
      setStatus({ error: true, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(kind, content) {
    if (!activeVariant) return;
    setBusy(true);
    setStatus(null);
    try {
      const id = kind === 'cover'
        ? activeVariant.coverId
        : kind === 'portfolio'
          ? activeVariant.portfolioId
          : kind === 'career-path'
            ? (activeVariant.careerPathId || 'default')
            : activeVariant.cvId;
      const saved = await saveContent(kind, id, content);
      if (kind === 'cover') {
        setCoverContent(saved.content);
        setEditContent(saved.content);
      } else if (kind === 'portfolio') {
        setPortfolioContent(saved.content);
        setEditContent(saved.content);
      } else if (kind === 'career-path') {
        setCareerPathContent(saved.content);
        setEditContent(saved.content);
      } else {
        setCvContent(saved.content);
        setEditContent(saved.content);
      }
      const boot = await fetchBootstrap();
      setBootstrap(boot);
      setStatus({ message: 'Saved.' });
    } catch (err) {
      setStatus({ error: true, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  function handleEditorChange(next) {
    setEditContent(next);
  }

  async function handleExport(mode) {
    if (!activeVariant) return;
    setBusy(true);
    try {
      const blob = await exportPdf({
        mode,
        variantId: activeVariant.id,
        coverId: activeVariant.coverId,
        cvId: activeVariant.cvId,
        portfolioId: activeVariant.portfolioId
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Scott-Bruton-${activeVariant.label.replace(/\s+/g, '-')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err) {
      console.warn('Export server failed, falling back to print', err);
      window.open(`/print?variant=${encodeURIComponent(activeVariant.id)}&mode=${encodeURIComponent(mode)}`, '_blank');
      setExportOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>CV Generator</h1>
        <p>Could not reach the API on port 3001. Start the app with start.bat / npm start.</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!bootstrap || !activeVariant) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <button type="button" className="shell-burger" aria-label="Open variants menu" onClick={() => setDrawerOpen(true)}>
          <span /><span /><span />
        </button>
        <div className="shell-brand">
          <span className="shell-brand__title">CV Generator</span>
          <span className="shell-brand__variant">{activeVariant.label}</span>
        </div>
        <div className="shell-header__actions">
          <button
            type="button"
            className="shell-btn shell-btn--secondary"
            onClick={() => setEditorOpen((open) => !open)}
            aria-pressed={editorOpen}
            aria-controls="shell-editor-panel"
          >
            {editorOpen ? 'Hide editor' : 'Show editor'}
          </button>
          {editorOpen ? (
            <button
              type="button"
              className="shell-btn shell-btn--secondary"
              onClick={() => setEditorMode((mode) => (mode === 'fields' ? 'json' : 'fields'))}
            >
              {editorMode === 'fields' ? 'Advanced JSON' : 'Structured edit'}
            </button>
          ) : null}
          <button type="button" className="shell-btn shell-btn--secondary" onClick={() => setExportOpen(true)} disabled={busy}>
            Export PDF
          </button>
        </div>
      </header>

      <DocTabs labels={labels} activeDoc={activeDoc} onChange={setActiveDoc} />

      <div className={`shell-workspace${editorOpen ? '' : ' shell-workspace--editor-collapsed'}`}>
        <DocumentPreview
          activeDoc={activeDoc}
          cover={previewCover}
          cv={previewCv}
          portfolio={previewPortfolio}
          careerPath={previewCareerPath}
          sharedProfile={sharedProfile}
          versionIds={{
            cover: activeVariant.coverId,
            cv: activeVariant.cvId,
            portfolio: activeVariant.portfolioId,
            careerPath: activeVariant.careerPathId || 'default'
          }}
        />
        {editorOpen ? (
          <aside className="shell-editor" id="shell-editor-panel">
            <div className="shell-editor__toolbar">
              <button
                type="button"
                className="shell-btn shell-btn--tiny"
                onClick={() => setEditorOpen(false)}
                aria-label="Collapse editor"
              >
                Collapse
              </button>
            </div>
            {editorMode === 'json' ? (
              <JsonEditor
                content={editContent}
                status={status}
                onSave={(content) => handleSave(saveKindForDoc(activeDoc), content)}
              />
            ) : activeDoc === 'cover' ? (
              <CoverEditor
                content={editContent}
                status={status}
                onSave={(content) => handleSave('cover', content)}
                onChange={handleEditorChange}
              />
            ) : activeDoc === 'portfolio' ? (
              <PortfolioEditor
                content={editContent}
                status={status}
                onSave={(content) => handleSave('portfolio', content)}
                onChange={handleEditorChange}
              />
            ) : activeDoc === 'career-path' ? (
              <CareerPathEditor
                content={editContent}
                status={status}
                onSave={(content) => handleSave('career-path', content)}
                onChange={handleEditorChange}
              />
            ) : (
              <CvEditor
                content={editContent}
                status={status}
                onSave={(content) => handleSave('cv', content)}
                onChange={handleEditorChange}
              />
            )}
          </aside>
        ) : null}
      </div>

      <VariantDrawer
        open={drawerOpen}
        variants={bootstrap.variants || []}
        activeVariantId={activeVariant.id}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleSelectVariant}
        onAdd={() => setAddOpen(true)}
      />

      <AddVariantDialog
        open={addOpen}
        variants={bootstrap.variants || []}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreateVariant}
      />

      <ExportDialog
        open={exportOpen}
        busy={busy}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/print" element={<PrintApp />} />
      <Route path="/*" element={<EditorShell />} />
    </Routes>
  );
}
