'use strict';

/**
 * Persist live-site content edits to GitHub so Render redeploys keep variants.
 * Enabled when GITHUB_TOKEN is set (and CONTENT_SYNC_ENABLED is not "false").
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYNC_ROOTS = [
  { abs: path.join(ROOT, 'content'), prefix: 'content' },
  { abs: path.join(ROOT, 'assets', 'cover'), prefix: 'assets/cover' }
];

const DEBOUNCE_MS = 8000;
let debounceTimer = null;
let pendingReason = '';
let syncInFlight = null;
let syncQueued = null;

function isContentSyncEnabled() {
  if (String(process.env.CONTENT_SYNC_ENABLED || '').toLowerCase() === 'false') return false;
  return Boolean(String(process.env.GITHUB_TOKEN || '').trim());
}

function getRepoConfig() {
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repo = String(process.env.GITHUB_REPO || 'ScottBruton/CV_Generator').trim();
  const branch = String(process.env.GITHUB_BRANCH || 'main').trim();
  const [owner, name] = repo.split('/');
  if (!token) throw new Error('GITHUB_TOKEN is not configured.');
  if (!owner || !name) throw new Error('GITHUB_REPO must look like owner/repo.');
  return { token, owner, name, branch, repo };
}

async function githubFetch(config, apiPath, options = {}) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cv-generator-content-sync',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const message = data?.message || response.statusText || 'GitHub API error';
    const error = new Error(`GitHub ${options.method || 'GET'} ${apiPath}: ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function listFilesRecursive(dirAbs, prefix) {
  if (!fs.existsSync(dirAbs)) return [];
  const out = [];

  function walk(currentAbs, currentRel) {
    for (const entry of fs.readdirSync(currentAbs, { withFileTypes: true })) {
      if (entry.name === '.' || entry.name === '..') continue;
      const abs = path.join(currentAbs, entry.name);
      const rel = currentRel ? `${currentRel}/${entry.name}` : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        out.push({ abs, path: rel.replace(/\\/g, '/') });
      }
    }
  }

  walk(dirAbs, prefix);
  return out;
}

function collectSyncFiles() {
  const files = [];
  for (const root of SYNC_ROOTS) {
    files.push(...listFilesRecursive(root.abs, root.prefix));
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function isBinaryPath(filePath) {
  return /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|eot|zip)$/i.test(filePath);
}

async function createBlob(config, file) {
  const buffer = fs.readFileSync(file.abs);
  const binary = isBinaryPath(file.path);
  const data = await githubFetch(config, `/repos/${config.owner}/${config.name}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      binary
        ? { content: buffer.toString('base64'), encoding: 'base64' }
        : { content: buffer.toString('utf8'), encoding: 'utf-8' }
    )
  });
  return {
    path: file.path,
    mode: '100644',
    type: 'blob',
    sha: data.sha
  };
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

async function syncContentToGithub(reason = 'content update') {
  if (!isContentSyncEnabled()) {
    return { skipped: true, reason: 'Content sync disabled or GITHUB_TOKEN missing' };
  }

  const config = getRepoConfig();
  const files = collectSyncFiles();
  if (!files.length) {
    return { skipped: true, reason: 'No content files to sync' };
  }

  const ref = await githubFetch(
    config,
    `/repos/${config.owner}/${config.name}/git/ref/heads/${encodeURIComponent(config.branch)}`
  );
  const headSha = ref.object.sha;
  const headCommit = await githubFetch(
    config,
    `/repos/${config.owner}/${config.name}/git/commits/${headSha}`
  );

  const treeItems = await mapPool(files, 8, (file) => createBlob(config, file));

  const newTree = await githubFetch(config, `/repos/${config.owner}/${config.name}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: headCommit.tree.sha,
      tree: treeItems
    })
  });

  if (newTree.sha === headCommit.tree.sha) {
    return { skipped: true, reason: 'No content changes vs GitHub' };
  }

  const message = `chore(content): sync from live site — ${reason}`.slice(0, 180);
  const newCommit = await githubFetch(config, `/repos/${config.owner}/${config.name}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [headSha]
    })
  });

  await githubFetch(
    config,
    `/repos/${config.owner}/${config.name}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha })
    }
  );

  console.log(`[content-sync] Pushed ${files.length} files to ${config.repo}@${config.branch} (${newCommit.sha.slice(0, 7)})`);
  return {
    ok: true,
    commit: newCommit.sha,
    files: files.length,
    repo: config.repo,
    branch: config.branch,
    message
  };
}

async function runSync(reason) {
  if (syncInFlight) {
    syncQueued = reason || syncQueued || 'content update';
    return syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      try {
        return await syncContentToGithub(reason);
      } catch (error) {
        // Branch moved (e.g. local push) — retry once against latest tip
        if (error.status === 422 || /fast.forward/i.test(error.message || '')) {
          return await syncContentToGithub(`${reason} (retry)`);
        }
        throw error;
      }
    } catch (error) {
      console.error(`[content-sync] Failed: ${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      syncInFlight = null;
      if (syncQueued) {
        const nextReason = syncQueued;
        syncQueued = null;
        scheduleContentSync(nextReason);
      }
    }
  })();

  return syncInFlight;
}

/** Debounced sync — good for rapid editor saves. */
function scheduleContentSync(reason = 'content update') {
  if (!isContentSyncEnabled()) return;
  pendingReason = reason || pendingReason || 'content update';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const message = pendingReason;
    pendingReason = '';
    debounceTimer = null;
    runSync(message);
  }, DEBOUNCE_MS);
}

/** Flush soon (still coalesces in-flight work) — use after create/delete variant. */
function flushContentSync(reason = 'content update') {
  if (!isContentSyncEnabled()) {
    return Promise.resolve({ skipped: true, reason: 'Content sync disabled or GITHUB_TOKEN missing' });
  }
  clearTimeout(debounceTimer);
  debounceTimer = null;
  pendingReason = '';
  return runSync(reason);
}

module.exports = {
  isContentSyncEnabled,
  scheduleContentSync,
  flushContentSync,
  syncContentToGithub
};
