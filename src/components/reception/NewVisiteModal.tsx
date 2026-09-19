import React, { useState } from 'react';
import { Patient, Visite, VisiteType } from '../../types/index.js';
import { FilePlus2, X, AlertCircle, CheckCircle2, User, Clock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface NewVisiteModalProps {
  patient: Patient;
  onClose: () => void;
  onSuccess: (visite: Visite) => void;
}

export const NewVisiteModal: React.FC<NewVisiteModalProps> = ({ patient, onClose, onSuccess }) => {
  const [motifVenue, setMotifVenue] = useState('Consultation générale');
  const [typeVisite, setTypeVisite] = useState<VisiteType>('STANDARD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch('/api/visites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          motif_venue: motifVenue,
          type_visite: typeVisite,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors de la création de la visite.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <FilePlus2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Nouvelle Visite d'Accueil</h3>
              <p className="text-xs text-slate-300">Épisode de soin du jour — Statut initial : ATTENTE_TRIAGE</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Fiche récapitulative du patient */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 text-sm">
                {patient.nom} {patient.prenom}
              </span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-sm">
                {patient.numero_dossier}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400">Né(e) le : </span>
                <span className="font-medium text-slate-800">{patient.date_naissance}</span> ({patient.sexe === 'M' ? 'Homme' : 'Femme'})
              </div>
              <div>
                <span className="text-slate-400">Téléphone : </span>
                <span className="font-mono text-slate-800">{patient.telephone}</span>
              </div>
              {patient.allergies && (
                <div className="col-span-2 text-amber-800 bg-amber-50 p-1.5 rounded-sm border border-amber-200">
                  <span className="font-bold">Allergies signalées : </span>
                  <span>{patient.allergies}</span>
                </div>
              )}
            </div>
          </div>

          {/* Type de visite */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Type de visite / Priorité d'accueil *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTypeVisite('STANDARD')}
                className={`p-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  typeVisite === 'STANDARD'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setTypeVisite('URGENCE')}
                className={`p-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  typeVisite === 'URGENCE'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Urgence
              </button>
              <button
                type="button"
                onClick={() => setTypeVisite('CONTROLE')}
                className={`p-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  typeVisite === 'CONTROLE'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Contrôle
              </button>
            </div>
          </div>

          {/* Motif de venue */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motif de venue / Plaintes exprimées *
            </label>
            <textarea
              required
              rows={3}
              value={motifVenue}
              onChange={(e) => setMotifVenue(e.target.value)}
              placeholder="Ex: Fièvre, toux et fatigue intense depuis 3 jours..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Règle d'intégrité :</strong> Cette visite est enregistrée sous le dossier permanent <strong>{patient.numero_dossier}</strong> sans altération des visites antérieures.
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Création...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Ouvrir la Visite & Diriger vers le Triage</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
