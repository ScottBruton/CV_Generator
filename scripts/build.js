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
 * Indents each line by depth × 2 spaces, preserving relative indentation.
 */
function indentLines(html, depth = 0) {
  if (!html || !String(html).trim()) return '';
  const base = '  '.repeat(depth);
  return String(html)
    .trimEnd()
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      const relative = line.match(/^(\s*)/)[1];
      return base + relative + line.trim();
    })
    .join('\n');
}

/**
 * Indents unformatted component output to a fixed depth.
 */
function indentBlock(html, depth = 0) {
  if (!html || !String(html).trim()) return '';
  const base = '  '.repeat(depth);
  return String(html)
    .trim()
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      const relative = line.match(/^(\s*)/)[1];
      return base + relative + line.trim();
    })
    .join('\n');
}

/**
 * Renders a component for each item in an array.
 * Returns empty string if items is missing (e.g. mid-save while editing JSON).
 */
function renderEach(name, items, mapFn = (item) => item) {
  if (!Array.isArray(items)) {
    return '';
  }
  return items.map((item) => renderComponent(name, mapFn(item))).join('\n\n');
}

/**
 * Formats a timeline date range from startDate / endDate.
 * endDate null means Present. Optional dateLabel for short stints.
 */
function formatTimelineDateRange(entry) {
  if (entry.dateLabel) {
    return entry.dateLabel;
  }

  const start = entry.startDate || entry.start || entry.year || '';
  const end = entry.endDate !== undefined ? entry.endDate : entry.end;

  if (end === null || end === undefined || end === 'Present' || entry.isPresent) {
    return start ? `${start}\u2013Present` : 'Present';
  }
  if (!start) {
    return '';
  }
  if (start === end) {
    return start;
  }
  return `${start}\u2013${end}`;
}

/**
 * Normalises one timeline JSON entry into template data.
 */
function normalizeTimelineStep(entry, root) {
  const organization = entry.organization || entry.name || '';
  const image = entry.image || entry.icon || '';
  const hasIcon = image && fs.existsSync(path.join(root, image));
  const present = entry.endDate === null || entry.end === 'Present' || entry.isPresent === true;
  const honor = entry.honor || '';
  const url = entry.url || '';

  const iconHtml = hasIcon
    ? `<img class="timeline__icon" src="${escapeHtml(image)}" alt="">`
    : `<span class="timeline__icon-fallback" aria-hidden="true">${escapeHtml((organization || entry.startDate || '?').charAt(0).toUpperCase())}</span>`;

  const logoLinkHtml = url
    ? `<a class="timeline__logo" href="${escapeHtml(url)}" title="${escapeHtml(organization)}" target="_blank" rel="noopener noreferrer">${iconHtml}<span class="visually-hidden">${escapeHtml(organization)}</span></a>`
    : `<span class="timeline__logo">${iconHtml}</span>`;

  return {
    stepClass: entry.company ? 'timeline__step timeline__step--company' : 'timeline__step',
    organization: escapeHtml(organization),
    role: escapeHtml(entry.role || entry.label || ''),
    honorHtml: honor ? `<span class="timeline__honor">${escapeHtml(honor)}</span>` : '',
    dateRange: formatTimelineDateRange(entry),
    presentArrowHtml: present ? '<span class="timeline__arrow" aria-hidden="true">&#9654;</span>' : '',
    logoLinkHtml
  };
}

/**
 * Builds timeline grid HTML from JSON entries.
 * Each step = one column: logo centred on line segment, rail ends with milestone dot.
 */
