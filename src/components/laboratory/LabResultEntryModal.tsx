import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  X, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Printer, 
  ShieldAlert, 
  History, 
  Upload, 
  Clock, 
  Syringe, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { LabOrder, LabAnalyse, LabResultAmendment } from '../../types';
import { api } from '../../lib/api';

// Valeurs de référence et unités prédéfinies pour assister le laborantin
const BIOLOGY_PRESETS: Record<string, { unite: string; ref: string; normalMin?: number; normalMax?: number }> = {
  'GLYCÉMIE': { unite: 'mg/dL', ref: '70 - 110', normalMin: 70, normalMax: 110 },
  'GLYCEMIE': { unite: 'mg/dL', ref: '70 - 110', normalMin: 70, normalMax: 110 },
  'GLYCÉMIE À JEUN': { unite: 'mg/dL', ref: '70 - 110', normalMin: 70, normalMax: 110 },
  'GLYCEMIE A JEUN': { unite: 'mg/dL', ref: '70 - 110', normalMin: 70, normalMax: 110 },
  'CRÉATININE': { unite: 'mg/L', ref: '6.0 - 12.0', normalMin: 6.0, normalMax: 12.0 },
  'CREATININEMIE': { unite: 'mg/L', ref: '6.0 - 12.0', normalMin: 6.0, normalMax: 12.0 },
  'URÉE': { unite: 'g/L', ref: '0.15 - 0.45', normalMin: 0.15, normalMax: 0.45 },
  'UREE': { unite: 'g/L', ref: '0.15 - 0.45', normalMin: 0.15, normalMax: 0.45 },
  'HÉMOGLOBINE': { unite: 'g/dL', ref: '12.0 - 16.5', normalMin: 12.0, normalMax: 16.5 },
  'HEMOGLOBINE': { unite: 'g/dL', ref: '12.0 - 16.5', normalMin: 12.0, normalMax: 16.5 },
  'NFS': { unite: 'g/dL', ref: 'Hb: 12-16 g/dL, GB: 4000-10000/mm³, Plq: 150-450 G/L' },
  'NUMÉRATION FORMULE SANGUINE': { unite: 'g/dL', ref: 'Hb: 12-16 g/dL, GB: 4000-10000/mm³, Plq: 150-450 G/L' },
  'CRP': { unite: 'mg/L', ref: '< 6.0', normalMax: 6.0 },
  'PROTEINE C-REACTIVE': { unite: 'mg/L', ref: '< 6.0', normalMax: 6.0 },
  'GOUTTE ÉPAISSE': { unite: 'parasites/µL', ref: 'Négative (< 0)' },
  'GOUTTE EPAISSE / TDR': { unite: 'parasites/µL', ref: 'Négative' },
  'TDR PALUDISME': { unite: 'qualitatif', ref: 'Négatif' },
  'TRANSAMINASES ALAT': { unite: 'UI/L', ref: '< 45', normalMax: 45 },
  'TRANSAMINASES ASAT': { unite: 'UI/L', ref: '< 35', normalMax: 35 },
  'IONOGRAMME SANGUIN': { unite: 'mmol/L', ref: 'Na+: 135-145, K+: 3.5-5.0, Cl-: 98-106' },
  'ECBU': { unite: '/mm³', ref: 'Leuco < 10/mm³, Hématies < 10/mm³, Stérile' }
};

interface LabResultEntryModalProps {
  order: LabOrder;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: LabOrder) => void;
  onOpenBulletin: (orderId: string) => void;
}

