'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_URL = 'http://127.0.0.1:3000/';
const DEFAULT_FILENAME = 'Scott-Bruton-Application.pdf';
const DEVICE_SCALE_FACTOR = 2;

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function findBrowserExecutable() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function runHeadlessPrint(executable, url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=8000',
      `--force-device-scale-factor=${DEVICE_SCALE_FACTOR}`,
      `--print-to-pdf=${outputPath}`,
      '--no-pdf-header-footer',
      url
    ];

    execFile(executable, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(outputPath);
    });
  });
}

async function exportPdfBuffer(options = {}) {
  const executable = findBrowserExecutable();
  if (!executable) {
    throw new Error('Chrome or Edge was not found. Install Chrome/Edge or set CHROME_PATH.');
  }

  const url = options.url || DEFAULT_URL;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-export-'));
  const tempPdf = path.join(tempDir, 'export.pdf');

  try {
    await runHeadlessPrint(executable, url, tempPdf);

    if (!fs.existsSync(tempPdf) || fs.statSync(tempPdf).size === 0) {
      throw new Error('Headless export produced an empty PDF.');
    }

    return fs.readFileSync(tempPdf);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
  exportPdfBuffer,
  exportPdfToFile
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
