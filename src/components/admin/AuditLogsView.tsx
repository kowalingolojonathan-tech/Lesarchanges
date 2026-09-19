import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types/index.js';
import { ShieldAlert, RefreshCw, Clock, Laptop, Filter } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erreur chargement logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'ALL') return true;
    return log.action.includes(filterAction);
  });

  const getActionBadgeClass = (action: string) => {
    if (action.includes('DENIED')) return 'bg-red-100 text-red-800 border-red-200';
    if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (action.includes('USER_')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="w-6 h-6 mr-2 text-purple-600" />
            Journal d'Audit Immuable & Traçabilité
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enregistrement systématique de chaque tentative de connexion, action sensible, création et violation RBAC.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">Toutes les actions</option>
              <option value="LOGIN">Connexions & Sessions</option>
              <option value="DENIED">Violations de sécurité (RBAC)</option>
              <option value="USER">Gestion utilisateurs</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            title="Rafraîchir les journaux"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tableau des logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Horodatage</th>
                <th className="px-6 py-3.5">Utilisateur & Rôle</th>
                <th className="px-6 py-3.5">Action tracée</th>
                <th className="px-6 py-3.5">Ressource / Cible</th>
                <th className="px-6 py-3.5">Détails de l'opération</th>
                <th className="px-6 py-3.5">IP Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Aucun événement d'audit enregistré pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors font-mono text-xs">
                    <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5 font-sans">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString('fr-FR')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      {log.username ? (
                        <div>
                          <span className="font-semibold text-slate-900">@{log.username}</span>
                          <span className="text-[11px] text-slate-500 block">({log.role})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Système / Inconnu</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md border font-semibold ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-800">
                      {log.ressource_type} {log.ressource_id ? `(${log.ressource_id})` : ''}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 max-w-md truncate font-sans text-xs">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Laptop className="w-3 h-3 text-slate-400" />
                        <span>{log.ip_address || 'local'}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
