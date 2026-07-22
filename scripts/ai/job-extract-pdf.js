'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const MAX_BYTES = 6 * 1024 * 1024;
const MIN_CHARS = 280;

async function extractJobTextFromPdf({ pdfBase64, filename = 'upload.pdf' }) {
  const raw = String(pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
  if (!raw) throw new Error('Missing PDF data.');

  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('Invalid PDF data.');
  if (buffer.length > MAX_BYTES) throw new Error('PDF too large (max 6MB).');

  const tempPath = path.join(os.tmpdir(), `cv-job-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  let parser;
  try {
    fs.writeFileSync(tempPath, buffer);
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = String(result?.text || result || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < MIN_CHARS) {
      throw new Error('PDF contained no usable job description text.');
    }

    return {
      text,
      filename: path.basename(filename || 'upload.pdf'),
      pages: result?.total || result?.numpages || null
    };
  } catch (error) {
    if (error.message && /usable job description|Missing PDF|Invalid PDF|too large/.test(error.message)) {
      throw error;
    }
    throw new Error('Could not read PDF text. Try pasted text instead.');
  } finally {
    try {
      if (parser?.destroy) await parser.destroy();
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup failures
    }
  }
}

module.exports = {
  extractJobTextFromPdf,
  MAX_BYTES,
  MIN_CHARS
};
