import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard.jsx';
import Servers from './pages/Servers.jsx';
import ServerDetail from './pages/ServerDetail.jsx';
import ModsPage from './pages/Mods.jsx';
import LogsPage from './pages/Logs.jsx';
import SettingsPage from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './services/auth';
import SteamGuardListener from './components/SteamGuardListener.jsx';

export default function App() {
  const { loaded, authEnabled, authenticated } = useAuth();
  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center text-ink-200">Loading…</div>
    );
  }
  if (authEnabled && !authenticated) {
    return <Login />;
  }
  return (
    <div className="h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/servers/:id/*" element={<ServerDetail />} />
            <Route path="/mods" element={<ModsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <SteamGuardListener />
    </div>
  );
}
