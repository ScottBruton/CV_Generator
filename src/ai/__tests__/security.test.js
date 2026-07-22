import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

describe('API key isolation', () => {
  it('never references OPEN_AI_API_KEY from client-side source', () => {
    const files = walk(path.join(ROOT, 'src'));
    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('OPEN_AI_API_KEY') || text.includes('sk-proj-') || text.includes('process.env.OPEN_AI')) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps env loader on the server only', () => {
    const envModule = fs.readFileSync(path.join(ROOT, 'scripts/ai/env.js'), 'utf8');
    expect(envModule).toContain('OPEN_AI_API_KEY');
    expect(envModule).toContain('dotenv');
  });
});
