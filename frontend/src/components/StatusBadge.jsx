import React from 'react';

const TEXT = {
  running: 'Running',
  stopped: 'Stopped',
  starting: 'Starting…',
  stopping: 'Stopping…',
  crashed: 'Crashed',
  installing: 'Installing…',
  updating: 'Updating…',
};

export default function StatusBadge({ status }) {
  const cls = `badge-${status || 'stopped'}`;
  return <span className={cls}>{TEXT[status] || status || 'Unknown'}</span>;
}
