import { useState, useCallback } from 'react';

const ADMIN_KEY = 'alex-selas-drops-admin';
const TOKEN_KEY = 'alex-selas-drops-token';

export function useAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return !!token;
  });

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Email o contraseña incorrectos' };
      }
      const { token } = await res.json();
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(ADMIN_KEY, 'true');
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  }, []);

  const getToken = useCallback(() => {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }, []);

  return { isAuthenticated, login, logout, getToken };
}
