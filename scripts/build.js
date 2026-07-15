'use strict';

const fs = require('fs');
const path = require('path');
const icons = require('../components/icons');
const {
  resolveCompanyId,
  renderCompanyMarker
} = require('./company-markers');

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
function normalizeTimelineStep(entry, root, companyMarkers, getInstanceId) {
  const organization = entry.organization || entry.name || '';
  const image = entry.image || entry.icon || '';
  const hasIcon = image && fs.existsSync(path.join(root, image));
  const present = entry.endDate === null || entry.end === 'Present' || entry.isPresent === true;
  const honor = entry.honor || '';
  const url = entry.url || '';
  const companyId = entry.companyId || resolveCompanyId(organization, companyMarkers);

  const iconHtml = hasIcon
    ? `<img class="timeline__icon" src="${escapeHtml(image)}" alt="">`
    : `<span class="timeline__icon-fallback" aria-hidden="true">${escapeHtml((organization || entry.startDate || '?').charAt(0).toUpperCase())}</span>`;

  const logoLinkHtml = url
    ? `<a class="timeline__logo" href="${escapeHtml(url)}" title="${escapeHtml(organization)}" target="_blank" rel="noopener noreferrer">${iconHtml}<span class="visually-hidden">${escapeHtml(organization)}</span></a>`
    : `<span class="timeline__logo">${iconHtml}</span>`;

  const markerHtml = companyId
    ? renderCompanyMarker(companyId, companyMarkers, {
      instanceId: getInstanceId(),
      contextClass: 'company-marker-wrap--timeline',
      shape: companyMarkers.timelineMarkerShape || companyMarkers.markerShape || 'diamond'
    })
    : '';

  return {
    stepClass: entry.company ? 'timeline__step timeline__step--company' : 'timeline__step',
    organization: escapeHtml(organization),
    role: escapeHtml(entry.role || entry.label || ''),
    honorHtml: honor ? `<span class="timeline__honor">${escapeHtml(honor)}</span>` : '',
    dateRange: formatTimelineDateRange(entry),
    presentArrowHtml: present ? '<span class="timeline__arrow" aria-hidden="true">&#9654;</span>' : '',
    logoLinkHtml,
    markerHtml
  };
}

/**
 * Builds timeline grid HTML from JSON entries.
 * Each step = one column: logo centred on line segment, rail ends with milestone dot.
 */
