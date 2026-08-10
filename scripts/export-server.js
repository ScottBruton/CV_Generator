'use strict';

require('./ai/env');

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exportPdfBuffer, DEFAULT_FILENAME, DEVICE_SCALE_FACTOR } = require('./export-pdf');
const { compressExportImage } = require('./export-image');
const {
  authEnabled,
  getExportKey,
  validateCredentials,
  isAuthenticated,
  issueSession,
  clearSession,
  maybeGrantExportSession
} = require('./auth');
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
const { scheduleContentSync, flushContentSync, isContentSyncEnabled } = require('./content-sync');

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || process.env.EXPORT_PORT || 3001);
const HOST = process.env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1');
const ORIGIN = process.env.EXPORT_ORIGIN
  || (isProd ? '' : 'http://127.0.0.1:5173');
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');
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

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
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
  sendJson(res, code, { error: message });
}

function resolveExportMode(body) {
  if (body.mode && EXPORT_MODES.has(body.mode)) return body.mode;
  if (body.includeCover === false) return 'cv-portfolio';
  return 'all';
}

function publicOrigin(req) {
  if (ORIGIN) return ORIGIN.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${PORT}`;
  return `${proto}://${host}`;
}

function exportUrlForRequest(body, req) {
  const mode = resolveExportMode(body);
  const params = new URLSearchParams();
  params.set('mode', mode);

  const variantId = body.variant || body.variantId || getActiveVariantId();
  if (variantId) params.set('variant', variantId);

  if (body.cover || body.coverId) params.set('cover', body.cover || body.coverId);
  if (body.cv || body.cvId) params.set('cv', body.cv || body.cvId);
  if (body.portfolio || body.portfolioId) params.set('portfolio', body.portfolio || body.portfolioId);
  if (authEnabled()) params.set('exportKey', getExportKey());

  return `${publicOrigin(req)}/print?${params.toString()}`;
}

async function handleExport(req, res) {
  const body = await readJsonBody(req);
  const exportUrl = exportUrlForRequest(body, req);
  const maxBytes = Number(body.maxBytes) > 0
    ? Number(body.maxBytes)
    : (Number(body.maxMb) > 0 ? Number(body.maxMb) * 1024 * 1024 : null);
  console.log(`Exporting from ${exportUrl}${maxBytes ? ` (max ${Math.round(maxBytes / (1024 * 1024) * 10) / 10} MB)` : ''}`);
  try {
    const pdf = await exportPdfBuffer({ url: exportUrl, maxBytes });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${DEFAULT_FILENAME}"`,
      'Content-Length': pdf.length
    });
    res.end(pdf);
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('[export]', error.message);
    if (status === 413) {
      sendError(res, 413, error);
      return;
    }
    throw error;
  }
}

function isSafeStaticPath(filePath, rootDir) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(rootDir);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function trySendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const type = STATIC_TYPES[ext] || 'application/octet-stream';
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=86400'
  });
  res.end(body);
  return true;
}

function serveStatic(req, res, url) {
  const rawPath = decodeURIComponent(url.pathname);
  if (!rawPath || rawPath.includes('..')) return false;
  const rel = rawPath.replace(/^\//, '');
  if (!rel || rel.endsWith('/')) return false;

  const assetsRoot = path.join(ROOT, 'assets');
  const candidates = [
    { file: path.join(DIST_DIR, rel), root: DIST_DIR },
    { file: path.join(PUBLIC_DIR, rel), root: PUBLIC_DIR }
  ];
  if (rel.startsWith('assets/')) {
    candidates.push({ file: path.join(ROOT, rel), root: assetsRoot });
  }

  for (const { file, root } of candidates) {
    if (!isSafeStaticPath(file, root)) continue;
    if (trySendFile(res, file)) return true;
  }
  return false;
}

function serveSpa(res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!trySendFile(res, indexPath)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build missing. Run npm run build.');
  }
}

