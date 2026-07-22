'use strict';

const OpenAI = require('openai');
const { getOpenAiApiKey, getOpenAiModel } = require('./env');

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 1;

function createClient({ timeout = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES } = {}) {
  return new OpenAI({
    apiKey: getOpenAiApiKey(),
    timeout,
    maxRetries
  });
}

/** Newer flagship models reject custom temperature values. */
function supportsCustomTemperature(model) {
  const name = String(model || '').toLowerCase();
  if (!name) return false;
  if (name.includes('gpt-5.6')) return false;
  if (/^o[0-9]/.test(name)) return false;
  return true;
}

function isTimeoutError(error) {
  return error?.name === 'APIConnectionTimeoutError'
    || /timed out/i.test(String(error?.message || ''));
}

/**
 * @param {{
 *   messages: Array<{role:string, content:string}>,
 *   schemaName: string,
 *   timeout?: number,
 *   maxRetries?: number
 * }} params
 */
async function createJsonCompletion({
  messages,
  schemaName,
  timeout = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES
}) {
  const client = createClient({ timeout, maxRetries });
  const model = getOpenAiModel();

  const payload = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      ...messages,
      {
        role: 'system',
        content: `Respond with a single JSON object for ${schemaName}. No markdown fences.`
      }
    ]
  };

  if (supportsCustomTemperature(model)) {
    payload.temperature = 0.2;
  }

  let response;
  try {
    response = await client.chat.completions.create(payload);
  } catch (error) {
    if (isTimeoutError(error)) {
      const wrapped = new Error(
        `AI request timed out after ${Math.round(timeout / 1000)}s. Try again, or reduce focus chips / paste a shorter job summary.`
      );
      wrapped.statusCode = 504;
      throw wrapped;
    }
    throw error;
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON.');
  }
}

module.exports = {
  createJsonCompletion,
  getOpenAiModel,
  supportsCustomTemperature,
  DEFAULT_TIMEOUT_MS
};