export const LabResultEntryModal: React.FC<LabResultEntryModalProps> = ({
  order,
  onClose,
  onOrderUpdated,
  onOpenBulletin
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // État du prélèvement
  const [prelevementDate, setPrelevementDate] = useState<string>(
    order.date_prelevement 
      ? new Date(order.date_prelevement).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [isPrelevementDone, setIsPrelevementDone] = useState<boolean>(
    !!order.date_prelevement || ['PRELEVEMENT_EFFECTUE', 'EN_ANALYSE', 'RESULTATS_SAISIS', 'RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
  );

  // État des analyses
  const [analysesData, setAnalysesData] = useState<Array<{
    id: string;
    nom_analyse: string;
    type_echantillon: string;
    valeur_mesuree: string;
    unite: string;
    valeurs_reference: string;
    interpretation: 'NORMAL' | 'ANORMAL' | 'CRITIQUE' | '';
    observation: string;
    commentaire_technique: string;
  }>>(() => {
    return (order.analyses || []).map((an: LabAnalyse) => {
      // Détecter preset si pas encore renseigné
      const upperNom = (an.nom_analyse || '').toUpperCase();
      let defaultUnite = an.unite || '';
      let defaultRef = an.valeurs_reference || '';

      for (const [key, preset] of Object.entries(BIOLOGY_PRESETS)) {
        if (upperNom.includes(key)) {
          if (!defaultUnite) defaultUnite = preset.unite;
          if (!defaultRef) defaultRef = preset.ref;
          break;
        }
      }

      return {
        id: an.id,
        nom_analyse: an.nom_analyse,
        type_echantillon: an.type_echantillon,
        valeur_mesuree: an.valeur_mesuree || '',
        unite: defaultUnite,
        valeurs_reference: defaultRef,
        interpretation: (an.interpretation as any) || '',
        observation: an.observation || '',
        commentaire_technique: an.commentaire_technique || ''
      };
    });
  });

  // Métadonnées globales
  const [conclusionGlobale, setConclusionGlobale] = useState<string>(order.conclusion_globale || '');
  const [remarquesTechniques, setRemarquesTechniques] = useState<string>(order.remarques_techniques || '');
  const [documentUrl, setDocumentUrl] = useState<string>(order.document_url || '');
  const [documentNom, setDocumentNom] = useState<string>(order.document_nom || '');

  // Mode amendement pour les demandes déjà validées
  const isAlreadyValidated = ['RESULTATS_VALIDES', 'RESULTAT_VALIDE', 'TERMINEE'].includes(order.statut);
  const [amendementMode, setAmendementMode] = useState<boolean>(false);
  const [amendementMotif, setAmendementMotif] = useState<string>('');

  // Gestion des changements sur chaque analyse
  const handleAnalyseChange = (id: string, field: string, value: string) => {
    setAnalysesData((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };

        // Aide automatique au calcul d'interprétation
        if (field === 'valeur_mesuree') {
          const valNum = parseFloat(value.replace(',', '.'));
          if (!isNaN(valNum)) {
            const upperNom = item.nom_analyse.toUpperCase();
            for (const [key, preset] of Object.entries(BIOLOGY_PRESETS)) {
              if (upperNom.includes(key)) {
                if (preset.normalMin !== undefined && valNum < preset.normalMin) {
                  updated.interpretation = 'ANORMAL';
                } else if (preset.normalMax !== undefined && valNum > preset.normalMax) {
                  // Si beaucoup trop élevé, critique
                  if (valNum > preset.normalMax * 2) {
                    updated.interpretation = 'CRITIQUE';
                  } else {
                    updated.interpretation = 'ANORMAL';
                  }
                } else if (preset.normalMin !== undefined || preset.normalMax !== undefined) {
                  updated.interpretation = 'NORMAL';
                }
                break;
              }
            }
          }
        }

        return updated;
      })
    );
  };

  // 1. Enregistrement prélèvement
  const handleSavePrelevement = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.post<{ message: string; lab_order: LabOrder }>(
        `/api/laboratory/orders/${order.id}/prelevement`,
        {
          date_prelevement: new Date(prelevementDate).toISOString(),
          statut: 'PRELEVEMENT_EFFECTUE'
        }
      );
      setIsPrelevementDone(true);
      setSuccessMessage('Prélèvement biologique enregistré avec succès.');
      onOrderUpdated(res.lab_order);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du prélèvement.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Enregistrement brouillon / résultats
  const handleSaveDraft = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.post<{ message: string; lab_order: LabOrder }>(
        `/api/laboratory/orders/${order.id}/results`,
        {
          results: analysesData,
          conclusion_globale: conclusionGlobale,
          remarques_techniques: remarquesTechniques,
          document_url: documentUrl,
          document_nom: documentNom,
          statut: 'RESULTATS_SAISIS'
        }
      );
      setSuccessMessage('Résultats enregistrés en brouillon avec succès.');
      onOrderUpdated(res.lab_order);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement des résultats.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Validation définitive
  const handleValidateResults = async () => {
    // Vérification qu'au moins une analyse a une valeur
    const hasValue = analysesData.some((a) => a.valeur_mesuree.trim().length > 0 || a.observation.trim().length > 0);
    if (!hasValue) {
      setError('Veuillez saisir au moins un résultat d\'analyse avant de procéder à la validation.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir valider définitivement ces résultats d’analyses ?\n\nIls seront immédiatement certifiés et transmis au médecin prescripteur.')) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Étape 1 : Sauvegarde des résultats
      await api.post(`/api/laboratory/orders/${order.id}/results`, {
        results: analysesData,
        conclusion_globale: conclusionGlobale,
        remarques_techniques: remarquesTechniques,
        document_url: documentUrl,
        document_nom: documentNom,
        statut: 'RESULTATS_SAISIS'
      });

      // Étape 2 : Validation formelle et notification médecin
      const res = await api.post<{ message: string; lab_order: LabOrder }>(
        `/api/laboratory/orders/${order.id}/validate`,
        {
          conclusion_globale: conclusionGlobale,
          remarques_techniques: remarquesTechniques
        }
      );

      setSuccessMessage('Résultats validés avec succès et transmis au médecin prescripteur !');
      onOrderUpdated(res.lab_order);
      setTimeout(() => {
        onClose();
        onOpenBulletin(order.id);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation des résultats.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Soumission d'amendement pour une demande déjà validée
  const handleSaveAmendment = async () => {
    if (!amendementMotif || amendementMotif.trim().length < 5) {
      setError('Le motif d’amendement est strictement obligatoire (au moins 5 caractères) pour tracer la rectification réglementaire.');
      return;
    }

    if (!confirm(`Confirmez-vous l'amendement officiel de ces résultats ?\nMotif : "${amendementMotif}"`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.post<{ message: string; lab_order: LabOrder }>(
        `/api/laboratory/orders/${order.id}/amend`,
        {
          motif: amendementMotif,
          results: analysesData,
          conclusion_globale: conclusionGlobale,
          remarques_techniques: remarquesTechniques
        }
      );
      setSuccessMessage('Amendement validé avec succès. Les résultats rectifiés ont été notifiés au médecin.');
      onOrderUpdated(res.lab_order);
      setAmendementMode(false);
      setAmendementMotif('');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'amendement des résultats.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Entête du modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">
                  Saisie & Validation des Analyses Biologiques
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {order.numero_demande || order.id}
                </span>
                {order.urgence === 'URGENTE' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    URGENT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Patient : <strong className="text-white uppercase">{order.patient_nom} {order.patient_prenom}</strong> (N° {order.numero_dossier}) — Prescrit par Dr. {order.medecin_nom}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenBulletin(order.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition cursor-pointer border border-slate-700"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Bulletin Officiel
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages d'alerte / succès */}
        {error && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-700 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-700 font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section avertissement si déjà validé */}
        {isAlreadyValidated && !amendementMode && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Résultats validés & certifiés :</strong> Cette demande a déjà été validée le {order.validated_at ? new Date(order.validated_at).toLocaleString('fr-FR') : '—'} par {order.validated_by_nom || 'le laboratoire'}. Les résultats ne peuvent être modifiés que via la procédure d'amendement officiel.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAmendementMode(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shrink-0 transition ml-4"
            >
              Rectifier (Amendement)
            </button>
          </div>
        )}

        {/* Formulaire d'amendement si actif */}
        {amendementMode && (
          <div className="px-6 py-3.5 bg-amber-500/10 border-b border-amber-300 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <History className="w-4 h-4 text-amber-700" />
                <span>PROCÉDURE D'AMENDEMENT / RECTIFICATION OFFICIELLE DE RÉSULTAT</span>
              </div>
              <button
                type="button"
                onClick={() => setAmendementMode(false)}
                className="text-amber-700 hover:text-amber-900 text-xs font-medium cursor-pointer"
              >
                Annuler
              </button>
            </div>
            <p className="text-slate-700 text-[11px]">
              Toute modification apportée à un résultat biologique certifié sera consignée dans le registre d’audit avec la version précédente et transmise au médecin traitant.
            </p>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-800 shrink-0">Motif explicite de l'amendement * :</label>
              <input
                type="text"
                value={amendementMotif}
                onChange={(e) => setAmendementMotif(e.target.value)}
                placeholder="Ex: Rectification suite à repasse de contrôle sur automate / Erreur de transcription..."
                className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        {/* Contenu scrollable du modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          
          {/* Bloc 1 : Statut du prélèvement biologique */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <Syringe className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Échantillons & Prélèvement Biologique
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isPrelevementDone ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Prélèvement effectué le {new Date(prelevementDate).toLocaleString('fr-FR')}
                      </span>
                    ) : (
                      'Prélèvement en attente de réalisation'
                    )}
                  </p>
                </div>
              </div>

              {!isPrelevementDone ? (
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={prelevementDate}
                    onChange={(e) => setPrelevementDate(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSavePrelevement}
                    disabled={submitting}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition cursor-pointer disabled:opacity-50"
                  >
                    Confirmer le Prélèvement
                  </button>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Prélèvement Validé
                </span>
              )}
            </div>
          </div>

          {/* Bloc 2 : Saisie des analyses demandées */}
          <div className="rounded-lg bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>Analyses prescrites ({analysesData.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Renseignez les valeurs mesurées, unités et interprétations
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {analysesData.map((analyse, index) => {
                const isAnormal = analyse.interpretation === 'ANORMAL';
                const isCritique = analyse.interpretation === 'CRITIQUE';

                return (
                  <div 
                    key={analyse.id}
                    className={`p-4 transition ${
                      isCritique ? 'bg-rose-50/40' : isAnormal ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">
                          {analyse.nom_analyse}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {analyse.type_echantillon}
                        </span>
                      </div>

                      {/* Sélecteur d'interprétation */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 mr-1">Interprétation :</span>
                        {(['NORMAL', 'ANORMAL', 'CRITIQUE'] as const).map((interp) => (
                          <button
                            key={interp}
                            type="button"
                            disabled={isAlreadyValidated && !amendementMode}
                            onClick={() => handleAnalyseChange(analyse.id, 'interpretation', interp)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                              analyse.interpretation === interp
                                ? interp === 'NORMAL'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : interp === 'ANORMAL'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {interp}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grille des champs de saisie pour l'analyse */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Valeur mesurée * :
                        </label>
                        <input
                          type="text"
                          disabled={isAlreadyValidated && !amendementMode}
                          value={analyse.valeur_mesuree}
                          onChange={(e) => handleAnalyseChange(analyse.id, 'valeur_mesuree', e.target.value)}
                          placeholder="Ex: 0.95 ou Négatif"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Unité :
                        </label>
                        <input
                          type="text"
                          disabled={isAlreadyValidated && !amendementMode}
                          value={analyse.unite}
                          onChange={(e) => handleAnalyseChange(analyse.id, 'unite', e.target.value)}
                          placeholder="Ex: g/L, mg/L, /mm³"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Normes / Réf. :
                        </label>
                        <input
                          type="text"
                          disabled={isAlreadyValidated && !amendementMode}
                          value={analyse.valeurs_reference}
                          onChange={(e) => handleAnalyseChange(analyse.id, 'valeurs_reference', e.target.value)}
                          placeholder="Ex: 0.70 - 1.10"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Observation :
                        </label>
                        <input
                          type="text"
                          disabled={isAlreadyValidated && !amendementMode}
                          value={analyse.observation}
                          onChange={(e) => handleAnalyseChange(analyse.id, 'observation', e.target.value)}
                          placeholder="Ex: Sérum limpide, pas d'hémolyse"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Bloc 3 : Conclusion globale & Remarques techniques du biologiste */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Conclusion Biologique & Compte Rendu</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Conclusion globale (visible par le médecin prescripteur) :
                </label>
                <textarea
                  rows={3}
                  disabled={isAlreadyValidated && !amendementMode}
                  value={conclusionGlobale}
                  onChange={(e) => setConclusionGlobale(e.target.value)}
                  placeholder="Ex: Profil glycémique et rénal dans les limites de la normale. Présence d'une anémie normocytaire modérée à surveiller."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:ring-1 focus:ring-emerald-500 bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Remarques techniques / Automate (usage interne laboratoire) :
                </label>
                <textarea
                  rows={3}
                  disabled={isAlreadyValidated && !amendementMode}
                  value={remarquesTechniques}
                  onChange={(e) => setRemarquesTechniques(e.target.value)}
                  placeholder="Ex: Automate Mindray BC-5300, série N° 458. Contrôle qualité journalier validé."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:ring-1 focus:ring-emerald-500 bg-white resize-none"
                />
              </div>
            </div>

            {/* Document externe ou compte rendu scanné */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Lien ou référence du document scanné / PDF (facultatif) :
                </label>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    disabled={isAlreadyValidated && !amendementMode}
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="https://... ou réf: SCAN-LAB-2026-001.pdf"
                    className="flex-1 px-2.5 py-1 border border-slate-300 rounded text-slate-800 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="w-48">
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Nom d'affichage :
                </label>
                <input
                  type="text"
                  disabled={isAlreadyValidated && !amendementMode}
                  value={documentNom}
                  onChange={(e) => setDocumentNom(e.target.value)}
                  placeholder="Ex: Tracé_automate.pdf"
                  className="w-full px-2.5 py-1 border border-slate-300 rounded text-slate-800 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Historique des amendements si existants */}
          {order.amendements && order.amendements.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-700" />
                <span>Historique des amendements ({order.amendements.length})</span>
              </h4>
              <div className="space-y-1.5">
                {order.amendements.map((amd: LabResultAmendment, idx: number) => (
                  <div key={amd.id || idx} className="p-2.5 rounded bg-white border border-amber-200 text-slate-800 text-[11px]">
                    <div className="flex items-center justify-between font-semibold text-amber-900 mb-1">
                      <span>Amendement #{idx + 1} — {new Date(amd.created_at).toLocaleString('fr-FR')}</span>
                      <span>Par {amd.amende_par_nom || 'Laboratoire'}</span>
                    </div>
                    <p className="italic text-slate-700">« {amd.motif} »</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Pied de page avec actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200">
          <div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Fermer
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Si en mode amendement */}
            {amendementMode ? (
              <button
                type="button"
                onClick={handleSaveAmendment}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Enregistrer l'amendement officiel
              </button>
            ) : isAlreadyValidated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Résultats certifiés et validés
                </span>
                <button
                  type="button"
                  onClick={() => onOpenBulletin(order.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer Bulletin
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  Enregistrer Brouillon
                </button>

                <button
                  type="button"
                  onClick={handleValidateResults}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider Définitivement & Transmettre
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
