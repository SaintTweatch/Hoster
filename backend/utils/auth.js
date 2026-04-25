'use strict';

const crypto = require('crypto');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const sessions = new Map(); // token -> { user, expiresAt }

function authEnabled() {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getCookieToken(req) {
  const raw = req.headers['cookie'];
  if (!raw) return null;
  const parts = raw.split(';').map((s) => s.trim());
  for (const part of parts) {
    if (part.startsWith('dzm_session=')) return decodeURIComponent(part.slice('dzm_session='.length));
  }
  return null;
}

function setCookie(res, token) {
  const expires = new Date(Date.now() + SESSION_TTL_MS).toUTCString();
  res.setHeader('Set-Cookie', `dzm_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'dzm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function isAuthenticated(req) {
  if (!authEnabled()) return true;
  const token = getCookieToken(req) || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const sess = sessions.get(token);
  if (!sess) return false;
  if (sess.expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  req.session = sess;
  req.sessionToken = token;
  return true;
}

function middleware() {
  return (req, res, next) => {
    if (!authEnabled()) return next();
    const isAuth = req.path === '/api/auth/login' || req.path === '/api/auth/session';
    if (isAuth) return next();
    if (!req.path.startsWith('/api/')) return next(); // static assets and SPA routes
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

function handleLogin(req, res) {
  if (!authEnabled()) {
    return res.json({ ok: true, authenticated: false });
  }
  const { username, password } = req.body || {};
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = newToken();
  sessions.set(token, { user: username, expiresAt: Date.now() + SESSION_TTL_MS });
  setCookie(res, token);
  res.json({ ok: true, user: username });
}

function handleLogout(req, res) {
  const token = getCookieToken(req);
  if (token) sessions.delete(token);
  clearCookie(res);
  res.json({ ok: true });
}

function handleSession(req, res) {
  if (!authEnabled()) return res.json({ authEnabled: false, authenticated: true });
  const ok = isAuthenticated(req);
  res.json({ authEnabled: true, authenticated: ok, user: ok ? req.session.user : null });
}

module.exports = {
  middleware,
  authEnabled,
  isAuthenticated,
  handleLogin,
  handleLogout,
  handleSession,
};
