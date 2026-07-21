/**
 * Presentational Cover document (JSX port of cover-page structure).
 * Preview currently uses server-rendered HTML for fidelity; this component
 * is available for client-side rendering and future editor live preview.
 */
export default function CoverDocument({ cover, profile, versionId }) {
  if (!cover || !profile) return null;

  const senderName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  const email = (profile.contact || []).find((item) => item.type === 'email');
  const phone = (profile.contact || []).find((item) => item.type === 'phone');
  const location = (profile.contact || []).find((item) => item.type === 'location');
  const linkedin = (profile.contact || []).find((item) => item.type === 'linkedin');
  const recipient = String(cover.recipient || 'Hiring Manager').replace(/^Dear\s+/i, '');
  const hasLogo = Boolean(cover.companyLogo);

  return (
    <article className="page page--cover" id={`cover-${versionId}`} data-version={versionId} aria-label="Cover letter">
      <header className="cover__identity">
        <div className="cover__photo">
          {profile.photo?.src ? (
            <img src={`/${profile.photo.src.replace(/^\//, '')}`} alt={profile.photo.alt || ''} className="cover__photo-img" />
          ) : (
            <div className="cover__photo-placeholder" aria-label="Portrait photo placeholder">
              <span className="placeholder-label">{profile.photo?.alt || 'Photo'}</span>
            </div>
          )}
        </div>
        <div className="cover__identity-copy">
          <h1 className="cover__sender-name">
            <span className="cover__sender-first">{profile.firstName}</span>
            <span className="cover__sender-last">{profile.lastName}</span>
          </h1>
          <p className="cover__sender-title">{profile.title}</p>
        </div>
      </header>

      <section className="cover__application" aria-label="Application details">
        <div className="cover__company-mark">
          {hasLogo ? (
            <img className="cover__company-logo" src={`/${cover.companyLogo.replace(/^\//, '')}`} alt={`${cover.company || 'Company'} logo`} />
          ) : (
            <span className="cover__company-logo-fallback" aria-hidden="true">
              {(cover.company || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="cover__application-copy">
          <p className="cover__company-name">{cover.company || ''}</p>
          <p className="cover__position">{cover.subject || 'Application'}</p>
          <p className="cover__document-type">Cover Letter</p>
        </div>
      </section>

      <div className="cover__gradient-divider" aria-hidden="true" />

      <section className="cover__letter-card" aria-label="Cover letter body">
        <p className="cover__salutation">Dear {recipient},</p>
        {(cover.paragraphs || []).map((paragraph, index) => (
          <p className="cover__paragraph" key={index}>{paragraph}</p>
        ))}
        <p className="cover__closing">{cover.closing || 'Yours sincerely,'}</p>
        <p className="cover__signature">{senderName}</p>
      </section>

      <footer className="cover__contact-panel" aria-label="Contact information">
        <div className="cover__contact-items">
          <div className="cover__contact-item">
            <div className="cover__contact-copy">
              <span className="cover__contact-label">LinkedIn</span>
              {linkedin?.href ? <a className="cover__contact-link" href={linkedin.href}>{linkedin.value}</a> : <span className="cover__contact-value">{linkedin?.value}</span>}
            </div>
          </div>
          <div className="cover__contact-item">
            <div className="cover__contact-copy">
              <span className="cover__contact-label">Address</span>
              <span className="cover__contact-value">{location?.value}</span>
            </div>
          </div>
          <div className="cover__contact-item">
            <div className="cover__contact-copy">
              <span className="cover__contact-label">Phone</span>
              {phone?.href ? <a className="cover__contact-link" href={phone.href}>{phone.value}</a> : <span className="cover__contact-value">{phone?.value}</span>}
            </div>
          </div>
          <div className="cover__contact-item">
            <div className="cover__contact-copy">
              <span className="cover__contact-label">Email</span>
              {email?.href ? <a className="cover__contact-link" href={email.href}>{email.value}</a> : <span className="cover__contact-value">{email?.value}</span>}
            </div>
          </div>
        </div>
      </footer>
    </article>
  );
}
