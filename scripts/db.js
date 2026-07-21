'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'cv-generator.db');
const VARIANTS_JSON = path.join(ROOT, 'content', 'app', 'variants.json');
const APPLICATIONS_JSON = path.join(ROOT, 'content', 'app', 'applications.json');
const CONTENT_DIR = path.join(ROOT, 'content');

let dbInstance = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function listCoverFiles() {
  const dir = path.join(CONTENT_DIR, 'cover');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const id = path.basename(name, '.json');
      const data = readJson(path.join(dir, name), {});
      return {
        id: data.id || id,
        label: data.label || data.company || data.subject || id
      };
    });
}

function listCvDirs() {
  const dir = path.join(CONTENT_DIR, 'cv');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const meta = readJson(path.join(dir, entry.name, 'meta.json'), {});
      return {
        id: meta.id || entry.name,
        label: meta.label || entry.name
      };
    });
}

function listPortfolioFiles() {
  const dir = path.join(CONTENT_DIR, 'portfolio');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const id = path.basename(name, '.json');
      const data = readJson(path.join(dir, name), {});
      return {
        id: data.id || id,
        label: data.label || data.title || id
      };
    });
}

function openDb() {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS covers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cvs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      company TEXT,
      is_template INTEGER NOT NULL DEFAULT 0,
      cover_id TEXT NOT NULL,
      cv_id TEXT NOT NULL,
      portfolio_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (cover_id) REFERENCES covers(id),
      FOREIGN KEY (cv_id) REFERENCES cvs(id),
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    dbInstance.exec('ALTER TABLE applications ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0');
  } catch (error) {
    // column already exists
  }

  syncCatalogFromFilesystem();
  seedVariantsIfNeeded();
  return dbInstance;
}

function syncCatalogFromFilesystem() {
  const db = openDb();
  const covers = listCoverFiles();
  const cvs = listCvDirs();
  const portfolios = listPortfolioFiles();

  const upsertCover = db.prepare('INSERT INTO covers (id, label) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label');
  const upsertCv = db.prepare('INSERT INTO cvs (id, label) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label');
  const upsertPortfolio = db.prepare('INSERT INTO portfolios (id, label) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label');

  for (const item of covers) upsertCover.run(item.id, item.label);
  for (const item of cvs) upsertCv.run(item.id, item.label);
  for (const item of portfolios) upsertPortfolio.run(item.id, item.label);

  return getCatalog();
}

function mapVariantRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    company: row.company || '',
    isTemplate: Boolean(row.isTemplate ?? row.is_template),
    coverId: row.coverId ?? row.cover_id,
    cvId: row.cvId ?? row.cv_id,
    portfolioId: row.portfolioId ?? row.portfolio_id,
    updatedAt: row.updatedAt ?? row.updated_at
  };
}

function ensureCanonicalVariants() {
  const catalog = getCatalog();
  const has = (kind, id) => catalog[kind].some((item) => item.id === id);

  if (has('covers', 'default') && has('cvs', 'default') && has('portfolios', 'default')) {
    upsertVariant({
      id: 'default',
      label: 'Default template',
      company: '',
      isTemplate: true,
      coverId: 'default',
      cvId: 'default',
      portfolioId: 'default'
    }, { persist: false });
  }

  if (has('covers', 'breville') && has('cvs', 'breville') && has('portfolios', 'breville')) {
    upsertVariant({
      id: 'breville',
      label: 'Breville',
      company: 'Breville',
      isTemplate: false,
      coverId: 'breville',
      cvId: 'breville',
      portfolioId: 'breville'
    }, { persist: false });
  }
}

function seedVariantsIfNeeded() {
  const db = openDb();
  const count = db.prepare('SELECT COUNT(*) AS count FROM applications').get().count;

  if (count === 0) {
    const fromVariants = readJson(VARIANTS_JSON, null);
    if (fromVariants?.variants?.length) {
      for (const variant of fromVariants.variants) {
        upsertVariant(variant, { persist: false });
      }
      setActiveVariantId(fromVariants.activeVariantId || 'default', { persist: false });
    }
  }

  ensureCanonicalVariants();

  const preferred = readJson(VARIANTS_JSON, null)?.activeVariantId;
  if (preferred && getVariant(preferred)) {
    setActiveVariantId(preferred, { persist: false });
  } else if (!getActiveVariantId()) {
    setActiveVariantId(getVariant('default')?.id || listVariants()[0]?.id, { persist: false });
  }

  persistVariantsJson();
}

