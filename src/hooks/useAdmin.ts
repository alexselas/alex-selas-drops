import { useState, useCallback } from 'react';

const ADMIN_KEY = 'alex-selas-drops-admin';
const ADMIN_EMAIL = 'alex-selas92@hotmail.com';
const ADMIN_PASSWORD = 'Gato1992.';

export function useAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(ADMIN_KEY) === 'true';
  });

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    if (email !== ADMIN_EMAIL) {
      return { success: false, error: 'Email no reconocido' };
    }
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: 'Contraseña incorrecta' };
    }
    sessionStorage.setItem(ADMIN_KEY, 'true');
    setIsAuthenticated(true);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY);
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout };
}
