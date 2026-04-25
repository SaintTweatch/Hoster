# DayZ Manager — v1.0.0

An open-source, self-hosted **DayZ dedicated server manager** with a beginner-friendly web
dashboard and a production-ready Node.js backend. Install, configure, run, monitor, and mod
your DayZ servers without ever touching a command line.

> 100% free. No telemetry. No cloud lock-in. Works offline. MIT licensed.

---

## Features

- **One-click server creation.** Pick a name and ports, click *Create* — the manager
  installs DayZ via SteamCMD, generates `serverDZ.cfg`, prepares folders, and launches it.
- **Full lifecycle control.** Start / stop / restart, automatic restart on crash, optional
  scheduled restarts, live process status, CPU & RAM monitoring.
- **SteamCMD integration.** Auto-downloads SteamCMD on first use. Wraps the official
  install / update / workshop-download commands.
- **Mod manager.** Add mods by Workshop ID, enable/disable, drag-style reorder, automatic
  download, automatic key (`*.bikey`) copy into `keys/`, and load order management.
- **Visual config generator.** Form-based editor for `serverDZ.cfg` with validation, live
  preview, save/load presets.
- **Live console with WebSocket streaming.** Real-time stdout/stderr, search/filter,
  per-server log files persisted to disk.
- **Multi-server.** Run as many servers in parallel as your hardware can handle.
- **Optional local auth.** Single admin login, completely opt-in.
- **REST API.** Every UI action is also reachable via JSON for automation.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Web dashboard (React + Vite)                      │
│           pages, components, hooks – Tailwind dark UI, /ws live          │
└──────────────────────────────────────────────────────────────────────────┘
                          │ HTTP /api      ▲ WebSocket /ws
                          ▼                │
┌──────────────────────────────────────────────────────────────────────────┐
│                     Backend (Node.js + Express)                          │
│  routes/ → controllers/ → services/ (steamcmd, serverManager, mods,      │
│  config, logs)  • websocket/wsServer.js  • SQLite via better-sqlite3     │
└──────────────────────────────────────────────────────────────────────────┘
                          │ child_process / fs / SteamCMD
                          ▼
                     DayZ dedicated server processes
```

Folders:

```
DayZ-Manager/
├── backend/             Node.js / Express / WebSocket
│   ├── controllers/     HTTP handlers
│   ├── services/        Business logic (lifecycle, mods, config, steam, logs, settings)
│   ├── routes/          Express routers mounted under /api
│   ├── websocket/       Live event hub
│   ├── steamcmd/        Module re-export (uses services/steamcmdService.js)
│   ├── serverManager/   Module re-export (uses services/serverManager.js)
│   ├── utils/           paths, logger, validators, auth
│   ├── tests/           node --test based unit tests
│   └── index.js         Entrypoint
├── frontend/            React + Vite + Tailwind dashboard
│   └── src/{components,pages,hooks,services}
├── configs/             Example serverDZ.cfg / BattlEye config
├── servers/             Per-server install dirs (created at runtime)
├── database/            SQLite database file
├── logs/                Persisted backend + per-server console logs
├── scripts/             install.bat / start.bat / install.sh / start.sh
├── steamcmd/            Auto-installed SteamCMD (created at runtime)
├── LICENSE
└── README.md
```

---

## Prerequisites

| Requirement                | Notes                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| **Windows 10/11 or Linux** | Windows is the primary target; Linux is fully supported.              |
| **Node.js 18.17+ LTS**     | https://nodejs.org/ (use the LTS installer).                          |
| **C/C++ build tools**      | Required to build `better-sqlite3`. On Windows: `npm i -g windows-build-tools` is no longer needed; the Node 18+ MSI now ships with the necessary toolchain. On Linux: `sudo apt install build-essential python3`. |
| **Open UDP ports**         | Default 2302 (game) and 27016 (Steam query). Forward in your router for public hosting. |
| **Disk space**             | DayZ server is ~6–8 GB; each mod adds 100 MB–4 GB.                    |

> SteamCMD itself does **not** need to be installed manually – the manager downloads and
> sets it up the first time you create a server.

---

## Quick start (Windows)

```bat
:: 1. Open this folder in a normal command prompt
cd C:\Users\You\Desktop\DayZ-Manager-v1.0.0

