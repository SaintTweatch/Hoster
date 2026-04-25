import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const WSContext = createContext(null);
export const useWS = () => useContext(WSContext);

export function WebSocketProvider({ children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let stopped = false;

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        try {
          ws.send(JSON.stringify({ type: 'subscribe', topics: ['*'] }));
        } catch (_) {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        try { ws.close(); } catch (_) {}
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }
        for (const listener of listenersRef.current) {
          try { listener(msg); } catch (e) { /* ignore */ }
        }
      };
    }
    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (ws) try { ws.close(); } catch (_) {}
    };
  }, []);

  const value = {
    connected,
    subscribe(listener) {
      listenersRef.current.add(listener);
      return () => listenersRef.current.delete(listener);
    },
    send(obj) {
      const ws = wsRef.current;
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    },
  };

  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}
