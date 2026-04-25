import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Play, Square, RotateCw, DownloadCloud } from 'lucide-react';
import { Servers as Api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useWS } from '../services/ws';

export default function ServersPage() {
  const toast = useToast();
  const { subscribe } = useWS();
  const [servers, setServers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [progress, setProgress] = useState({});

  async function refresh() {
    try {
      setServers(await Api.list());
    } catch (e) {
      toast.error('Failed to load servers');
    }
  }

  useEffect(() => {
    refresh();
    const off = subscribe((msg) => {
      if (msg.type === 'server:status') {
        setServers((prev) => prev.map((s) => (s.id === msg.data.serverId ? { ...s, status: msg.data.status } : s)));
      } else if (msg.type === 'steam:progress' && msg.data?.kind === 'server-install') {
        setProgress((p) => ({
          ...p,
          [msg.data.serverId]: msg.data.completed
            ? null
            : { percent: msg.data.percent, line: msg.data.line, error: msg.data.error },
        }));
      }
    });
    return off;
  }, [subscribe]);

  async function action(fn, id, label) {
    setBusyId(id);
    try {
      await fn(id);
      toast.success(label);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this server? Files on disk are kept unless you confirm wipe.')) return;
    const wipe = confirm('Also DELETE all files in the install directory? This cannot be undone.');
    try {
      await Api.remove(id, wipe);
      toast.success(wipe ? 'Server and files deleted' : 'Server entry deleted');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Servers</h2>
          <p className="text-ink-200 text-sm">Manage every DayZ server you've created.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Create server
        </button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-200 border-b border-ink-500/40">
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Port / Query</th>
              <th className="py-2 px-4">Branch</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-ink-200">No servers yet.</td></tr>
            )}
            {servers.map((s) => {
              const p = progress[s.id];
              return (
              <tr key={s.id} className="border-b border-ink-500/40 hover:bg-ink-600/40">
                <td className="py-2 px-4">
                  <Link to={`/servers/${s.id}`} className="font-medium hover:text-brand-300">{s.name}</Link>
                  <div className="text-xs text-ink-200 truncate max-w-xs">{s.install_path}</div>
                  {p && (
                    <div className="mt-1 text-xs">
                      <div className="h-1 w-48 rounded bg-ink-500 overflow-hidden">
                        <div
                          className={`h-full ${p.error ? 'bg-red-500' : 'bg-brand-500'} transition-all`}
                          style={{ width: `${Math.max(2, Math.min(100, p.percent ?? 5))}%` }}
                        />
                      </div>
                      <div className="text-ink-200 truncate max-w-xs mt-0.5">
                        {p.error ? `error: ${p.error}` : (p.line || `Installing… ${p.percent != null ? p.percent.toFixed(1) + '%' : ''}`)}
                      </div>
                    </div>
                  )}
                </td>
                <td className="py-2 px-4">{s.port} / {s.query_port}</td>
                <td className="py-2 px-4 capitalize">{s.branch}</td>
                <td className="py-2 px-4"><StatusBadge status={s.status} /></td>
                <td className="py-2 px-4">
                  <div className="flex justify-end gap-2 flex-wrap">
                    <button className="btn-secondary" disabled={busyId === s.id} title="Install/Update via SteamCMD"
                      onClick={() => action(() => Api.install(s.id), s.id, 'Install/update started')}>
                      <DownloadCloud size={14} /> Install
                    </button>
                    {s.status === 'running' || s.status === 'starting' ? (
                      <>
                        <button className="btn-secondary" disabled={busyId === s.id}
                          onClick={() => action(Api.restart, s.id, 'Restarting…')}><RotateCw size={14} /> Restart</button>
                        <button className="btn-danger" disabled={busyId === s.id}
                          onClick={() => action(Api.stop, s.id, 'Stop signal sent')}><Square size={14} /> Stop</button>
                      </>
                    ) : (
                      <button className="btn-primary" disabled={busyId === s.id}
                        onClick={() => action(Api.start, s.id, 'Starting…')}><Play size={14} /> Start</button>
                    )}
                    <button className="btn-ghost" onClick={() => remove(s.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateServerModal open={creating} onClose={() => setCreating(false)} onCreated={refresh} />
    </div>
  );
}

function CreateServerModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', port: 2302, queryPort: 27016, branch: 'public', autoStart: false, autoRestart: true, autoInstall: true });
  const [submitting, setSubmitting] = useState(false);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await Api.create(form);
      toast.success(`Created ${created.name}`);
      if (form.autoInstall) {
        await Api.install(created.id, { branch: form.branch });
        toast.info('SteamCMD install/update queued. This can take a while…');
      }
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create server');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a new DayZ server"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="create-server-form" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create server'}
          </button>
        </>
      )}>
      <form id="create-server-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Server name</label>
          <input className="input" required minLength={1} maxLength={64} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="My DayZ Server" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Game port</label>
            <input className="input" type="number" min="1" max="65535" value={form.port} onChange={(e) => update('port', e.target.value)} />
          </div>
          <div>
            <label className="label">Steam query port</label>
            <input className="input" type="number" min="1" max="65535" value={form.queryPort} onChange={(e) => update('queryPort', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Branch</label>
          <select className="input" value={form.branch} onChange={(e) => update('branch', e.target.value)}>
            <option value="public">public (stable)</option>
            <option value="experimental">experimental</option>
          </select>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-100">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.autoInstall} onChange={(e) => update('autoInstall', e.target.checked)} />
            Install via SteamCMD now
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.autoStart} onChange={(e) => update('autoStart', e.target.checked)} />
            Auto-start with manager
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.autoRestart} onChange={(e) => update('autoRestart', e.target.checked)} />
            Auto-restart on crash
          </label>
        </div>
        <div className="text-xs text-ink-200">A default <code>serverDZ.cfg</code> will be generated. You can edit it under the server's "Config" tab.</div>
      </form>
    </Modal>
  );
}
