import React, { useEffect, useMemo, useState } from 'react';
import { Save, FileDown } from 'lucide-react';
import { Servers, Configs, Presets } from '../../services/api';
import { useToast } from '../../components/Toast';

export default function ConfigTab({ server, onSaved }) {
  const toast = useToast();
  const [payload, setPayload] = useState(null);
  const [rendered, setRendered] = useState('');
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await Servers.config.get(server.id);
    setPayload(data.payload);
    setRendered(data.rendered);
    setPresets(await Presets.list());
  }
  useEffect(() => { load(); }, [server.id]);

  const motdText = useMemo(() => Array.isArray(payload?.motd) ? payload.motd.join('\n') : '', [payload]);

  function update(patch) {
    setPayload((p) => ({ ...p, ...patch }));
  }

  async function preview(next = payload) {
    try {
      const text = await Configs.render(next);
      setRendered(text);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Validation failed');
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await Servers.config.save(server.id, payload);
      setPayload(res.payload);
      const text = await Configs.render(res.payload);
      setRendered(text);
      toast.success('serverDZ.cfg saved and written to disk');
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  async function savePreset() {
    if (!presetName.trim()) {
      toast.warning('Provide a preset name');
      return;
    }
    try {
      await Presets.save(presetName.trim(), payload);
      toast.success(`Preset "${presetName.trim()}" saved`);
      setPresets(await Presets.list());
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save preset');
    }
  }

  function loadPreset(p) {
    setPayload((prev) => ({ ...prev, ...p.payload }));
    toast.info(`Loaded preset "${p.name}"`);
  }

  if (!payload) return <div className="text-ink-200">Loading config…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-3">
        <h3 className="font-medium">serverDZ.cfg</h3>
        <Field label="Hostname" value={payload.hostname} onChange={(v) => update({ hostname: v })} />
        <Field label="Server password (join)" value={payload.password} onChange={(v) => update({ password: v })} type="password" />
        <Field label="Admin password" value={payload.passwordAdmin} onChange={(v) => update({ passwordAdmin: v })} type="password" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max players" value={payload.maxPlayers} onChange={(v) => update({ maxPlayers: Number(v) })} type="number" />
          <Field label="Steam query port" value={payload.steamQueryPort} onChange={(v) => update({ steamQueryPort: Number(v) })} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mission template" value={payload.missionTemplate} onChange={(v) => update({ missionTemplate: v })} />
          <Field label="Server time" value={payload.serverTime} onChange={(v) => update({ serverTime: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="verifySignatures" value={payload.verifySignatures} onChange={(v) => update({ verifySignatures: Number(v) })} options={[0, 1, 2]} />
          <Select label="disable3rdPerson" value={payload.disable3rdPerson} onChange={(v) => update({ disable3rdPerson: Number(v) })} options={[0, 1]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Time accel" type="number" value={payload.serverTimeAcceleration} onChange={(v) => update({ serverTimeAcceleration: Number(v) })} />
          <Field label="Night accel" type="number" value={payload.serverNightTimeAcceleration} onChange={(v) => update({ serverNightTimeAcceleration: Number(v) })} />
          <Field label="FPS limit" type="number" value={payload.serverFpsLimit} onChange={(v) => update({ serverFpsLimit: Number(v) })} />
        </div>

        <div>
          <label className="label">MOTD (one line per row)</label>
          <textarea
            rows={4}
            className="input font-mono"
            value={motdText}
            onChange={(e) => update({ motd: e.target.value.split('\n') })}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn-primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Saving…' : 'Save & write'}</button>
          <button className="btn-secondary" onClick={() => preview(payload)}><FileDown size={16} /> Preview</button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h3 className="font-medium mb-2">Presets</h3>
          <div className="flex gap-2 mb-3">
            <input className="input" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" />
            <button className="btn-secondary whitespace-nowrap" onClick={savePreset}>Save preset</button>
          </div>
          {presets.length === 0 && <div className="text-sm text-ink-200">No presets saved yet.</div>}
          <ul className="text-sm space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-ink-500/30 py-1">
                <span>{p.name}</span>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => loadPreset(p)}>Load</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-3">
          <div className="text-xs text-ink-200 px-2 py-1">Rendered serverDZ.cfg preview</div>
          <pre className="overflow-auto text-xs p-3 bg-ink-900 rounded-md max-h-[60vh] whitespace-pre-wrap">{rendered}</pre>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
