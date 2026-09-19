import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Shield, User, LogOut, RefreshCw, KeyRound, Sparkles } from 'lucide-react';
import { Role } from '../../types/index.js';

export const Header: React.FC = () => {
  const { user, logout, quickLogin } = useAuth();
  const [switching, setSwitching] = useState(false);

  const getRoleBadgeColor = (role?: Role) => {
    switch (role) {
      case 'ADMINISTRATEUR':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RÉCEPTION':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'MÉDECIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'LABORATOIRE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleQuickSwitch = async (username: string) => {
    setSwitching(true);
    try {
      await quickLogin(username);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo & Titre */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold text-xl tracking-tight">
              ✝
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Clinique Les Archanges</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
                  V1 • RDC
                </span>
              </div>
              <p className="text-xs text-slate-500">Système Clinique & Circuit Patient Sécurisé</p>
            </div>
          </div>

          {/* Sélecteur de test rapide des 4 Rôles (Socle Phase 1) */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 flex items-center px-1.5">
              <KeyRound className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Basculer rôle :
            </span>
            <button
              onClick={() => handleQuickSwitch('admin')}
              disabled={switching || user?.role === 'ADMINISTRATEUR'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'ADMINISTRATEUR'
                  ? 'bg-purple-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickSwitch('reception')}
              disabled={switching || user?.role === 'RÉCEPTION'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'RÉCEPTION'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Réception
            </button>
            <button
              onClick={() => handleQuickSwitch('dr.sawadogo')}
              disabled={switching || user?.role === 'MÉDECIN'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'MÉDECIN'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Médecin
            </button>
            <button
              onClick={() => handleQuickSwitch('labo.biologiste')}
              disabled={switching || user?.role === 'LABORATOIRE'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'LABORATOIRE'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Laboratoire
            </button>
          </div>

          {/* Utilisateur connecté & Déconnexion */}
          {user && (
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.nom_complet}</div>
                <div className="flex items-center justify-end space-x-1">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-md border font-medium ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => logout()}
                title="Déconnexion"
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
