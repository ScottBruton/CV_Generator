'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ALLOWED_ROOTS = [
  path.join(ROOT, 'assets'),
  path.join(ROOT, 'public')
];

function resolveSafeAssetPath(src) {
  const clean = String(src || '')
    .replace(/^\//, '')
    .replace(/^public\//, '')
    .split('?')[0]
    .split('#')[0];
  if (!clean || clean.includes('..')) return null;

  const candidates = [
    path.join(ROOT, clean),
    path.join(ROOT, 'public', clean),
    path.join(ROOT, 'assets', clean.replace(/^assets[\\/]/, ''))
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const allowed = ALLOWED_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
    if (!allowed) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return null;
}

/**
 * Compress a local raster image for size-capped PDF export.
 * SVGs and missing files return null (caller should serve original).
 */
async function compressExportImage(src, { maxWidth = 1200, quality = 70 } = {}) {
  const filePath = resolveSafeAssetPath(src);
  if (!filePath) return null;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.svg') return null;

  const width = Math.max(320, Math.min(2400, Number(maxWidth) || 1200));
  const q = Math.max(40, Math.min(90, Number(quality) || 70));

  const pipeline = sharp(filePath, { failOn: 'none' }).rotate().resize({
    width,
    withoutEnlargement: true,
    fit: 'inside'
  });

  // JPEG keeps PDF embeds small; preserve alpha as PNG when needed.
  if (ext === '.png' || ext === '.webp' || ext === '.gif') {
    const meta = await sharp(filePath, { failOn: 'none' }).metadata();
    if (meta.hasAlpha) {
      const buffer = await pipeline.png({ compressionLevel: 9, palette: true, quality: q }).toBuffer();
      return { buffer, contentType: 'image/png' };
    }
  }

  const buffer = await pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  return { buffer, contentType: 'image/jpeg' };
}

module.exports = {
  compressExportImage,
  resolveSafeAssetPath
};
