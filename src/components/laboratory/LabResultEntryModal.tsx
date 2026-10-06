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
  HelpCircle,
  Barcode
} from 'lucide-react';
import { LabOrder, LabAnalyse, LabResultAmendment, CatalogueExam } from '../../types';
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
  const [catalogueExams, setCatalogueExams] = useState<CatalogueExam[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState<boolean>(false);
  const [conformiteModal, setConformiteModal] = useState<{ ouverte: boolean; conforme: boolean } | null>(null);

  useEffect(() => {
    async function loadCatalogue() {
      try {
        setCatalogueLoading(true);
        const res = await api.get<{ exams: CatalogueExam[] }>('/api/lab/catalogue/exams');
        setCatalogueExams(res.exams || []);
      } catch (err) {
        console.error('Erreur chargement catalogue:', err);
      } finally {
        setCatalogueLoading(false);
      }
    }
    loadCatalogue();
  }, []);

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
    instructions?: string;
    mode?: 'GLOBAL' | 'PERSONNALISE';
    examen_id?: string | null;
    selection_details?: { parametre_id?: string; sous_parametre_id?: string }[] | null;
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
        commentaire_technique: an.commentaire_technique || '',
        instructions: an.instructions || undefined,
        mode: (an.mode as any) || 'GLOBAL',
        examen_id: an.examen_id || null,
        selection_details: an.selection_details || null,
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
      const res = await api.post<{ message: string; lab_order: LabOrder; echantillon?: any }>(
        `/api/laboratory/orders/${order.id}/prelevement`,
        {
          date_prelevement: new Date(prelevementDate).toISOString(),
          statut: 'PRELEVEMENT_EFFECTUE'
        }
      );
      const echInfo = res.echantillon
        ? ` — Échantillon ${res.echantillon.nature_prelevement || ''} (id: ${res.echantillon.id})`
        : '';
      setIsPrelevementDone(true);
      setSuccessMessage(`Prélèvement biologique enregistré avec succès. Échantillon créé et lié à la demande.${echInfo}`);
      onOrderUpdated(res.lab_order);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du prélèvement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Gestion de la conformité de l'échantillon
  const handleConformite = async (conforme: boolean, motif?: string) => {
    if (!order.echantillon?.id) {
      setError('Aucun échantillon identifié pour cette demande.');
      setConformiteModal(null);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<{ message: string }>(
        `/api/laboratory/orders/${order.id}/conformite`,
        { conforme, motif: motif || undefined }
      );
      setSuccessMessage(res.message || 'Conformité enregistrée.');
       setConformiteModal(null);
       setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la conformité.');
    } finally {
      setSubmitting(false);
      setConformiteModal(null);
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
        
        {/* Entête du modal — Détail complet de la prescription */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-sm text-white">
                  {order.numero_demande || order.id}
                </h2>
                {order.urgence === 'URGENTE' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                    URGENTE
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  order.statut === 'PRISE_EN_CHARGE'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : order.statut === 'DEMANDE_CREEE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : order.statut === 'RESULTATS_SAISIS'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : ['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                }`}>
                  {order.statut}
                </span>
                {order.laborantin_nom && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {order.laborantin_nom}
                  </span>
                )}
                {order.bloque_caisse ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                    PAIEMENT EN ATTENTE
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    order.statut_paiement_labo === 'PAYÉ'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : order.statut_paiement_labo === 'PARTIELLEMENT PAYÉ'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : order.statut_paiement_labo?.includes('Dérogation')
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {order.statut_paiement_labo || 'NON PAYÉ'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                Patient : <strong className="text-white uppercase">{order.patient_nom} {order.patient_prenom}</strong>
                {' — '}Dossier N° <strong className="text-white">{order.numero_dossier || '—'}</strong>
                {' — '}Prescrit par <strong className="text-white">Dr. {order.medecin_nom || 'traitant'}</strong>
                {order.numero_visite && <span>{' — '}Visite <strong className="text-white">{order.numero_visite}</strong></span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
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

        {/* Résumé prescription — informations cliniques et paramétrage */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-start gap-4 text-xs">
          {order.indication_clinique && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px] block">Indication clinique</span>
                <span className="text-blue-800">{order.indication_clinique}</span>
              </div>
            </div>
          )}
          {order.commentaire && (
            <div className="flex items-start gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">Instructions médecin</span>
                <span className="text-slate-700">{order.commentaire}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
            <FlaskConical className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] block">Nombre d'analyses</span>
              <span className="text-indigo-800 font-bold">{order.analyses?.length || 0} examen(s)</span>
            </div>
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
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> Prélèvement effectué le {new Date(prelevementDate).toLocaleString('fr-FR')}
                </span>
              )}
              {isPrelevementDone && order.date_prelevement && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Prélèvement validé</strong> — Statut de la demande : {order.statut}</span>
                </div>
              )}
              {isPrelevementDone && order.echantillon?.code_barre && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-indigo-100 text-indigo-700">
                      <Barcode className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Code-barres de l'échantillon</span>
                  </div>
                  <div className="font-mono text-sm text-slate-900 bg-white px-3 py-2 rounded border border-slate-200 break-all">
                    {order.echantillon.code_barre}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Ce code identifie l'échantillon de manière unique. À utiliser pour le suivi, l'impression et la traçabilité.
                  </p>
                </div>
              )}
              {isPrelevementDone && order.echantillon && !order.echantillon.statut && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2">Conformité de l'échantillon</p>
                  <div className="flex gap-4">
<button
                        onClick={() => setConformiteModal({ ouverte: true, conforme: true })}
                       disabled={order.echantillon?.statut !== undefined}
                       className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition cursor-pointer">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Échantillon conforme
                    </button>
<button
                        onClick={() => setConformiteModal({ouverte: true, conforme: false })}
                       disabled={order.echantillon?.statut !== undefined}
                       className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition cursor-pointer">
                       <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      Échantillon non conforme
                    </button>
                  </div>
                </div>
              )}
              {isPrelevementDone && order.echantillon?.statut && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                  <p className="font-bold text-slate-900 uppercase tracking-wider mb-1">Statut :</p>
                  <span className={`text-emerald-600 ${order.echantillon.statut === 'ECHANTILLON_RECU' ? 'font-semibold' : 'font-medium'}`}>
                    {order.echantillon.statut === 'ECHANTILLON_RECU' ? 'Conforme' : order.echantillon.statut === 'ECHANTILLON_NON_CONFORME' ? 'Non conforme' : order.echantillon.statut}
                  </span>
                  {order.echantillon.motif_non_conformite && (
                    <p className="text-[10px] text-slate-500 small">
                      Motif : {order.echantillon.motif_non_conformite}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bloc 2 : Saisie des analyses demandées */}
          <div className="rounded-lg bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>Prescription du médecin — {order.analyses?.length || 0} examen(s)</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                {order.analyses?.some(a => a.mode === 'PERSONNALISE') ? 'Mode PERSONNALISÉ' : 'Mode GLOBAL'}
                {' — '}Renseignez les valeurs mesurées, unités et interprétations
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {analysesData.map((analyse, index) => {
                const isAnormal = analyse.interpretation === 'ANORMAL';
                const isCritique = analyse.interpretation === 'CRITIQUE';
                const isGlobal = !analyse.mode || analyse.mode === 'GLOBAL';
                const selectedExam = catalogueExams.find(e => e.id === analyse.examen_id);
                const hasParams = isGlobal && selectedExam?.parametres && selectedExam.parametres.length > 0;
                const hasSelection = !isGlobal && (analyse.selection_details || []).length > 0;

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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isGlobal
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-purple-100 text-purple-800 border-purple-300'
                        }`}>
                          {isGlobal ? 'GLOBAL' : 'PERSONNALISÉ'}
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

                    {/* Affichage des paramètres de prescription */}
                    {(hasParams || hasSelection || analyse.instructions) && (
                      <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        {analyse.instructions && (
                          <div className="mb-1.5 flex items-start gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mt-0.5">Instr. :</span>
                            <span className="text-slate-700 italic">{analyse.instructions}</span>
                          </div>
                        )}
                        {hasParams && (() => {
                          const ex = selectedExam;
                          if (!ex || !ex.parametres) return null;
                          return (
                            <div className="pt-1.5 border-t border-slate-200">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Paramètres du catalogue ({ex.nom}) :
                              </div>
                              <div className="space-y-0.5">
                                {ex.parametres.map((param: any) => (
                                  <div key={param.id} className="flex items-center gap-1.5 text-slate-700">
                                    <span className="text-[11px] font-medium">• {param.nom}</span>
                                    {param.unite && <span className="text-slate-400 text-[10px]">({param.unite})</span>}
                                    {param.sous_parametres && param.sous_parametres.length > 0 && (
                                      <div className="ml-5 space-y-0.5">
                                        {param.sous_parametres.map((sub: any) => (
                                          <div key={sub.id} className="text-[10px] text-slate-500">
                                            – {sub.nom}{sub.unite && <span> ({sub.unite})</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {hasSelection && selectedExam && (
                          <div className="pt-1.5 border-t border-slate-200">
                            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">
                              Paramètres sélectionnés ({selectedExam.nom}) :
                            </div>
                            {(() => {
                              const examParams = selectedExam.parametres || [];
                              return (
                                <div className="space-y-0.5">
                                  {analyse.selection_details!.map((sel, i) => {
                                    const param = examParams.find((p: any) => p.id === sel.parametre_id);
                                    if (!param) return null;
                                    const sub = param.sous_parametres?.find((s: any) => s.id === sel.sous_parametre_id);
                                    return (
                                      <div key={i} className="text-[11px] text-purple-800 font-medium">
                                        • {sub ? sub.nom : param.nom}
                                        {sub?.unite && <span className="text-slate-500"> ({sub.unite})</span>}
                                        {!sub && param.unite && <span className="text-slate-500"> ({param.unite})</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

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
