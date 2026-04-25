import React, { useState } from 'react';
import { useAuth } from '../services/auth';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <svg viewBox="0 0 64 64" className="w-9 h-9">
            <path d="M14 44 L32 14 L50 44 Z" fill="none" stroke="#3aa570" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="32" cy="36" r="3" fill="#3aa570" />
          </svg>
          <div>
            <div className="font-semibold">DayZ Manager</div>
            <div className="text-xs text-ink-200">Sign in to continue</div>
          </div>
        </div>
        <div className="mb-3">
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-sm text-red-300 mb-3">{error}</div>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
