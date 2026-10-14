import React, { useState, useEffect } from 'react';
import {
  Scan, Plus, X, CheckCircle2, AlertCircle, Lock, RefreshCw, Eye, Activity,
  Clock, FileText, ShieldCheck
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ImagerieDemandeStatut } from '../../types';

interface ImagerieDemandeItem {
  id: string;
  numero_demande: string;
  consultation_id: string;
  patient_id: string;
  visite_id: string;
  medecin_id: string;
  date_demande: string;
  statut: ImagerieDemandeStatut;
  urgence: 'NORMALE' | 'URGENTE';
  indication_clinique?: string | null;
  commentaire?: string | null;
  categorie?: string | null;
  facture_id?: string | null;
  created_at: string;
  updated_at: string;
  patient_nom?: string;
  patient_prenom?: string;
  numero_dossier?: string;
  numero_visite?: string;
  medecin_nom?: string;
}

const CATEGORIE_IMAGERIE = [
  { id: 'radiographie', label: 'Radiographie', icon: '📷' },
  { id: 'echo-gen', label: 'Échographie Générale', icon: '🔍' },
  { id: 'echo-pelv', label: 'Échographie Pelvienne', icon: '🔍' },
  { id: 'echo-gyn', label: 'Échographie Gynécologique', icon: '🔍' },
  { id: 'echo-obs', label: 'Échographie Obstétricale', icon: '🔍' },
  { id: 'scanner', label: 'Scanner (TDM)', icon: '🖥️' },
  { id: 'irm', label: 'IRM', icon: '🧲' },
];

const STATUT_LIBELLE: Record<ImagerieDemandeStatut, string> = {
  DEMANDE_CREEE: 'Demande créée',
  PRISE_EN_CHARGE: 'Prise en charge',
  EN_REALISATION: 'En réalisation',
  RESULTATS_A_SAISIR: 'Résultats à saisir',
  RESULTATS_SAISIS: 'Résultats saisis',
  RESULTAT_A_VALIDER: 'En attente de validation',
  RESULTATS_VALIDES: 'Résultats validés',
  RESULTAT_VALIDE: 'Résultat validé',
  TRANSMIS_AU_MEDECIN: 'Transmis au médecin',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée'
};

interface ImagerieOrderManagerProps {
  consultationId: string;
  patientId: string;
  visiteId: string;
  isConsultationFinalized: boolean;
  isAmendmentMode?: boolean;
  amendementMotif?: string;
  initialOrders?: ImagerieDemandeItem[];
  onOrdersUpdated?: () => void;
}

