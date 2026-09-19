import React, { useState, useEffect } from 'react';
import { Visite, Doctor } from '../../types/index.js';
import { Stethoscope, CheckCircle2, User, X, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AssignDoctorModalProps {
  visite: Visite;
  onClose: () => void;
  onSuccess: (updatedVisite: Visite) => void;
}

export const AssignDoctorModal: React.FC<AssignDoctorModalProps> = ({ visite, onClose, onSuccess }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(visite.medecin_id || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await apiFetch('/api/doctors');
        const data = await res.json();
        if (res.ok && Array.isArray(data.doctors)) {
          setDoctors(data.doctors);
          if (data.doctors.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(data.doctors[0].id);
          }
        } else {
          setErrorMessage(data.error || 'Impossible de charger la liste des médecins.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erreur réseau.');
      } finally {
        setIsLoading(false);
      }
    }
    loadDoctors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setErrorMessage('Veuillez sélectionner un médecin traitant.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/api/visites/${visite.id}/assign-doctor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medecin_id: selectedDoctorId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors de l\'affectation du médecin.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur réseau.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-400/30">
              <Stethoscope className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Affectation du Médecin Traitant</h3>
              <p className="text-xs text-slate-300">
                Patient : <span className="font-semibold text-white">{visite.patient_nom} {visite.patient_prenom}</span>
              </p>
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

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Dossier permanent :</span>
              <span className="font-mono font-bold text-slate-800">{visite.numero_dossier}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Numéro de visite :</span>
              <span className="font-mono text-slate-800">{visite.numero_visite}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Motif de venue :</span>
              <span className="text-slate-800">{visite.motif_venue || 'Consultation générale'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Sélectionnez le médecin traitant actif :
            </label>

            {isLoading ? (
              <div className="flex items-center justify-center p-6 space-x-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Chargement des médecins en service...</span>
              </div>
            ) : doctors.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center">
                Aucun médecin actif configuré dans la clinique. Veuillez contacter l'administrateur.
              </div>
            ) : (
              <div className="space-y-2">
                {doctors.map((doc) => (
                  <label
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedDoctorId === doc.id
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        selectedDoctorId === doc.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">
                          Dr. {doc.nom_complet}
                        </span>
                        <span className="text-[11px] text-slate-500">Identifiant : @{doc.username}</span>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="medecin_choice"
                      value={doc.id}
                      checked={selectedDoctorId === doc.id}
                      onChange={() => setSelectedDoctorId(doc.id)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
            <strong>Transition d'état :</strong> La visite passera immédiatement au statut <strong>ATTENTE_MEDECIN</strong>. Le médecin pourra visualiser le patient dans sa file d'attente lors de la phase consultation.
          </div>

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
              disabled={isSubmitting || !selectedDoctorId}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Affectation...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Confirmer l'affectation & Placer en Attente Médecin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
