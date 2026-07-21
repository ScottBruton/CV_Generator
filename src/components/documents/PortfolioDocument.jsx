function PortfolioItem({ item }) {
  const images = (item.images || []).filter(Boolean);
  if (!images.length) return null;

  const layout = item.layout === 'full' || item.layout === 'half-centered' ? item.layout : 'half';
  let mediaClass = '';
  if (images.length >= 4) mediaClass = ' portfolio-item__media--quad';
  else if (images.length > 1) mediaClass = ' portfolio-item__media--multi';

  return (
    <article className={`portfolio-item portfolio-item--${layout}`} id={item.id || undefined}>
      <div className="portfolio-item__inner">
        <header className="portfolio-item__header">
          <h2 className="portfolio-item__title">{item.title}</h2>
          {item.subtitle ? <p className="portfolio-item__subtitle">{item.subtitle}</p> : null}
        </header>
        <div className={`portfolio-item__media${mediaClass}`}>
          {images.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={`/${String(src).replace(/^\//, '')}`}
              alt={`${item.title} — image ${index + 1}`}
              className="portfolio-item__image"
              loading="eager"
              decoding="async"
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function PortfolioDocument({ portfolio, versionId }) {
  if (!portfolio) return null;
  const sheets = Array.isArray(portfolio.sheets)
    ? portfolio.sheets
    : [{ items: portfolio.items || [] }];

  return (
    <div className="portfolio-version" data-version={versionId}>
      {sheets.map((sheet, sheetIndex) => {
        const items = (sheet.items || []).map((item) => (
          <PortfolioItem key={item.id || item.title} item={item} />
        )).filter(Boolean);
        if (!items.length) return null;
        const sheetId = sheetIndex === 0
          ? `portfolio-${versionId}`
          : `portfolio-${versionId}-${sheetIndex + 1}`;
        return (
          <article className="page page--portfolio" id={sheetId} data-version={versionId} aria-label="Portfolio" key={sheetId}>
            <header className="portfolio-header">
              <a href="#cv" className="portfolio-header__back">↑ CV</a>
              <div className="portfolio-header__title-wrap">
                <p className="portfolio-header__eyebrow">Selected Engineering Work</p>
                <h1 className="portfolio-header__title">
                  <span className="portfolio-header__title-word portfolio-header__title-word--dark">Product</span>
                  <span className="portfolio-header__title-word portfolio-header__title-word--blue">Portfolio</span>
                </h1>
                <p className="portfolio-header__subtitle">
                  <span>Medical Devices</span>
                  <span className="portfolio-header__sep portfolio-header__sep--blue" aria-hidden="true">•</span>
                  <span>Mechatronics</span>
                  <span className="portfolio-header__sep portfolio-header__sep--purple" aria-hidden="true">•</span>
                  <span>Product Development</span>
                </p>
              </div>
            </header>
            <div className="portfolio-grid">{items}</div>
          </article>
        );
      })}
    </div>
  );
}