:: 2. Install all dependencies (root + backend + frontend)
scripts\install.bat

:: 3. Start the manager (dev mode: hot-reloading backend + Vite frontend)
scripts\start.bat
```

Now open **http://127.0.0.1:5173** in your browser. The Vite dev server proxies `/api`
and `/ws` to the backend at `http://127.0.0.1:8765`.

For a single-process **production** run (frontend bundle served by Express):

```bat
scripts\start-prod.bat
:: Then open http://127.0.0.1:8765
```

## Quick start (Linux / macOS)

```bash
chmod +x scripts/*.sh
scripts/install.sh
scripts/start.sh        # dev
# or
scripts/start-prod.sh   # production
```

---

## First-time walkthrough

1. **Open the dashboard** (`http://127.0.0.1:5173` in dev, or `:8765` in prod).
2. **Configure your Steam account.** Open **Settings** and enter the username and
   password of a Steam account that owns DayZ. The DayZ dedicated server (App ID
   `223350`) is **not** anonymously downloadable, so this step is required.
   Credentials are encrypted at rest with AES-256-GCM (key derived from
   `SESSION_SECRET` in `.env`).
3. Click **Test login**. If your account uses Steam Guard, a modal will appear
   asking for the email or mobile-authenticator code. Enter it once — SteamCMD
   then caches the session on this machine, so you won't be prompted again.
4. Click **Create server**, pick a name and ports (defaults are fine), and check
   *Install via SteamCMD now*. Click **Create**.
5. The manager will:
   - Download SteamCMD (if needed) into `./steamcmd/`
   - Run `steamcmd +force_install_dir <serverDir> +login <user> +app_update 223350 validate +quit`
   - Stream live progress to the **Servers** list and the per-server **Logs** tab
   - Generate a default `serverDZ.cfg` based on your hostname / port
6. Once installed, open the server's **Mods** tab, paste a Workshop ID
   (e.g. `1559212036` for *Community Framework*), click **Install**, then enable it.
7. Open **Config** to tweak `serverDZ.cfg` visually, then **Save & write**.
8. Hit **Start** – open the **Logs** tab to see the live console.
9. Open `client → Direct Connect → 127.0.0.1:2302` in DayZ to join.

> A first-time DayZ server install is roughly **6–8 GB**, which usually takes
> 5–15 minutes depending on your connection. Watch the progress bar in the
> Servers list, or the live SteamCMD output in the Logs tab.

---

## Configuration

All runtime configuration lives in `.env` at the project root. The file is
created automatically from `.env.example` the first time you run the start
script. Open it and **change `SESSION_SECRET` to a long random string** before
saving Steam credentials in the dashboard — it is the encryption key for those
credentials at rest.

```env
# Backend HTTP/WebSocket port
PORT=8765
HOST=127.0.0.1

# Optional dashboard login (leave blank to disable)
ADMIN_USER=
ADMIN_PASSWORD=

# Used to derive the AES-256-GCM key that encrypts Steam credentials in SQLite.
# Generate one with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_SECRET=change-me-to-a-long-random-string

# Optional: re-use an existing SteamCMD install
STEAMCMD_PATH=

# Optional path overrides
# DATA_DIR=
# SERVERS_DIR=
# LOGS_DIR=
# CONFIGS_DIR=
```

> **Security tips**
> - If you bind the backend to `0.0.0.0`, **always** set `ADMIN_USER` / `ADMIN_PASSWORD`.
> - Always replace `SESSION_SECRET` before storing real Steam credentials.
> - The default bind is `127.0.0.1`, so the dashboard is only reachable from
>   the local machine until you change it.

---

## REST API (selected endpoints)

