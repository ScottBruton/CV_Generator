const fs = require('fs');
const path = require('path');

const MARKER_DIR = path.join('assets', 'logos', 'companies', 'company_logos');

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function buildBandRects(colors, shape) {
  const bandHeight = 16 / colors.length;
  return colors
    .map((color, index) => {
      const y = (index * bandHeight).toFixed(3);
      const height = bandHeight.toFixed(3);
      return `<rect x="0" y="${y}" width="16" height="${height}" fill="${escapeAttr(color)}"/>`;
    })
    .join('\n    ');
}

function buildSplitRects(company) {
  return `
    <rect x="0" y="0" width="16" height="7" fill="${escapeAttr(company.top)}"/>
    <rect x="0" y="7" width="16" height="1.2" fill="${escapeAttr(company.line)}"/>
    <rect x="0" y="8.2" width="16" height="7.8" fill="${escapeAttr(company.bottom)}"/>`;
}

function buildFillContent(company) {
  if (company.pattern === 'bands') {
    return buildBandRects(company.colors, company);
  }
  return buildSplitRects(company);
}

function buildDiamondSvg(company, clipId) {
  return `<svg class="company-marker company-marker--diamond" viewBox="0 0 16 16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="${clipId}">
      <polygon points="8,1 15,8 8,15 1,8"/>
    </clipPath>
  </defs>
  <g clip-path="url(#${clipId})">${buildFillContent(company)}
  </g>
  <polygon class="company-marker__stroke" points="8,1 15,8 8,15 1,8" fill="none" stroke="currentColor" stroke-width="1.25"/>
</svg>`;
}

function buildCircleSvg(company, clipId) {
  return `<svg class="company-marker company-marker--circle" viewBox="0 0 16 16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="${clipId}">
      <circle cx="8" cy="8" r="7"/>
    </clipPath>
  </defs>
  <g clip-path="url(#${clipId})">${buildFillContent(company)}
  </g>
  <circle class="company-marker__stroke" cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.25"/>
</svg>`;
}

function buildMarkerSvg(company, shape, clipId) {
  return shape === 'circle' ? buildCircleSvg(company, clipId) : buildDiamondSvg(company, clipId);
}

function writeMarkerFiles(config, root) {
  const outputDir = path.join(root, MARKER_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  Object.entries(config.companies).forEach(([id, company]) => {
    ['diamond', 'circle'].forEach((shape) => {
      const clipId = `clip-${id}-${shape}`;
      const svg = `${buildMarkerSvg(company, shape, clipId)}\n`;
      const filePath = path.join(outputDir, `${shape}-${id}.svg`);
      const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

      if (existing !== svg) {
        fs.writeFileSync(filePath, svg, 'utf8');
      }
    });
  });
}

function resolveCompanyId(companyRef, config) {
  if (!companyRef) {
    return '';
  }
  if (config.companies[companyRef]) {
    return companyRef;
  }
  return config.organizationMap[companyRef] || '';
}

function renderCompanyMarker(companyRef, config, options = {}) {
  if (config.showCompanyMarkers === false) {
    return '';
  }

  const companyId = resolveCompanyId(companyRef, config);
  if (!companyId) {
    return '';
  }

  const company = config.companies[companyId];
  const shape = options.shape
    || (options.contextClass?.includes('pillar') ? config.pillarMarkerShape : null)
    || (options.contextClass?.includes('timeline') ? config.timelineMarkerShape : null)
    || config.markerShape
    || 'diamond';
  const clipId = `clip-${companyId}-${shape}-${options.instanceId || '0'}`;
  const svg = buildMarkerSvg(company, shape, clipId);

  const classNames = ['company-marker-wrap'];
  if (options.contextClass) {
    classNames.push(options.contextClass);
  }

  return `<span class="${classNames.join(' ')}" title="${escapeAttr(company.label)}">${svg}</span>`;
}

module.exports = {
  MARKER_DIR,
  buildMarkerSvg,
  writeMarkerFiles,
  resolveCompanyId,
  renderCompanyMarker
};
