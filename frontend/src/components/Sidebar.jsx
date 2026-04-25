import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Settings, Boxes, Activity, Cog } from 'lucide-react';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/servers', label: 'Servers', icon: Server },
  { to: '/mods', label: 'Mods', icon: Boxes },
  { to: '/logs', label: 'Logs', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Cog },
];

export default function Sidebar() {
  return (
    <aside className="w-60 hidden md:flex flex-col bg-ink-800/80 border-r border-ink-500/40">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-ink-500/40">
        <svg viewBox="0 0 64 64" className="w-8 h-8">
          <path d="M14 44 L32 14 L50 44 Z" fill="none" stroke="#3aa570" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="32" cy="36" r="3" fill="#3aa570" />
        </svg>
        <div className="leading-tight">
          <div className="font-semibold text-ink-100">DayZ Manager</div>
          <div className="text-xs text-ink-200">Self-hosted</div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-100'
                  : 'text-ink-200 hover:text-ink-100 hover:bg-ink-600/40'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-ink-500/40 text-xs text-ink-200">
        Open-source DayZ server manager
      </div>
    </aside>
  );
}
