'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_MODULE = path.join(__dirname, 'build.js');
const WATCH_DIRS = [
  path.join(ROOT, 'content'),
  path.join(ROOT, 'components'),
  path.join(ROOT, 'templates'),
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'assets')
];

let debounceTimer = null;

function loadBuilder() {
  delete require.cache[require.resolve(BUILD_MODULE)];
  return require(BUILD_MODULE).CVBuilder;
}

function rebuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const CVBuilder = loadBuilder();
      const output = new CVBuilder().build();
      console.log(`[${new Date().toLocaleTimeString()}] Rebuilt ${output}`);
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Build failed: ${error.message}`);
    }
  }, 400);
}

function watchCssFiles() {
  for (const file of ['style.css', 'profile.css', 'stat-card.css', 'timeline.css', 'impact.css', 'skills.css', 'portfolio.css', 'tools.css', 'cover.css', 'app.css', 'print.css']) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    fs.watch(filePath, () => rebuild());
    console.log(`Watching ${file}`);
  }
}

function watchDir(dir) {
  fs.watch(dir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (filename.endsWith('.json') || filename.endsWith('.html') || filename.endsWith('.js') ||
        filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png') ||
        filename.endsWith('.webp') || filename.endsWith('.svg')) {
      rebuild();
    }
  });
  console.log(`Watching ${path.relative(ROOT, dir)}`);
}

console.log('CV watch mode — edit JSON/components and save to rebuild\n');
rebuild();
watchCssFiles();

for (const dir of WATCH_DIRS) {
  watchDir(dir);
}
