import { createContext, useContext } from 'react';
import type { Credentials } from '../types/green';

export interface AuthContextValue {
  credentials: Credentials | null;
  /** Проверяет данные через getStateInstance и сохраняет их при успехе. */
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth доступен только внутри AuthProvider');
  }
  return context;
}
