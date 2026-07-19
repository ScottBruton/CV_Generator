'use strict';

(function initApp() {
  const DOC_LABELS = {
    cover: 'Cover Letter',
    cv: 'CV',
    portfolio: 'Portfolio'
  };

  const state = {
    view: 'cv',
    versions: {
      cover: 'default',
      cv: 'default',
      portfolio: 'default'
    }
  };

  const workspace = document.querySelector('.app-workspace');
  const activeLabel = document.getElementById('app-active-label');
  const previewRoot = document.getElementById('app-preview');
  const previewBody = document.getElementById('app-preview-body');
  const previewBtn = document.getElementById('app-preview-btn');
  const exportBtn = document.getElementById('app-export-btn');
  const closePreviewBtn = document.getElementById('app-preview-close');

  if (!workspace) return;

  function getViewElement(view) {
    return document.querySelector(`.app-view[data-view="${view}"]`);
  }

  function getSelectedLabel(view, versionId) {
    const option = document.querySelector(
      `.app-dropdown[data-doc="${view}"] .app-dropdown__option[data-version="${versionId}"]`
    );
    return option ? option.textContent.trim() : versionId;
  }

  function updateDropdownSelections() {
    Object.keys(DOC_LABELS).forEach((view) => {
      const versionLabel = getSelectedLabel(view, state.versions[view]);
      const selectionEl = document.querySelector(`[data-dropdown-selection="${view}"]`);
      if (selectionEl) {
        selectionEl.textContent = versionLabel;
      }

      const dropdown = document.querySelector(`.app-dropdown[data-doc="${view}"]`);
      dropdown?.classList.toggle('is-view-active', state.view === view);
    });
  }

  function updateExportLabel() {
    if (!activeLabel) return;
    const parts = Object.keys(DOC_LABELS).map((view) => {
      const versionLabel = getSelectedLabel(view, state.versions[view]);
      return `${DOC_LABELS[view]}: ${versionLabel}`;
    });
    activeLabel.textContent = `Export — ${parts.join(' · ')}`;
  }

  function updateSelectionUi() {
    document.querySelectorAll('.app-dropdown__option').forEach((option) => {
      const optionView = option.dataset.view;
      const optionVersion = option.dataset.version;
      option.classList.toggle(
        'is-selected',
        optionVersion === state.versions[optionView]
      );
      option.setAttribute('aria-selected', optionVersion === state.versions[optionView] ? 'true' : 'false');
    });

    updateDropdownSelections();
    updateExportLabel();
  }

  function setActiveView(view, versionId) {
    if (!DOC_LABELS[view]) return;

    state.view = view;
    if (versionId) {
      state.versions[view] = versionId;
    }

    document.querySelectorAll('.app-view').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.view === view);
    });

    updateSelectionUi();
  }

  function closeDropdowns() {
    document.querySelectorAll('.app-dropdown.is-open').forEach((dropdown) => {
      dropdown.classList.remove('is-open');
      dropdown.querySelector('.app-dropdown__trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  function initDropdowns() {
    document.querySelectorAll('.app-dropdown').forEach((dropdown) => {
      const trigger = dropdown.querySelector('.app-dropdown__trigger');
      const menu = dropdown.querySelector('.app-dropdown__menu');

      trigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = dropdown.classList.contains('is-open');
        closeDropdowns();
        if (!isOpen) {
          dropdown.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      menu?.addEventListener('click', (event) => {
        const option = event.target.closest('.app-dropdown__option');
        if (!option) return;
        const view = option.dataset.view;
        const versionId = option.dataset.version;
        setActiveView(view, versionId);
        closeDropdowns();
      });
    });

    document.addEventListener('click', closeDropdowns);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdowns();
        closePreview();
      }
    });
  }

  function collectPages(view) {
    const viewEl = getViewElement(view);
    if (!viewEl) return [];
    return Array.from(viewEl.querySelectorAll('.page'));
  }

  function clonePages(pages) {
    return pages.map((page) => page.cloneNode(true));
  }

  function buildCombinedPages() {
    return [
      ...collectPages('cover'),
      ...collectPages('cv'),
      ...collectPages('portfolio')
    ];
  }

  function renderPreview() {
    if (!previewBody) return;
    previewBody.innerHTML = '';

    const sections = [
      { view: 'cover', label: 'Cover Letter' },
      { view: 'cv', label: 'CV' },
      { view: 'portfolio', label: 'Portfolio' }
    ];

    sections.forEach(({ view, label }) => {
      const pages = collectPages(view);
      if (!pages.length) return;

      const heading = document.createElement('div');
      heading.className = 'app-preview__section-label';
      heading.textContent = label;
      previewBody.appendChild(heading);

      clonePages(pages).forEach((page) => {
        previewBody.appendChild(page);
      });
    });
  }

  function openPreview() {
    if (!previewRoot) return;
    renderPreview();
    previewRoot.classList.add('is-open');
    previewRoot.setAttribute('aria-hidden', 'false');
  }

  function closePreview() {
    if (!previewRoot) return;
    previewRoot.classList.remove('is-open');
    previewRoot.setAttribute('aria-hidden', 'true');
  }

  async function preloadExportImages() {
    const views = ['cover', 'cv', 'portfolio'];
    const images = views.flatMap((view) =>
      Array.from(document.querySelectorAll(`.app-view[data-view="${view}"] img[src]`))
    );

    await Promise.all(images.map((img) => {
      img.loading = 'eager';

      if (img.complete && img.naturalWidth > 0) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }

      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        const src = img.getAttribute('src');
        if (src) {
          img.src = src;
        }
      });
    }));
  }

  async function exportPdf() {
    const pages = buildCombinedPages();
    if (!pages.length) {
      window.alert('Nothing to export.');
      return;
    }

    exportBtn.disabled = true;
    exportBtn.textContent = 'Preparing…';

    try {
      await preloadExportImages();
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      document.body.classList.add('is-print-export');
      window.print();
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export PDF';
    }
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('is-print-export');
  });

  previewBtn?.addEventListener('click', openPreview);
  closePreviewBtn?.addEventListener('click', closePreview);
  exportBtn?.addEventListener('click', exportPdf);

  initDropdowns();
  setActiveView('cv', 'default');
})();
