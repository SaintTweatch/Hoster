import React, { useEffect, useState } from 'react';
import { Servers } from '../services/api';
import Console from '../components/Console';

export default function LogsPage() {
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    Servers.list().then((list) => {
      setServers(list);
      if (list.length && !selected) setSelected(list[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Logs</h2>
          <p className="text-ink-200 text-sm">Live server console.</p>
        </div>
        <select className="input w-72" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {servers.length === 0 && <option value="">No servers</option>}
          {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {selected && <Console serverId={selected} height="70vh" />}
    </div>
  );
}
