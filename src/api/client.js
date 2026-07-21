const API_ORIGIN = '';

async function request(pathname, options = {}) {
  const response = await fetch(`${API_ORIGIN}${pathname}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
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