export const ImagerieOrderManager: React.FC<ImagerieOrderManagerProps> = ({
  consultationId,
  patientId,
  visiteId,
  isConsultationFinalized,
  isAmendmentMode = false,
  amendementMotif = '',
  initialOrders = [],
  onOrdersUpdated,
}) => {
  const [orders, setOrders] = useState<ImagerieDemandeItem[]>(initialOrders);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [categorie, setCategorie] = useState<string>('');
  const [indicationClinique, setIndicationClinique] = useState<string>('');
  const [urgence, setUrgence] = useState<'NORMALE' | 'URGENTE'>('NORMALE');
  const [commentaire, setCommentaire] = useState<string>('');

  const [orderAmendmentMode, setOrderAmendmentMode] = useState<boolean>(false);
  const [orderAmendmentMotif, setOrderAmendmentMotif] = useState<string>('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/medical/imagerie-demandes`);
      if (res.ok) {
        const data = await res.json();
        const filtered = (data.demandes || []).filter(
          (d: ImagerieDemandeItem) => d.consultation_id === consultationId && d.statut !== 'ANNULEE'
        );
        setOrders(filtered);
      }
    } catch (err) {
      console.error('Erreur chargement demandes imagerie:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultationId) {
      fetchOrders();
    }
  }, [consultationId]);

  const handleStartNew = () => {
    if (isConsultationFinalized && !isAmendmentMode) {
      setError('La consultation est finalisée. Veuillez activer le mode amendement pour prescrire un nouvel examen.');
      return;
    }

    setCategorie('');
    setIndicationClinique('');
    setUrgence('NORMALE');
    setCommentaire('');
    setOrderAmendmentMode(isConsultationFinalized);
    setOrderAmendmentMotif(amendementMotif || '');
    setError(null);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setShowForm(false);
    setCategorie('');
    setIndicationClinique('');
    setUrgence('NORMALE');
    setCommentaire('');
    setError(null);
    setOrderAmendmentMode(false);
    setOrderAmendmentMotif('');
  };

  const handleSaveOrder = async () => {
    setError(null);

    if (!categorie) {
      setError('Veuillez sélectionner une catégorie d\'examen.');
      return;
    }
    if (!indicationClinique.trim() || indicationClinique.trim().length < 3) {
      setError('Veuillez renseigner l\'indication clinique (minimum 3 caractères).');
      return;
    }

    if (isConsultationFinalized && !orderAmendmentMode) {
      setError('La consultation est finalisée. Un motif explicite d\'amendement est requis.');
      return;
    }

    const currentMotif = orderAmendmentMotif || amendementMotif;
    if ((isConsultationFinalized || orderAmendmentMode) && (!currentMotif || currentMotif.trim().length < 5)) {
      setError('Veuillez renseigner un motif d\'amendement médical d\'au moins 5 caractères.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        consultation_id: consultationId,
        categorie: categorie,
        indication_clinique: indicationClinique.trim(),
        urgence: urgence,
        commentaire: commentaire.trim() || undefined,
      };

      if (isConsultationFinalized || orderAmendmentMode) {
        payload.is_amendment = true;
        payload.amendement_motif = currentMotif.trim();
      }

      const res = await apiFetch('/api/medical/imagerie-demandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la demande.');
      }

      setSuccessMessage('Demande d\'imagerie créée avec succès.');
      setShowForm(false);
      setCategorie('');
      setIndicationClinique('');
      setUrgence('NORMALE');
      setCommentaire('');
      setOrderAmendmentMode(false);
      setOrderAmendmentMotif('');

      await fetchOrders();
      if (onOrdersUpdated) {
        onOrdersUpdated();
      }

      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer la demande d\'imagerie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="section-imagerie" className="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">

      {/* En-tête */}
      <div className="p-4 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/50 border-b border-violet-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold shadow-2xs">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">Examens d'Imagerie</h3>
              <span className="text-[10px] bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded-full border border-violet-200">
                {orders.filter(o => o.statut !== 'ANNULEE').length} prescription(s)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Demandes d'imagerie médicale — Phase 7.1
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!showForm && (
            <button
              type="button"
              onClick={handleStartNew}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Prescrire un Examen d'Imagerie
            </button>
          )}

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            title="Rafraîchir"
            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FORMULAIRE DE CRÉATION */}
      {showForm && (
        <div className="p-5 bg-violet-50/40 border-b border-violet-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scan className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-slate-900">Nouvelle Demande d'Imagerie</h4>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Si consultation finalisée : saisie obligatoire du motif d'amendement */}
          {isConsultationFinalized && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Consultation Finalisée — Amendement Requis</span>
              </div>
              <input
                type="text"
                value={orderAmendmentMotif}
                onChange={(e) => setOrderAmendmentMotif(e.target.value)}
                placeholder="Motif médical de l'amendement..."
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          )}

          {/* Sélection de la catégorie d'examen */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Catégorie d'examen *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIE_IMAGERIE.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategorie(cat.id)}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-all text-left ${
                    categorie === cat.id
                      ? 'bg-violet-600 border-violet-700 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50'
                  }`}
                >
                  <span className="text-base mr-1">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Indication clinique */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Indication Clinique *
            </label>
            <textarea
              rows={2}
              value={indicationClinique}
              onChange={(e) => setIndicationClinique(e.target.value)}
              placeholder="Ex: Suspicion de lithiase biliaire, Bilan pré-opératoire, Suivi post-traumatique..."
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-hidden text-slate-800"
            />
          </div>

          {/* Niveau d'urgence */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Niveau d'urgence
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUrgence('NORMALE')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  urgence === 'NORMALE'
                    ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                NORMALE
              </button>
              <button
                type="button"
                onClick={() => setUrgence('URGENTE')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                  urgence === 'URGENTE'
                    ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-rose-700 hover:bg-rose-50'
                }`}
              >
                ⚠️ URGENTE
              </button>
            </div>
          </div>

          {/* Commentaires */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Informations complémentaires (optionnel)
            </label>
            <textarea
              rows={2}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ex: Patient allergique à la gadolinium, besoin de préparation spécifique..."
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-hidden text-slate-800"
            />
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-violet-100">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={saving}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Prescrire l'examen
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Liste des demandes */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
            <span>Chargement des demandes d'imagerie...</span>
          </div>
        )}

        {!loading && orders.length === 0 && !showForm && (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 space-y-2">
            <Scan className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">Aucun examen d'imagerie prescrit pour cette consultation.</p>
            <p className="text-[11px] text-slate-400">
              Cliquez sur « Prescrire un Examen d'Imagerie » pour ordonner un examen.
            </p>
          </div>
        )}

        {!loading && orders.map((order) => {
          const isUrgent = order.urgence === 'URGENTE';
          const isFinalized = order.statut === 'TERMINEE' || order.statut === 'TRANSMIS_AU_MEDECIN';
          const isPaid = order.facture_id !== null;
          const dateStr = new Date(order.date_demande || order.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric'
          });
          const catLabel = CATEGORIE_IMAGERIE.find(c => c.id === order.categorie)?.label || order.categorie || 'Imagerie';

          return (
            <div
              key={order.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isUrgent
                  ? 'bg-rose-50/30 border-rose-200 ring-1 ring-rose-300/40'
                  : isFinalized
                    ? 'bg-emerald-50/20 border-emerald-200'
                    : 'bg-white border-violet-100 shadow-2xs'
              }`}
            >
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isUrgent ? 'bg-rose-100' : isFinalized ? 'bg-emerald-100' : 'bg-violet-100'
                    }`}>
                      <Scan className={`w-4.5 h-4.5 ${
                        isUrgent ? 'text-rose-700' : isFinalized ? 'text-emerald-700' : 'text-violet-700'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="font-bold text-xs text-slate-900">{catLabel}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isUrgent ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.urgence}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isFinalized
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {STATUT_LIBELLE[order.statut as ImagerieDemandeStatut] || order.statut}
                        </span>
                        {isPaid && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            Payé
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        N° {order.numero_demande} • Prescrit le {dateStr} par Dr. {order.medecin_nom || 'traitant'}
                      </p>
                      {order.indication_clinique && (
                        <p className="text-xs text-slate-700 mt-1 italic">
                          {order.indication_clinique}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">{order.numero_demande}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
