import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export type ProductTrack = 'academic_gd' | 'industry';

interface AuthContextType {
  user: User | null;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
  track: ProductTrack | null;
  selectTrack: (track: ProductTrack) => void;
  clearTrack: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [track, setTrack] = useState<ProductTrack | null>(() => {
    const stored = localStorage.getItem('product_track');
    return stored === 'academic_gd' || stored === 'industry' ? stored : null;
  });

  useEffect(() => {
    // Restore user from localStorage on mount
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (u: User, token: string, refreshToken: string) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
  };

  const selectTrack = (selectedTrack: ProductTrack) => {
    setTrack(selectedTrack);
    localStorage.setItem('product_track', selectedTrack);
  };

  const clearTrack = () => {
    setTrack(null);
    localStorage.removeItem('product_track');
  };

  const logout = () => {
    setUser(null);
    clearTrack();
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAdmin: user?.role === 'admin', isLoading, track, selectTrack, clearTrack }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
