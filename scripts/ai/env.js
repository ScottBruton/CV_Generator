'use strict';

const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env') });

function getOpenAiApiKey() {
  const key = String(process.env.OPEN_AI_API_KEY || '').trim();
  if (!key) {
    throw new Error('OPEN_AI_API_KEY is not configured on the server.');
  }
  return key;
}

function getOpenAiModel() {
  return String(process.env.OPEN_AI_MODEL || 'gpt-5.6-sol').trim() || 'gpt-5.6-sol';
}

module.exports = {
  ROOT,
  getOpenAiApiKey,
  getOpenAiModel
};
