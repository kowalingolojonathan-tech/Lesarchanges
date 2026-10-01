import React, { useState, useEffect } from 'react';
import { Settings, Coins, Database, ShieldCheck, MapPin, Building, ArrowRight, Tag } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface ClinicSettingsViewProps {
  onNavigateToTarifs?: () => void;
}

export const ClinicSettingsView: React.FC<ClinicSettingsViewProps> = ({ onNavigateToTarifs }) => {
  const [stats, setStats] = useState<any>(null);
  const [currentRate, setCurrentRate] = useState<number>(2850);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/system/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    apiFetch('/api/billing/exchange-rate')
      .then((res) => res.json())
      .then((data) => {
        if (data.rate) setCurrentRate(data.rate);
      })
      .catch((err) => console.error(err));
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
              <span className="text-slate-600">Taux de conversion officiel actuel :</span>
              <span className="font-bold text-emerald-800 font-mono">
                1 USD = {currentRate.toLocaleString('fr-FR')} FC
              </span>
            </div>
          </div>

          {onNavigateToTarifs && (
            <button
              onClick={onNavigateToTarifs}
              className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <Tag className="w-4 h-4" />
              <span>Gérer les Tarifs & le Taux de Change</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}

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

        {/* Coordonnées officielles de la Clinique */}
        <div className="md:col-span-2 bg-emerald-50/70 border border-emerald-200 p-6 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-emerald-900 font-bold">
            <Building className="w-5 h-5 text-emerald-700" />
            <span>Coordonnées Officielles de l'Établissement (Factures, Reçus, Ordonnances & Documents)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Établissement :</span>
              <span className="font-semibold text-emerald-950">Clinique Les Archanges</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Adresse :</span>
              <span className="text-slate-800">À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Téléphone & Horaires :</span>
              <span className="text-slate-800 font-semibold">+243 989 715 771</span>
              <span className="block text-emerald-700 font-medium">Ouvert 24h/24 et 7j/7.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
