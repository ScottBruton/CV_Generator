import CoverDocument from './CoverDocument.jsx';
import CvDocument from './CvDocument.jsx';
import PortfolioDocument from './PortfolioDocument.jsx';
import CareerPathDocument from './CareerPathDocument.jsx';
import EducationDocument from './EducationDocument.jsx';

export default function DocumentPreview({
  activeDoc,
  cover,
  cv,
  portfolio,
  careerPath,
  education,
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
  if (activeDoc === 'career-path' && !careerPath) {
    return <div className="shell-preview"><p>Loading career path…</p></div>;
  }
  if (activeDoc === 'education' && !education) {
    return <div className="shell-preview"><p>Loading education…</p></div>;
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
        {activeDoc === 'career-path' ? (
          <CareerPathDocument
            content={careerPath}
            versionId={versionIds?.careerPath || careerPath?.id || 'default'}
          />
        ) : null}
        {activeDoc === 'education' ? (
          <EducationDocument
            content={education}
            versionId={versionIds?.education || education?.id || 'default'}
          />
        ) : null}
      </div>
    </div>
  );
}
