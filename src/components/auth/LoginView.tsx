import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, User, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.error || 'Identifiants invalides.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (u: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await quickLogin(u);
      if (res && !res.success) {
        setError(res.error || 'Échec de la connexion.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg text-2xl font-bold mb-4">
          ✝
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clinique Les Archanges</h2>
        <p className="mt-2 text-sm text-slate-600">
          Système Hospitalier Intégré — Connexion sécurisée
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200/80 sm:rounded-2xl sm:px-10">
          
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Identifiant utilisateur
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: admin, reception, dr.sawadogo..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mot de passe
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          {/* Accès rapide pour tests V1 des 4 rôles */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
              Comptes de test des 4 rôles (Phase 1) :
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuick('admin')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all text-xs"
              >
                <div className="font-semibold text-purple-900">ADMINISTRATEUR</div>
                <div className="text-slate-500 text-[11px]">admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('reception')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-xs"
              >
                <div className="font-semibold text-blue-900">RÉCEPTION</div>
                <div className="text-slate-500 text-[11px]">reception</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('dr.sawadogo')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all text-xs"
              >
                <div className="font-semibold text-emerald-900">MÉDECIN</div>
                <div className="text-slate-500 text-[11px]">dr.sawadogo</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('labo.biologiste')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-all text-xs"
              >
                <div className="font-semibold text-amber-900">LABORATOIRE</div>
                <div className="text-slate-500 text-[11px]">labo.biologiste</div>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Mots de passe sécurisés avec hachage bcrypt et persistance en base relationnelle SQLite.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
