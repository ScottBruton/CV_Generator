import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchBootstrap, fetchContent } from '../api/client';
import CoverDocument from '../components/documents/CoverDocument.jsx';
import CvDocument from '../components/documents/CvDocument.jsx';
import PortfolioDocument from '../components/documents/PortfolioDocument.jsx';

const MODE_VIEWS = {
  all: ['cover', 'cv', 'portfolio'],
  'cv-portfolio': ['cv', 'portfolio'],
  cover: ['cover'],
  cv: ['cv'],
  portfolio: ['portfolio']
};

export default function PrintApp() {
  const [params] = useSearchParams();
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');

  const mode = params.get('mode') || 'all';
  const views = MODE_VIEWS[mode] || MODE_VIEWS.all;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const bootstrap = await fetchBootstrap();
        const variantId = params.get('variant') || bootstrap.activeVariantId;
        const variant = (bootstrap.variants || []).find((item) => item.id === variantId) || bootstrap.activeVariant;
        if (!variant) throw new Error('Variant not found');

        const [cover, cv, portfolio, sharedProfile] = await Promise.all([
          fetchContent('cover', params.get('cover') || variant.coverId),
          fetchContent('cv', params.get('cv') || variant.cvId),
          fetchContent('portfolio', params.get('portfolio') || variant.portfolioId),
          fetchContent('shared-profile', 'shared')
        ]);

        if (!cancelled) {
          setBundle({
            variant,
            cover: cover.content,
            cv: cv.content,
            portfolio: portfolio.content,
            sharedProfile: sharedProfile.content
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [params]);

  useEffect(() => {
    if (!bundle) return undefined;
    document.body.classList.add('is-print-export', 'is-print-export-hq', 'print-root', 'app');

    const images = Array.from(document.querySelectorAll('img[src]'));
    Promise.all(images.map((img) => {
      img.loading = 'eager';
      if (img.complete && img.naturalWidth > 0) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })).then(() => document.fonts?.ready);

    return () => {
      document.body.classList.remove('is-print-export', 'is-print-export-hq', 'print-root');
    };
  }, [bundle]);

  if (error) return <p style={{ padding: 24 }}>Export failed: {error}</p>;
  if (!bundle) return <p style={{ padding: 24 }}>Preparing export…</p>;

  return (
    <main className="app-workspace" style={{ display: 'block', padding: 0 }}>
      {views.includes('cover') ? (
        <div className="app-view" data-view="cover" style={{ display: 'block' }}>
          <CoverDocument
            cover={bundle.cover}
            profile={bundle.sharedProfile || bundle.cv?.profile || {}}
            versionId={bundle.variant.coverId}
          />
        </div>
      ) : null}
      {views.includes('cv') ? (
        <div className="app-view" data-view="cv" style={{ display: 'block' }}>
          <CvDocument content={bundle.cv} versionId={bundle.variant.cvId} />
        </div>
      ) : null}
      {views.includes('portfolio') ? (
        <div className="app-view" data-view="portfolio" style={{ display: 'block' }}>
          <PortfolioDocument portfolio={bundle.portfolio} versionId={bundle.variant.portfolioId} />
        </div>
      ) : null}
    </main>
  );
}
