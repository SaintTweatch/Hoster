import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWS } from '../services/ws';
import { Servers } from '../services/api';

const MAX = 2000;

export default function Console({ serverId, height = '60vh' }) {
  const { subscribe } = useWS();
  const [lines, setLines] = useState([]);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Servers.logsTail(serverId, 800).then((res) => {
      if (!mounted) return;
      setLines((prev) => trim([...res.lines]));
    });
    const off = subscribe((msg) => {
      if (msg.type !== 'server:log') return;
      if (!msg.data || msg.data.serverId !== serverId) return;
      setLines((prev) => trim([...prev, msg.data]));
    });
    return () => {
      mounted = false;
      off();
    };
  }, [serverId, subscribe]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const filtered = useMemo(() => {
    if (!filter) return lines;
    const f = filter.toLowerCase();
    return lines.filter((l) => l.line.toLowerCase().includes(f));
  }, [lines, filter]);

  return (
    <div className="card overflow-hidden flex flex-col" style={{ height }}>
      <div className="px-3 py-2 border-b border-ink-500/40 flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Filter logs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="text-xs flex items-center gap-1 text-ink-200">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          auto-scroll
        </label>
        <button className="btn-secondary" onClick={() => setLines([])}>Clear</button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 bg-ink-900/80">
        {filtered.length === 0 && <div className="text-ink-200 text-sm">No log lines yet.</div>}
        {filtered.map((l, i) => (
          <div key={i} className={`console-line console-${l.stream || 'stdout'}`}>
            <span className="text-ink-200/60">{l.ts ? new Date(l.ts).toLocaleTimeString() : ''}</span>
            {' '}{l.line}
          </div>
        ))}
      </div>
    </div>
  );
}

function trim(arr) {
  if (arr.length <= MAX) return arr;
  return arr.slice(arr.length - MAX);
}
