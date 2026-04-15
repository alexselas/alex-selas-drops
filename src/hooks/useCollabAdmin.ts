import { useState, useCallback } from 'react';

const TOKEN_KEY = 'alex-selas-drops-collab-token';
const COLLAB_ID_KEY = 'alex-selas-drops-collab-id';

export function useCollabAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!sessionStorage.getItem(TOKEN_KEY));
  const [collaboratorId, setCollaboratorId] = useState(() => sessionStorage.getItem(COLLAB_ID_KEY) || '');

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/collab-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Email o contraseña incorrectos' };
      }
      const { token, collaboratorId: id } = await res.json();
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(COLLAB_ID_KEY, id);
      setIsAuthenticated(true);
      setCollaboratorId(id);
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, collabId: string, profile?: {
    artistName: string;
    bio: string;
    socialLinks: { instagram?: string; tiktok?: string; spotify?: string; youtube?: string; soundcloud?: string };
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/collab-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, collaboratorId: collabId, profile }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Error al crear cuenta' };
      }
      const { token, collaboratorId: id } = await res.json();
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(COLLAB_ID_KEY, id);
      setIsAuthenticated(true);
      setCollaboratorId(id);
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(COLLAB_ID_KEY);
    setIsAuthenticated(false);
    setCollaboratorId('');
  }, []);

  const getToken = useCallback(() => sessionStorage.getItem(TOKEN_KEY) || '', []);

  return { isAuthenticated, collaboratorId, login, register, logout, getToken };
}
