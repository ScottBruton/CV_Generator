'use strict';

require('./ai/env');

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exportPdfBuffer, DEFAULT_FILENAME, DEVICE_SCALE_FACTOR } = require('./export-pdf');
const {
  getBootstrapData,
  listVariants,
  getVariant,
  upsertVariant,
  deleteVariant,
  setActiveVariantId,
  getActiveVariantId,
  createVariantFrom,
  getContent,
  putContent,
  syncCatalogFromFilesystem
} = require('./db');
const { handleJobSummary, handleTailor } = require('./ai/handlers');

const PORT = Number(process.env.EXPORT_PORT || 3001);
const ORIGIN = process.env.EXPORT_ORIGIN || 'http://127.0.0.1:5173';
const ROOT = path.resolve(__dirname, '..');
const COVER_ASSET_DIR = path.join(ROOT, 'assets', 'cover');

const EXPORT_MODES = new Set(['all', 'cv-portfolio', 'cover', 'cv', 'portfolio']);
const COVER_LOGO_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg'
};

function readJsonBody(req, maxBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'logo'))
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'logo';
}

function uniqueCoverLogoPath(filename) {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext) || 'logo';
  let candidate = `${stem}${ext}`;
  let index = 1;
  while (fs.existsSync(path.join(COVER_ASSET_DIR, candidate))) {
    candidate = `${stem}-${index}${ext}`;
    index += 1;
  }
  return candidate;
}

function saveCoverLogoUpload(body = {}) {
  const mimeType = String(body.mimeType || '').toLowerCase();
  const ext = COVER_LOGO_MIME[mimeType];
  if (!ext) {
    throw new Error('Unsupported image type. Use JPG, PNG, WEBP, GIF, or SVG.');
  }

  const raw = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) throw new Error('Missing image data');

  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('Invalid image data');
  if (buffer.length > 6e6) throw new Error('Image too large (max 6MB)');

  fs.mkdirSync(COVER_ASSET_DIR, { recursive: true });

  let filename = sanitizeFilename(body.filename || `logo${ext}`);
  if (!path.extname(filename)) filename += ext;
  else filename = `${path.basename(filename, path.extname(filename))}${ext}`;

  filename = uniqueCoverLogoPath(filename);
  const absolute = path.join(COVER_ASSET_DIR, filename);
  fs.writeFileSync(absolute, buffer);

  return {
    path: `assets/cover/${filename}`,
    filename
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, statusCode, error) {
  const code = error?.statusCode || statusCode;
  let message = error?.message || String(error);
  if (error?.name === 'ZodError' && Array.isArray(error.issues)) {
    message = error.issues.map((issue) => issue.message).join('; ') || 'Invalid request.';
  }
  // Never return stack traces or raw provider payloads to the client
  sendJson(res, code, { error: message });
}

function resolveExportMode(body) {
  if (body.mode && EXPORT_MODES.has(body.mode)) return body.mode;
  if (body.includeCover === false) return 'cv-portfolio';
  return 'all';
}

function exportUrlForRequest(body) {
  const mode = resolveExportMode(body);
  const params = new URLSearchParams();
  params.set('mode', mode);

  const variantId = body.variant || body.variantId || getActiveVariantId();
  if (variantId) params.set('variant', variantId);

  if (body.cover || body.coverId) params.set('cover', body.cover || body.coverId);
  if (body.cv || body.cvId) params.set('cv', body.cv || body.cvId);
  if (body.portfolio || body.portfolioId) params.set('portfolio', body.portfolio || body.portfolioId);

  return `${ORIGIN}/print?${params.toString()}`;
}

