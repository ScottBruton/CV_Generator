'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_URL = 'http://127.0.0.1:3000/';
const DEFAULT_FILENAME = 'Scott-Bruton-Application.pdf';
const DEVICE_SCALE_FACTOR = 2;

/**
 * Size-capped export attempts.
 * Keep device scale at 2x so text/styles stay sharp; only image compression changes.
 */
const SIZE_ATTEMPTS = [
  { label: 'images-high', deviceScaleFactor: 2, imgMax: 1600, imgQ: 82 },
  { label: 'images-medium', deviceScaleFactor: 2, imgMax: 1200, imgQ: 70 },
  { label: 'images-low', deviceScaleFactor: 2, imgMax: 960, imgQ: 58 },
  { label: 'images-min', deviceScaleFactor: 2, imgMax: 720, imgQ: 48 }
];

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const CHROME_EXE_NAMES = new Set([
  'chrome',
  'chrome.exe',
  'chromium',
  'chromium.exe',
  'google-chrome',
  'google-chrome-stable'
]);

function findChromeInDir(rootAbs, depth = 0) {
  if (!rootAbs || depth > 8 || !fs.existsSync(rootAbs)) return null;
  let entries;
  try {
    entries = fs.readdirSync(rootAbs, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const abs = path.join(rootAbs, entry.name);
    if (entry.isFile() && CHROME_EXE_NAMES.has(entry.name.toLowerCase())) {
      return abs;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findChromeInDir(path.join(rootAbs, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

function puppeteerCacheRoots() {
  return [
    process.env.PUPPETEER_CACHE_DIR,
    path.join(process.cwd(), '.cache', 'puppeteer'),
    path.join(os.homedir(), '.cache', 'puppeteer'),
    '/opt/render/.cache/puppeteer'
  ].filter(Boolean);
}

function findBrowserExecutable() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const puppeteer = require('puppeteer');
    if (typeof puppeteer.executablePath === 'function') {
      const installed = puppeteer.executablePath();
      if (installed && fs.existsSync(installed)) return installed;
    }
  } catch {
    // puppeteer not installed
  }

  for (const root of puppeteerCacheRoots()) {
    const found = findChromeInDir(root);
    if (found) return found;
  }

  return null;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function withPrintParams(url, { imgMax, imgQ } = {}) {
  const parsed = new URL(url);
  if (imgMax) parsed.searchParams.set('imgMax', String(imgMax));
  else parsed.searchParams.delete('imgMax');
  if (imgQ) parsed.searchParams.set('imgQ', String(imgQ));
  else parsed.searchParams.delete('imgQ');
  return parsed.toString();
}

function runHeadlessPrint(executable, url, outputPath, deviceScaleFactor = DEVICE_SCALE_FACTOR) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      // Required on Render / Linux containers without a sandbox user.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--run-all-compositor-stages-before-draw',
      // Extra time so compressed image swaps can finish before capture.
      '--virtual-time-budget=20000',
      '--font-render-hinting=none',
      `--force-device-scale-factor=${deviceScaleFactor}`,
      `--print-to-pdf=${outputPath}`,
      '--no-pdf-header-footer',
      url
    ];

    execFile(executable, args, { timeout: 180000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(outputPath);
    });
  });
}

async function exportOnce(executable, url, attempt) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-export-'));
  const tempPdf = path.join(tempDir, 'export.pdf');
  const printUrl = withPrintParams(url, attempt);

  try {
    await runHeadlessPrint(executable, printUrl, tempPdf, attempt.deviceScaleFactor || DEVICE_SCALE_FACTOR);

    if (!fs.existsSync(tempPdf) || fs.statSync(tempPdf).size === 0) {
      throw new Error('Headless export produced an empty PDF.');
    }

    return {
      buffer: fs.readFileSync(tempPdf),
      label: attempt.label || `${attempt.deviceScaleFactor || DEVICE_SCALE_FACTOR}x`,
      attempt
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * @param {{
 *   url?: string,
 *   deviceScaleFactor?: number,
 *   maxBytes?: number|null
 * }} options
 */
async function exportPdfBuffer(options = {}) {
  const executable = findBrowserExecutable();
  if (!executable) {
    throw new Error(
      'Chrome or Edge was not found. On Render, ensure the build runs '
      + '`npx puppeteer browsers install chrome` with PUPPETEER_CACHE_DIR set. '
      + 'Locally install Chrome/Edge or set CHROME_PATH / PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  const url = options.url || DEFAULT_URL;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : null;
  const attempts = maxBytes
    ? SIZE_ATTEMPTS
    : [{
      label: 'hq',
      deviceScaleFactor: Number(options.deviceScaleFactor) > 0 ? Number(options.deviceScaleFactor) : DEVICE_SCALE_FACTOR
    }];

  let smallest = null;

  for (const attempt of attempts) {
    const result = await exportOnce(executable, url, attempt);
    if (!smallest || result.buffer.length < smallest.buffer.length) {
      smallest = result;
    }
    if (!maxBytes || result.buffer.length <= maxBytes) {
      if (maxBytes) {
        console.log(`Export OK at ${result.label}: ${formatBytes(result.buffer.length)} (limit ${formatBytes(maxBytes)})`);
      }
      return result.buffer;
    }
    console.log(
      `Export at ${result.label} is ${formatBytes(result.buffer.length)} (limit ${formatBytes(maxBytes)}); compressing images further…`
    );
  }

  const error = new Error(
    `Could not produce a PDF under ${formatBytes(maxBytes)} `
    + `(smallest was ${formatBytes(smallest.buffer.length)} via ${smallest.label}). `
    + 'Try exporting fewer documents (e.g. CV + Portfolio only).'
  );
  error.statusCode = 413;
  throw error;
}

async function exportPdfToFile(options = {}) {
  const outputPath = path.resolve(options.output || path.join(process.cwd(), DEFAULT_FILENAME));
  const buffer = await exportPdfBuffer(options);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  DEFAULT_URL,
  DEFAULT_FILENAME,
  DEVICE_SCALE_FACTOR,
  SIZE_ATTEMPTS,
  findBrowserExecutable,
  exportPdfBuffer,
  exportPdfToFile,
  formatBytes
};

if (require.main === module) {
  exportPdfToFile()
    .then((output) => {
      console.log(`Exported ${output}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
