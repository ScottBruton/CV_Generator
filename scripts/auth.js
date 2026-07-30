'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'cv_session';
const EXPORT_COOKIE = 'cv_export';
const SESSION_DAYS = 7;
const EXPORT_MINUTES = 15;

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authEnabled() {
  return Boolean(String(process.env.AUTH_USERNAME || '').trim()
    && String(process.env.AUTH_PASSWORD || '').trim());
}

function getSessionSecret() {
  return String(process.env.SESSION_SECRET || process.env.EXPORT_INTERNAL_KEY || '').trim()
    || 'local-dev-only-change-me';
}

function getExportKey() {
  return String(process.env.EXPORT_INTERNAL_KEY || process.env.SESSION_SECRET || '').trim()
    || 'local-dev-only-change-me';
}

function signPayload(payloadObject, maxAgeMs) {
  const body = {
    ...payloadObject,
    exp: Date.now() + maxAgeMs
  };
  const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || !String(token).includes('.')) return null;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  if (!timingSafeEqualString(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.exp || Date.now() > Number(data.exp)) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieHeader(name, value, { maxAgeSec, httpOnly = true } = {}) {
  const secure = process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === '1';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax'
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAgeSec != null) parts.push(`Max-Age=${Math.max(0, Number(maxAgeSec) || 0)}`);
  return parts.join('; ');
}

function clearCookieHeader(name) {
  return cookieHeader(name, '', { maxAgeSec: 0 });
}

function createSessionToken(username) {
  return signPayload({ u: username, t: 'session' }, SESSION_DAYS * 24 * 60 * 60 * 1000);
}

function createExportToken() {
  return signPayload({ t: 'export' }, EXPORT_MINUTES * 60 * 1000);
}

function validateCredentials(username, password) {
  if (!authEnabled()) return true;
  const expectedUser = String(process.env.AUTH_USERNAME || '').trim();
  const expectedPass = String(process.env.AUTH_PASSWORD || '');
  return timingSafeEqualString(username, expectedUser)
    && timingSafeEqualString(password, expectedPass);
}

function isAuthenticated(req, url) {
  if (!authEnabled()) return true;

  const exportKey = url?.searchParams?.get('exportKey');
  if (exportKey && timingSafeEqualString(exportKey, getExportKey())) {
    return true;
  }

  const cookies = parseCookies(req);
  if (verifyToken(cookies[COOKIE_NAME])) return true;
  if (verifyToken(cookies[EXPORT_COOKIE])) return true;
  return false;
}

function appendSetCookie(res, headerValue) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', headerValue);
    return;
  }
  const list = Array.isArray(existing) ? existing : [existing];
  res.setHeader('Set-Cookie', [...list, headerValue]);
}

function issueSession(res, username) {
  const token = createSessionToken(username);
  appendSetCookie(res, cookieHeader(COOKIE_NAME, token, {
    maxAgeSec: SESSION_DAYS * 24 * 60 * 60
  }));
}

function issueExportSession(res) {
  const token = createExportToken();
  appendSetCookie(res, cookieHeader(EXPORT_COOKIE, token, {
    maxAgeSec: EXPORT_MINUTES * 60
  }));
}

function clearSession(res) {
  appendSetCookie(res, clearCookieHeader(COOKIE_NAME));
  appendSetCookie(res, clearCookieHeader(EXPORT_COOKIE));
}

function maybeGrantExportSession(req, res, url) {
  if (!authEnabled()) return;
  const exportKey = url.searchParams.get('exportKey');
  if (exportKey && timingSafeEqualString(exportKey, getExportKey())) {
    issueExportSession(res);
  }
}

module.exports = {
  COOKIE_NAME,
  EXPORT_COOKIE,
  authEnabled,
  getExportKey,
  validateCredentials,
  isAuthenticated,
  issueSession,
  clearSession,
  maybeGrantExportSession,
  parseCookies
};
