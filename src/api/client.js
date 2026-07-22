import { appendDebugLog } from '../lib/debugLog.js';

const API_ORIGIN = '';

async function request(pathname, options = {}) {
  try {
    const response = await fetch(`${API_ORIGIN}${pathname}`, {
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
      throw new Error(message);
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

export async function exportPdf({ mode, variantId, coverId, cvId, portfolioId }) {
  const response = await fetch('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      variant: variantId,
      cover: coverId,
      cv: cvId,
      portfolio: portfolioId
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.blob();
}
