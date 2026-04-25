import { useEffect, useState } from 'react';
import { useWS } from '../services/ws';

/**
 * Subscribe to status/stats events for a single server.
 *
 * @param {string} serverId
 * @returns {{ status: string|null, pid: number|null, cpu: number|null, memory: number|null, uptimeMs: number|null, error: string|null }}
 */
export function useServerStatus(serverId) {
  const { subscribe } = useWS();
  const [state, setState] = useState({ status: null, pid: null, cpu: null, memory: null, uptimeMs: null, error: null });

  useEffect(() => {
    const off = subscribe((msg) => {
      if (!msg?.data || msg.data.serverId !== serverId) return;
      if (msg.type === 'server:status') {
        setState((s) => ({ ...s, status: msg.data.status, pid: msg.data.pid ?? s.pid, error: msg.data.error || null }));
      } else if (msg.type === 'server:stats') {
        setState((s) => ({ ...s, cpu: msg.data.cpu, memory: msg.data.memory, uptimeMs: msg.data.uptimeMs }));
      }
    });
    return off;
  }, [serverId, subscribe]);

  return state;
}
