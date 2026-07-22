'use strict';

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const MIN_CHARS = 280;

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function collectMeta(document) {
  const get = (selector, attr = 'content') => {
    const el = document.querySelector(selector);
    return cleanText(el?.getAttribute(attr) || el?.textContent || '');
  };

  return {
    ogTitle: get('meta[property="og:title"]'),
    ogDescription: get('meta[property="og:description"]'),
    description: get('meta[name="description"]'),
    title: cleanText(document.title || '')
  };
}

function collectJsonLd(document) {
  const blocks = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = JSON.parse(script.textContent || 'null');
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const type = String(item['@type'] || '');
        if (/JobPosting/i.test(type) || item.title || item.description) {
          blocks.push(item);
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return blocks;
}

function htmlToText(html) {
  if (!html) return '';
  const dom = new JSDOM(`<body>${html}</body>`);
  return cleanText(dom.window.document.body.textContent || '');
}

function collectLinkedInish(document) {
  const selectors = [
    '.show-more-less-html__markup',
    '.description__text',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '[data-test-id="job-details-description"]',
    'article',
    'main'
  ];
  const chunks = [];
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const text = cleanText(el.textContent || '');
      if (text.length >= 120) chunks.push(text);
    }
  }
  return chunks;
}

function scoreJobText(text) {
  const value = String(text || '');
  let score = value.length;
  if (/responsibilit|what you.?ll|requirements|solidworks|cad|engineer|design for manufacture/i.test(value)) {
    score += 800;
  }
  if (/sign in|join now|similar jobs|people also viewed/i.test(value) && value.length < 1200) {
    score -= 500;
  }
  return score;
}

async function extractJobTextFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CV-Generator-JobExtract/1.1)',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timed out retrieving the job page. Try PDF upload or pasted text instead.');
    }
    throw new Error('Could not retrieve the job page. Try PDF upload or pasted text instead.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`The website returned HTTP ${response.status}. Try PDF upload or pasted text instead.`);
  }

  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('URL did not return an HTML page. Try PDF upload or pasted text instead.');
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url: parsed.toString() });
  const { document } = dom.window;
  const meta = collectMeta(document);
  const jsonLd = collectJsonLd(document);
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const candidates = [];

  if (article?.textContent) {
    candidates.push({
      text: cleanText(article.textContent),
      title: cleanText(article.title || meta.ogTitle || meta.title),
      kind: 'readability'
    });
  }

  for (const item of jsonLd) {
    const description = htmlToText(item.description || '');
    const composed = cleanText([
      item.title ? `Job title: ${item.title}` : '',
      item.hiringOrganization?.name ? `Company: ${item.hiringOrganization.name}` : '',
      item.jobLocation?.address ? `Location: ${JSON.stringify(item.jobLocation.address)}` : '',
      description
    ].filter(Boolean).join('\n\n'));
    if (composed) {
      candidates.push({
        text: composed,
        title: cleanText(item.title || meta.ogTitle || meta.title),
        kind: 'jsonld'
      });
    }
  }

  for (const chunk of collectLinkedInish(document)) {
    candidates.push({
      text: chunk,
      title: meta.ogTitle || meta.title,
      kind: 'selector'
    });
  }

  const metaBlob = cleanText([
    meta.ogTitle || meta.title,
    meta.ogDescription || meta.description
  ].filter(Boolean).join('\n\n'));
  if (metaBlob) {
    candidates.push({
      text: metaBlob,
      title: meta.ogTitle || meta.title,
      kind: 'meta'
    });
  }

  candidates.sort((a, b) => scoreJobText(b.text) - scoreJobText(a.text));
  const best = candidates[0];
  const text = best?.text || '';

  if (text.length < MIN_CHARS) {
    const host = parsed.hostname.replace(/^www\./, '');
    throw new Error(
      `No meaningful job advertisement content could be extracted from ${host}. `
      + 'LinkedIn and similar sites often hide the full description from automated access. '
      + 'Copy the job description text or upload a PDF instead.'
    );
  }

  const looksThin = !/responsibilit|what you|requirements|solidworks|cad|experience/i.test(text)
    && text.length < 900;

  return {
    text,
    title: best?.title || meta.ogTitle || meta.title || '',
    sourceUrl: parsed.toString(),
    extractionKind: best?.kind || 'unknown',
    warning: looksThin
      ? 'Extracted text looks incomplete (common on LinkedIn). Prefer pasted job text for best results.'
      : undefined
  };
}

module.exports = {
  extractJobTextFromUrl,
  MIN_CHARS
};
