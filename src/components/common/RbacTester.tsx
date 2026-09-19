import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ShieldCheck, Lock, Play, AlertCircle, CheckCircle2, ShieldX } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface EndpointTest {
  name: string;
  url: string;
  allowedRoles: string[];
  description: string;
}

export const RbacTester: React.FC = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, { status: number; message: string; ok: boolean }>>({});
  const [running, setRunning] = useState<string | null>(null);

  const endpoints: EndpointTest[] = [
    {
      name: 'Accès Dossiers Médicaux Confidentiels',
      url: '/api/medical/protected-test',
      allowedRoles: ['MÉDECIN'],
      description: 'Accès aux notes cliniques, diagnostics et anamnèses privées.',
    },
    {
      name: 'Accès Paillasse & Validation Labo',
      url: '/api/lab/protected-test',
      allowedRoles: ['LABORATOIRE'],
      description: 'Saisie des résultats d\'analyses et validation biologique.',
    },
    {
      name: 'Accès Enregistrement & Caisse',
      url: '/api/reception/protected-test',
      allowedRoles: ['RÉCEPTION'],
      description: 'Accueil, saisie des constantes de triage et encaissement des factures.',
    },
    {
      name: 'Accès Administration & Comptes Utilisateurs',
      url: '/api/users',
      allowedRoles: ['ADMINISTRATEUR'],
      description: 'Création de comptes et gestion des accès utilisateurs.',
    },
    {
      name: 'Accès Journaux d\'Audit Sécurisé',
      url: '/api/audit-logs',
      allowedRoles: ['ADMINISTRATEUR'],
      description: 'Consultation des traces techniques et logs de sécurité.',
    },
  ];

  const runTest = async (ep: EndpointTest) => {
    setRunning(ep.url);
    try {
      const res = await apiFetch(ep.url);
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [ep.url]: {
          status: res.status,
          message: res.ok ? (data.message || 'Succès') : (data.error || 'Accès refusé'),
          ok: res.ok,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [ep.url]: {
          status: 500,
          message: 'Erreur réseau',
          ok: false,
        },
      }));
    } finally {
      setRunning(null);
    }
  };

  const runAllTests = async () => {
    for (const ep of endpoints) {
      await runTest(ep);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center">
            <ShieldCheck className="w-6 h-6 mr-2 text-emerald-600" />
            Vérification Interactive des Protections RBAC (Backend)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ce module interroge directement les endpoints d'API protégés pour vérifier l'application stricte des règles côté serveur.
          </p>
        </div>
        <button
          onClick={runAllTests}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-semibold transition-colors shadow-xs"
        >
          <Play className="w-4 h-4" />
          <span>Tester toutes les routes</span>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex items-start space-x-3">
        <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Votre session active actuelle :</p>
          <p className="text-blue-800 text-xs mt-0.5">
            Utilisateur <strong>@{user?.username}</strong> — Rôle actif : <strong>{user?.role}</strong>.
            Basculez entre les rôles depuis l'en-tête pour tester le comportement de chaque profil.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {endpoints.map((ep) => {
          const result = testResults[ep.url];
          const shouldHaveAccess = user ? ep.allowedRoles.includes(user.role) : false;

          return (
            <div
              key={ep.url}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-base">{ep.name}</span>
                  <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    {ep.url}
                  </code>
                </div>
                <p className="text-xs text-slate-500">{ep.description}</p>
                <div className="flex items-center space-x-2 text-xs pt-1">
                  <span className="text-slate-400">Rôles autorisés :</span>
                  <span className="font-semibold text-slate-700">
                    {ep.allowedRoles.join(', ')}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">
                    Attente pour votre rôle : {shouldHaveAccess ? (
                      <span className="text-emerald-600 font-semibold">200 Autorisé</span>
                    ) : (
                      <span className="text-red-600 font-semibold">403 Interdit</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center">
                {result && (
                  <div className="text-right">
                    <div className="flex items-center space-x-1.5 justify-end">
                      {result.ok ? (
                        <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          HTTP {result.status} (Autorisé)
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-md border border-red-200">
                          <ShieldX className="w-3.5 h-3.5 mr-1 text-red-600" />
                          HTTP {result.status} (Bloqué par RBAC)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs truncate mt-0.5">
                      {result.message}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => runTest(ep)}
                  disabled={running === ep.url}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3 h-3 text-slate-500" />
                  <span>{running === ep.url ? 'Test...' : 'Tester'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
