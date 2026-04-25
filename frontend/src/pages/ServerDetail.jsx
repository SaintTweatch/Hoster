import React, { useEffect, useState } from 'react';
import { useParams, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { Cpu, MemoryStick, Play, Square, RotateCw, DownloadCloud } from 'lucide-react';
import { Servers } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useServerStatus } from '../hooks/useServerStatus';
import { useWS } from '../services/ws';
import OverviewTab from './serverTabs/Overview.jsx';
import ConfigTab from './serverTabs/Config.jsx';
import ModsTab from './serverTabs/ModsTab.jsx';
import LogsTab from './serverTabs/LogsTab.jsx';
import SettingsTab from './serverTabs/SettingsTab.jsx';

const TABS = [
  { to: '', label: 'Overview' },
  { to: 'config', label: 'Config' },
  { to: 'mods', label: 'Mods' },
  { to: 'logs', label: 'Logs' },
  { to: 'settings', label: 'Settings' },
];

function fmtBytes(n) {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export default function ServerDetail() {
  const { id } = useParams();
  const toast = useToast();
  const live = useServerStatus(id);
  const { subscribe } = useWS();
  const [server, setServer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [installProgress, setInstallProgress] = useState(null);

  async function refresh() {
    try {
      setServer(await Servers.get(id));
    } catch (e) {
      toast.error('Failed to load server');
    }
  }

  useEffect(() => { refresh(); }, [id]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type !== 'steam:progress') return;
      if (msg.data?.serverId !== id) return;
      if (msg.data.kind !== 'server-install') return;
      if (msg.data.completed) {
        setInstallProgress(null);
        refresh();
        return;
      }
      setInstallProgress({ percent: msg.data.percent, line: msg.data.line, error: msg.data.error });
    });
  }, [id, subscribe]);

  async function action(fn, label) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!server) return <div className="text-ink-200">Loading…</div>;
  const status = live.status || server.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-200">Server</div>
          <h2 className="text-2xl font-semibold">{server.name}</h2>
          <div className="text-xs text-ink-200 mt-1">{server.install_path}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={busy} title="Install / Update via SteamCMD"
              onClick={() => action(() => Servers.install(id), 'Install/update started')}><DownloadCloud size={14} /> Install/Update</button>
            {status === 'running' || status === 'starting' ? (
              <>
                <button className="btn-secondary" disabled={busy}
                  onClick={() => action(() => Servers.restart(id), 'Restarting…')}><RotateCw size={14} /> Restart</button>
                <button className="btn-danger" disabled={busy}
                  onClick={() => action(() => Servers.stop(id), 'Stop signal sent')}><Square size={14} /> Stop</button>
              </>
            ) : (
              <button className="btn-primary" disabled={busy}
                onClick={() => action(() => Servers.start(id), 'Starting…')}><Play size={14} /> Start</button>
            )}
          </div>
        </div>
      </div>

      {(installProgress || status === 'updating' || status === 'installing') && (
        <div className="card p-4 border-amber-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-amber-200">
              {installProgress?.error ? 'SteamCMD install error' : 'SteamCMD installing the DayZ server…'}
            </div>
            <div className="text-xs text-ink-200">
              {installProgress?.percent != null ? `${installProgress.percent.toFixed(1)}%` : 'starting…'}
            </div>
          </div>
          <div className="h-2 w-full rounded bg-ink-500 overflow-hidden">
            <div
              className={`h-full ${installProgress?.error ? 'bg-red-500' : 'bg-brand-500'} transition-all`}
              style={{ width: `${Math.max(3, Math.min(100, installProgress?.percent ?? 5))}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-ink-200 truncate">
            {installProgress?.error || installProgress?.line || 'A first-time install of the DayZ server is ~7 GB and typically takes 5–15 minutes.'}
          </div>
          <div className="mt-1 text-xs text-ink-200">
            Live progress also streams to the <NavLink to="logs" className="text-brand-300">Logs</NavLink> tab.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Port" value={server.port} hint={`Query ${server.query_port}`} />
        <Stat label="Branch" value={server.branch} hint={server.executable || '—'} />
        <Stat icon={Cpu} label="CPU" value={live.cpu != null ? `${live.cpu.toFixed(1)}%` : '—'} hint={server.cpu_count ? `cpuCount=${server.cpu_count}` : 'unset'} />
        <Stat icon={MemoryStick} label="Memory" value={fmtBytes(live.memory)} hint={live.uptimeMs ? `up ${(live.uptimeMs / 1000 / 60).toFixed(1)} min` : ''} />
      </div>

      <div className="border-b border-ink-500/40">
        <nav className="flex gap-2">
          {TABS.map((t) => (
            <NavLink
              end={t.to === ''}
              key={t.to}
              to={t.to}
              className={({ isActive }) => `px-4 py-2 text-sm rounded-t-md ${isActive ? 'bg-ink-700 text-ink-100 border-b-2 border-brand-500' : 'text-ink-200 hover:text-ink-100'}`}
            >{t.label}</NavLink>
          ))}
        </nav>
      </div>

      <Routes>
        <Route index element={<OverviewTab server={server} />} />
        <Route path="config" element={<ConfigTab server={server} onSaved={refresh} />} />
        <Route path="mods" element={<ModsTab server={server} />} />
        <Route path="logs" element={<LogsTab server={server} />} />
        <Route path="settings" element={<SettingsTab server={server} onSaved={refresh} />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-ink-200">{Icon && <Icon size={14} />} {label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-ink-200">{hint}</div>}
    </div>
  );
}
