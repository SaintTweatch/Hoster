import React, { useEffect, useState } from 'react';
import { Plus, Trash2, DownloadCloud, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { Mods, Servers } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useWS } from '../../services/ws';

export default function ModsTab({ server }) {
  const toast = useToast();
  const { subscribe } = useWS();
  const [mods, setMods] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [progress, setProgress] = useState({});
  const [form, setForm] = useState({ workshopId: '', name: '', kind: 'client' });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [list, info] = await Promise.all([Mods.list(server.id), Servers.installedMods(server.id)]);
      setMods(list);
      setInstalled(info.installed);
    } catch (e) {
      toast.error('Failed to load mods');
    }
  }

  useEffect(() => {
    refresh();
    const off = subscribe((msg) => {
      if (msg.type !== 'steam:progress') return;
      if (msg.data?.serverId !== server.id) return;
      setProgress((p) => ({ ...p, [msg.data.workshopId || 'server-install']: msg.data }));
      if (msg.data?.completed) {
        refresh();
      }
    });
    return off;
  }, [server.id, subscribe]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await Mods.add(server.id, { ...form, enabled: true });
      toast.success('Mod added');
      setForm({ workshopId: '', name: '', kind: 'client' });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to add mod');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(mod) {
    try {
      await Mods.update(server.id, mod.id, { enabled: !mod.enabled });
      refresh();
    } catch (e) { toast.error('Failed to update mod'); }
  }

  async function move(mod, dir) {
    const ordered = [...mods];
    const idx = ordered.findIndex((m) => m.id === mod.id);
    const next = idx + dir;
    if (next < 0 || next >= ordered.length) return;
    const [m] = ordered.splice(idx, 1);
    ordered.splice(next, 0, m);
    try {
      await Mods.reorder(server.id, ordered.map((m) => m.id));
      setMods(ordered);
    } catch (e) { toast.error('Failed to reorder'); }
  }

  async function install(mod) {
    try {
      await Mods.install(server.id, mod.id);
      toast.info(`Downloading workshop mod ${mod.workshop_id}…`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Install failed'); }
  }

  async function remove(mod) {
    if (!confirm(`Remove mod @${mod.workshop_id}?`)) return;
    try {
      await Mods.remove(server.id, mod.id);
      toast.success('Mod removed');
      refresh();
    } catch (e) { toast.error('Failed to remove'); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <label className="label">Workshop ID</label>
          <input className="input" pattern="[0-9]{6,15}" required value={form.workshopId} onChange={(e) => setForm({ ...form, workshopId: e.target.value })} placeholder="1559212036" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Display name (optional)</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="@CF" />
        </div>
        <div>
          <label className="label">Kind</label>
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="client">client (-mod)</option>
            <option value="server">server (-servermod)</option>
          </select>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}><Plus size={14} /> Add mod</button>
        </div>
      </form>

      <div className="card">
        <div className="px-4 py-2 border-b border-ink-500/40 flex items-center justify-between">
          <h3 className="font-medium">Configured mods</h3>
          <span className="text-xs text-ink-200">Order is the load order passed to <code>-mod</code> / <code>-servermod</code></span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-ink-200">
            <tr>
              <th className="px-4 py-2 w-10">#</th>
              <th className="px-4 py-2">Mod</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Installed</th>
              <th className="px-4 py-2">Enabled</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mods.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-200">No mods configured.</td></tr>
            )}
            {mods.map((m, i) => {
              const p = progress[m.workshop_id];
              return (
                <tr key={m.id} className="border-b border-ink-500/40">
                  <td className="px-4 py-2 text-ink-200">{i + 1}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{m.name || `@${m.workshop_id}`}</div>
                    <a target="_blank" rel="noreferrer"
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${m.workshop_id}`}
                      className="text-xs text-brand-300 hover:text-brand-100 inline-flex items-center gap-1">
                      Workshop {m.workshop_id} <ExternalLink size={12} />
                    </a>
                    {p && (
                      <div className="text-xs text-ink-200 mt-1">{p.line || (p.percent != null ? `${Math.round(p.percent)}%` : '')}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize">{m.kind}</td>
                  <td className="px-4 py-2">{m.installed ? <span className="text-emerald-300">yes</span> : <span className="text-ink-200">no</span>}</td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="mr-2" checked={!!m.enabled} onChange={() => toggle(m)} />
                      <span className={m.enabled ? 'text-emerald-300' : 'text-ink-200'}>{m.enabled ? 'on' : 'off'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" title="Move up" onClick={() => move(m, -1)}><ArrowUp size={14} /></button>
                      <button className="btn-ghost" title="Move down" onClick={() => move(m, +1)}><ArrowDown size={14} /></button>
                      <button className="btn-secondary" title="Download via SteamCMD" onClick={() => install(m)}><DownloadCloud size={14} /> Install</button>
                      <button className="btn-ghost" title="Remove" onClick={() => remove(m)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-2">Installed on disk</h3>
        {installed.length === 0 && <div className="text-sm text-ink-200">No mod folders detected in the install directory.</div>}
        <ul className="text-sm grid sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {installed.map((m) => (
            <li key={m.folder} className="text-ink-100">
              <code className="text-brand-300">{m.folder}</code>
              <span className="text-ink-200"> — {m.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
