import React from 'react';
import { Construction, ArrowLeft, ShieldCheck } from 'lucide-react';

interface Phase2PlaceholderProps {
  moduleName: string;
  roleRequired: string;
  description: string;
  workflowSteps: string[];
  onBack: () => void;
}

export const Phase2Placeholder: React.FC<Phase2PlaceholderProps> = ({
  moduleName,
  roleRequired,
  description,
  workflowSteps,
  onBack,
}) => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
              Prévu pour la Phase 2
            </span>
            <span className="text-xs text-slate-500">Rôle requis : <strong>{roleRequired}</strong></span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">{moduleName}</h2>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour au Dashboard</span>
        </button>
      </div>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center">
          <Construction className="w-4 h-4 mr-2 text-amber-600" />
          Spécification validée prête pour implémentation Phase 2 :
        </h3>
        <ol className="space-y-2.5 text-xs text-slate-700 list-decimal list-inside leading-relaxed">
          {workflowSteps.map((step, idx) => (
            <li key={idx} className="pl-1">
              <span className="font-semibold text-slate-900">{step.split(' : ')[0]}</span>
              {step.includes(' : ') && <span> : {step.split(' : ')[1]}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-900 flex items-center space-x-2.5">
        <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <span>
          Le socle technique Phase 1 (Base relationnelle, tables, clés étrangères, sessions, RBAC et audit) est d'ores et déjà actif et prêt à accueillir ce module dès votre feu vert.
        </span>
      </div>
    </div>
  );
};
