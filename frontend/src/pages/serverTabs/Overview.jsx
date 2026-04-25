import React from 'react';
import { Server, Boxes, FileCog, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Overview({ server }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-ink-200 mb-2"><Server size={16} /> Server details</div>
        <dl className="text-sm space-y-1">
          <Row label="Name" value={server.name} />
          <Row label="Install path" value={server.install_path} mono />
          <Row label="Profile dir" value={server.profile_dir} mono />
          <Row label="Executable" value={server.executable || '—'} mono />
          <Row label="Branch" value={server.branch} />
          <Row label="Game port" value={server.port} />
          <Row label="Query port" value={server.query_port} />
          <Row label="Auto-start" value={server.auto_start ? 'enabled' : 'disabled'} />
          <Row label="Auto-restart" value={server.auto_restart ? 'enabled' : 'disabled'} />
          <Row label="Restart schedule" value={server.restart_schedule || '—'} />
          <Row label="Created" value={server.created_at} />
        </dl>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-ink-200 mb-2"><FileText size={16} /> Quick links</div>
        <ul className="space-y-2 text-sm">
          <li><Link to="config" className="text-brand-300 hover:text-brand-100 inline-flex items-center gap-2"><FileCog size={14} /> Edit serverDZ.cfg</Link></li>
          <li><Link to="mods" className="text-brand-300 hover:text-brand-100 inline-flex items-center gap-2"><Boxes size={14} /> Manage mods</Link></li>
          <li><Link to="logs" className="text-brand-300 hover:text-brand-100 inline-flex items-center gap-2"><FileText size={14} /> View live logs</Link></li>
        </ul>

        <div className="mt-6 text-sm text-ink-200">
          <p className="mb-2">To make this server joinable from the public internet, ensure these UDP ports are open / forwarded:</p>
          <ul className="list-disc list-inside text-ink-100">
            <li>Game: <code>{server.port}</code></li>
            <li>Steam query: <code>{server.query_port}</code></li>
            <li>BattlEye RCon (if enabled): <code>2306</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-500/30 py-1.5">
      <dt className="text-ink-200">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs' : ''} text-ink-100 truncate`}>{String(value ?? '—')}</dd>
    </div>
  );
}
