'use strict';

const http = require('http');
const { exportPdfBuffer, DEFAULT_FILENAME, DEFAULT_URL, DEVICE_SCALE_FACTOR } = require('./export-pdf');

const PORT = Number(process.env.EXPORT_PORT || 3001);
const ORIGIN = process.env.EXPORT_ORIGIN || 'http://127.0.0.1:3000';

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
    const pdf = await exportPdfBuffer({ url: `${ORIGIN}/` });
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Export server listening on http://127.0.0.1:${PORT} (${DEVICE_SCALE_FACTOR}x device scale)`);
});
