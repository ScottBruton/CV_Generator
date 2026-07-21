import { Icon } from '../../lib/icons.jsx';
import { assetUrl, formatTimelineDateRange, lineText } from '../../lib/content.js';

function PillarLineContent({ entry }) {
  const data = typeof entry === 'string' ? { text: entry } : entry || {};
  const text = data.text || '';
  const classPart = data.class ? <span className="pillar__body-class"> (Class {data.class})</span> : null;
  const mark = data.endToEnd ? <span className="pillar__body-mark">*</span> : null;
  const inner = <>{text}{classPart}{mark}</>;

  if (data.href) {
    return <a className="pillar__body-link" href={data.href}>{inner}</a>;
  }
  return inner;
}

function bodyHasEndToEnd(body = []) {
  return body.some((entry) => {
    if (!entry || typeof entry === 'string') return false;
    if (entry.endToEnd) return true;
    return (entry.bullets || []).some((bullet) => (typeof bullet === 'object' ? bullet.endToEnd : false));
  });
}

function PillarBody({ body = [] }) {
  return (
    <>
      {body.map((entry, index) => {
        if (entry?.heading) {
          return <h4 className="pillar__body-heading" key={index}>{entry.heading}</h4>;
        }
        if (entry?.subheading) {
          const tier = entry.tier || 1;
          return (
            <h5 className={`pillar__body-subheading pillar__body-subheading--tier-${tier}`} key={index}>
              {entry.subheading}
            </h5>
          );
        }

        const hasText = Boolean(lineText(entry));
        const bullets = entry?.bullets || [];
        const inline = Boolean(entry?.bulletsInline);
        const itemClass = [
          'pillar__body-item',
          bullets.length ? 'pillar__body-item--bulleted' : '',
          entry?.company ? 'pillar__body-item--marked' : ''
        ].filter(Boolean).join(' ');

        if (!hasText && bullets.length) {
          return (
            <ul className="pillar__body-list pillar__body-list--standalone" key={index}>
              {bullets.map((bullet, bulletIndex) => (
                <li className="pillar__body-bullet" key={bulletIndex}>
                  <PillarLineContent entry={bullet} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div className={itemClass} key={index}>
            {hasText ? (
              <p className={`pillar__body-text${entry?.company ? ' pillar__body-text--marked' : ''}`}>
                <PillarLineContent entry={entry} />
              </p>
            ) : null}
            {bullets.length ? (
              <ul className={inline ? 'pillar__body-sublist' : 'pillar__body-list'}>
                {bullets.map((bullet, bulletIndex) => (
                  <li className={inline ? 'pillar__body-subbullet' : 'pillar__body-bullet'} key={bulletIndex}>
                    <PillarLineContent entry={bullet} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {bodyHasEndToEnd(body) ? (
        <p className="pillar__body-footnote"><span className="pillar__body-mark">*</span> Sole designer &amp; developer</p>
      ) : null}
    </>
  );
}

function Pillar({ pillar }) {
  const variant = pillar.variant || 'technical';
  return (
    <div className={`pillar pillar--${variant}`}>
      <div className="pillar__header">
        <div className="pillar__hex">
          <Icon name="hexShape" className="pillar__hex-shape" />
          <Icon name={pillar.hexIcon || 'gear'} className="pillar__hex-icon" />
        </div>
        <h3 className="pillar__title">{pillar.title}</h3>
        {pillar.kpi?.stats?.length ? (
          <div className="pillar__header-pills">
            {pillar.kpi.stats.map((stat) => (
              <span className="pillar__header-pill" key={`${stat.number}-${stat.label}`}>
                {stat.number} {stat.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <hr className="pillar__divider" />
      <div className="pillar__body">
        <PillarBody body={pillar.body || []} />
      </div>
    </div>
  );
}

function SkillRow({ skill }) {
  const level = Math.max(0, Math.min(100, Number(skill.level) || 0));
  return (
    <li className="skill-row">
      <span className="skill-row__name">{skill.name}</span>
      <div
        className="skill-row__bar"
        role="progressbar"
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${skill.name} competency`}
      >
        <span className="skill-row__fill" style={{ '--skill-level': level }} />
        <span className="skill-row__dividers" aria-hidden="true">
          <span className="skill-row__divider" />
          <span className="skill-row__divider" />
          <span className="skill-row__divider" />
        </span>
      </div>
      <span className="skill-row__years">{skill.note || ''}</span>
    </li>
  );
}

function SkillGroup({ group }) {
  return (
    <div className="skill-group">
      <h3 className="skill-group__heading">{group.heading}</h3>
      <ul className="skills-list">
        {(group.subskills || []).map((skill) => (
          <SkillRow key={skill.name} skill={skill} />
        ))}
      </ul>
    </div>
  );
}

function SkillsSection({ skills }) {
  const groups = skills?.groups || [];
  if (!groups.length) return null;

  const mid = Math.ceil(groups.length / 2);
  const leftGroups = groups.slice(0, mid);
  const rightGroups = groups.slice(mid);

  return (
    <div className="pillars-layout__skills" aria-label="Core skills">
      <div className="bottom-card page-lower__skills">
        <div className="skills-card">
          <h3 className="skills-card__title">Core Skills</h3>
          <div className="skills-legend" aria-hidden="true">
            <div className="skills-legend__bar">
              <span className="skills-legend__segment">Novice</span>
              <span className="skills-legend__segment">Competent</span>
              <span className="skills-legend__segment">Advanced</span>
              <span className="skills-legend__segment">Expert</span>
            </div>
            <span className="skills-legend__separator" />
            <span className="skills-legend__exp">
              <span className="skills-legend__exp-line">Experience</span>
              <span className="skills-legend__exp-line skills-legend__exp-line--sub">(Years)</span>
            </span>
          </div>
          <div className="skills-card__columns">
            <div className="skills-column">
              <div className="skills-column__groups">
                {leftGroups.map((group) => (
                  <SkillGroup key={group.heading} group={group} />
                ))}
              </div>
            </div>
            <div className="skills-column">
              <div className="skills-column__groups">
                {rightGroups.map((group) => (
                  <SkillGroup key={group.heading} group={group} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Timeline({ journey }) {
  const steps = journey?.timeline || [];
  if (!steps.length) return null;

  return (
    <section className="journey" aria-label="Career journey">
      <h2 className="timeline__heading">
        <span className="timeline__heading-chevrons timeline__heading-chevrons--left" aria-hidden="true">
          <span>›</span><span>›</span><span>›</span><span>›</span>
        </span>
        <span className="timeline__heading-text">Career Path</span>
        <span className="timeline__heading-chevrons timeline__heading-chevrons--right" aria-hidden="true">
          <span>›</span><span>›</span><span>›</span><span>›</span>
        </span>
      </h2>
      <div className="timeline" style={{ '--timeline-steps': steps.length }} aria-label="Career timeline">
        <div className="timeline__grid">
          <div className="timeline__start">
            <div className="timeline__step-logo" aria-hidden="true" />
            <div className="timeline__step-rail">
              <span className="timeline__dot" />
            </div>
            <div className="timeline__step-details" aria-hidden="true" />
          </div>
          {steps.map((step, index) => {
            const org = step.organization || step.name || '';
            const role = step.role || step.label || '';
            const image = step.image || step.icon;
            const dateRange = formatTimelineDateRange(step);
            const isPresent = step.isPresent || step.endDate === null || /present/i.test(String(step.endDate || ''));
            return (
              <div className={`timeline__step${step.company ? ' timeline__step--company' : ''}`} key={`${org}-${index}`}>
                <div className="timeline__step-logo">
                  {step.url ? (
                    <a className="timeline__logo" href={step.url} target="_blank" rel="noreferrer">
                      {image ? <img className="timeline__icon" src={assetUrl(image)} alt="" /> : <span className="timeline__icon-fallback">{org.charAt(0)}</span>}
                      <span className="visually-hidden">{org}</span>
                    </a>
                  ) : (
                    <span className="timeline__logo">
                      {image ? <img className="timeline__icon" src={assetUrl(image)} alt="" /> : <span className="timeline__icon-fallback">{org.charAt(0)}</span>}
                    </span>
                  )}
                  <span className="timeline__org-name">{org}</span>
                </div>
                <div className="timeline__step-rail">
                  <span className="timeline__step-line" />
                  <span className="timeline__dot" />
                </div>
                <div className="timeline__step-details">
                  <span className="timeline__divider" />
                  <span className="timeline__dates">
                    {isPresent ? <span className="timeline__arrow" aria-hidden="true">▶</span> : null}
                    {dateRange}
                  </span>
                  <span className="timeline__label">{role}</span>
                  {step.honor ? <span className="timeline__honor">{step.honor}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function CvDocument({ content, versionId }) {
  if (!content) return null;

  const profile = content.profile || {};
  const stats = content.stats?.stats || [];
  const pillars = content.impact?.pillars || [];
  const tools = content.tools?.tools || [];
  const photoSrc = profile.photo?.src ? assetUrl(profile.photo.src) : '';

  const technical = pillars.find((item) => item.variant === 'technical');
  const business = pillars.find((item) => item.variant === 'business');
  const leadership = pillars.find((item) => item.variant === 'leadership');

  return (
    <article className="page" id={`cv-${versionId}`} data-version={versionId} aria-label="CV document">
      <header className="header">
        <div className="header__photo">
          {photoSrc ? (
            <img src={photoSrc} alt={profile.photo?.alt || ''} className="header__photo-img" />
          ) : (
            <div className="photo-placeholder" aria-label="Portrait photo placeholder">
              <Icon name="photo" className="photo-placeholder__icon" />
              <span className="placeholder-label">{profile.photo?.alt || 'Photo'}</span>
            </div>
          )}
        </div>

        <div className="header__right">
          <div className="header__main">
            <div className="header__intro">
              <h1 className="name">
                <span className="name__first">{profile.firstName}</span>
                <span className="name__last">{profile.lastName}</span>
              </h1>
              <p className="title">{profile.title}</p>
            </div>
            {profile.summary ? <p className="summary summary--intro">{profile.summary}</p> : null}
            {stats.length ? (
              <div className="stat-cards stat-cards--header">
                {stats.map((stat) => (
                  <div className={`stat-card stat-card--${stat.variant || 'blue'}`} key={stat.title}>
                    <Icon name={stat.icon || 'trend'} className="stat-card__icon" />
                    <strong className="stat-card__title">{stat.title}</strong>
                    <span className="stat-card__desc">{stat.description}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <ul className="contact contact--stacked" aria-label="Contact information">
            {(profile.contact || []).map((item) => (
              <li className="contact__item" key={`${item.type}-${item.value}`}>
                <Icon name={item.type} className="contact__icon" />
                {item.href ? <a href={item.href}>{item.value}</a> : <span>{item.value}</span>}
              </li>
            ))}
          </ul>
        </div>

        <Timeline journey={content.journey} />
      </header>

      <section className="impact" aria-labelledby="impact-heading">
        <div className="framework framework--achievements">
          <div className="framework__box framework__box--achievements">
            <span className="framework__title" id="impact-heading">
              {content.impact?.frameworkTitle || 'Professional Achievements'}
            </span>
            <span className="framework__underline" />
          </div>
        </div>
        <div className="pillars-layout">
          <div className="pillar-col pillar-col--technical">{technical ? <Pillar pillar={technical} /> : null}</div>
          <div className="pillar-col pillar-col--business">{business ? <Pillar pillar={business} /> : null}</div>
          <div className="pillar-col pillar-col--leadership">{leadership ? <Pillar pillar={leadership} /> : null}</div>
          <SkillsSection skills={content.skills} />
        </div>
      </section>

      {tools.length ? (
        <section className="tools-footer">
          <div className="tools-footer__inner">
            <h2 className="tools-footer__title">{content.tools?.sectionTitle || 'Tools & Technologies'}</h2>
            <div className="tools-grid">
              {tools.map((tool) => {
                const icon = tool.icon ? (
                  <img src={assetUrl(tool.icon)} alt="" />
                ) : (
                  <span>{(tool.name || '?').charAt(0)}</span>
                );
                return (
                  <div className="tool-item" key={tool.name}>
                    {tool.href || tool.url ? (
                      <a className="tool-item__icon tool-item__link" href={tool.href || tool.url} target="_blank" rel="noreferrer">
                        {icon}
                      </a>
                    ) : (
                      <div className="tool-item__icon">{icon}</div>
                    )}
                    <span className="tool-item__name">{tool.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
