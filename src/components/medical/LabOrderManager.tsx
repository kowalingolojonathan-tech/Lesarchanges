import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, Plus, Trash2, CheckCircle2, AlertCircle, Lock, Edit3, 
  Printer, Clock, FileText, ChevronDown, ChevronUp, Save, 
  X, AlertTriangle, ShieldAlert, Sparkles, RefreshCw, Eye, Ban, UserCheck, Check
} from 'lucide-react';
import { DemandeLaboratoire, AnalyseLaboratoire, LabOrderUrgence, EchantillonType, LaborantinUser, CatalogueExam, CatalogueParametre, CatalogueSousParametre, ModePrescription } from '../../types';
import { apiFetch } from '../../lib/api';
import { LabReportModal } from './LabReportModal';

interface LabOrderManagerProps {
  consultationId: string;
  patientId: string;
  visiteId: string;
  isConsultationFinalized: boolean;
  isAmendmentMode?: boolean;
  amendementMotif?: string;
  initialLabOrders?: DemandeLaboratoire[];
  onLabOrdersUpdated?: () => void;
}

interface AnalysisRowState {
  id?: string;
  nom_analyse: string;
  type_echantillon: EchantillonType;
  instructions?: string;
  ordre?: number;
  // Champs catalogue
  examen_id?: string | null;
  mode?: ModePrescription;
  parametre_id?: string | null;
  sous_parametre_id?: string | null;
  selection_details?: { parametre_id?: string; sous_parametre_id?: string }[] | null;
  prix_usd?: number | null;
  tarif_id?: string;
}

const COMMON_EXAMS: { nom: string; type: EchantillonType; instructions?: string }[] = [
  { nom: 'NFS (Numération Formule Sanguine)', type: 'SANG', instructions: 'Prélèvement sur tube EDTA' },
  { nom: 'Goutte Épaisse & TDR Paludisme', type: 'SANG', instructions: 'En urgence si pic fébrile' },
  { nom: 'Glycémie à jeun', type: 'SANG', instructions: 'Patient strictement à jeun depuis 8h' },
  { nom: 'Créatininémie & Clairance', type: 'SANG', instructions: 'Tube sec ou hépariné' },
  { nom: 'Ionogramme sanguin (Na+, K+, Cl-)', type: 'SANG', instructions: 'Éviter toute hémolyse' },
  { nom: 'ECBU (Examen des Urines)', type: 'URINE', instructions: 'Toilette locale rigoureuse, recueil au milieu du jet' },
  { nom: 'Bandelette Urinaire', type: 'URINE', instructions: 'Urine fraîche du matin' },
  { nom: 'Examen Parasitologique des Selles (EPS)', type: 'SELLES', instructions: 'Pot stérile, acheminement rapide' },
  { nom: 'CRP (Protéine C-Réactive)', type: 'SANG', instructions: 'Tube sec' },
  { nom: 'Vitesse de Sédimentation (VS)', type: 'SANG', instructions: 'Tube citrate noir' },
  { nom: 'Transaminases (ASAT / ALAT)', type: 'SANG', instructions: 'Bilan hépatique' },
  { nom: 'Sérodiagnostic de Widal (Typhoïde)', type: 'SANG', instructions: 'Tube sec' }
];

const getInitialAnalysisRow = (): AnalysisRowState => ({
  nom_analyse: '',
  type_echantillon: 'SANG',
  instructions: '',
  examen_id: null,
  mode: 'GLOBAL',
  selection_details: null,
  prix_usd: null,
});