async function handleExport(req, res) {
  const body = await readJsonBody(req);
  const exportUrl = exportUrlForRequest(body);
  console.log(`Exporting from ${exportUrl}`);
  const pdf = await exportPdfBuffer({ url: exportUrl });
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${DEFAULT_FILENAME}"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    sendJson(res, 200, getBootstrapData());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/variants') {
    sendJson(res, 200, {
      variants: listVariants(),
      activeVariantId: getActiveVariantId()
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/variants') {
    const body = await readJsonBody(req);
    let variant;
    if (body.fromId || body.cloneFrom) {
      variant = createVariantFrom({
        label: body.label,
        company: body.company,
        fromId: body.fromId || body.cloneFrom || 'default'
      });
    } else {
      variant = upsertVariant(body);
      if (body.setActive) setActiveVariantId(variant.id);
    }
    sendJson(res, 200, { variant, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/variants/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/variants/'.length));
    const body = await readJsonBody(req);
    const variant = upsertVariant({ ...body, id });
    if (body.setActive) setActiveVariantId(variant.id);
    sendJson(res, 200, { variant, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/variants/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/variants/'.length));
    deleteVariant(id);
    sendJson(res, 200, { ok: true, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/active-variant') {
    const body = await readJsonBody(req);
    const variant = setActiveVariantId(body.id);
    sendJson(res, 200, { variant, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/content/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    // /api/content/:kind/:id
    const kind = parts[2];
    const id = decodeURIComponent(parts[3] || '');
    sendJson(res, 200, { content: getContent(kind, id) });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/content/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const kind = parts[2];
    const id = decodeURIComponent(parts[3] || '');
    const body = await readJsonBody(req);
    const content = putContent(kind, id, body.content || body);
    sendJson(res, 200, { content, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/upload/cover-logo') {
    const body = await readJsonBody(req, 8e6);
    const uploaded = saveCoverLogoUpload(body);
    sendJson(res, 200, uploaded);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/job-summary') {
    const body = await readJsonBody(req, 8e6);
    try {
      const result = await handleJobSummary(req, body);
      sendJson(res, 200, result);
    } catch (error) {
      console.error('[ai/job-summary]', error?.name || 'Error', error?.statusCode || 500);
      sendError(res, error?.statusCode || 400, error);
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/tailor') {
    const body = await readJsonBody(req, 4e6);
    try {
      const result = await handleTailor(req, body);
      sendJson(res, 200, result);
    } catch (error) {
      console.error('[ai/tailor]', error?.name || 'Error', error?.statusCode || 500);
      sendError(res, error?.statusCode || 400, error);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/render/')) {
    const variantId = decodeURIComponent(url.pathname.slice('/api/render/'.length));
    const variant = getVariant(variantId) || getVariant(getActiveVariantId());
    if (!variant) throw new Error('Variant not found');
    const catalog = getBootstrapData().catalog;
    sendJson(res, 200, {
      variant,
      cover: getContent('cover', variant.coverId),
      cv: getContent('cv', variant.cvId),
      portfolio: getContent('portfolio', variant.portfolioId),
      sharedProfile: getContent('shared-profile', 'shared'),
      labels: {
        cover: catalog.covers.find((item) => item.id === variant.coverId)?.label || variant.coverId,
        cv: catalog.cvs.find((item) => item.id === variant.cvId)?.label || variant.cvId,
        portfolio: catalog.portfolios.find((item) => item.id === variant.portfolioId)?.label || variant.portfolioId
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

    if (req.method === 'POST' && url.pathname === '/export') {
      await handleExport(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    if (req.url && String(req.url).startsWith('/api/ai/')) {
      console.error('[ai]', error?.name || 'Error', error?.statusCode || 500);
      sendError(res, error?.statusCode || 500, error);
      return;
    }
    console.error(error);
    if (req.url && req.url.startsWith('/api/')) {
      sendError(res, error?.statusCode || 400, error);
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.message || 'Export failed');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Export port ${PORT} is already in use. Stop the old export server (or rerun start.bat) and try again.`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, '127.0.0.1', () => {
  syncCatalogFromFilesystem();
  console.log(`App API + export server listening on http://127.0.0.1:${PORT} (${DEVICE_SCALE_FACTOR}x → ${ORIGIN})`);
});
