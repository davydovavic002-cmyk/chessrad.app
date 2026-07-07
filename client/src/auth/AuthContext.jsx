import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiJson } from '../api';
import { disconnectSocket } from '../socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api('/api/profile');
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (username, password) => {
    const { res, data } = await apiJson('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.ok && data.success) {
      await refreshUser();
      return { ok: true, user: data.user };
    }
    return { ok: false, message: data.message || 'Неверный логин или пароль' };
  }, [refreshUser]);

  const register = useCallback(async (username, password, role, extras = {}) => {
    const { res, data } = await apiJson('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        role,
        displayName: extras.displayName,
        teacherLinkCode: extras.teacherLinkCode,
      }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: data.message || 'Ошибка регистрации' };
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await api('/api/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, login, register, logout }),
    [user, loading, refreshUser, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
