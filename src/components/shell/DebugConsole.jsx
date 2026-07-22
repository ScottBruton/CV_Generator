import { useEffect, useRef, useState } from 'react';
import {
  clearDebugLogs,
  getDebugLogs,
  subscribeDebugLogs
} from '../../lib/debugLog.js';

const DEFAULT_HEIGHT = 100;
const MIN_HEIGHT = 72;
const MAX_HEIGHT_RATIO = 0.7;

export default function DebugConsole({ open, onClose }) {
  const [logs, setLogs] = useState(() => getDebugLogs());
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const bodyRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => subscribeDebugLogs(setLogs), []);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs, open, height]);

  useEffect(() => {
    function onMove(event) {
      if (!dragRef.current) return;
      const next = window.innerHeight - event.clientY;
      const max = Math.floor(window.innerHeight * MAX_HEIGHT_RATIO);
      setHeight(Math.min(max, Math.max(MIN_HEIGHT, next)));
    }

    function onUp() {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="debug-console" style={{ height }} role="log" aria-live="polite" aria-label="Debug console">
      <div
        className="debug-console__resize"
        title="Drag to resize"
        onPointerDown={(event) => {
          dragRef.current = true;
          document.body.style.cursor = 'ns-resize';
          document.body.style.userSelect = 'none';
          event.preventDefault();
        }}
      />
      <div className="debug-console__toolbar">
        <strong>Debug console</strong>
        <span className="debug-console__meta">{logs.length} entries</span>
        <div className="debug-console__actions">
          <button type="button" className="shell-btn shell-btn--tiny" onClick={clearDebugLogs}>
            Clear
          </button>
          <button type="button" className="shell-btn shell-btn--tiny" onClick={onClose}>
            Hide
          </button>
        </div>
      </div>
      <div className="debug-console__body" ref={bodyRef}>
        {logs.length ? logs.map((entry) => (
          <div key={entry.id} className={`debug-console__line debug-console__line--${entry.level}`}>
            <span className="debug-console__time">{entry.timestamp.slice(11, 23)}</span>
            <span className="debug-console__level">{entry.level}</span>
            <span className="debug-console__msg">{entry.message}</span>
          </div>
        )) : (
          <div className="debug-console__empty">No logs yet. Console output and runtime errors will appear here.</div>
        )}
      </div>
    </div>
  );
}
