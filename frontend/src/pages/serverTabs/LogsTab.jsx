import React from 'react';
import Console from '../../components/Console';

export default function LogsTab({ server }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-ink-200">Live console output (stdout + stderr) from the server process.</div>
      <Console serverId={server.id} height="65vh" />
    </div>
  );
}