function buildTimeline(timelineItems, root, companyMarkers, getInstanceId) {
  const steps = (timelineItems || []).map((entry) => normalizeTimelineStep(entry, root, companyMarkers, getInstanceId));

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
    this.markerInstance = 0;
    this.companyMarkers = loadJson('companies', 'company-markers.json');
  }

  /** Unique id for inline SVG clip paths. */
  nextMarkerInstanceId() {
    this.markerInstance += 1;
    return String(this.markerInstance);
  }

  /** Render a company marker for pillar bullets. */
  renderBulletMarker(companyRef) {
    return renderCompanyMarker(companyRef, this.companyMarkers, {
      instanceId: this.nextMarkerInstanceId(),
      contextClass: 'company-marker-wrap--pillar',
      shape: this.companyMarkers.pillarMarkerShape || this.companyMarkers.markerShape || 'circle'
    });
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
      companyMarkers: this.companyMarkers
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

    const timeline = buildTimeline(
      journey.timeline,
      this.root,
      this.companyMarkers,
      () => this.nextMarkerInstanceId()
    );

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

  /** Whether a body entry or bullet marks end-to-end design. */
  entryHasEndToEnd(entry) {
    if (!entry || typeof entry === 'string') {
      return false;
    }
    if (entry.endToEnd) {
      return true;
    }
    return (entry.bullets || []).some((bullet) => this.entryHasEndToEnd(bullet));
  }

  /** Whether any entry in a pillar body uses end-to-end marking. */
  bodyHasEndToEnd(body) {
    return Array.isArray(body) && body.some((entry) => this.entryHasEndToEnd(entry));
  }

  /** Format one pillar body line with optional class, link, and end-to-end mark. */
  formatPillarLine(entry) {
    const data = typeof entry === 'string' ? { text: entry } : entry;
    const text = escapeHtml(data.text || '');
    const classSuffix = data.class
      ? ` <span class="pillar__body-class">(Class ${escapeHtml(data.class)})</span>`
      : '';
    const label = `${text}${classSuffix}`;

    let inner = label;
    if (data.href) {
      inner = `<a href="${escapeHtml(data.href)}" class="pillar__body-link">${label}</a>`;
    }
    if (data.endToEnd) {
      inner += '<span class="pillar__body-mark" aria-hidden="true">*</span>';
    }
    return inner;
  }

  /** Build bullet list HTML for a body entry. */
  buildPillarBullets(bullets) {
    return (bullets || [])
      .map((bullet) => {
        const data = typeof bullet === 'string' ? { text: bullet } : bullet;
        const marker = data.company ? this.renderBulletMarker(data.company) : '';

        return renderComponent('pillar-body-bullet', {
          bulletContent: this.formatPillarLine(bullet),
          marker
        });
      })
      .join('\n');
  }

  /** Build indented sub-bullet list HTML (lighter bullets under a project title). */
  buildPillarSubBullets(bullets) {
    return (bullets || [])
      .map((bullet) => {
        const data = typeof bullet === 'string' ? { text: bullet } : bullet;
        const marker = data.company ? this.renderBulletMarker(data.company) : '';

        return renderComponent('pillar-body-subbullet', {
          bulletContent: this.formatPillarLine(bullet),
          marker
        });
      })
      .join('\n');
  }

  /** Props for pillar body items that support an optional company marker on the main line. */
  pillarItemMarkerProps(entry, options = {}) {
    const itemMarker = entry.company ? this.renderBulletMarker(entry.company) : '';
    const marked = Boolean(itemMarker);

    return {
      itemMarker,
      marked,
      markedClass: marked ? ' pillar__body-item--marked' : '',
      markedTextClass: marked ? ' pillar__body-text--marked' : '',
      bulleted: options.bulleted !== undefined ? options.bulleted : true
    };
  }

  /** Build the main paragraph HTML for a pillar body item. */
  buildPillarItemContentHtml(entry) {
    const hasText = Boolean(entry.text && String(entry.text).trim());
    if (!hasText) {
      return '';
    }

    const { itemMarker, markedTextClass } = this.pillarItemMarkerProps(entry);

    return `<p class="pillar__body-text${markedTextClass}">${itemMarker}<span class="pillar__body-text__inner">${this.formatPillarLine(entry)}</span></p>`;
  }

  /** Build one pillar body entry (heading, subheading, or item with sub-bullets). */
  buildPillarBodyEntry(entry) {
    if (entry.heading) {
      return renderComponent('pillar-body-heading', { heading: entry.heading });
    }

    if (entry.subheading) {
      return renderComponent('pillar-body-subheading', {
        subheading: entry.subheading,
        tier: String(entry.tier || 1)
      });
    }

    const hasText = Boolean(entry.text && String(entry.text).trim());

    if (entry.bulletsInline && Array.isArray(entry.bullets) && entry.bullets.length) {
      return renderComponent('pillar-body-item', {
        itemContentHtml: this.buildPillarItemContentHtml(entry),
        subBullets: this.buildPillarSubBullets(entry.bullets),
        ...this.pillarItemMarkerProps(entry)
      });
    }

    const bulletsHtml = this.buildPillarBullets(entry.bullets);

    if (!hasText && bulletsHtml) {
      return `<ul class="pillar__body-list pillar__body-list--standalone">\n${bulletsHtml}\n</ul>`;
    }

    return renderComponent('pillar-body-item', {
      itemContentHtml: this.buildPillarItemContentHtml(entry),
      bullets: bulletsHtml,
      bulleted: hasText && !bulletsHtml,
      ...this.pillarItemMarkerProps(entry, { bulleted: hasText && !bulletsHtml })
    });
  }

  /** Build the full pillar body from JSON entries. */
  buildPillarBody(body) {
    if (!Array.isArray(body)) {
      return '';
    }

    const contentHtml = body.map((entry) => this.buildPillarBodyEntry(entry)).join('\n\n');
    const footnoteHtml = this.bodyHasEndToEnd(body)
      ? renderComponent('pillar-body-footnote', { text: 'Sole designer & developer' })
      : '';

    return footnoteHtml ? `${contentHtml}\n\n${footnoteHtml}` : contentHtml;
  }

  /** Build header stat pills from pillar KPI stats. */
  buildHeaderPills(pillar) {
    if (!Array.isArray(pillar.kpi?.stats)) {
      return '';
    }

    return renderEach('pillar-header-pill', pillar.kpi.stats, (stat) => ({
      text: `${stat.number} ${stat.label}`
    }));
  }

  /** Build a single impact pillar from JSON. */
  buildPillar(pillar) {
    const bodyHtml = this.buildPillarBody(pillar.body || []);

    const headerHtml = renderComponent('pillar-header', {
      hexShape: icons.hexShape,
      hexIcon: this.resolvePillarHexIcon(pillar.hexIcon),
      title: pillar.title,
      pills: this.buildHeaderPills(pillar)
    });

    return renderComponent('pillar', {
      variant: pillar.variant,
      header: headerHtml,
      body: bodyHtml
    });
  }

  /** Build the references card. */
  buildReferences(content) {
    const { references } = content;

    return renderComponent('page-references', {
      icon: icons.referencesUser,
      title: references.sectionTitle || 'References',
      statement: references.statement
    });
  }

  /** Build one skill row. */
  buildSkillRow(subskill) {
    return renderComponent('skill-row', {
      name: subskill.name,
      level: subskill.level ?? 0,
      note: subskill.note || ''
    });
  }

  /** Build a skill group (heading + subskills, or a single flat row). */
  buildSkillGroup(group) {
    if (group.name && !group.subskills) {
      return renderComponent('skill-group', {
        single: true,
        rows: this.buildSkillRow(group)
      });
    }

    const subskills = group.subskills || [];

    if (subskills.length === 1) {
      const sub = subskills[0];
      return renderComponent('skill-group', {
        single: true,
        rows: this.buildSkillRow({
          name: group.heading || sub.name,
          level: sub.level,
          note: sub.note
        })
      });
    }

    const rows = subskills.map((sub) => this.buildSkillRow(sub)).join('\n');

    return renderComponent('skill-group', {
      single: false,
      heading: group.heading || '',
      rows
    });
  }

  /** Build one skills column (skill groups). */
  buildSkillsColumn(groups) {
    const groupsHtml = groups.map((group) => this.buildSkillGroup(group)).join('\n\n');

    return renderComponent('skills-column', { groups: groupsHtml });
  }

  /** Build the core skills card. */
  buildSkillsCard(content) {
    const { skills } = content;
    const groups = skills.groups || skills.skills || [];
    const leftGroups = groups.filter((_, index) => index % 2 === 0);
    const rightGroups = groups.filter((_, index) => index % 2 === 1);

    return renderComponent('skills-card', {
      legend: loadComponent('skills-legend'),
      leftColumn: this.buildSkillsColumn(leftGroups),
      rightColumn: this.buildSkillsColumn(rightGroups)
    });
  }

  /** Build the full impact section with framework diagram. */
  buildImpact(content) {
    const { impact } = content;
    const pillarByVariant = Object.fromEntries(
      (impact.pillars || []).map((pillar) => [pillar.variant, this.buildPillar(pillar)])
    );

    const frameworkHtml = renderComponent('framework', {
      title: impact.frameworkTitle || ''
    });

    return indentBlock(renderComponent('impact', {
      framework: frameworkHtml,
      technicalPillar: pillarByVariant.technical || '',
      businessPillar: pillarByVariant.business || '',
      leadershipPillar: pillarByVariant.leadership || '',
      skillsSpan: this.buildSkillsSection(content)
    }), 2);
  }

  /** Build the core skills section (aligned under business + leadership columns). */
  buildSkillsSection(content) {
    return indentBlock(renderComponent('skills-section', {
      card: this.buildSkillsCard(content)
    }), 1);
  }

  /** Build the full-width tools strip at the bottom of the page. */
  buildToolsFooter(content) {
    const { tools } = content;

    const toolsHtml = renderEach('tool-item', tools.tools, (tool) => ({
      name: tool.name,
      icon: tool.icon && fs.existsSync(path.join(this.root, tool.icon)) ? tool.icon : '',
      initial: tool.name.charAt(0)
    }));

    return indentLines(`<section class="tools-footer" aria-label="Tools and technologies">
  <div class="tools-footer__inner">
    ${renderComponent('section-label', {
      modifierClass: 'section-label section-label--small section-label--compact',
      id: '',
      sectionNumber: tools.sectionNumber,
      sectionTitle: tools.sectionTitle
    })}
    <div class="tools-grid">
${indentBlock(toolsHtml, 3)}
    </div>
  </div>
</section>`, 2);
  }

  /** Assemble the full page and write index.html. */
  build() {
    const content = this.loadContent();
    const pageTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, 'page.html'), 'utf8');

    const html = '<!-- Generated by scripts/build.js — edit content/*.json and components, then save (watch rebuilds) or run npm run build. Do not edit this file directly. -->\n' + render(pageTemplate, {
      pageTitle: `${content.profile.firstName} ${content.profile.lastName} — CV`,
      header: this.buildHeader(content),
      impact: this.buildImpact(content),
      toolsFooter: this.buildToolsFooter(content)
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
