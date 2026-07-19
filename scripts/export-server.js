'use strict';

const http = require('http');
const { exportPdfBuffer, DEFAULT_FILENAME, DEVICE_SCALE_FACTOR } = require('./export-pdf');

const PORT = Number(process.env.EXPORT_PORT || 3001);
const ORIGIN = process.env.EXPORT_ORIGIN || 'http://127.0.0.1:3000';

const EXPORT_MODES = new Set(['all', 'cv-portfolio', 'cover', 'cv', 'portfolio']);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
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

function resolveExportMode(body) {
  if (body.mode && EXPORT_MODES.has(body.mode)) {
    return body.mode;
  }

  // Backward compatibility with earlier includeCover payload.
  if (body.includeCover === false) {
    return 'cv-portfolio';
  }

  return 'all';
}

function exportUrlForMode(mode) {
  if (mode === 'all') {
    return `${ORIGIN}/`;
  }
  return `${ORIGIN}/?export=${encodeURIComponent(mode)}`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/export') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const body = await readJsonBody(req);
    const mode = resolveExportMode(body);
    const exportUrl = exportUrlForMode(mode);
    console.log(`Exporting mode="${mode}" from ${exportUrl}`);
    const pdf = await exportPdfBuffer({ url: exportUrl });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${DEFAULT_FILENAME}"`,
      'Content-Length': pdf.length
    });
    res.end(pdf);
  } catch (error) {
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
  console.log(`Export server listening on http://127.0.0.1:${PORT} (${DEVICE_SCALE_FACTOR}x device scale)`);
});
