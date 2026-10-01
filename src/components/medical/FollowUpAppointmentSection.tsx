import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, Plus, Trash2, 
  RefreshCw, ChevronDown, ChevronUp, Save, X, Phone, UserCheck, ShieldCheck
} from 'lucide-react';
import { RendezVous, RendezVousStatut } from '../../types';
import { apiFetch } from '../../lib/api';

interface FollowUpAppointmentSectionProps {
  consultationId: string;
  patientId: string;
  visiteId: string;
  medecinId: string;
  patientNom?: string;
  patientPrenom?: string;
  isConsultationFinalized: boolean;
}

export const FollowUpAppointmentSection: React.FC<FollowUpAppointmentSectionProps> = ({
  consultationId,
  patientId,
  visiteId,
  medecinId,
  patientNom,
  patientPrenom,
  isConsultationFinalized
}) => {
  const [appointments, setAppointments] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mode création
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [dateRdv, setDateRdv] = useState<string>('');
  const [heureRdv, setHeureRdv] = useState<string>('09:00');
  const [motif, setMotif] = useState<string>('Contrôle clinique post-traitement');
  const [notes, setNotes] = useState<string>('');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/rendez-vous?patient_id=${patientId}&tous=true`);
      if (res.ok) {
        const data = await res.json();
        // Filtrer les rendez-vous liés à cette visite ou ce patient
        setAppointments(data.appointments || []);
      }
    } catch (err: any) {
      console.error('Erreur chargement rendez-vous suivi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchAppointments();
    }
  }, [patientId]);

  // Raccourcis de dates
  const handleShortcutDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDateRdv(d.toLocaleDateString('en-CA'));
  };

  const handleStartNew = () => {
    // Par défaut, proposer J+7
    handleShortcutDays(7);
    setHeureRdv('09:00');
    setMotif('Contrôle clinique post-traitement');
    setNotes('');
    setIsCreating(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleCreate = async () => {
    if (!dateRdv) {
      setError("La date du rendez-vous de contrôle est obligatoire.");
      return;
    }
    try {
      setSaving(true);
      setError(null);

      const res = await apiFetch('/api/rendez-vous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          medecin_id: medecinId || undefined,
          visite_id: visiteId || undefined,
          date_rdv: dateRdv.trim().split('T')[0],
          heure_rdv: heureRdv || '09:00',
          motif: motif.trim() || 'Contrôle clinique post-traitement',
          type_rdv: 'CONTROLE',
          source_demande: 'CONSULTATION_SUIVI',
          statut: 'PLANIFIÉ',
          notes: notes.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la programmation du rendez-vous');
      }

      setSuccessMessage("Rendez-vous de contrôle enregistré avec succès. Il apparaît automatiquement dans le planning de la réception.");
      setIsCreating(false);
      await fetchAppointments();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous ?")) return;
    try {
      setSaving(true);
      const res = await apiFetch(`/api/rendez-vous/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif_annulation: 'Annulé depuis l’espace consultation par le médecin' })
      });
      if (res.ok) {
        setSuccessMessage("Rendez-vous annulé.");
        await fetchAppointments();
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'annulation");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatut: RendezVousStatut) => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/rendez-vous/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la mise à jour du statut');
      }
      setSuccessMessage(`Statut du rendez-vous mis à jour : ${newStatut}`);
      await fetchAppointments();
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (statut: RendezVousStatut) => {
    switch (statut) {
      case 'PLANIFIÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <Clock className="w-3 h-3 mr-1" />
            Planifié
          </span>
        );
      case 'CONFIRMÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmé
          </span>
        );
      case 'PATIENT PRÉSENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <UserCheck className="w-3 h-3 mr-1" />
            Patient présent
          </span>
        );
      case 'HONORÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Honoré
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            Absent
          </span>
        );
      case 'ANNULÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <X className="w-3 h-3 mr-1" />
            Annulé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {statut}
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-800/80 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center">
              Rendez-vous de Contrôle & Suivi Clinique
              <span className="ml-2.5 text-[10px] uppercase font-bold tracking-wider bg-blue-600/60 text-blue-100 px-2 py-0.5 rounded-full">
                Calendrier Partagé
              </span>
            </h3>
            <p className="text-xs text-blue-200">
              Programmez un contrôle post-traitement — Synchronisé automatiquement avec le planning de la réception
            </p>
          </div>
        </div>

        {!isCreating && (
          <button
            type="button"
            onClick={handleStartNew}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Programmer un Contrôle
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-rose-600 mr-2 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Formulaire de création */}
        {isCreating && (
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-blue-200 pb-2">
              <span className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-blue-700" />
                Nouveau Rendez-vous de Suivi Clinique
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Raccourcis de délais */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Délais recommandés :
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleShortcutDays(3)}
                  className="px-2.5 py-1 text-xs bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 rounded-md font-medium"
                >
                  Dans 3 jours (72h)
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutDays(7)}
                  className="px-2.5 py-1 text-xs bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 rounded-md font-medium"
                >
                  Dans 1 semaine (J+7)
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutDays(14)}
                  className="px-2.5 py-1 text-xs bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 rounded-md font-medium"
                >
                  Dans 2 semaines (J+14)
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutDays(30)}
                  className="px-2.5 py-1 text-xs bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 rounded-md font-medium"
                >
                  Dans 1 mois
                </button>
              </div>
            </div>

            {/* Champs Date & Heure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date du rendez-vous *
                </label>
                <input
                  type="date"
                  value={dateRdv}
                  onChange={(e) => setDateRdv(e.target.value)}
                  min={new Date().toLocaleDateString('en-CA')}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Heure estimée
                </label>
                <input
                  type="time"
                  value={heureRdv}
                  onChange={(e) => setHeureRdv(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Motif */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif du rendez-vous de suivi
              </label>
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Contrôle clinique post-traitement antipaludéen..."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes complémentaires */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Consignes pour le patient & la réception (optionnel)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Faire une NFS de contrôle avant la consultation. Venir à jeun si glycémie..."
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions formulaire */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-blue-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleCreate}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs flex items-center"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? 'Enregistrement...' : 'Enregistrer le Rendez-vous'}
              </button>
            </div>
          </div>
        )}

        {/* Liste des rendez-vous existants pour ce patient */}
        {appointments.length === 0 && !isCreating ? (
          <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
            <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-600">Aucun rendez-vous de suivi programmé pour ce patient</p>
            <p className="text-[11px] text-slate-400">
              Cliquez sur "Programmer un Contrôle" pour fixer une date de suivi partagée avec la réception.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((rdv) => (
              <div 
                key={rdv.id}
                className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">
                      {new Date(rdv.date_rdv).toLocaleDateString('fr-FR', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                      })} à {rdv.heure_rdv || '09:00'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">({rdv.numero_rdv})</span>
                    {getStatusBadge(rdv.statut)}
                  </div>
                  <p className="text-slate-600">
                    Motif : <strong className="text-slate-800">{rdv.motif}</strong>
                    {rdv.notes && <span className="text-slate-500 italic ml-2">({rdv.notes})</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Praticien : Dr. {rdv.medecin_nom || 'Médecin'} • Source : {rdv.source_demande === 'CONSULTATION_SUIVI' ? 'Suivi consultation' : rdv.source_demande || 'Accueil'}
                  </p>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                  {rdv.statut === 'PATIENT PRÉSENT' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(rdv.id, 'HONORÉ')}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center shadow-xs"
                      title="Marquer la consultation de suivi comme honorée"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Honoré
                    </button>
                  )}

                  {rdv.statut !== 'ANNULÉ' && rdv.statut !== 'HONORÉ' && (
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(rdv.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs flex items-center shrink-0"
                      title="Annuler ce rendez-vous"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
