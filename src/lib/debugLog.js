const MAX_ENTRIES = 500;
const listeners = new Set();
/** @type {Array<{ id: number, level: string, message: string, timestamp: string }>} */
let entries = [];
let seq = 0;
let patched = false;

const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
};

function serializeArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }
  try {
    return JSON.stringify(arg, null, 0);
  } catch {
    return String(arg);
  }
}

function notify() {
  for (const listener of listeners) listener(entries);
}

export function appendDebugLog(level, args) {
  const message = (Array.isArray(args) ? args : [args]).map(serializeArg).join(' ');
  entries = [
    ...entries,
    {
      id: ++seq,
      level,
      message,
      timestamp: new Date().toISOString()
    }
  ].slice(-MAX_ENTRIES);
  notify();
}

export function getDebugLogs() {
  return entries;
}

export function clearDebugLogs() {
  entries = [];
  notify();
}

export function subscribeDebugLogs(listener) {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}

export function installDebugConsoleCapture() {
  if (patched || typeof console === 'undefined') return;
  patched = true;

  ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
    console[level] = (...args) => {
      try {
        appendDebugLog(level, args);
      } catch {
        // never break logging
      }
      original[level](...args);
    };
  });

  window.addEventListener('error', (event) => {
    appendDebugLog('error', [
      event.message || 'Window error',
      event.filename ? `@ ${event.filename}:${event.lineno || 0}` : ''
    ]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    appendDebugLog('error', ['Unhandled rejection', event.reason]);
  });

  appendDebugLog('info', ['Debug console capture enabled']);
}
