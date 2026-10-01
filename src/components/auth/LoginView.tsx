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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-6 px-3 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600 text-white shadow-lg text-2xl font-bold mb-3 sm:mb-4">
          ✝
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Clinique Les Archanges</h2>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-600">
          Système Hospitalier Intégré — Connexion sécurisée
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-4 shadow-xl border border-slate-200/80 rounded-2xl sm:px-10">
          
          {error && (
            <div className="mb-4 sm:mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          {/* Accès rapide pour tests V1 des 4 rôles */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
              Comptes de test des 4 rôles (Phase 1) :
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuick('admin')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all text-xs min-h-[44px]"
              >
                <div className="font-bold text-purple-900">ADMINISTRATEUR</div>
                <div className="text-slate-500 text-[10px] font-mono">admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('reception')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-xs min-h-[44px]"
              >
                <div className="font-bold text-blue-900">RÉCEPTION</div>
                <div className="text-slate-500 text-[10px] font-mono">reception</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('dr.sawadogo')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all text-xs min-h-[44px]"
              >
                <div className="font-bold text-emerald-900">MÉDECIN</div>
                <div className="text-slate-500 text-[10px] font-mono">dr.sawadogo</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('labo.biologiste')}
                className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-all text-xs min-h-[44px]"
              >
                <div className="font-bold text-amber-900">LABORATOIRE</div>
                <div className="text-slate-500 text-[10px] font-mono">labo.biologiste</div>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Mots de passe sécurisés avec hachage bcrypt et persistance en base relationnelle SQLite.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