| Method | Path                                  | Description                         |
| ------ | ------------------------------------- | ----------------------------------- |
| GET    | `/api/system/info`                    | host metrics + steamcmd status      |
| GET    | `/api/servers`                        | list servers                        |
| POST   | `/api/servers`                        | create server                       |
| POST   | `/api/servers/:id/start`              | start server                        |
| POST   | `/api/servers/:id/stop?force=1`       | stop (or force-kill) server         |
| POST   | `/api/servers/:id/restart`            | restart server                      |
| POST   | `/api/servers/:id/install`            | install/update via SteamCMD         |
| GET    | `/api/servers/:id/config`             | get serverDZ.cfg payload + render   |
| PUT    | `/api/servers/:id/config`             | save and write serverDZ.cfg         |
| GET    | `/api/mods/:serverId`                 | list mods                           |
| POST   | `/api/mods/:serverId`                 | add mod                             |
| POST   | `/api/mods/:serverId/:modId/install`  | download a workshop mod             |
| GET    | `/api/logs/:serverId/tail?limit=500`  | tail recent log lines               |
| GET    | `/api/presets`                        | list config presets                 |
| GET    | `/api/settings`                       | get Steam account / app settings    |
| PUT    | `/api/settings/steam`                 | save Steam username / password      |
| POST   | `/api/settings/steam/test-login`      | run +login then +quit to validate   |
| POST   | `/api/settings/steam/guard`           | submit a Steam Guard 2FA code       |
| POST   | `/api/settings/steam/cancel`          | cancel an in-progress SteamCMD job  |

### WebSocket events (`ws://host:port/ws`)

Topic-based JSON messages. Subscribe with `{ "type":"subscribe", "topics":["*"] }`.

- `server:status` — `{ serverId, status, pid, startedAt }`
- `server:stats` — `{ serverId, cpu, memory, uptimeMs }`
- `server:log` — `{ serverId, ts, stream, line }`
- `steam:progress` — `{ serverId, kind, percent, line }`
  - `kind: 'server-install' | 'workshop-download' | 'steam-guard-required'`
  - When `kind === 'steam-guard-required'`, the dashboard pops a modal asking
    for the email or mobile-authenticator code; submit it via
    `POST /api/settings/steam/guard`.

---

## Tests

A small test suite covers the config generator, validators, mod manager logic, and the
server manager database flow:

```bat
npm --prefix backend test
```

(Runs Node's built-in `node --test` runner against `backend/tests/*.test.js`.)

---

## Security model

- All inputs (server names, ports, mod IDs, file paths) pass strict validators.
- Child processes are spawned **without a shell** – no string interpolation, only argv arrays.
- Every filesystem access through the API is constrained to the server's install directory
  (path traversal is blocked).
- Optional cookie-based session auth for the dashboard (`ADMIN_USER` + `ADMIN_PASSWORD`).
- The backend defaults to binding `127.0.0.1`. Expose it carefully.
- **Steam credentials are encrypted at rest** with AES-256-GCM in the SQLite
  `app_settings` table. The encryption key is derived from `SESSION_SECRET` via
  scrypt — so set a real `SESSION_SECRET` before saving credentials, and treat
  `.env` like any other secret. The plaintext password is never returned by the
  REST API; the dashboard only sees `hasPassword: true|false`.

> The legality of the server itself is your responsibility. This project never bundles or
> redistributes any DayZ binaries — everything is fetched from the official Steam servers.

---

## Roadmap (bonus / future work)

- Plugin system for community-contributed extensions (e.g. Discord webhooks, RCon GUIs).
- One-click backups + restore (configs, mission folder, types.xml, mod list).
- Built-in mod presets (CF, Trader, BBP) sharable as a single JSON file.
- Optional reverse-proxy ready manifest (Caddyfile / nginx snippet).
- Multi-user / role-based admin (operator / readonly).
- Live player list via the Steam query protocol.
- BattlEye RCon GUI built on a small protocol implementation.

---

## License

MIT. See the LICENSE block in each source file or the top of this repository.
