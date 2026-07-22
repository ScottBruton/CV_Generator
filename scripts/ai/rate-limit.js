'use strict';

const buckets = new Map();

/**
 * Simple fixed-window rate limiter.
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [options]
 */
function checkRateLimit(key, options = {}) {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

module.exports = {
  checkRateLimit
};
