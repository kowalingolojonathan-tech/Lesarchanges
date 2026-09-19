import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types/index.js';

interface Permissions {
  role: Role;
  canManageUsers: boolean;
  canViewTechnicalAudit: boolean;
  canManagePatientsReception: boolean;
  canRecordVitals: boolean;
  canProcessPayments: boolean;
  canAccessConsultations: boolean;
  canPrescribeMedicines: boolean;
  canOrderLabTests: boolean;
  canReferExternal: boolean;
  canProcessLabSamples: boolean;
  canValidateLabResults: boolean;
  canAccessPrivateMedicalNotes: boolean;
}

interface AuthContextType {
  user: User | null;
  permissions: Permissions | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  quickLogin: (username: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async (explicitToken?: string) => {
    try {
      const token = explicitToken || localStorage.getItem('archanges_auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPermissions(data.permissions);
      } else {
        if (res.status === 401) {
          localStorage.removeItem('archanges_auth_token');
        }
        setUser(null);
        setPermissions(null);
      }
    } catch (err) {
      console.error('Erreur vérification session:', err);
      setUser(null);
      setPermissions(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('archanges_auth_token', data.token);
        }
        if (data.user) {
          setUser(data.user);
        }
        await fetchCurrentUser(data.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Identifiants incorrects.' };
      }
    } catch (err) {
      return { success: false, error: 'Impossible de contacter le serveur.' };
    }
  };

  const quickLogin = async (username: string) => {
    // Dictionnaire des mots de passe des comptes pré-configurés pour la phase de test
    const passwords: Record<string, string> = {
      admin: 'ArchangesAdmin2026!',
      reception: 'ArchangesRecep2026!',
      'dr.sawadogo': 'ArchangesMed2026!',
      'labo.biologiste': 'ArchangesLab2026!',
    };

    const pwd = passwords[username];
    if (pwd) {
      return await login(username, pwd);
    }
    return { success: false, error: 'Identifiant de compte rapide inconnu.' };
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('archanges_auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } finally {
      localStorage.removeItem('archanges_auth_token');
      setUser(null);
      setPermissions(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        login,
        logout,
        quickLogin,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};