function getCatalog() {
  const db = openDb();
  return {
    covers: db.prepare('SELECT id, label FROM covers ORDER BY label COLLATE NOCASE').all(),
    cvs: db.prepare('SELECT id, label FROM cvs ORDER BY label COLLATE NOCASE').all(),
    portfolios: db.prepare('SELECT id, label FROM portfolios ORDER BY label COLLATE NOCASE').all()
  };
}

function listVariants() {
  const db = openDb();
  const rows = db.prepare(`
    SELECT
      id,
      label,
      company,
      is_template AS isTemplate,
      cover_id AS coverId,
      cv_id AS cvId,
      portfolio_id AS portfolioId,
      updated_at AS updatedAt
    FROM applications
    ORDER BY is_template DESC, label COLLATE NOCASE
  `).all();
  return rows.map(mapVariantRow);
}

function getVariant(id) {
  const db = openDb();
  const row = db.prepare(`
    SELECT
      id,
      label,
      company,
      is_template AS isTemplate,
      cover_id AS coverId,
      cv_id AS cvId,
      portfolio_id AS portfolioId,
      updated_at AS updatedAt
    FROM applications
    WHERE id = ?
  `).get(id);
  return mapVariantRow(row);
}

function getMeta(key, fallback = null) {
  const db = openDb();
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setMeta(key, value) {
  const db = openDb();
  db.prepare(`
    INSERT INTO app_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function getActiveVariantId() {
  const activeId = getMeta('active_variant_id') || getMeta('active_application_id');
  if (activeId && getVariant(activeId)) return activeId;
  const first = listVariants()[0];
  return first ? first.id : null;
}

function setActiveVariantId(id, options = {}) {
  const variant = getVariant(id);
  if (!variant) throw new Error(`Variant "${id}" was not found.`);
  setMeta('active_variant_id', id);
  setMeta('active_application_id', id);
  if (options.persist !== false) persistVariantsJson();
  return variant;
}

function upsertVariant(input, options = {}) {
  const db = openDb();
  syncCatalogFromFilesystem();
  const catalog = getCatalog();
  const id = slugify(input.id || input.label || input.company);
  const label = String(input.label || input.company || id).trim();
  const company = String(input.company || (input.isTemplate ? '' : label)).trim();
  const coverId = input.coverId || input.cover_id;
  const cvId = input.cvId || input.cv_id;
  const portfolioId = input.portfolioId || input.portfolio_id;
  const isTemplate = input.isTemplate ? 1 : 0;

  if (!label) throw new Error('Variant label is required.');
  if (!catalog.covers.some((item) => item.id === coverId)) throw new Error(`Cover "${coverId}" was not found.`);
  if (!catalog.cvs.some((item) => item.id === cvId)) throw new Error(`CV "${cvId}" was not found.`);
  if (!catalog.portfolios.some((item) => item.id === portfolioId)) throw new Error(`Portfolio "${portfolioId}" was not found.`);

  db.prepare(`
    INSERT INTO applications (id, label, company, is_template, cover_id, cv_id, portfolio_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      company = excluded.company,
      is_template = excluded.is_template,
      cover_id = excluded.cover_id,
      cv_id = excluded.cv_id,
      portfolio_id = excluded.portfolio_id,
      updated_at = excluded.updated_at
  `).run(id, label, company, isTemplate, coverId, cvId, portfolioId, nowIso());

  if (!getActiveVariantId()) setMeta('active_variant_id', id);
  if (options.persist !== false) persistVariantsJson();
  return getVariant(id);
}

function deleteVariant(id) {
  const existing = getVariant(id);
  if (!existing) throw new Error(`Variant "${id}" was not found.`);
  if (existing.isTemplate) throw new Error('The Default template cannot be deleted.');

  const db = openDb();
  db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  if (getActiveVariantId() === id) {
    const next = listVariants()[0];
    if (next) setActiveVariantId(next.id, { persist: false });
    else {
      db.prepare('DELETE FROM app_meta WHERE key = ?').run('active_variant_id');
      db.prepare('DELETE FROM app_meta WHERE key = ?').run('active_application_id');
    }
  }
  persistVariantsJson();
  return true;
}

function persistVariantsJson() {
  const catalog = getCatalog();
  const payload = {
    activeVariantId: getActiveVariantId(),
    variants: listVariants()
  };
  writeJson(VARIANTS_JSON, payload);
  writeJson(APPLICATIONS_JSON, {
    activeApplicationId: payload.activeVariantId,
    applications: payload.variants
  });
  writeJson(path.join(CONTENT_DIR, 'app', 'versions.json'), {
    coverLetters: catalog.covers,
    cvs: catalog.cvs,
    portfolios: catalog.portfolios
  });
  return payload;
}

function getBootstrapData() {
  syncCatalogFromFilesystem();
  const catalog = getCatalog();
  const variants = listVariants();
  const activeVariantId = getActiveVariantId();
  const activeVariant = activeVariantId ? getVariant(activeVariantId) : null;

  return {
    catalog,
    variants,
    activeVariantId,
    activeVariant,
    // backward-compatible aliases
    applications: variants,
    activeApplicationId: activeVariantId,
    activeApplication: activeVariant,
    versions: {
      coverLetters: catalog.covers,
      cvs: catalog.cvs,
      portfolios: catalog.portfolios
    }
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function duplicateCover({ fromId, id, label }) {
  const sourceId = slugify(fromId);
  const targetId = slugify(id || label);
  const sourcePath = path.join(CONTENT_DIR, 'cover', `${sourceId}.json`);
  const targetPath = path.join(CONTENT_DIR, 'cover', `${targetId}.json`);
  if (!fs.existsSync(sourcePath)) throw new Error(`Cover "${sourceId}" was not found.`);
  if (fs.existsSync(targetPath)) throw new Error(`Cover "${targetId}" already exists.`);
  const data = readJson(sourcePath, {});
  data.id = targetId;
  data.label = label || `${data.label || sourceId} Copy`;
  writeJson(targetPath, data);
  syncCatalogFromFilesystem();
  return getCatalog().covers.find((item) => item.id === targetId);
}

function duplicateCv({ fromId, id, label }) {
  const sourceId = slugify(fromId);
  const targetId = slugify(id || label);
  const sourceDir = path.join(CONTENT_DIR, 'cv', sourceId);
  const targetDir = path.join(CONTENT_DIR, 'cv', targetId);
  if (!fs.existsSync(sourceDir)) throw new Error(`CV "${sourceId}" was not found.`);
  if (fs.existsSync(targetDir)) throw new Error(`CV "${targetId}" already exists.`);
  copyDir(sourceDir, targetDir);
  writeJson(path.join(targetDir, 'meta.json'), {
    id: targetId,
    label: label || `${sourceId} Copy`
  });
  syncCatalogFromFilesystem();
  return getCatalog().cvs.find((item) => item.id === targetId);
}

function duplicatePortfolio({ fromId, id, label }) {
  const sourceId = slugify(fromId);
  const targetId = slugify(id || label);
  const sourcePath = path.join(CONTENT_DIR, 'portfolio', `${sourceId}.json`);
  const targetPath = path.join(CONTENT_DIR, 'portfolio', `${targetId}.json`);
  if (!fs.existsSync(sourcePath)) throw new Error(`Portfolio "${sourceId}" was not found.`);
  if (fs.existsSync(targetPath)) throw new Error(`Portfolio "${targetId}" already exists.`);
  const data = readJson(sourcePath, {});
  data.id = targetId;
  data.label = label || `${data.label || sourceId} Copy`;
  writeJson(targetPath, data);
  syncCatalogFromFilesystem();
  return getCatalog().portfolios.find((item) => item.id === targetId);
}

function createVariantFrom({ label, company, fromId }) {
  const source = getVariant(fromId || 'default');
  if (!source) throw new Error(`Clone source "${fromId || 'default'}" was not found.`);

  const id = slugify(label || company);
  if (getVariant(id)) throw new Error(`Variant "${id}" already exists.`);

  const coverLabel = `${label} Cover Letter`;
  const cvLabel = `${label} CV`;
  const portfolioLabel = `${label} Portfolio`;

  duplicateCover({ fromId: source.coverId, id, label: coverLabel });
  duplicateCv({ fromId: source.cvId, id, label: cvLabel });
  duplicatePortfolio({ fromId: source.portfolioId, id, label: portfolioLabel });

  const variant = upsertVariant({
    id,
    label: label || company || id,
    company: company || label || '',
    isTemplate: false,
    coverId: id,
    cvId: id,
    portfolioId: id
  });

  setActiveVariantId(variant.id);
  return variant;
}

function getContent(kind, id) {
  const safeId = slugify(id);
  if (kind === 'cover') {
    const filePath = path.join(CONTENT_DIR, 'cover', `${safeId}.json`);
    const data = readJson(filePath, null);
    if (!data) throw new Error(`Cover "${safeId}" was not found.`);
    return data;
  }
  if (kind === 'portfolio') {
    const filePath = path.join(CONTENT_DIR, 'portfolio', `${safeId}.json`);
    const data = readJson(filePath, null);
    if (!data) throw new Error(`Portfolio "${safeId}" was not found.`);
    return data;
  }
  if (kind === 'cv') {
    const base = path.join(CONTENT_DIR, 'cv', safeId);
    if (!fs.existsSync(base)) throw new Error(`CV "${safeId}" was not found.`);
    return {
      meta: readJson(path.join(base, 'meta.json'), { id: safeId, label: safeId }),
      profile: readJson(path.join(base, 'header', 'profile.json'), {}),
      stats: readJson(path.join(base, 'stats', 'stat.json'), {}),
      journey: readJson(path.join(base, 'journey', 'journey.json'), {}),
      impact: readJson(path.join(base, 'impact', 'impact.json'), {}),
      skills: readJson(path.join(base, 'skills', 'skills.json'), {}),
      tools: readJson(path.join(base, 'tools', 'tools.json'), {}),
      references: readJson(path.join(base, 'references', 'references.json'), {})
    };
  }
  if (kind === 'shared-profile') {
    return readJson(path.join(CONTENT_DIR, 'shared', 'profile.json'), {});
  }
  throw new Error(`Unknown content kind "${kind}".`);
}

function putContent(kind, id, payload) {
  const safeId = slugify(id);
  if (kind === 'cover') {
    const data = { ...payload, id: safeId };
    writeJson(path.join(CONTENT_DIR, 'cover', `${safeId}.json`), data);
    syncCatalogFromFilesystem();
    return data;
  }
  if (kind === 'portfolio') {
    const data = { ...payload, id: safeId };
    writeJson(path.join(CONTENT_DIR, 'portfolio', `${safeId}.json`), data);
    syncCatalogFromFilesystem();
    return data;
  }
  if (kind === 'cv') {
    const base = path.join(CONTENT_DIR, 'cv', safeId);
    if (!fs.existsSync(base)) throw new Error(`CV "${safeId}" was not found.`);
    if (payload.meta) writeJson(path.join(base, 'meta.json'), { ...payload.meta, id: safeId });
    if (payload.profile) writeJson(path.join(base, 'header', 'profile.json'), payload.profile);
    if (payload.stats) writeJson(path.join(base, 'stats', 'stat.json'), payload.stats);
    if (payload.journey) writeJson(path.join(base, 'journey', 'journey.json'), payload.journey);
    if (payload.impact) writeJson(path.join(base, 'impact', 'impact.json'), payload.impact);
    if (payload.skills) writeJson(path.join(base, 'skills', 'skills.json'), payload.skills);
    if (payload.tools) writeJson(path.join(base, 'tools', 'tools.json'), payload.tools);
    if (payload.references) writeJson(path.join(base, 'references', 'references.json'), payload.references);
    syncCatalogFromFilesystem();
    return getContent('cv', safeId);
  }
  if (kind === 'shared-profile') {
    writeJson(path.join(CONTENT_DIR, 'shared', 'profile.json'), payload);
    return payload;
  }
  throw new Error(`Unknown content kind "${kind}".`);
}

// Backward-compatible aliases
const listApplications = listVariants;
const getApplication = getVariant;
const getActiveApplicationId = getActiveVariantId;
const setActiveApplicationId = setActiveVariantId;
const upsertApplication = upsertVariant;
const deleteApplication = deleteVariant;
const persistApplicationsJson = persistVariantsJson;

module.exports = {
  ROOT,
  DB_PATH,
  openDb,
  syncCatalogFromFilesystem,
  getCatalog,
  listVariants,
  getVariant,
  getActiveVariantId,
  setActiveVariantId,
  upsertVariant,
  deleteVariant,
  createVariantFrom,
  persistVariantsJson,
  getBootstrapData,
  getContent,
  putContent,
  duplicateCover,
  duplicateCv,
  duplicatePortfolio,
  slugify,
  listCoverFiles,
  listCvDirs,
  listPortfolioFiles,
  listApplications,
  getApplication,
  getActiveApplicationId,
  setActiveApplicationId,
  upsertApplication,
  deleteApplication,
  persistApplicationsJson
};
