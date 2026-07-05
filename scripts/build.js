'use strict';

const fs = require('fs');
const path = require('path');
const icons = require('../components/icons');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const TEMPLATE_DIR = path.join(ROOT, 'templates');
const OUTPUT_FILE = path.join(ROOT, 'index.html');

/**
 * Reads and parses a JSON content file for a given section.
 */
function loadJson(...segments) {
  const filePath = path.join(CONTENT_DIR, ...segments);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const label = segments.join('/');
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in content/${label} — check for missing commas or brackets`);
    }
    throw error;
  }
}

/**
 * Loads an HTML component partial from the components folder.
 */
function loadComponent(name) {
  const filePath = path.join(COMPONENTS_DIR, `${name}.html`);
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Escapes HTML special characters in plain text values.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Simple template renderer supporting {{key}}, {{#if key}}...{{else}}...{{/if}}.
 */
function render(template, data) {
  let output = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, ifBlock, elseBlock) => (data[key] ? render(ifBlock, data) : render(elseBlock, data))
  );

  output = output.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
    return data[key] ? render(inner, data) : '';
  });

  output = output.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in data)) return '';
    const value = data[key];
    return typeof value === 'string' ? value : escapeHtml(value);
  });

  return output;
}

/**
 * Renders a component once with the supplied data object.
 */
function renderComponent(name, data) {
  return render(loadComponent(name), data);
}

/**
 * Renders a component for each item in an array.
 * Returns empty string if items is missing (e.g. mid-save while editing JSON).
 */
function renderEach(name, items, mapFn = (item) => item) {
  if (!Array.isArray(items)) {
    return '';
  }
  return items.map((item) => renderComponent(name, mapFn(item))).join('\n');
}

/**
 * Formats a timeline date range for display.
 * Supports optional dateLabel override for short stints (e.g. "Apr–Aug 2020").
 */
function formatDateRange(point) {
  if (point.dateLabel) {
    return point.dateLabel;
  }

  const start = point.start || point.year || '';
  const end = point.end || start;

  if (point.isPresent || end === 'Present') {
    return `${start}\u2013Present`;
  }
  if (!start) {
    return '';
  }
  if (start === end) {
    return start;
  }
  return `${start}\u2013${end}`;
}

class CVBuilder {
  constructor(options = {}) {
    this.root = options.root || ROOT;
    this.outputFile = options.outputFile || OUTPUT_FILE;
  }

  /** Load all section JSON into a single content object. */
  loadContent() {
    return {
      profile: loadJson('header', 'profile.json'),
      journey: loadJson('journey', 'journey.json'),
      pillars: [
        loadJson('impact', 'technical.json'),
        loadJson('impact', 'business.json'),
        loadJson('impact', 'leadership.json')
      ],
      skills: loadJson('skills', 'skills.json'),
      tools: loadJson('tools', 'tools.json'),
      references: loadJson('references', 'references.json'),
      footer: loadJson('footer', 'footer.json')
    };
  }

  /** Build the header block (photo, identity, journey). */
  buildHeader(content) {
    const { profile, journey } = content;

    const photoHtml = profile.photo?.src && fs.existsSync(path.join(this.root, profile.photo.src))
      ? `<img src="${escapeHtml(profile.photo.src)}" alt="${escapeHtml(profile.photo.alt)}" class="header__photo-img">`
      : `<div class="photo-placeholder" aria-label="Portrait photo placeholder">
          ${icons.photo}
          <span class="placeholder-label">${escapeHtml(profile.photo?.alt || 'Photo')}</span>
        </div>`;

    const contactHtml = renderEach('contact-item', profile.contact, (item) => ({
      icon: icons[item.type] || '',
      value: item.value,
      href: item.href || ''
    }));

    const mapTimelinePoint = (point) => {
      const name = point.name || '';
      const hasIcon = point.icon && fs.existsSync(path.join(this.root, point.icon));
      const iconHtml = hasIcon
        ? `<img class="timeline__icon" src="${escapeHtml(point.icon)}" alt="">`
        : `<span class="timeline__icon-fallback" aria-hidden="true">${escapeHtml((name || point.start || point.year || '?').charAt(0).toUpperCase())}</span>`;

      return {
        dateRange: formatDateRange(point),
        label: point.label || name,
        name,
        url: point.url || '',
        iconHtml,
        isPresent: point.isPresent || false
      };
    };

    const timelineItems = journey.timeline || [];

    const logosRowHtml = timelineItems
      .map((point) => {
        const mapped = mapTimelinePoint(point);
        const gapClass = point.isPresent ? 'timeline__logo-gap timeline__logo-gap--present' : 'timeline__logo-gap';
        return `<div class="timeline__logo-bridge">${renderComponent('timeline-logo-cell', mapped)}</div><div class="${gapClass}" aria-hidden="true"></div>`;
      })
      .join('\n');

    const trackHtml = timelineItems
      .map((point) => {
        const mapped = mapTimelinePoint(point);
        return renderComponent('timeline-segment', mapped) + renderComponent('timeline-dot-cell', mapped);
      })
      .join('\n');

    const statsHtml = renderEach('stat-card', journey.stats, (stat) => ({
      variant: stat.variant,
      icon: icons[stat.icon] || '',
      title: stat.title,
      description: stat.description
    }));

    return `<header class="header">
      <div class="header__photo">${photoHtml}</div>
      <div class="header__right">
        <div class="header__main">
          <div class="header__intro">
            <h1 class="name">
              <span class="name__first">${escapeHtml(profile.firstName)}</span>
              <span class="name__last">${escapeHtml(profile.lastName)}</span>
            </h1>
            <p class="title">${escapeHtml(profile.title)}</p>
          </div>
          <p class="summary summary--intro">${escapeHtml(profile.summary)}</p>
          <div class="stat-cards stat-cards--header">${statsHtml}</div>
        </div>
        <ul class="contact contact--stacked" aria-label="Contact information">${contactHtml}</ul>
      </div>
      <section class="journey" aria-label="Career journey">
        <div class="timeline" aria-label="Career timeline">
          <div class="timeline__logos-row">
            <div class="timeline__logo-spacer" aria-hidden="true"></div>
            ${logosRowHtml}
          </div>
          <div class="timeline__track-row">
            <div class="timeline__start" aria-hidden="true"><span class="timeline__dot"></span></div>
            ${trackHtml}
          </div>
        </div>
      </section>
    </header>`;
  }

  /** Build a single impact pillar from JSON. */
  buildPillar(pillar) {
    const bulletsHtml = renderEach('pillar-bullet', pillar.bullets || [], (bullet) => ({
      icon: icons[bullet.icon] || '',
      heading: bullet.heading,
      description: bullet.description
    }));

    const kpiStatsHtml = renderEach('kpi-stat', pillar.kpi?.stats || []);

    return renderComponent('pillar', {
      variant: pillar.variant,
      hexShape: icons.hexShape,
      hexIcon: icons[pillar.hexIcon] || icons.gear,
      title: pillar.title,
      subtitle: pillar.subtitle,
      bullets: bulletsHtml,
      kpiCategory: pillar.kpi?.category || '',
      kpiLabel: pillar.kpi?.label || '',
      kpiStats: kpiStatsHtml
    });
  }

  /** Build the full impact section with framework diagram. */
  buildImpact(content) {
    const pillarsHtml = content.pillars.map((pillar) => this.buildPillar(pillar)).join('\n');

    return `<section class="impact" aria-labelledby="impact-heading">
      ${renderComponent('section-label', {
        modifierClass: 'section-label section-label--impact',
        id: 'impact-heading',
        sectionNumber: '02',
        sectionTitle: 'How I Create Impact'
      })}
      <div class="framework">
        <div class="framework__box">The Impact Framework</div>
        <svg class="framework__wiring" viewBox="0 0 600 48" preserveAspectRatio="none" aria-hidden="true">
          <line x1="300" y1="0" x2="300" y2="16" stroke="#222" stroke-width="1"/>
          <line x1="100" y1="16" x2="500" y2="16" stroke="#222" stroke-width="1"/>
          <line x1="100" y1="16" x2="100" y2="48" stroke="#222" stroke-width="1"/>
          <line x1="300" y1="16" x2="300" y2="48" stroke="#222" stroke-width="1"/>
          <line x1="500" y1="16" x2="500" y2="48" stroke="#222" stroke-width="1"/>
        </svg>
      </div>
      <div class="pillars">${pillarsHtml}</div>
    </section>`;
  }

  /** Build skills, tools, and references cards. */
  buildBottomGrid(content) {
    const { skills, tools, references } = content;

    const skillsListHtml = (skills.skills || [])
      .map((skill) => `<li>${escapeHtml(skill)}</li>`)
      .join('\n');

    const toolsHtml = renderEach('tool-item', tools.tools, (tool) => ({
      name: tool.name,
      icon: tool.icon && fs.existsSync(path.join(this.root, tool.icon)) ? tool.icon : '',
      initial: tool.name.charAt(0)
    }));

    return `<section class="bottom-grid" aria-label="Skills, tools, and references">
      <div class="bottom-card">
        ${renderComponent('section-label', {
          modifierClass: 'section-label section-label--small',
          id: '',
          sectionNumber: skills.sectionNumber,
          sectionTitle: skills.sectionTitle
        })}
        <ul class="skills-list">${skillsListHtml}</ul>
      </div>
      <div class="bottom-card">
        ${renderComponent('section-label', {
          modifierClass: 'section-label section-label--small',
          id: '',
          sectionNumber: tools.sectionNumber,
          sectionTitle: tools.sectionTitle
        })}
        <div class="tools-grid">${toolsHtml}</div>
      </div>
      <div class="bottom-card bottom-card--references">
        ${renderComponent('section-label', {
          modifierClass: 'section-label section-label--small',
          id: '',
          sectionNumber: references.sectionNumber,
          sectionTitle: references.sectionTitle
        })}
        <div class="references">
          ${icons.referencesUser}
          <p class="references__text">${escapeHtml(references.statement)}</p>
        </div>
      </div>
    </section>`;
  }

  /** Build the footer quote and QR block. */
  buildFooter(content) {
    const { footer } = content;
    const qrExists = footer.qr?.src && fs.existsSync(path.join(this.root, footer.qr.src));

    const qrHtml = qrExists
      ? `<img src="${escapeHtml(footer.qr.src)}" alt="${escapeHtml(footer.qr.alt)}" class="qr-code">`
      : `<div class="qr-placeholder" aria-label="QR code placeholder"><span class="placeholder-label">QR</span></div>`;

    return `<footer class="page-footer">
      <div class="page-footer__quote">
        <span class="page-footer__mark" aria-hidden="true">&ldquo;</span>
        <blockquote class="page-footer__text">${escapeHtml(footer.quote)}</blockquote>
      </div>
      <div class="page-footer__connect">
        <p class="page-footer__cta">
          <strong>${escapeHtml(footer.ctaHeading)}</strong>
          <span>${escapeHtml(footer.ctaText)}</span>
        </p>
        ${qrHtml}
      </div>
    </footer>`;
  }

  /** Assemble the full page and write index.html. */
  build() {
    const content = this.loadContent();
    const pageTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, 'page.html'), 'utf8');

    const html = render(pageTemplate, {
      pageTitle: `${content.profile.firstName} ${content.profile.lastName} — CV`,
      header: this.buildHeader(content),
      impact: this.buildImpact(content),
      bottomGrid: this.buildBottomGrid(content),
      footer: this.buildFooter(content)
    });

    fs.writeFileSync(this.outputFile, html, 'utf8');
    return this.outputFile;
  }
}

module.exports = { CVBuilder, loadJson, loadComponent, render, renderComponent, renderEach, formatDateRange };

if (require.main === module) {
  const output = new CVBuilder().build();
  console.log(`Built ${output}`);
}
