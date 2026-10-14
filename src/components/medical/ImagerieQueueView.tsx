import React, { useState, useEffect } from 'react';
import {
  Scan, Camera, Activity, Brain, ShieldCheck, AlertCircle,
  Loader, FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ImagerieCategorie {
  id: string;
  nom: string;
  description: string;
  icone: string;
  actif: boolean;
}

export const ImagerieQueueView: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const categories: ImagerieCategorie[] = [
    {
      id: 'radio',
      nom: 'Radiographie',
      description: 'Examens radiologiques standards — Thorax, squelette, abdomen, membres.',
      icone: 'scan',
      actif: true,
    },
    {
      id: 'echo-gen',
      nom: 'Échographie Générale',
      description: 'Échographie abdominale, thyroïde, mammaire, vasculaire et musculo-squelettique.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-pelv',
      nom: 'Échographie Pelvienne',
      description: 'Échographie pelvienne transabdominale et trans-vaginale — organes génitaux féminins et vessie.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-gyn',
      nom: 'Échographie Gynécologique',
      description: 'Bilan gynécologique échographique complet — utérus, annexes, doppler ovarien.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-obs',
      nom: 'Échographie Obstétricale',
      description: 'Suivi de grossesse — datation, anatomie fœtale, dopplers, morphologie.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'scanner',
      nom: 'Scanner (TDM)',
      description: 'Tomodensitométrie — corps entier, crâne, thorax, abdomen, pelvis, angio-scanner.',
      icone: 'activity',
      actif: true,
    },
    {
      id: 'irm',
      nom: 'IRM',
      description: 'Imagerie par Résonance Magnétique — encéphale, rachis, articulations, abdomen, angio-IRM.',
      icone: 'brain',
      actif: true,
    },
  ];

  const getIcon = (icone: string) => {
    switch (icone) {
      case 'scan':
        return <Scan className="w-8 h-8" />;
      case 'camera':
        return <Camera className="w-8 h-8" />;
      case 'activity':
        return <Activity className="w-8 h-8" />;
      case 'brain':
        return <Brain className="w-8 h-8" />;
      default:
        return <Scan className="w-8 h-8" />;
    }
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center">
              <Scan className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                Imagerie Médicale
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Demande et suivi des examens d&apos;imagerie — Phase 7.1
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Module en construction</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm text-slate-500 font-medium">Chargement des catégories...</p>
        </div>
      ) : (
        <>
          {/* Grille des catégories d'examens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 group-hover:bg-indigo-100 transition-colors">
                    {getIcon(cat.icone)}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Actif
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-1.5">
                  {cat.nom}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {cat.description}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">{cat.id.toUpperCase()}</span>
                  <span className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                    <FileText className="w-3 h-3" />
                    Détails en cours
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Note d'information */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 mb-1">Phase 7.1 — Structure initiale</p>
              <p>
                Cette phase positionne le socle du module Imagerie médicale.
                Les workflows de prescription, d&apos;exécution, de saisie des comptes rendus,
                de validation et de facturation seront implémentés dans les étapes suivantes.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