function buildTimeline(timelineItems, root) {
  const steps = (timelineItems || []).map((entry) => normalizeTimelineStep(entry, root));

  const stepsHtml = steps
    .map((step) => indentBlock(renderComponent('timeline-segment', step), 4))
    .join('\n\n');

  return {
    stepCount: steps.length,
    stepsHtml
  };
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
      stats: loadJson('stats', 'stat.json'),
      journey: loadJson('journey', 'journey.json'),
      impact: loadJson('impact', 'impact.json'),
      skills: loadJson('skills', 'skills.json'),
      tools: loadJson('tools', 'tools.json'),
      references: loadJson('references', 'references.json'),
      footer: loadJson('footer', 'footer.json')
    };
  }

  /** Build the header block (photo, identity, journey). */
  buildHeader(content) {
    const { profile, journey, stats } = content;

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

    const timeline = buildTimeline(journey.timeline, this.root);

    const statsHtml = renderEach('stat-card', stats.stats, (stat) => ({
      variant: stat.variant,
      icon: icons[stat.icon] || '',
      title: stat.title,
      description: stat.description
    }));

    const timelineHtml = renderComponent('timeline', {
      stepCount: timeline.stepCount,
      stepsHtml: `\n${timeline.stepsHtml}`
    });

    return indentLines(`<header class="header">
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
      <div class="stat-cards stat-cards--header">
${indentBlock(statsHtml, 4)}
      </div>
    </div>
    <ul class="contact contact--stacked" aria-label="Contact information">
${indentBlock(contactHtml, 3)}
    </ul>
  </div>
${timelineHtml}
</header>`, 2);
  }

  /** Resolve a pillar hex icon with the correct CSS class. */
  resolvePillarHexIcon(iconKey) {
    const icon = icons[iconKey] || icons.gear;
    return icon.replace(/class="[^"]*"/, 'class="pillar__hex-icon"');
  }

  /** Build a single impact pillar from JSON. */
  buildPillar(pillar) {
    const bulletsHtml = renderEach('pillar-bullet', pillar.bullets || [], (bullet) => ({
      icon: icons[bullet.icon] || '',
      heading: bullet.heading,
      description: bullet.description
    }));

    const kpiStatsHtml = renderEach('kpi-stat', pillar.kpi?.stats || [], (stat) => stat);

    const headerHtml = renderComponent('pillar-header', {
      hexShape: icons.hexShape,
      hexIcon: this.resolvePillarHexIcon(pillar.hexIcon),
      title: pillar.title,
      subtitle: pillar.subtitle
    });

    const kpiHtml = renderComponent('pillar-kpi', {
      kpiCategory: pillar.kpi?.category || '',
      kpiLabel: pillar.kpi?.label || '',
      kpiStats: kpiStatsHtml
    });

    return renderComponent('pillar', {
      variant: pillar.variant,
      header: headerHtml,
      bullets: bulletsHtml,
      kpi: kpiHtml
    });
  }

  /** Build the full impact section with framework diagram. */
  buildImpact(content) {
    const { impact } = content;
    const pillarsHtml = (impact.pillars || []).map((pillar) => this.buildPillar(pillar)).join('\n\n');

    const frameworkHtml = renderComponent('framework', {
      title: impact.frameworkTitle || ''
    });

    return indentBlock(renderComponent('impact', {
      framework: frameworkHtml,
      pillars: pillarsHtml
    }), 2);
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

    return indentLines(`<section class="bottom-grid" aria-label="Skills, tools, and references">
  <div class="bottom-card">
    ${renderComponent('section-label', {
      modifierClass: 'section-label section-label--small',
      id: '',
      sectionNumber: skills.sectionNumber,
      sectionTitle: skills.sectionTitle
    })}
    <ul class="skills-list">
${indentBlock(skillsListHtml, 3)}
    </ul>
  </div>
  <div class="bottom-card">
    ${renderComponent('section-label', {
      modifierClass: 'section-label section-label--small',
      id: '',
      sectionNumber: tools.sectionNumber,
      sectionTitle: tools.sectionTitle
    })}
    <div class="tools-grid">
${indentBlock(toolsHtml, 3)}
    </div>
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
</section>`, 2);
  }

  /** Build the footer quote and QR block. */
  buildFooter(content) {
    const { footer } = content;
    const qrExists = footer.qr?.src && fs.existsSync(path.join(this.root, footer.qr.src));

    const qrHtml = qrExists
      ? `<img src="${escapeHtml(footer.qr.src)}" alt="${escapeHtml(footer.qr.alt)}" class="qr-code">`
      : `<div class="qr-placeholder" aria-label="QR code placeholder"><span class="placeholder-label">QR</span></div>`;

    return indentLines(`<footer class="page-footer">
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
</footer>`, 2);
  }

  /** Assemble the full page and write index.html. */
  build() {
    const content = this.loadContent();
    const pageTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, 'page.html'), 'utf8');

    const html = '<!-- Generated by scripts/build.js — edit content/*.json and components, then save (watch rebuilds) or run npm run build. Do not edit this file directly. -->\n' + render(pageTemplate, {
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

module.exports = {
  CVBuilder,
  loadJson,
  loadComponent,
  render,
  renderComponent,
  renderEach,
  indentLines,
  indentBlock,
  formatTimelineDateRange,
  normalizeTimelineStep,
  buildTimeline
};

if (require.main === module) {
  const output = new CVBuilder().build();
  console.log(`Built ${output}`);
}
