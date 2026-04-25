import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Servers } from '../services/api';

export default function ModsIndex() {
  const [servers, setServers] = useState([]);
  useEffect(() => { Servers.list().then(setServers); }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Mods</h2>
        <p className="text-ink-200 text-sm">Pick a server to manage its mod list.</p>
      </div>
      <div className="card divide-y divide-ink-500/40">
        {servers.length === 0 && <div className="p-6 text-sm text-ink-200">No servers yet.</div>}
        {servers.map((s) => (
          <Link key={s.id} to={`/servers/${s.id}/mods`} className="flex items-center justify-between px-5 py-3 hover:bg-ink-600/40">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-ink-200">{s.install_path}</div>
            </div>
            <div className="text-sm text-brand-300">Manage mods →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
