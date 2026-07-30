import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const auth = require('../auth');

describe('auth gate helpers', () => {
  let savedUser;
  let savedPass;
  let savedSecret;

  beforeEach(() => {
    savedUser = process.env.AUTH_USERNAME;
    savedPass = process.env.AUTH_PASSWORD;
    savedSecret = process.env.SESSION_SECRET;
    process.env.AUTH_USERNAME = 'demo-user';
    process.env.AUTH_PASSWORD = 'demo-pass';
    process.env.SESSION_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (savedUser === undefined) delete process.env.AUTH_USERNAME;
    else process.env.AUTH_USERNAME = savedUser;
    if (savedPass === undefined) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = savedPass;
    if (savedSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = savedSecret;
  });

  it('requires both username and password env to enable auth', () => {
    expect(auth.authEnabled()).toBe(true);
    delete process.env.AUTH_PASSWORD;
    expect(auth.authEnabled()).toBe(false);
  });

  it('validates credentials with timing-safe compare', () => {
    expect(auth.validateCredentials('demo-user', 'demo-pass')).toBe(true);
    expect(auth.validateCredentials('demo-user', 'wrong')).toBe(false);
  });
});
