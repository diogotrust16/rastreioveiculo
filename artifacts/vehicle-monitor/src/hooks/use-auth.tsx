import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthUser {
  role: 'ADMIN' | 'CLIENT';
  clientId: number | null;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => void;
}

function decodeToken(token: string): AuthUser | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return { role: payload.role ?? 'CLIENT', clientId: payload.clientId ?? null };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem('token');
    return t ? decodeToken(t) : null;
  });
  const [_, setLocation] = useLocation();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      setUser(decodeToken(newToken));
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    setLocation('/login');
  };

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem('token'));
  }, []);

  return (
    <AuthContext.Provider value={{
      token,
      user,
      setToken,
      isAuthenticated: !!token,
      isAdmin: user?.role === 'ADMIN',
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
