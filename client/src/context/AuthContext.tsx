import { createContext, useContext, useEffect, useState } from 'react';
import type { ApiError } from '../config/api.config';

export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

export interface AuthContextType {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount, restore session by calling GET /api/auth/me
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const sessionUser: SessionUser = await response.json();
          setUser(sessionUser);
        } else {
          // 401 or any non-200: not authenticated
          setUser(null);
        }
      } catch {
        // Network error or server unreachable
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Login failed' }));
      const apiError: ApiError = {
        message: (errorBody as { message?: string }).message ?? 'Login failed',
        ...(typeof (errorBody as { field?: string }).field === 'string'
          ? { field: (errorBody as { field?: string }).field }
          : {}),
      };
      throw apiError;
    }

    const sessionUser: SessionUser = await response.json();
    setUser(sessionUser);
    // Navigation is handled by the caller (LoginPage) so it can respect
    // the post-login redirect destination stored in router location state.
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      // Always clear user and redirect, even if the request fails
      setUser(null);
      window.location.href = '/login';
    }
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
