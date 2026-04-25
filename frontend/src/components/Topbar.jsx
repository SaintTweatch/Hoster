import React from 'react';
import { Wifi, WifiOff, LogOut } from 'lucide-react';
import { useWS } from '../services/ws';
import { useAuth } from '../services/auth';

export default function Topbar() {
  const { connected } = useWS();
  const { authEnabled, authenticated, user, logout } = useAuth();
  return (
    <header className="h-14 px-5 border-b border-ink-500/40 bg-ink-800/60 flex items-center justify-between">
      <h1 className="text-sm uppercase tracking-widest text-ink-200">Server Operations</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi size={14} /> live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <WifiOff size={14} /> reconnecting…
            </span>
          )}
        </div>
        {authEnabled && authenticated && (
          <div className="flex items-center gap-2 text-xs text-ink-200">
            <span className="hidden sm:inline">Signed in as <strong className="text-ink-100">{user}</strong></span>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={logout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
