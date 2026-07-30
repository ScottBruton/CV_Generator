import { appendDebugLog } from '../lib/debugLog.js';

const API_ORIGIN = '';

async function request(pathname, options = {}) {
  try {
    const response = await fetch(`${API_ORIGIN}${pathname}`, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || `Request failed (${response.status})`;
      appendDebugLog('error', [`API ${options.method || 'GET'} ${pathname}`, message]);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    appendDebugLog('debug', [`API ${options.method || 'GET'} ${pathname}`, `OK ${response.status}`]);
    return data;
  } catch (error) {
    if (!String(error.message || '').startsWith('API ') && !String(error.message || '').includes('Request failed')) {
      appendDebugLog('error', [`API ${options.method || 'GET'} ${pathname}`, error.message || error]);
    }
    throw error;
  }
}

export function fetchAuthStatus() {
  return request('/api/auth/me');
}

export function login({ username, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function fetchBootstrap() {
  return request('/api/bootstrap');
}

export function setActiveVariant(id) {
  return request('/api/active-variant', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
}

export function createVariant({ label, company, fromId }) {
  return request('/api/variants', {
    method: 'POST',
    body: JSON.stringify({ label, company, fromId })
  });
}

export function deleteVariant(id) {
  return request(`/api/variants/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function fetchContent(kind, id) {
  return request(`/api/content/${encodeURIComponent(kind)}/${encodeURIComponent(id || 'default')}`);
}

export function saveContent(kind, id, content) {
  return request(`/api/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ content })
  });
}

export function uploadCoverLogo({ filename, mimeType, data }) {
  return request('/api/upload/cover-logo', {
    method: 'POST',
    body: JSON.stringify({ filename, mimeType, data })
  });
}

export function analyseJobSummary(payload) {
  return request('/api/ai/job-summary', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function tailorDocuments(payload) {
  return request('/api/ai/tailor', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function exportPdf({ mode, variantId, coverId, cvId, portfolioId, maxMb }) {
  const response = await fetch('/export', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      variant: variantId,
      cover: coverId,
      cv: cvId,
      portfolio: portfolioId,
      maxMb: maxMb || undefined
    })
  });

  if (!response.ok) {
    let message = await response.text();
    try {
      const data = JSON.parse(message);
      if (data.error) message = data.error;
    } catch {
      // keep text
    }
    throw new Error(message || `Export failed (${response.status})`);
  }

  return response.blob();
}
