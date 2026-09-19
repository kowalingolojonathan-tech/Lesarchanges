import React, { useState, useEffect } from 'react';
import { Settings, Coins, Database, ShieldCheck, MapPin, Building } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export const ClinicSettingsView: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/system/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center">
          <Settings className="w-6 h-6 mr-2 text-purple-600" />
          Configuration Système & Devises (RDC)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Paramètres structurels de l'établissement, devises de facturation et état de la persistance relationnelle.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Devises RDC */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-bold">
            <Coins className="w-5 h-5 text-emerald-600" />
            <span>Devises Clinique V1 (RDC)</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Devise de référence principale :</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                USD ($)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Devise locale nationale :</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                CDF (Franc Congolais)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Taux de conversion appliqué :</span>
              <span className="font-bold text-slate-900">
                1 USD = 2 850 CDF
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Chaque facture enregistre explicitement sa devise lors de son émission. Les prix unitaires et historiques sont scellés dans <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">facture_items</code>.
          </p>
        </div>

        {/* Base de données & Sécurité */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-bold">
            <Database className="w-5 h-5 text-purple-600" />
            <span>Moteur Relationnel Transactionnel</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Moteur de stockage :</span>
              <span className="font-semibold text-slate-900">SQLite 3 (ACID)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Contraintes Foreign Keys :</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                PRAGMA foreign_keys = ON
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Fichier de persistance :</span>
              <span className="font-mono text-xs text-slate-800 bg-white px-2 py-1 border rounded">
                ./data/clinique_les_archanges.db
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Intégrité référentielle stricte avec suppression logique (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">actif = 0</code>) pour préserver l'historique médical et financier.
          </p>
        </div>

        {/* Séparation Administration Technique vs Accès Médical */}
        <div className="md:col-span-2 bg-purple-50/70 border border-purple-200 p-6 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-purple-900 font-bold">
            <ShieldCheck className="w-5 h-5 text-purple-700" />
            <span>Règle Fondamentale : Séparation de l'Administration Technique et de l'Accès Médical</span>
          </div>
          <p className="text-sm text-purple-950 leading-relaxed">
            Conformément à vos directives, le rôle <strong>ADMINISTRATEUR</strong> gère l'infrastructure, les comptes, les devises et consulte les journaux d'audit de sécurité. Il <strong>n'a pas d'accès par défaut aux notes de consultation, diagnostics et antécédents médicaux confidentiels des patients</strong>. Cette interdiction est vérifiée et appliquée côté backend via les middlewares de contrôle RBAC.
          </p>
        </div>

      </div>
    </div>
  );
};
