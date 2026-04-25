'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const paths = require('./utils/paths');
const logger = require('./utils/logger');
const db = require('./db');
const { initWebSocket } = require('./websocket/wsServer');
const auth = require('./utils/auth');

const serversRouter = require('./routes/servers');
const modsRouter = require('./routes/mods');
const configsRouter = require('./routes/configs');
const systemRouter = require('./routes/system');
const logsRouter = require('./routes/logs');
const steamRouter = require('./routes/steam');
const presetsRouter = require('./routes/presets');
const settingsRouter = require('./routes/settings');

const ServerManager = require('./services/serverManager');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 8765;

async function bootstrap() {
  await paths.ensureRuntimeDirs();
  db.init();

  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(auth.middleware());

  // Auth (login/logout/session)
  app.post('/api/auth/login', auth.handleLogin);
  app.post('/api/auth/logout', auth.handleLogout);
  app.get('/api/auth/session', auth.handleSession);

  // API routes
  app.use('/api/servers', serversRouter);
  app.use('/api/mods', modsRouter);
  app.use('/api/configs', configsRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/steam', steamRouter);
  app.use('/api/presets', presetsRouter);
  app.use('/api/settings', settingsRouter);

  // Optional: serve frontend production build if present
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  const fs = require('fs');
  const hasDist = fs.existsSync(path.join(frontendDist, 'index.html'));
  if (hasDist) {
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api|ws).*/, (_req, res, next) => {
      res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
        if (err) next();
      });
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send(
        'DayZ Manager backend is running.\n\n' +
        'For development, start the Vite frontend: npm --prefix frontend run dev\n' +
        '   then open http://127.0.0.1:5173\n\n' +
        'For production, build the frontend bundle: npm --prefix frontend run build\n' +
        '   and restart the backend.'
      );
    });
  }

  // Centralized error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error('HTTP error: ' + (err && err.stack ? err.stack : err));
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  const server = http.createServer(app);
  initWebSocket(server);

  // Restore any auto-start servers and start scheduled restarts
  ServerManager.bootstrap().catch((err) => {
    logger.error('ServerManager bootstrap failed: ' + err.stack);
  });

  server.listen(PORT, HOST, () => {
    logger.info(`DayZ Manager backend listening on http://${HOST}:${PORT}`);
    logger.info(`Servers dir:  ${paths.SERVERS_DIR}`);
    logger.info(`Configs dir:  ${paths.CONFIGS_DIR}`);
    logger.info(`Database:     ${paths.DB_FILE}`);
  });

  const shutdown = async (signal) => {
    logger.warn(`Received ${signal}, shutting down gracefully...`);
    try {
      await ServerManager.shutdownAll();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    } catch (err) {
      logger.error('Shutdown error: ' + err.stack);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
