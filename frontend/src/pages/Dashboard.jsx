import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, MemoryStick, Server, Boxes, Plus, KeyRound } from 'lucide-react';
import { Servers, System, Steam, Settings as SettingsApi } from '../services/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';

function fmtBytes(n) {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [servers, setServers] = useState([]);
  const [steam, setSteam] = useState({ installed: false });
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [i, s, st, cfg] = await Promise.all([System.info(), Servers.list(), Steam.status(), SettingsApi.get()]);
      setInfo(i);
      setServers(s);
      setSteam(st);
      setSettings(cfg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 7000);
    return () => clearInterval(t);
  }, []);

  async function installSteam() {
    try {
      await System.installSteamcmd();
      toast.info('Installing SteamCMD in the background…');
    } catch (e) {
      toast.error('Failed to start SteamCMD install');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-ink-200 text-sm">Overview of your DayZ servers and host machine.</p>
        </div>
        <Link to="/servers" className="btn-primary"><Plus size={16} /> New server</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Servers" value={loading ? '—' : servers.length} hint={`${servers.filter((s) => s.status === 'running').length} running`} />
        <StatCard icon={Boxes} label="SteamCMD" value={steam.installed ? 'Ready' : 'Not installed'} hint={steam.installed ? 'Auto-installed' : 'Will install on first use'} />
        <StatCard icon={Cpu} label="CPU cores" value={info?.cpu?.cores || '—'} hint={info?.cpu?.model?.split('@')[0] || ''} />
        <StatCard icon={MemoryStick} label="Memory" value={info ? `${fmtBytes(info.memory.total - info.memory.free)} / ${fmtBytes(info.memory.total)}` : '—'} hint="Used / Total" />
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-ink-500/40 flex items-center justify-between">
          <h3 className="font-medium">Your servers</h3>
          <Link to="/servers" className="text-sm text-brand-300 hover:text-brand-100">Manage →</Link>
        </div>
        <div className="divide-y divide-ink-500/40">
          {servers.length === 0 && (
            <div className="p-6 text-sm text-ink-200">
              No servers yet. <Link to="/servers" className="text-brand-300 hover:text-brand-100">Create your first server</Link> to get started.
            </div>
          )}
          {servers.map((s) => (
            <Link
              to={`/servers/${s.id}`}
              key={s.id}
              className="px-5 py-3 flex items-center justify-between hover:bg-ink-600/40"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-ink-200">port {s.port} · query {s.query_port} · {s.branch}</div>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      </div>

      {settings && !settings.steam?.username && (
        <div className="card p-5 flex items-center justify-between border-amber-500/30">
          <div>
            <div className="font-medium flex items-center gap-2"><KeyRound size={16} /> Steam credentials required</div>
            <div className="text-sm text-ink-200">
              The DayZ dedicated server is <strong>not</strong> anonymously downloadable. Add a Steam account
              that owns DayZ before installing a server, or installs will fail with "No subscription".
            </div>
          </div>
          <Link to="/settings" className="btn-primary">Configure Steam account</Link>
        </div>
      )}

      {!steam.installed && (
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="font-medium">SteamCMD is required</div>
            <div className="text-sm text-ink-200">DayZ Manager will download SteamCMD automatically the first time it's needed, or you can install it now.</div>
          </div>
          <button className="btn-primary" onClick={installSteam}>Install SteamCMD now</button>
        </div>
      )}
    </div>
  );
}