export const LabOrderManager: React.FC<LabOrderManagerProps> = ({
  consultationId,
  isConsultationFinalized,
  isAmendmentMode = false,
  amendementMotif = '',
  initialLabOrders = [],
  onLabOrdersUpdated,
}) => {
  const [labOrders, setLabOrders] = useState<DemandeLaboratoire[]>(initialLabOrders);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulaire d'édition / création
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [urgence, setUrgence] = useState<LabOrderUrgence>('NORMALE');
  const [indicationClinique, setIndicationClinique] = useState<string>('');
  const [commentaire, setCommentaire] = useState<string>('');
  const [selectedLaborantinId, setSelectedLaborantinId] = useState<string>('');
  const [laborantins, setLaborantins] = useState<LaborantinUser[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRowState[]>([getInitialAnalysisRow()]);

  // Catalogue laboratoire (Phase 2C-5)
  const [catalogueExams, setCatalogueExams] = useState<CatalogueExam[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState<boolean>(false);
  const [searchExam, setSearchExam] = useState<string>('');
  const [showExamPicker, setShowExamPicker] = useState<number | null>(null);
  const [pickerActiveRowIdx, setPickerActiveRowIdx] = useState<number | null>(null);

  // Mode amendement spécifique
  const [orderAmendmentMode, setOrderAmendmentMode] = useState<boolean>(false);
  const [orderAmendmentMotif, setOrderAmendmentMotif] = useState<string>('');

  // Impression / Aperçu Bulletin
  const [previewOrder, setPreviewOrder] = useState<DemandeLaboratoire | null>(null);
  const [selectedBulletinOrderId, setSelectedBulletinOrderId] = useState<string | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [viewedOrderIds, setViewedOrderIds] = useState<Set<string>>(new Set());

  // Charger les laborantins actifs autorisés (Phase 2C-3)
  const fetchLaborantins = async () => {
    try {
      const res = await apiFetch('/api/laborantins');
      if (res.ok) {
        const data = await res.json();
        setLaborantins(data.laborantins || []);
      }
    } catch (err: any) {
      console.error('Erreur chargement laborantins:', err);
    }
  };

  // Charger le catalogue des examens (Phase 2C-5)
  const fetchCatalogue = async () => {
    try {
      setCatalogueLoading(true);
      const res = await apiFetch('/api/lab/catalogue/exams');
      if (res.ok) {
        const data = await res.json();
        setCatalogueExams(data.exams || []);
      }
    } catch (err: any) {
      console.error('Erreur chargement catalogue:', err);
    } finally {
      setCatalogueLoading(false);
    }
  };

  // Recharger les demandes depuis l'API
  const fetchLabOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/medical/consultations/${consultationId}/lab-orders`);
      if (res.ok) {
        const data = await res.json();
        setLabOrders(data.lab_orders || []);
        if (data.lab_orders && data.lab_orders.length > 0) {
          setExpandedOrderIds(prev => ({
            ...prev,
            [data.lab_orders[0].id]: true
          }));
        }
      }
    } catch (err: any) {
      console.error('Erreur chargement demandes de laboratoire:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultationId) {
      fetchLabOrders();
      fetchLaborantins();
      fetchCatalogue();
    }
  }, [consultationId]);

  // Fermer le sélecteur d'examen au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-exam-picker]')) {
        setShowExamPicker(null);
        setPickerActiveRowIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Démarrer une nouvelle demande
  const handleStartNew = () => {
    if (isConsultationFinalized && !isAmendmentMode) {
      setError('La consultation est finalisée. Veuillez activer le mode amendement pour prescrire de nouvelles analyses.');
      return;
    }

    setActiveOrderId(null);
    setUrgence('NORMALE');
    setIndicationClinique('');
    setCommentaire('');
    setSelectedLaborantinId('');
    setAnalyses([getInitialAnalysisRow()]);
    setOrderAmendmentMode(isConsultationFinalized);
    setOrderAmendmentMotif(amendementMotif || '');
    setError(null);
    setIsEditing(true);
  };

  // Ajouter un examen pré-configuré (Quick Pick / Gagner du temps)
  const handleAddPresetExam = (preset: { nom: string; type: EchantillonType; instructions?: string }) => {
    // Essayer de trouver l'examen correspondant dans le catalogue réel
    const catalogMatch = catalogueExams.find(
      e => e.nom.toLowerCase() === preset.nom.toLowerCase() ||
           e.code.toLowerCase() === preset.nom.split('(')[0].trim().toLowerCase()
    );

    const baseRow: AnalysisRowState = catalogMatch 
      ? {
          nom_analyse: catalogMatch.nom,
          type_echantillon: preset.type,
          instructions: preset.instructions || catalogMatch.description || '',
          examen_id: catalogMatch.id,
          mode: 'GLOBAL',
          selection_details: null,
          prix_usd: catalogMatch.prix_global_usd,
        }
      : {
          nom_analyse: preset.nom,
          type_echantillon: preset.type,
          instructions: preset.instructions || '',
          examen_id: null,
          mode: 'GLOBAL',
          selection_details: null,
          prix_usd: null,
        };

    if (analyses.some(a => a.nom_analyse?.toLowerCase() === (catalogMatch?.nom || preset.nom).toLowerCase())) {
      return; // Déjà présent
    }

    // Si la seule ligne existante est vide, on la remplace
    if (analyses.length === 1 && !analyses[0].nom_analyse?.trim()) {
      setAnalyses([baseRow]);
    } else {
      setAnalyses(prev => [...prev, baseRow]);
    }
  };

  // Ajouter une ligne d'analyse manuelle
  const handleAddAnalysisRow = () => {
    setAnalyses(prev => [...prev, getInitialAnalysisRow()]);
  };

  // Retirer une ligne d'analyse
  const handleRemoveAnalysisRow = (index: number) => {
    if (analyses.length <= 1) {
      setAnalyses([getInitialAnalysisRow()]);
      return;
    }
    setAnalyses(prev => prev.filter((_, idx) => idx !== index));
  };

  // Mettre à jour un champ d'une analyse
  const handleUpdateAnalysis = (index: number, field: keyof AnalysisRowState, value: any) => {
    setAnalyses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Sélectionner un examen depuis le catalogue
  const handleSelectCatalogueExam = (index: number, exam: CatalogueExam) => {
    setAnalyses(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        nom_analyse: exam.nom,
        type_echantillon: updated[index].type_echantillon,
        examen_id: exam.id,
        mode: 'GLOBAL',
        selection_details: null,
        instructions: exam.description || updated[index].instructions,
      };
      return updated;
    });
    setShowExamPicker(null);
    setPickerActiveRowIdx(null);
    setSearchExam('');
  };

  // Changer le mode GLOBAL / PERSONNALISE
  const handleChangeMode = (index: number, mode: ModePrescription) => {
    setAnalyses(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        mode,
        selection_details: mode === 'PERSONNALISE' ? [] : null,
      };
      return updated;
    });
  };

  // Basculer la sélection d'un paramètre
  const toggleParamSelection = (rowIndex: number, parametreId: string, sousParametreId?: string) => {
    setAnalyses(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const currentSelection = row.selection_details ? [...row.selection_details] : [];
      const existingIdx = currentSelection.findIndex(
        s => s.sous_parametre_id === (sousParametreId || parametreId) && s.parametre_id === parametreId
      );
      if (existingIdx >= 0) {
        currentSelection.splice(existingIdx, 1);
      } else {
        currentSelection.push({ parametre_id: parametreId, sous_parametre_id: sousParametreId });
      }
      updated[rowIndex] = { ...row, selection_details: currentSelection };
      return updated;
    });
  };

  // Annuler la saisie en cours
  const handleCancelEdit = () => {
    setIsEditing(false);
    setActiveOrderId(null);
    setSelectedLaborantinId('');
    setError(null);
    setOrderAmendmentMode(false);
    setOrderAmendmentMotif('');
  };

  // Valider et enregistrer la demande de laboratoire
  const handleSaveLabOrder = async () => {
    setError(null);

    // Validation des analyses
    const validAnalyses = analyses.filter(a => a.nom_analyse && a.nom_analyse.trim().length > 0);
    if (validAnalyses.length === 0) {
      setError('Au moins une analyse médicale doit être spécifiée.');
      return;
    }

    for (const it of validAnalyses) {
      if (!it.nom_analyse || it.nom_analyse.trim().length === 0) {
        setError('Le nom de chaque analyse est obligatoire.');
        return;
      }
      if (!['SANG', 'URINE', 'SELLES', 'AUTRE'].includes(it.type_echantillon || '')) {
        setError(`Type d'échantillon invalide pour "${it.nom_analyse}".`);
        return;
      }
      // Validation PERSONNALISÉ : au moins un paramètre/sous-paramètre sélectionné
      if (it.mode === 'PERSONNALISE') {
        const hasSelection = (it.selection_details || []).length > 0;
        if (!hasSelection) {
          setError(`L'examen "${it.nom_analyse}" est en mode PERSONNALISÉ mais aucun paramètre n'est sélectionné.`);
          return;
        }
      }
    }

    if (isConsultationFinalized && !isAmendmentMode && !orderAmendmentMode) {
      setError('La consultation est finalisée. Un motif explicite d’amendement est requis.');
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
      urgence,
      laborantin_id: selectedLaborantinId && selectedLaborantinId.trim() !== '' ? selectedLaborantinId.trim() : null,
      indication_clinique: indicationClinique.trim() || undefined,
      commentaire: commentaire.trim() || undefined,
      analyses: validAnalyses.map((a, i) => ({
        nom_analyse: a.nom_analyse!.trim(),
        type_echantillon: a.type_echantillon || 'SANG',
        instructions: a.instructions?.trim() || undefined,
        ordre: i,
        // Champs catalogue Phase 2C-5
        examen_id: a.examen_id || null,
        mode: a.mode || 'GLOBAL',
        parametre_id: a.parametre_id || null,
        sous_parametre_id: a.sous_parametre_id || null,
        selection_details: a.selection_details,
        prix_usd: a.prix_usd || null,
        tarif_id: a.tarif_id || undefined,
      }))
    };

      if (isConsultationFinalized || orderAmendmentMode) {
        payload.is_amendment = true;
        payload.amendement_motif = currentMotif.trim();
      }

      let res;
      if (activeOrderId) {
        res = await apiFetch(`/api/medical/lab-orders/${activeOrderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/medical/lab-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'enregistrement de la demande de laboratoire.');
      }

      setSuccessMessage(activeOrderId ? 'Demande de laboratoire mise à jour avec succès.' : 'Demande de laboratoire créée avec succès.');
      setIsEditing(false);
      setActiveOrderId(null);
      setOrderAmendmentMode(false);
      setOrderAmendmentMotif('');

      await fetchLabOrders();
      if (onLabOrdersUpdated) {
        onLabOrdersUpdated();
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Impossible d\'enregistrer la demande de laboratoire.');
    } finally {
      setSaving(false);
    }
  };

  // Annuler une demande de laboratoire
  const handleCancelLabOrder = async (orderId: string) => {
    if (!window.confirm('Êtes-vous certain de vouloir annuler cette demande d\'analyses ?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await apiFetch(`/api/medical/lab-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut: 'ANNULEE',
          is_amendment: isConsultationFinalized,
          amendement_motif: isConsultationFinalized ? (amendementMotif || 'Annulation prescription laboratoire') : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'annulation');
      }

      setSuccessMessage('Demande de laboratoire marquée comme annulée.');
      await fetchLabOrders();
      if (onLabOrdersUpdated) {
        onLabOrdersUpdated();
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Échec de l\'annulation.');
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir l'aperçu du bon de laboratoire
  const handleOpenPreview = (order: DemandeLaboratoire) => {
    setPreviewOrder(order);
  };

  // Impression native du bon de laboratoire
  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div id="section-laboratoire" className="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">
      
      {/* En-tête de la section */}
      <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">Demandes d'Analyses de Laboratoire</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                Phase 2C-2 Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Examens biologiques prescrits, type d'échantillons et niveau d'urgence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartNew}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Prescrire des Analyses
            </button>
          )}

          <button
            type="button"
            onClick={fetchLabOrders}
            disabled={loading}
            title="Rafraîchir les demandes"
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages d'erreur et de succès */}
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

      {/* FORMULAIRE DE CRÉATION / MODIFICATION */}
      {isEditing && (
        <div className="p-5 bg-indigo-50/40 border-b border-indigo-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">
                {activeOrderId ? 'Modifier la Demande d\'Analyses' : 'Nouvelle Demande d\'Analyses Biologiques'}
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">Urgence :</span>
              <button
                type="button"
                onClick={() => setUrgence('NORMALE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                  urgence === 'NORMALE'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                NORMALE
              </button>
              <button
                type="button"
                onClick={() => setUrgence('URGENTE')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  urgence === 'URGENTE'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                }`}
              >
                URGENTE ⚠️
              </button>
            </div>
          </div>

          {/* Si la consultation est finalisée : saisie obligatoire du motif d'amendement */}
          {isConsultationFinalized && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Consultation Médicale Finalisée — Règle de Traçabilité & Amendement Strict</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Cette consultation a été clôturée. Pour prescrire cette analyse, un motif explicite d'amendement doit être consigné dans le journal d'audit.
              </p>
              <input
                type="text"
                value={orderAmendmentMotif}
                onChange={(e) => setOrderAmendmentMotif(e.target.value)}
                placeholder="Ex: Évolution fébrile sous traitement nécessitant bilan inflammatoire complémentaire..."
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-medium"
              />
            </div>
          )}

          {/* Attribution laborantin (Facultative - Phase 2C-3) */}
          <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Attribution Laborantin (Facultative)
              </label>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                Phase 2C-3
              </span>
            </div>
            <select
              value={selectedLaborantinId}
              onChange={(e) => setSelectedLaborantinId(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-800 font-medium"
            >
              <option value="">-- Aucun laborantin spécifique / Attribution automatique (File générale du laboratoire) --</option>
              {laborantins.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  🧪 {lab.nom_complet} (@{lab.username}) — Laboratoire Clinique Les Archanges (Actif)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              {selectedLaborantinId 
                ? "La demande apparaîtra directement dans les tâches assignées de ce laborantin."
                : "La demande restera disponible pour l'ensemble de l'équipe du laboratoire dans la file générale."}
            </p>
          </div>

          {/* Renseignements cliniques & Remarques */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Indication Clinique / Renseignements Médicaux
              </label>
              <input
                type="text"
                value={indicationClinique}
                onChange={(e) => setIndicationClinique(e.target.value)}
                placeholder="Ex: Fièvre persistante, altération de l'état général, suspicion de paludisme grave..."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Instructions / Commentaires Particuliers
              </label>
              <input
                type="text"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ex: Prélèvement avant la première prise d'antibiotiques..."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-800"
              />
            </div>
          </div>

          {/* Sélection rapide d'examens fréquents (Quick Picks) */}
          <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Examens Fréquents (Ajout en un clic) :
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold">Gagnez du temps au cabinet</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_EXAMS.map((exam, idx) => {
                const isSelected = analyses.some(a => a.nom_analyse?.toLowerCase() === exam.nom.toLowerCase());
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPresetExam(exam)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      isSelected 
                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-semibold' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                    }`}
                  >
                    + {exam.nom.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tableau des examens demandés */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Liste des Analyses Demandées ({analyses.length}) *
              </span>
              <button
                type="button"
                onClick={handleAddAnalysisRow}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Ajouter une autre analyse
              </button>
            </div>

            <div className="space-y-3">
              {analyses.map((it, idx) => {
                const filteredExams = catalogueExams.filter(e =>
                  e.nom.toLowerCase().includes(searchExam.toLowerCase()) ||
                  e.code.toLowerCase().includes(searchExam.toLowerCase())
                );
                const selectedExam = catalogueExams.find(e => e.id === it.examen_id);
                const isGlobalMode = it.mode === 'GLOBAL';
                const isPersonnaliseMode = it.mode === 'PERSONNALISE';

                return (
                  <div key={idx} className="p-3 bg-white border border-indigo-200 rounded-xl shadow-2xs space-y-3">
                    {/* Ligne 1 : Sélection examen + Type échantillon */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </div>

                      {/* Sélecteur examen catalogue */}
                      <div className="relative flex-1 w-full">
                        <button
                          type="button"
                          onClick={() => { setShowExamPicker(showExamPicker === idx ? null : idx); setPickerActiveRowIdx(idx); setSearchExam(''); }}
                          className="w-full text-left text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold text-slate-900 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedExam ? `📋 ${selectedExam.nom}` : it.examen_id ? `📋 Examen sélectionné` : '➕ Sélectionner un examen du catalogue'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${showExamPicker === idx ? 'rotate-180' : ''}`} />
                        </button>

                        {showExamPicker === idx && (
                          <div data-exam-picker className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                              <input
                                type="text"
                                value={searchExam}
                                onChange={(e) => setSearchExam(e.target.value)}
                                placeholder="Rechercher un examen..."
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                              />
                            </div>
                            {catalogueLoading ? (
                              <div className="p-3 text-center text-xs text-slate-400">Chargement...</div>
                            ) : filteredExams.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400">Aucun examen trouvé dans le catalogue</div>
                            ) : (
                              filteredExams.map((exam) => (
                                <button
                                  key={exam.id}
                                  type="button"
                                  onClick={() => handleSelectCatalogueExam(idx, exam)}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-none ${
                                    it.examen_id === exam.id ? 'bg-indigo-100' : ''
                                  }`}
                                >
                                  <div className="font-semibold text-slate-900">{exam.nom}</div>
                                  <div className="text-[10px] text-slate-500">{exam.code} {exam.prix_global_usd != null && `— ${exam.prix_global_usd.toFixed(2)} USD`}</div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Type d'échantillon */}
                      <div className="w-full md:w-32 shrink-0">
                        <select
                          value={it.type_echantillon || 'SANG'}
                          onChange={(e) => handleUpdateAnalysis(idx, 'type_echantillon', e.target.value as EchantillonType)}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium text-slate-800"
                        >
                          <option value="SANG">🩸 Sang</option>
                          <option value="URINE">🧪 Urine</option>
                          <option value="SELLES">🔬 Selles</option>
                          <option value="AUTRE">📋 Autre</option>
                        </select>
                      </div>
                    </div>

                    {/* Ligne 2 : Mode GLOBAL / PERSONNALISÉ */}
                    {it.examen_id && selectedExam && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mode :</span>
                        <button
                          type="button"
                          onClick={() => handleChangeMode(idx, 'GLOBAL')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                            isGlobalMode
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-indigo-50'
                          }`}
                        >
                          🏥 GLOBAL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeMode(idx, 'PERSONNALISE')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                            isPersonnaliseMode
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          ✂️ PERSONNALISÉ
                        </button>

                        {isGlobalMode && selectedExam.prix_global_usd != null && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold ml-auto">
                            Prix global : {selectedExam.prix_global_usd.toFixed(2)} USD
                          </span>
                        )}
                        {isPersonnaliseMode && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-auto">
                            Mode détaillé — cochez les paramètres
                          </span>
                        )}
                      </div>
                    )}

                    {/* Arbre paramètres / sous-paramètres pour mode PERSONNALISÉ */}
                    {isPersonnaliseMode && selectedExam?.parametres && (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 space-y-2 max-h-48 overflow-y-auto">
                        {selectedExam.parametres.map((param: CatalogueParametre) => (
                          <div key={param.id} className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  (it.selection_details || []).some(
                                    s => s.parametre_id === param.id && !s.sous_parametre_id
                                  )
                                }
                                onChange={() => toggleParamSelection(idx, param.id)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs font-bold text-slate-800">{param.nom}</span>
                              <span className="text-[10px] text-slate-500">{param.type_resultat}</span>
                              {param.prix_usd != null && (
                                <span className="text-[10px] font-semibold text-emerald-700 ml-auto">{param.prix_usd.toFixed(2)} USD</span>
                              )}
                            </label>
                            {param.sous_parametres && param.sous_parametres.length > 0 && (
                              <div className="ml-6 space-y-1 border-l-2 border-emerald-200 pl-2">
                                {param.sous_parametres.map((sub: CatalogueSousParametre) => (
                                  <label key={sub.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={
                                        (it.selection_details || []).some(
                                          s => s.sous_parametre_id === sub.id
                                        )
                                      }
                                      onChange={() => toggleParamSelection(idx, param.id, sub.id)}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-[11px] text-slate-700">{sub.nom}</span>
                                    {sub.prix_usd != null && (
                                      <span className="text-[10px] text-emerald-700 ml-auto">{sub.prix_usd.toFixed(2)} USD</span>
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {((it.selection_details || []).length > 0) && (
                          <div className="pt-1 border-t border-emerald-200 text-xs font-bold text-emerald-900">
                            Sous-total : {(() => {
                              let total = 0;
                              for (const sel of it.selection_details!) {
                                const param = selectedExam.parametres?.find(p => p.id === sel.parametre_id);
                                if (sel.sous_parametre_id) {
                                  total += param?.sous_parametres?.find(s => s.id === sel.sous_parametre_id)?.prix_usd || 0;
                                } else {
                                  total += param?.prix_usd || 0;
                                }
                              }
                              return total.toFixed(2);
                            })()} USD
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ligne 3 : Nom manuel + Instructions */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={it.nom_analyse || ''}
                          onChange={(e) => handleUpdateAnalysis(idx, 'nom_analyse', e.target.value)}
                          placeholder={selectedExam ? 'Nom affiché (modifiable)' : 'Nom de l\'analyse (ex: NFS, Hémoculture...)'}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold text-slate-900"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={it.instructions || ''}
                          onChange={(e) => handleUpdateAnalysis(idx, 'instructions', e.target.value)}
                          placeholder="Instructions (ex: à jeun, tube hépariné...)"
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-700"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAnalysisRow(idx)}
                        title="Supprimer cette ligne"
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Boutons d'action du formulaire */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-indigo-100">
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
              onClick={handleSaveLabOrder}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Enregistrement en cours...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Enregistrer la Demande
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* LISTE DES DEMANDES ENREGISTRÉES */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Chargement des demandes de laboratoire...</span>
          </div>
        )}

        {!loading && labOrders.length === 0 && !isEditing && (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 space-y-2">
            <FlaskConical className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">Aucune analyse biologique prescrite pour cette consultation.</p>
            <p className="text-[11px] text-slate-400">
              Cliquez sur « Prescrire des Analyses » pour ordonner des examens de sang, urine ou selles.
            </p>
          </div>
        )}

        {!loading && labOrders.map((order) => {
          const isExpanded = expandedOrderIds[order.id] ?? true;
          const isUrgent = order.urgence === 'URGENTE';
          const isCancelled = order.statut === 'ANNULEE';
          const dateStr = new Date(order.date_demande || order.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div 
              key={order.id} 
              className={`rounded-xl border transition-all overflow-hidden ${
                isCancelled 
                  ? 'bg-slate-50 border-slate-200 opacity-70' 
                  : isUrgent 
                    ? 'bg-rose-50/30 border-rose-200 ring-1 ring-rose-300/40' 
                    : 'bg-white border-indigo-100 shadow-2xs'
              }`}
            >
              {/* Entête du bon */}
              <div 
                onClick={() => toggleExpand(order.id)}
                className="p-3.5 bg-slate-50/80 hover:bg-indigo-50/50 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 select-none"
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">
                        {order.numero_demande || 'Demande sans numéro'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isUrgent ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.urgence}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isCancelled
                          ? 'bg-slate-200 text-slate-700'
                          : ['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
                            ? 'bg-emerald-600 text-white font-extrabold shadow-2xs'
                            : order.statut === 'RESULTATS_SAISIS'
                              ? 'bg-blue-600 text-white font-bold'
                              : order.statut === 'DEMANDE_CREEE'
                                ? 'bg-amber-100 text-amber-800'
                                : order.statut === 'PRISE_EN_CHARGE'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
                          ? '✓ RÉSULTATS DISPONIBLES & VALIDÉS'
                          : order.statut === 'RESULTATS_SAISIS'
                            ? 'RÉSULTATS SAISIS (À VALIDER)'
                            : order.statut === 'PRISE_EN_CHARGE'
                              ? 'PRISE EN CHARGE (PAILLASSE)'
                              : order.statut}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span>Prescrit le {dateStr} par {order.medecin_nom || 'Dr. traitant'}</span>
                      <span>•</span>
                      {order.laborantin_nom ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                          <UserCheck className="w-3 h-3" />
                          Attribué à : {order.laborantin_nom}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full border border-slate-200">
                          File générale (Attribution automatique)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {/* Bouton direct Bulletin Officiel */}
                  <button
                    type="button"
                    onClick={() => setSelectedBulletinOrderId(order.id)}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center shadow-xs"
                    title="Ouvrir le bulletin officiel d'analyses avec signature électronique"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Bulletin Officiel
                  </button>

                  {/* Bouton Résultat Vu pour les résultats validés */}
                  {['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut) && !isCancelled && (
                    <button
                      type="button"
                      disabled={viewedOrderIds.has(order.id)}
                      onClick={async () => {
                        try {
                          // Marquer la notification liée à ce bon de laboratoire comme lue
                          const res = await apiFetch(`/api/medical/lab-orders/${order.id}/mark-viewed`, { 
                            method: 'POST' 
                          });
                          if (res.ok) {
                            setViewedOrderIds(prev => new Set(prev).add(order.id));
                            await fetchLabOrders();
                            if (onLabOrdersUpdated) onLabOrdersUpdated();
                          }
                        } catch (err) {
                          console.error('Erreur marquage comme vu:', err);
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-xs ${
                        viewedOrderIds.has(order.id)
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                      title={viewedOrderIds.has(order.id) ? 'Déjà consulté' : 'Marquer ce résultat comme consulté'}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {viewedOrderIds.has(order.id) ? 'Vu ✓' : 'Résultat Vu'}
                    </button>
                  )}

                  {!isCancelled && !['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut) && (
                    <button
                      type="button"
                      onClick={() => handleCancelLabOrder(order.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors flex items-center"
                      title="Annuler cette demande"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" />
                      Annuler
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleExpand(order.id)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Contenu détaillé du bon de laboratoire */}
              {isExpanded && (
                <div className="p-4 space-y-3">
                  
                  {/* Bandeau Résultats Validés */}
                  {['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut) && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Résultats biologiques validés et transmis au dossier médical</span>
                        </div>
                        {order.date_validation && (
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Validé le {new Date(order.date_validation).toLocaleString('fr-FR')} {order.valide_par_nom ? `par ${order.valide_par_nom}` : ''}
                          </span>
                        )}
                      </div>
                      {order.conclusion_generale && (
                        <div className="text-xs text-emerald-950 mt-1 bg-white/70 p-2 rounded-lg border border-emerald-200">
                          <strong className="text-emerald-900">Conclusion du laboratoire : </strong>
                          <span className="italic">{order.conclusion_generale}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Indication clinique */}
                  {order.indication_clinique && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800">
                      <strong className="text-slate-900">Renseignements cliniques : </strong>
                      {order.indication_clinique}
                    </div>
                  )}

                  {/* Commentaires / Instructions */}
                  {order.commentaire && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800">
                      <strong className="text-slate-900">Commentaire : </strong>
                      {order.commentaire}
                    </div>
                  )}

                  {/* Motif amendement si présent */}
                  {order.amendement_motif && (
                    <div className="text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                      <strong className="text-amber-950">Motif de traçabilité / amendement : </strong>
                      {order.amendement_motif}
                    </div>
                  )}

                  {/* Liste des analyses & Résultats */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Analyses demandées & Résultats ({order.analyses?.length || 0})</span>
                      {['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut) && (
                        <span className="text-[10px] text-emerald-700 font-semibold">Toutes les valeurs sont certifiées</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {order.analyses && order.analyses.map((an, idx) => {
                        const hasValue = an.valeur_mesuree !== undefined && an.valeur_mesuree !== null && an.valeur_mesuree !== '';
                        const isAbnormal = an.interpretation && an.interpretation !== 'NORMAL';
                        const isCritical = an.interpretation === 'CRITIQUE';

                        return (
                          <div 
                            key={an.id || idx} 
                            className={`p-3 rounded-xl border text-xs transition-all ${
                              isCritical
                                ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400'
                                : isAbnormal
                                  ? 'bg-amber-50/60 border-amber-300'
                                  : hasValue
                                    ? 'bg-emerald-50/30 border-emerald-200'
                                    : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900 text-sm">{an.nom_analyse}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-white border border-slate-300 text-slate-700">
                                  {an.type_echantillon === 'SANG' && '🩸 Sang'}
                                  {an.type_echantillon === 'URINE' && '🧪 Urine'}
                                  {an.type_echantillon === 'SELLES' && '🔬 Selles'}
                                  {an.type_echantillon === 'AUTRE' && '📋 Autre'}
                                </span>
                              </div>

                              {/* Flag d'anomalie */}
                              {an.interpretation && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                                  an.interpretation === 'CRITIQUE'
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : an.interpretation === 'PATHOLOGIQUE' || an.interpretation === 'ANORMAL'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {an.interpretation}
                                </span>
                              )}
                            </div>

                            {/* Section Valeur résultat si disponible */}
                            {hasValue ? (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/80 p-2 rounded-lg">
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Résultat mesuré</div>
                                  <div className="text-sm font-black text-slate-900">
                                    {an.valeur_mesuree} <span className="text-xs font-medium text-slate-600">{an.unite}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Norme / Référence</div>
                                  <div className="text-xs font-semibold text-slate-700 mt-0.5">
                                    {an.valeurs_reference || 'Non renseignée'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Interprétation</div>
                                  <div className="text-xs text-slate-700 italic mt-0.5">
                                    {an.interpretation || 'Conforme au protocole'}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-slate-400 italic">
                                {an.instructions ? `Consigne : ${an.instructions} • ` : ''} En attente d'analyse sur le plateau technique
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODALE D'APERÇU & IMPRESSION DU BULLETIN DE LABORATOIRE */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* En-tête de la modale */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulletin de Demande d'Analyses Biologiques</h3>
                  <p className="text-xs text-slate-500">Document clinique officiel — Laboratoire Clinique Les Archanges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps imprimable du bulletin */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-900 font-sans">
              
              {/* En-tête de la clinique */}
              <div className="border-b-2 border-indigo-900 pb-4 flex items-start justify-between">
                <div>
                  <div className="text-lg font-black text-indigo-950 uppercase tracking-wide">
                    Clinique Les Archanges
                  </div>
                  <p className="text-xs text-slate-600">À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.</p>
                  <p className="text-[11px] text-slate-500">Téléphone : +243 989 715 771 • Horaires : Ouvert 24h/24 et 7j/7.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-indigo-900">
                    {previewOrder.numero_demande || previewOrder.id}
                  </div>
                  <div className="text-xs text-slate-500">
                    Date : {new Date(previewOrder.date_demande || previewOrder.created_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                    URGENCE : {previewOrder.urgence}
                  </div>
                </div>
              </div>

              {/* Cartouche Patient */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Patient : </span>
                  <strong className="text-slate-900 uppercase">
                    {previewOrder.patient_nom} {previewOrder.patient_prenom}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Dossier N° : </span>
                  <strong className="text-slate-900 font-mono">{previewOrder.numero_dossier || 'Non renseigné'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Visite Clinique : </span>
                  <span className="font-mono text-slate-800">{previewOrder.numero_visite || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Médecin Prescripteur : </span>
                  <strong className="text-slate-900">{previewOrder.medecin_nom || 'Dr. Sawadogo'}</strong>
                </div>
                <div className="col-span-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                  <span className="text-slate-500">Attribution Laboratoire : </span>
                  <strong className="text-indigo-900 font-medium">
                    {previewOrder.laborantin_nom 
                      ? `🧪 Attribuée à ${previewOrder.laborantin_nom}` 
                      : 'File générale du laboratoire (Attribution automatique)'}
                  </strong>
                </div>
              </div>

              {/* Renseignements cliniques */}
              {previewOrder.indication_clinique && (
                <div className="text-xs p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg">
                  <span className="font-bold text-indigo-950">Renseignements Cliniques : </span>
                  <span className="text-indigo-900">{previewOrder.indication_clinique}</span>
                </div>
              )}

              {/* Tableau officiel des examens */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b pb-1">
                  Examens Biologiques à Réaliser ({previewOrder.analyses?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">N°</th>
                        <th className="py-2 px-3">Analyse Demandée</th>
                        <th className="py-2 px-3 w-32">Échantillon</th>
                        <th className="py-2 px-3">Instructions / Modalités</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewOrder.analyses && previewOrder.analyses.map((an, idx) => (
                        <tr key={an.id || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{an.nom_analyse}</td>
                          <td className="py-2.5 px-3 font-semibold text-indigo-900">
                            {an.type_echantillon === 'SANG' && 'Sang veineux'}
                            {an.type_echantillon === 'URINE' && 'Urine fraîche'}
                            {an.type_echantillon === 'SELLES' && 'Selles'}
                            {an.type_echantillon === 'AUTRE' && 'Autre prélèvement'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 italic">
                            {an.instructions || 'Standard'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signature & Cachet */}
              <div className="pt-6 flex justify-between items-end text-xs">
                <div className="text-slate-400 text-[11px]">
                  Système d'Information Hospitalier — Clinique Les Archanges
                </div>
                <div className="text-right border-t border-slate-400 pt-2 w-52">
                  <div className="text-slate-500 text-[11px] mb-8">Cachet & Signature du Médecin :</div>
                  <div className="font-bold text-slate-900">{previewOrder.medecin_nom || 'Dr. Sawadogo'}</div>
                </div>
              </div>

            </div>

            {/* Pied de page modale */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimer le Bulletin
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODALE DU BULLETIN OFFICIEL DE RÉSULTATS (Phase 2C-4) */}
      {selectedBulletinOrderId && (
        <LabReportModal
          orderId={selectedBulletinOrderId}
          onClose={() => setSelectedBulletinOrderId(null)}
        />
      )}

    </div>
  );
};
