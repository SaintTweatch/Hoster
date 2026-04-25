'use strict';

const { WebSocketServer } = require('ws');
const url = require('url');
const logger = require('../utils/logger');
const auth = require('../utils/auth');

const TOPICS = {
  SERVER_STATUS: 'server:status',
  SERVER_LOG: 'server:log',
  SERVER_STATS: 'server:stats',
  STEAM_PROGRESS: 'steam:progress',
  EVENT: 'event',
};

let wss = null;
const subscriptions = new WeakMap(); // ws -> Set<topicKey>

function initWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = url.parse(req.url);
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    if (auth.authEnabled() && !auth.isAuthenticated(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    subscriptions.set(ws, new Set(['*']));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      const subs = subscriptions.get(ws) || new Set();
      if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
        for (const t of msg.topics) if (typeof t === 'string') subs.add(t);
        subscriptions.set(ws, subs);
      } else if (msg.type === 'unsubscribe' && Array.isArray(msg.topics)) {
        for (const t of msg.topics) subs.delete(t);
        subscriptions.set(ws, subs);
      } else if (msg.type === 'ping') {
        try { ws.send(JSON.stringify({ type: 'pong', ts: Date.now() })); } catch (_) {}
      }
    });
    try {
      ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
    } catch (_) {}
  });

  setInterval(() => {
    if (!wss) return;
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) {
        try { ws.ping(); } catch (_) {}
      }
    }
  }, 30000).unref();

  logger.info('WebSocket server attached at /ws');
}

function topicMatches(subs, topic) {
  if (!subs || subs.size === 0) return false;
  if (subs.has('*')) return true;
  if (subs.has(topic)) return true;
  // wildcard like "server:*"
  for (const pattern of subs) {
    if (!pattern.endsWith(':*')) continue;
    const prefix = pattern.slice(0, -1);
    if (topic.startsWith(prefix)) return true;
  }
  return false;
}

function broadcast(topic, payload) {
  if (!wss) return;
  const json = JSON.stringify({ type: topic, ts: Date.now(), data: payload });
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const subs = subscriptions.get(ws);
    if (!topicMatches(subs, topic)) continue;
    try { ws.send(json); } catch (_) { /* ignore */ }
  }
}

module.exports = { initWebSocket, broadcast, TOPICS };