function requireAuth(req, res, url) {
  if (isAuthenticated(req, url)) return true;
  if (url.pathname.startsWith('/api/') || url.pathname === '/export') {
    sendError(res, 401, new Error('Authentication required.'));
    return false;
  }
  res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Authentication required.');
  return false;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    sendJson(res, 200, {
      authRequired: authEnabled(),
      authenticated: isAuthenticated(req, url)
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJsonBody(req, 1e5);
    if (!authEnabled()) {
      sendJson(res, 200, { ok: true, authRequired: false });
      return;
    }
    if (!validateCredentials(body.username, body.password)) {
      const error = new Error('Invalid username or password.');
      error.statusCode = 401;
      throw error;
    }
    issueSession(res, String(body.username || '').trim());
    sendJson(res, 200, { ok: true, authenticated: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    clearSession(res);
    sendJson(res, 200, { ok: true, authenticated: false });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export-image') {
    const src = url.searchParams.get('src') || '';
    const maxWidth = Number(url.searchParams.get('w')) || 1200;
    const quality = Number(url.searchParams.get('q')) || 70;
    try {
      const compressed = await compressExportImage(src, { maxWidth, quality });
      if (!compressed) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Image not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': compressed.contentType,
        'Cache-Control': 'no-store',
        'Content-Length': compressed.buffer.length
      });
      res.end(compressed.buffer);
    } catch (error) {
      console.error('[export-image]', error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Image compression failed');
    }
    return;
  }

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

  if (req.method === 'POST' && url.pathname === '/api/active-variant') {
    const body = await readJsonBody(req);
    const variant = setActiveVariantId(body.id);
    scheduleContentSync(`active variant → ${variant.id}`);
    sendJson(res, 200, { variant, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/variants') {
    const body = await readJsonBody(req);
    const variant = createVariantFrom(body);
    flushContentSync(`create variant ${variant.id}`);
    sendJson(res, 201, { variant, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/variants/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/variants/'.length));
    deleteVariant(id);
    flushContentSync(`delete variant ${id}`);
    sendJson(res, 200, { ok: true, bootstrap: getBootstrapData() });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/content/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    // api content kind id
    const kind = parts[2];
    const id = decodeURIComponent(parts[3] || 'default');
    sendJson(res, 200, { content: getContent(kind, id) });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/content/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const kind = parts[2];
    const id = decodeURIComponent(parts[3] || 'default');
    const body = await readJsonBody(req, 8e6);
    const content = putContent(kind, id, body.content ?? body);
    scheduleContentSync(`save ${kind}/${id}`);
    sendJson(res, 200, { content });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/upload/cover-logo') {
    const body = await readJsonBody(req, 8e6);
    const uploaded = saveCoverLogoUpload(body);
    scheduleContentSync(`upload cover logo ${uploaded.filename}`);
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
  const allowOrigin = ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
    maybeGrantExportSession(req, res, url);

    const isPublicAuth = url.pathname === '/api/auth/me'
      || url.pathname === '/api/auth/login'
      || url.pathname === '/api/auth/logout';

    if (url.pathname.startsWith('/api/') || url.pathname === '/export') {
      if (!isPublicAuth && !requireAuth(req, res, url)) return;
    }

    if (req.method === 'POST' && url.pathname === '/export') {
      await handleExport(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    // Static / SPA (production). Dev uses Vite on 5173.
    if (isProd || process.env.SERVE_FRONTEND === '1') {
      if (serveStatic(req, res, url)) return;
      if (req.method === 'GET') {
        serveSpa(res);
        return;
      }
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

server.listen(PORT, HOST, () => {
  syncCatalogFromFilesystem();
  console.log(`App API + export server listening on http://${HOST}:${PORT} (${DEVICE_SCALE_FACTOR}x → ${ORIGIN || 'same-origin'})`);
  console.log(
    isContentSyncEnabled()
      ? `[content-sync] Enabled → ${process.env.GITHUB_REPO || 'ScottBruton/CV_Generator'}@${process.env.GITHUB_BRANCH || 'main'}`
      : '[content-sync] Disabled (set GITHUB_TOKEN on Render to persist live edits to GitHub)'
  );
  if (authEnabled()) console.log('Login gate: enabled (AUTH_USERNAME / AUTH_PASSWORD)');
  else console.log('Login gate: disabled (set AUTH_USERNAME and AUTH_PASSWORD to enable)');
});
