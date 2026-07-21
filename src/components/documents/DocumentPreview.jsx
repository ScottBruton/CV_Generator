import CoverDocument from './CoverDocument.jsx';
import CvDocument from './CvDocument.jsx';
import PortfolioDocument from './PortfolioDocument.jsx';

export default function DocumentPreview({
  activeDoc,
  cover,
  cv,
  portfolio,
  sharedProfile,
  versionIds
}) {
  if (activeDoc === 'cover' && !cover) {
    return <div className="shell-preview"><p>Loading cover…</p></div>;
  }
  if (activeDoc === 'cv' && !cv) {
    return <div className="shell-preview"><p>Loading CV…</p></div>;
  }
  if (activeDoc === 'portfolio' && !portfolio) {
    return <div className="shell-preview"><p>Loading portfolio…</p></div>;
  }

  return (
    <div className="shell-preview">
      <div className="shell-preview__doc">
        {activeDoc === 'cover' ? (
          <CoverDocument
            cover={cover}
            profile={sharedProfile || cv?.profile || {}}
            versionId={versionIds?.cover || cover?.id || 'default'}
          />
        ) : null}
        {activeDoc === 'cv' ? (
          <CvDocument content={cv} versionId={versionIds?.cv || cv?.meta?.id || 'default'} />
        ) : null}
        {activeDoc === 'portfolio' ? (
          <PortfolioDocument
            portfolio={portfolio}
            versionId={versionIds?.portfolio || portfolio?.id || 'default'}
          />
        ) : null}
      </div>
    </div>
  );
}
