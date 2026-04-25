import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ loaded: false, authEnabled: false, authenticated: true, user: null });

  async function refresh() {
    try {
      const s = await Auth.session();
      setSession({ loaded: true, ...s });
    } catch {
      setSession({ loaded: true, authEnabled: true, authenticated: false, user: null });
    }
  }

  useEffect(() => {
    refresh();
    const handler = () => setSession((s) => ({ ...s, authenticated: false }));
    window.addEventListener('dzm:unauthorized', handler);
    return () => window.removeEventListener('dzm:unauthorized', handler);
  }, []);

  async function login(username, password) {
    await Auth.login(username, password);
    await refresh();
  }

  async function logout() {
    await Auth.logout();
    await refresh();
  }

  return (
    <AuthContext.Provider value={{ ...session, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
