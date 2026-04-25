import React, { useEffect, useState } from 'react';
import { System, Steam, Settings as SettingsApi } from '../services/api';
import { useToast } from '../components/Toast';
import { DownloadCloud, RefreshCw, ShieldCheck, Trash2, LogIn, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [steam, setSteam] = useState({ installed: false });
  const [settings, setSettings] = useState(null);
  const [steamForm, setSteamForm] = useState({ username: '', password: '' });
  const [savingSteam, setSavingSteam] = useState(false);
  const [testingLogin, setTestingLogin] = useState(false);

  async function refresh() {
    const [sysInfo, steamStatus, appSettings] = await Promise.all([
      System.info(),
      Steam.status(),
      SettingsApi.get(),
    ]);
    setInfo(sysInfo);
    setSteam(steamStatus);
    setSettings(appSettings);
    setSteamForm((f) => ({ ...f, username: appSettings?.steam?.username || '' }));
  }

  useEffect(() => { refresh(); }, []);

  async function installSteamcmd() {
    try {
      await Steam.install();
      toast.info('SteamCMD installation started.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to start');
    }
  }

  async function saveSteam() {
    setSavingSteam(true);
    try {
      const updated = await SettingsApi.updateSteam({
        username: steamForm.username.trim(),
        password: steamForm.password,
      });
      setSettings(updated);
      setSteamForm((f) => ({ ...f, password: '' }));
      toast.success('Steam credentials saved.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSavingSteam(false);
    }
  }

  async function clearPassword() {
    setSavingSteam(true);
    try {
      const updated = await SettingsApi.updateSteam({ clearPassword: true });
      setSettings(updated);
      toast.info('Steam password cleared.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to clear');
    } finally {
      setSavingSteam(false);
    }
  }

  async function testLogin() {
    setTestingLogin(true);
    try {
      await SettingsApi.testLogin();
      toast.success('Steam login successful. Session is cached for future installs.');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Login failed');
    } finally {
      setTestingLogin(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-ink-200 text-sm">Steam account, SteamCMD, and host machine info.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium flex items-center gap-2"><KeyRound size={16} /> Steam Account</div>
            <div className="text-xs text-ink-200">
              The DayZ dedicated server is <strong>not</strong> anonymously downloadable.
              Enter the Steam account that owns DayZ. Credentials are stored encrypted on this machine.
            </div>
          </div>
          <div className="text-xs text-ink-200">
            {settings?.steam?.lastLoginOk ? (
              <span className="text-emerald-400">Last login OK · {settings.steam.lastLoginAt?.slice(0, 19).replace('T', ' ')}</span>
            ) : settings?.steam?.lastLoginAt ? (
              <span className="text-red-400">Last login failed</span>
            ) : null}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-ink-200">Steam username</span>
            <input
              className="input mt-1"
              type="text"
              autoComplete="off"
              value={steamForm.username}
              onChange={(e) => setSteamForm({ ...steamForm, username: e.target.value })}
              placeholder="your_steam_login"
            />
          </label>
          <label className="text-sm">
            <span className="text-ink-200">
              Password {settings?.steam?.hasPassword && <em className="text-emerald-400 not-italic">(stored)</em>}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={steamForm.password}
              onChange={(e) => setSteamForm({ ...steamForm, password: e.target.value })}
              placeholder={settings?.steam?.hasPassword ? '••••••••• (leave blank to keep)' : 'Steam account password'}
            />
          </label>
        </div>
        <p className="text-xs text-ink-200 mt-2">
          If your account uses Steam Guard (email or mobile authenticator), you'll be prompted for a code
          here when SteamCMD asks for one. After a successful login, SteamCMD remembers the session, so
          you usually only enter the Guard code on first login from this machine.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-primary" disabled={savingSteam} onClick={saveSteam}>
            {savingSteam ? 'Saving…' : 'Save credentials'}
          </button>
          <button
            className="btn-secondary"
            disabled={testingLogin || !settings?.steam?.username || !settings?.steam?.hasPassword}
            onClick={testLogin}
            title={!settings?.steam?.hasPassword ? 'Save a password first' : 'Run +login then +quit to validate credentials'}
          >
            <LogIn size={14} /> {testingLogin ? 'Testing…' : 'Test login'}
          </button>
          {settings?.steam?.hasPassword && (
            <button className="btn-ghost" onClick={clearPassword} disabled={savingSteam}>
              <Trash2 size={14} /> Clear stored password
            </button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium flex items-center gap-2"><ShieldCheck size={16} /> SteamCMD</div>
            <div className="text-xs text-ink-200">{steam.installed ? `Installed at ${steam.binary}` : 'Not installed (will auto-install on first use)'}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
            <button className="btn-primary" onClick={installSteamcmd}><DownloadCloud size={14} /> Install / Repair</button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-medium mb-2">Host machine</h3>
        {!info ? <div className="text-ink-200 text-sm">Loading…</div> : (
          <dl className="text-sm grid sm:grid-cols-2 gap-3">
            <Row label="Platform" value={`${info.platform} (${info.arch})`} />
            <Row label="Hostname" value={info.hostname} />
            <Row label="Node version" value={info.node} />
            <Row label="CPU" value={info.cpu.model} />
            <Row label="CPU cores" value={info.cpu.cores} />
            <Row label="Memory" value={`${(info.memory.total / (1024 ** 3)).toFixed(1)} GB total`} />
            <Row label="Servers root" value={info.paths.servers} mono />
            <Row label="Configs root" value={info.paths.configs} mono />
            <Row label="Logs root" value={info.paths.logs} mono />
            <Row label="Database" value={info.paths.data} mono />
          </dl>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-medium mb-2">Authentication</h3>
        <p className="text-sm text-ink-200">
          To enable a login wall, set <code>ADMIN_USER</code> and <code>ADMIN_PASSWORD</code> in
          your <code>.env</code> file and restart the backend. The dashboard is otherwise open
          to the local network only (default bind <code>127.0.0.1</code>).
        </p>
      </div>

    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-500/30 py-1.5">
      <dt className="text-ink-200">{label}</dt>
      <dd className={`text-right text-ink-100 truncate ${mono ? 'font-mono text-xs' : ''}`}>{String(value ?? '—')}</dd>
    </div>
  );
}
