import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Servers } from '../../services/api';
import { useToast } from '../../components/Toast';

export default function SettingsTab({ server, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: server.name,
    port: server.port,
    query_port: server.query_port,
    branch: server.branch,
    auto_start: !!server.auto_start,
    auto_restart: !!server.auto_restart,
    cpu_count: server.cpu_count || '',
    extra_params: server.extra_params || '',
    restart_schedule: server.restart_schedule || '',
  });
  const [saving, setSaving] = useState(false);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await Servers.update(server.id, {
        ...form,
        cpu_count: form.cpu_count === '' ? null : Number(form.cpu_count),
      });
      toast.success('Settings saved');
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4 max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Server name</label>
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Branch</label>
          <select className="input" value={form.branch} onChange={(e) => update('branch', e.target.value)}>
            <option value="public">public</option>
            <option value="experimental">experimental</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Game port</label>
          <input className="input" type="number" value={form.port} onChange={(e) => update('port', e.target.value)} />
        </div>
        <div>
          <label className="label">Query port</label>
          <input className="input" type="number" value={form.query_port} onChange={(e) => update('query_port', e.target.value)} />
        </div>
        <div>
          <label className="label">CPU cores (optional)</label>
          <input className="input" type="number" min="1" max="64" value={form.cpu_count} onChange={(e) => update('cpu_count', e.target.value)} placeholder="auto" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={form.auto_start} onChange={(e) => update('auto_start', e.target.checked)} />
          Auto-start when manager launches
        </label>
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={form.auto_restart} onChange={(e) => update('auto_restart', e.target.checked)} />
          Auto-restart on crash
        </label>
      </div>
      <div>
        <label className="label">Scheduled restart hours (UTC, comma-separated, e.g. <code>3, 9, 15, 21</code>)</label>
        <input className="input" value={form.restart_schedule} onChange={(e) => update('restart_schedule', e.target.value)} />
      </div>
      <div>
        <label className="label">Extra launch parameters</label>
        <input className="input font-mono" value={form.extra_params} onChange={(e) => update('extra_params', e.target.value)} placeholder="-doLogs -adminLog" />
        <div className="text-xs text-ink-200 mt-1">Tokens with shell metacharacters are filtered for safety.</div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  );
}
