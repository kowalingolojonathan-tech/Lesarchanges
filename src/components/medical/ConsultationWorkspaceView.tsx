import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, CheckCircle2, Lock, Unlock, AlertCircle, 
  HeartPulse, Heart, User, ShieldAlert, History, Plus, X, Stethoscope, 
  FileText, Activity, AlertTriangle, Clock, Pill, FlaskConical, ExternalLink,
  FileSearch, Microscope, Scale, Thermometer, ShieldCheck, CheckSquare, Sparkles,
  Wind, Ruler, Lightbulb, HelpCircle, ArrowRight, Check, Trash2, Tag, AlertOctagon
} from 'lucide-react';
import { 
  Consultation, Patient, SignesVitaux, Visite,
  HypotheseDiagnostique, DiagnosticRetenu, StatutHypothese, StatutDiagnosticRetenu 
} from '../../types';
import { PatientHistoryModal } from './PatientHistoryModal';
import { PrescriptionManager } from './PrescriptionManager';
import { LabOrderManager } from './LabOrderManager';
import { FollowUpAppointmentSection } from './FollowUpAppointmentSection';
import { apiFetch } from '../../lib/api';

interface ConsultationWorkspaceViewProps {
  consultationId: string;
  onBack: () => void;
  onConsultationFinalized?: () => void;
}

export const ConsultationWorkspaceView: React.FC<ConsultationWorkspaceViewProps> = ({
  consultationId,
  onBack,
  onConsultationFinalized,
}) => {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Champs du formulaire clinique
  const [motif, setMotif] = useState<string>('');
  const [histoire, setHistoire] = useState<string>('');
  const [examen, setExamen] = useState<string>('');
  const [conduiteATenir, setConduiteATenir] = useState<string>('');
  const [notesConfidentielles, setNotesConfidentielles] = useState<string>('');

  // 1. BLOC HYPOTHÈSES DIAGNOSTIQUES
  const [hypothesesDiagnostiques, setHypothesesDiagnostiques] = useState<HypotheseDiagnostique[]>([]);
  const [showAddHypothese, setShowAddHypothese] = useState<boolean>(false);
  const [newHypotheseLibelle, setNewHypotheseLibelle] = useState<string>('');
  const [newHypotheseStatut, setNewHypotheseStatut] = useState<StatutHypothese>('SUSPECTE');
  const [newHypotheseAttente, setNewHypotheseAttente] = useState<string>('');
  const [newHypotheseCertitude, setNewHypotheseCertitude] = useState<'FAIBLE' | 'MOYENNE' | 'FORTE'>('MOYENNE');

  // 2. BLOC DIAGNOSTICS RETENUS
  const [diagnosticsRetenus, setDiagnosticsRetenus] = useState<DiagnosticRetenu[]>([]);
  const [showAddRetenu, setShowAddRetenu] = useState<boolean>(false);
  const [newRetenuLibelle, setNewRetenuLibelle] = useState<string>('');
  const [newRetenuStatut, setNewRetenuStatut] = useState<StatutDiagnosticRetenu>('RETENU'); // 'RETENU' ou 'CONFIRME'
  const [newRetenuPrecision, setNewRetenuPrecision] = useState<string>('');
  const [newRetenuIsPrincipal, setNewRetenuIsPrincipal] = useState<boolean>(false);

  // Mode amendement pour consultation finalisée
  const [isAmendmentMode, setIsAmendmentMode] = useState<boolean>(false);
  const [amendementMotif, setAmendementMotif] = useState<string>('');

  // Modale historique
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Modale confirmation finalisation
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>('NON PAYÉ');

  // Allergies — saisie & modification réservées au MÉDECIN
  const [allergies, setAllergies] = useState<string>('');
  const [editingAllergies, setEditingAllergies] = useState<boolean>(false);

  const fetchConsultation = async (preserveFormFields = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/medical/consultations/${consultationId}`);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors du chargement de la consultation');
      }

      const data = await res.json();
      const c: Consultation = data.consultation;
      setConsultation(c);
      setAllergies(c.allergies || '');

      // Statut de paiement en lecture seule pour le médecin
      if (c.visite_id) {
        apiFetch(`/api/visites/${c.visite_id}/payment-status`)
          .then(r => r.json())
          .then(pData => {
            if (pData.statut_paiement) setPaymentStatus(pData.statut_paiement);
          })
          .catch(() => {});
      }

      // Initialiser le formulaire clinique uniquement si preserveFormFields est false
      if (!preserveFormFields) {
        setMotif(c.motif_consultation || '');
        setHistoire(c.histoire_maladie || '');
        setExamen(c.examen_physique || '');
        setConduiteATenir(c.conduite_a_tenir || '');
        setNotesConfidentielles(c.notes_confidentielles || '');

      // 1. Initialiser les Hypothèses diagnostiques
      let loadedHypo: HypotheseDiagnostique[] = [];
      if (c.hypotheses_diagnostiques) {
        try {
          const parsed = typeof c.hypotheses_diagnostiques === 'string'
            ? JSON.parse(c.hypotheses_diagnostiques)
            : c.hypotheses_diagnostiques;
          if (Array.isArray(parsed)) {
            loadedHypo = parsed;
          }
        } catch (e) {
          console.error('Erreur parsing hypotheses_diagnostiques', e);
        }
      }
      setHypothesesDiagnostiques(loadedHypo);

      // 2. Initialiser les Diagnostics Retenus (avec conservation stricte des données existantes)
      let loadedRetenus: DiagnosticRetenu[] = [];
      if (c.diagnostics_retenus) {
        try {
          const parsed = typeof c.diagnostics_retenus === 'string'
            ? JSON.parse(c.diagnostics_retenus)
            : c.diagnostics_retenus;
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedRetenus = parsed;
          }
        } catch (e) {
          console.error('Erreur parsing diagnostics_retenus', e);
        }
      }

      // Conservation des diagnostics existants :
      // Si aucun diagnostics_retenus n'est stocké (anciennes consultations existantes),
      // on convertit sans perte de données c.diagnostic_principal et c.diagnostics_associes
      if (loadedRetenus.length === 0) {
        if (c.diagnostic_principal && c.diagnostic_principal.trim()) {
          loadedRetenus.push({
            id: `diag_init_main_${c.id}`,
            libelle: c.diagnostic_principal.trim(),
            statut: 'RETENU',
            is_principal: true,
            created_at: c.date_consultation || new Date().toISOString()
          });
        }

        if (c.diagnostics_associes) {
          try {
            const parsedAssoc = typeof c.diagnostics_associes === 'string'
              ? JSON.parse(c.diagnostics_associes)
              : c.diagnostics_associes;
            if (Array.isArray(parsedAssoc)) {
              parsedAssoc.forEach((item, idx) => {
                if (item && typeof item === 'string' && item.trim()) {
                  loadedRetenus.push({
                    id: `diag_init_assoc_${c.id}_${idx}`,
                    libelle: item.trim(),
                    statut: 'RETENU',
                    is_principal: false,
                    created_at: c.date_consultation || new Date().toISOString()
                  });
                }
              });
            } else if (typeof c.diagnostics_associes === 'string' && c.diagnostics_associes.trim()) {
              loadedRetenus.push({
                id: `diag_init_assoc_${c.id}_0`,
                libelle: c.diagnostics_associes.trim(),
                statut: 'RETENU',
                is_principal: false,
                created_at: c.date_consultation || new Date().toISOString()
              });
            }
          } catch {
            if (typeof c.diagnostics_associes === 'string' && c.diagnostics_associes.trim()) {
              loadedRetenus.push({
                id: `diag_init_assoc_${c.id}_0`,
                libelle: c.diagnostics_associes.trim(),
                statut: 'RETENU',
                is_principal: false,
                created_at: c.date_consultation || new Date().toISOString()
              });
            }
          }
        }
      }

        setDiagnosticsRetenus(loadedRetenus);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de charger la consultation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultation();
  }, [consultationId]);

  // --- SAISIE & MODIFICATION DES ALLERGIES (réservée au MÉDECIN) ---
  const handleSaveAllergies = async () => {
    if (!consultation?.patient_id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/patients/${consultation.patient_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergies: allergies.trim() || null })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur sauvegarde allergies');
      }
      const data = await res.json();
      if (data.patient) {
        setAllergies(data.patient.allergies || '');
        setConsultation(prev => prev ? { ...prev, allergies: data.patient.allergies } : null);
      }
      setEditingAllergies(false);
      setSuccessMessage('Allergies enregistrées avec succès.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Échec de la sauvegarde des allergies');
    } finally {
      setSaving(false);
    }
  };

  // --- GESTION DU BLOC 1 : HYPOTHÈSES DIAGNOSTIQUES ---
  const handleAddHypothese = () => {
    const trimmed = newHypotheseLibelle.trim();
    if (!trimmed) return;

    const newHypo: HypotheseDiagnostique = {
      id: `hypo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      libelle: trimmed,
      statut: newHypotheseStatut,
      attente_details: newHypotheseAttente.trim() || null,
      certitude: newHypotheseCertitude,
      created_at: new Date().toISOString()
    };

    setHypothesesDiagnostiques(prev => [...prev, newHypo]);
    setNewHypotheseLibelle('');
    setNewHypotheseAttente('');
    setNewHypotheseStatut('SUSPECTE');
    setNewHypotheseCertitude('MOYENNE');
    setShowAddHypothese(false);
  };

  const handleRemoveHypothese = (id: string) => {
    setHypothesesDiagnostiques(prev => prev.filter(h => h.id !== id));
  };

  // ACTION EXPLICITE DU MÉDECIN : passage d'une hypothèse vers un diagnostic retenu
  const handlePromoteHypotheseToRetenu = (hypo: HypotheseDiagnostique) => {
    const alreadyExists = diagnosticsRetenus.some(
      d => d.libelle.toLowerCase().trim() === hypo.libelle.toLowerCase().trim()
    );

    const isFirstRetenu = diagnosticsRetenus.length === 0;

    const newRetenu: DiagnosticRetenu = {
      id: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      libelle: hypo.libelle,
      statut: 'RETENU',
      is_principal: isFirstRetenu,
      precision: hypo.attente_details ? `Issu de l'hypothèse (examens : ${hypo.attente_details})` : null,
      created_at: new Date().toISOString()
    };

    if (!alreadyExists) {
      setDiagnosticsRetenus(prev => [...prev, newRetenu]);
    }

    // Retirer de la liste des hypothèses suspectées
    setHypothesesDiagnostiques(prev => prev.filter(h => h.id !== hypo.id));

    setSuccessMessage(`Action médicale explicite : « ${hypo.libelle} » a été transféré dans les diagnostics retenus.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // --- GESTION DU BLOC 2 : DIAGNOSTICS RETENUS ---
  const handleAddDiagnosticRetenu = () => {
    const trimmed = newRetenuLibelle.trim();
    if (!trimmed) return;

    const shouldBePrincipal = newRetenuIsPrincipal || diagnosticsRetenus.length === 0;

    let updatedList = [...diagnosticsRetenus];
    if (shouldBePrincipal) {
      updatedList = updatedList.map(d => ({ ...d, is_principal: false }));
    }

    const newRetenu: DiagnosticRetenu = {
      id: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      libelle: trimmed,
      statut: newRetenuStatut, // 'RETENU' ou 'CONFIRME'
      is_principal: shouldBePrincipal,
      precision: newRetenuPrecision.trim() || null,
      created_at: new Date().toISOString()
    };

    setDiagnosticsRetenus([...updatedList, newRetenu]);
    setNewRetenuLibelle('');
    setNewRetenuPrecision('');
    setNewRetenuStatut('RETENU');
    setNewRetenuIsPrincipal(false);
    setShowAddRetenu(false);
  };

  const handleRemoveDiagnosticRetenu = (id: string) => {
    const target = diagnosticsRetenus.find(d => d.id === id);
    const remaining = diagnosticsRetenus.filter(d => d.id !== id);

    if (target?.is_principal && remaining.length > 0) {
      remaining[0].is_principal = true;
    }

    setDiagnosticsRetenus(remaining);
  };

  // Basculer la confirmation (RETENU <-> CONFIRME) dans les infos du diagnostic
  const handleToggleStatutConfirmation = (id: string) => {
    setDiagnosticsRetenus(prev =>
      prev.map(d => {
        if (d.id === id) {
          const nextStatut: StatutDiagnosticRetenu = d.statut === 'CONFIRME' ? 'RETENU' : 'CONFIRME';
          return { ...d, statut: nextStatut };
        }
        return d;
      })
    );
  };

  const handleSetPrincipalRetenu = (id: string) => {
    setDiagnosticsRetenus(prev =>
      prev.map(d => ({
        ...d,
        is_principal: d.id === id
      }))
    );
  };

  // Synchronisation avec les champs historiques pour rétrocompatibilité totale
  const getSyncedDiagnostics = () => {
    const principalItem = diagnosticsRetenus.find(d => d.is_principal) || diagnosticsRetenus[0];
    const principalLibelle = principalItem ? principalItem.libelle : '';
    const associesLibelles = diagnosticsRetenus
      .filter(d => d.id !== principalItem?.id)
      .map(d => d.libelle);

    return {
      diagnostic_principal: principalLibelle,
      diagnostics_associes: associesLibelles,
      hypotheses_diagnostiques: hypothesesDiagnostiques,
      diagnostics_retenus: diagnosticsRetenus
    };
  };

  // Sauvegarder la consultation (brouillon ou en cours)
  const handleSave = async (targetStatus: 'BROUILLON' | 'EN_COURS') => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const synced = getSyncedDiagnostics();
      const payload: any = {
        motif_consultation: motif,
        histoire_maladie: histoire,
        examen_physique: examen,
        diagnostic_principal: synced.diagnostic_principal,
        diagnostics_associes: synced.diagnostics_associes,
        hypotheses_diagnostiques: synced.hypotheses_diagnostiques,
        diagnostics_retenus: synced.diagnostics_retenus,
        conduite_a_tenir: conduiteATenir,
        notes_confidentielles: notesConfidentielles,
        statut: targetStatus,
      };

      if (consultation?.statut === 'FINALISEE') {
        payload.is_amendment = true;
        payload.amendement_motif = amendementMotif;
      }

      const res = await apiFetch(`/api/medical/consultations/${consultationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      setConsultation(data.consultation);
      setSuccessMessage(`Consultation enregistrée avec succès (${targetStatus === 'BROUILLON' ? 'Brouillon' : 'En cours'}).`);
      setIsAmendmentMode(false);
      setAmendementMotif('');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Validation avant finalisation
  const handleOpenFinalizeModal = () => {
    const errors: string[] = [];
    if (!motif.trim() || motif.trim().length < 2) {
      errors.push('Le motif de consultation est obligatoire.');
    }
    const synced = getSyncedDiagnostics();
    const hasRetenu = synced.diagnostic_principal && synced.diagnostic_principal.trim().length >= 2;
    const hasHypotheses = synced.hypotheses_diagnostiques && Array.isArray(synced.hypotheses_diagnostiques) && synced.hypotheses_diagnostiques.length > 0 &&
      synced.hypotheses_diagnostiques.every(h => h.libelle && h.libelle.trim().length >= 2);

    if (!hasRetenu && !hasHypotheses) {
      errors.push('Veuillez renseigner au moins un diagnostic retenu ou des hypothèses diagnostiques qualifiées pour finaliser.');
    }
    if (!conduiteATenir.trim() || conduiteATenir.trim().length < 2) {
      errors.push('La conduite à tenir / plan de prise en charge est obligatoire.');
    }
    if ((!histoire.trim() || histoire.trim().length < 2) && (!examen.trim() || examen.trim().length < 2)) {
      errors.push('Veuillez renseigner au moins l’histoire de la maladie ou l’examen physique.');
    }

    setValidationErrors(errors);
    setShowFinalizeConfirm(true);
  };

  // Confirmer la finalisation de la consultation
  const handleConfirmFinalize = async () => {
    setFinalizing(true);
    setError(null);
    try {
      const synced = getSyncedDiagnostics();
      const res = await apiFetch(`/api/medical/consultations/${consultationId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motif_consultation: motif,
          histoire_maladie: histoire,
          examen_physique: examen,
          diagnostic_principal: synced.diagnostic_principal,
          diagnostics_associes: synced.diagnostics_associes,
          hypotheses_diagnostiques: synced.hypotheses_diagnostiques,
          diagnostics_retenus: synced.diagnostics_retenus,
          conduite_a_tenir: conduiteATenir,
          notes_confidentielles: notesConfidentielles,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la finalisation');
      }

      setConsultation(data.consultation);
      setShowFinalizeConfirm(false);
      setSuccessMessage('Consultation finalisée avec succès ! Le dossier médical est verrouillé.');
      if (onConsultationFinalized) {
        onConsultationFinalized();
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de finaliser la consultation.');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Activity className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Ouverture sécurisée du dossier médical...</p>
      </div>
    );
  }

  if (error && !consultation) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Accès Refusé ou Dossier Introuvable</h2>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à la file d'attente
        </button>
      </div>
    );
  }

  if (!consultation) return null;

  const isFinalized = consultation.statut === 'FINALISEE';
  const isReadOnly = isFinalized && !isAmendmentMode;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Barre de navigation haute & Actions rapides */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
            title="Retour à la file"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">Poste Consultation</h1>
              <span className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                consultation.statut === 'FINALISEE' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : consultation.statut === 'BROUILLON'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {consultation.statut}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              Visite <strong className="font-mono text-slate-700">{consultation.numero_visite}</strong> • Dr. <strong className="text-slate-700">{consultation.medecin_nom}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors min-h-[38px]"
          >
            <History className="w-4 h-4 mr-1 text-slate-500" />
            <span className="hidden sm:inline">Historique</span>
          </button>

          {!isFinalized && (
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => handleSave('BROUILLON')}
                disabled={saving || finalizing}
                className="inline-flex items-center px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Brouillon
              </button>

              <button
                onClick={() => handleSave('EN_COURS')}
                disabled={saving || finalizing}
                className="inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Enregistrer
              </button>

              <button
                onClick={handleOpenFinalizeModal}
                disabled={saving || finalizing}
                className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 min-h-[38px]"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Finaliser
              </button>
            </div>
          )}

          {isFinalized && !isAmendmentMode && (
            <button
              onClick={() => setIsAmendmentMode(true)}
              className="inline-flex items-center px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-lg transition-colors min-h-[38px]"
            >
              <Unlock className="w-3.5 h-3.5 mr-1" />
              Modifier
            </button>
          )}

          {isFinalized && isAmendmentMode && (
            <button
              onClick={() => {
                setIsAmendmentMode(false);
                setAmendementMotif('');
              }}
              className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg min-h-[38px]"
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* BARRE D'ACCÈS RAPIDE AUX SECTIONS CLINIQUE (Mobile & Desktop - Règle 7) */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md p-1.5 sm:p-2 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1 sm:gap-1.5 overflow-x-auto text-xs font-semibold scrollbar-none">
        <button
          type="button"
          onClick={() => document.getElementById('sec_patient')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          📋 Patient
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_vitaux')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          💓 Vitaux
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_clinique')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          🩺 Anamnèse & Examen
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_diagnostics')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          💡 Diagnostics
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_prescriptions')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          💊 Ordonnance
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_labo')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          🔬 Laboratoire
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('sec_suivi')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap min-h-[34px]"
        >
          📅 Rendez-vous
        </button>
      </div>

      {/* Messages d'alerte ou succès */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bandeau d'amendement si consultation finalisée déverrouillée */}
      {isFinalized && isAmendmentMode && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
          <div className="flex items-center text-xs font-bold text-purple-900">
            <Lock className="w-4 h-4 mr-1.5 text-purple-700" />
            Mode Amendement Contrôlé (Consultation Finalisée)
          </div>
          <p className="text-xs text-purple-800 leading-relaxed">
            Cette consultation a été clôturée le <strong>{new Date(consultation.finalisee_le || '').toLocaleString('fr-FR')}</strong>.
            Toute modification doit impérativement comporter une justification médicale explicite enregistrée dans le journal d'audit.
          </p>
          <div>
            <label className="block text-xs font-bold text-purple-900 mb-1">
              Motif obligatoire de l'amendement * :
            </label>
            <input
              type="text"
              value={amendementMotif}
              onChange={(e) => setAmendementMotif(e.target.value)}
              placeholder="Ex: Correction posologie suite à confirmation téléphonique, ajout diagnostic différentiel..."
              className="w-full text-xs p-2.5 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => handleSave('EN_COURS')}
              disabled={!amendementMotif.trim() || amendementMotif.trim().length < 5 || saving}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              Enregistrer l'amendement
            </button>
          </div>
        </div>
      )}

      {/* CARTOUCHE PATIENT PERMANENT & CONTEXTE VISITE */}
      <div id="sec_patient" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-lg">
              {consultation.patient_sexe === 'F' ? 'F' : 'M'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">
                  {consultation.patient_nom} {consultation.patient_prenom}
                </h2>
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-md font-bold">
                  {consultation.numero_dossier}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  paymentStatus === 'PAYÉ' 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : paymentStatus === 'PARTIELLEMENT PAYÉ'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  Facturation : {paymentStatus}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                <span>Âge : <strong className="text-slate-800">{consultation.patient_age !== undefined && consultation.patient_age !== null ? `${consultation.patient_age} ans` : 'N/A'}</strong></span>
                <span>Sexe : <strong className="text-slate-800">{consultation.patient_sexe === 'F' ? 'Féminin' : 'Masculin'}</strong></span>
                <span>Tél : <strong className="text-slate-800">{consultation.patient_telephone || 'Non renseigné'}</strong></span>
                <span>Groupe : <strong className="text-slate-800">{consultation.groupe_sanguin || 'N/A'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <div className="text-slate-400">Type de Visite</div>
              <div className="font-bold text-slate-800">{consultation.type_visite || 'STANDARD'}</div>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <div>
              <div className="text-slate-400">Arrivée</div>
              <div className="font-bold text-slate-800">
                {consultation.date_arrivee ? new Date(consultation.date_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <div>
              <div className="text-slate-400 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Temps d'attente (arrêté)</span>
              </div>
              <div className="font-bold text-slate-800">
                {consultation.heure_orientation && consultation.heure_prise_en_charge ? (
                  <span className="text-amber-800 font-bold">
                    {Math.max(0, Math.round((new Date(consultation.heure_prise_en_charge).getTime() - new Date(consultation.heure_orientation).getTime()) / 60000))} min
                  </span>
                ) : consultation.heure_orientation ? (
                  <span className="text-slate-600">Orienté {new Date(consultation.heure_orientation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                ) : '-'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <div>
              <div className="text-slate-400 flex items-center space-x-1">
                <Stethoscope className="w-3 h-3 text-blue-600" />
                <span>Durée Consultation</span>
              </div>
              <div className="font-bold text-slate-800">
                {consultation.heure_debut_consultation ? (
                  <span className="text-blue-800 font-bold">
                    {consultation.heure_fin_consultation || consultation.finalisee_le ? (
                      `${Math.max(0, Math.round((new Date(consultation.heure_fin_consultation || consultation.finalisee_le || '').getTime() - new Date(consultation.heure_debut_consultation).getTime()) / 60000))} min (clôturée)`
                    ) : (
                      `Début ${new Date(consultation.heure_debut_consultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    )}
                  </span>
                ) : '-'}
              </div>
            </div>
          </div>

        </div>

        {/* Antécédents & Allergies (Alerte Visuelle) — Saisie réservée au MÉDECIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-xs">
          <div className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
            allergies && allergies.toLowerCase() !== 'néant' && allergies.toLowerCase() !== 'aucune'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              allergies && allergies.toLowerCase() !== 'néant' && allergies.toLowerCase() !== 'aucune'
                ? 'text-rose-600'
                : 'text-slate-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <strong>Allergies connues : </strong>
                {!isFinalized && !editingAllergies && (
                  <button
                    type="button"
                    onClick={() => setEditingAllergies(true)}
                    className="text-[10px] font-bold text-rose-700 hover:underline"
                  >
                    Modifier
                  </button>
                )}
              </div>
              {editingAllergies ? (
                <div className="mt-1 space-y-1.5">
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ex: Pénicilline, AINS, Sulfamides (sinon RAS)"
                    className="w-full px-2 py-1 text-xs border border-rose-300 rounded focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveAllergies}
                      disabled={saving}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingAllergies(false); setAllergies(consultation.allergies || ''); }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <span>{allergies || 'Aucune allergie signalée.'}</span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-start space-x-2">
            <FileText className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5" />
            <div>
              <strong>Antécédents du dossier : </strong>
              <span>{consultation.antecedents || 'Aucun antécédent particulier renseigné.'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VOLET DES SIGNES VITAUX RELEVÉS LORS DU TRIAGE DE CETTE VISITE */}
      <div id="sec_vitaux" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Signes Vitaux & Données Physiques du Triage</h3>
              <p className="text-[11px] text-slate-500">
                Saisis au triage par <strong>{consultation.triage_agent_nom || 'l’infirmier de triage'}</strong>
                {consultation.triage_date_prise ? ` le ${new Date(consultation.triage_date_prise).toLocaleDateString('fr-FR')} à ${new Date(consultation.triage_date_prise).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-1 rounded-md flex items-center space-x-1 self-start sm:self-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Constantes Mesurées au Triage</span>
          </span>
        </div>

        {/* 1. TOUTES LES DONNÉES SAISIES EN FAITES - CHACUNE VUE SÉPARÉMENT AU COMPLET */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>Constantes Vitales Mesurées au Triage Réception (8 constantes vitales)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
            
            {/* 1. Température */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Thermometer className="w-4 h-4 text-amber-500" />
                  <span>Température</span>
                </div>
                {consultation.temperature !== undefined && consultation.temperature !== null && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.temperature >= 38.0 ? 'bg-rose-100 text-rose-700' :
                    consultation.temperature >= 37.6 ? 'bg-amber-100 text-amber-700' :
                    consultation.temperature < 36.0 ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.temperature >= 38.0 ? 'Fièvre' :
                     consultation.temperature >= 37.6 ? 'Fébrilité' :
                     consultation.temperature < 36.0 ? 'Hypothermie' : 'Normale'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.temperature !== undefined && consultation.temperature !== null ? `${consultation.temperature}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">°C</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 36.5 – 37.5 °C</div>
            </div>

            {/* 2. Pression Systolique (PAS) */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Activity className="w-4 h-4 text-rose-500" />
                  <span>PAS (Systolique)</span>
                </div>
                {consultation.tension_systolique && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.tension_systolique >= 140 ? 'bg-rose-100 text-rose-700' :
                    consultation.tension_systolique < 100 ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.tension_systolique >= 140 ? 'Élevée' :
                     consultation.tension_systolique < 100 ? 'Basse' : 'Normale'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.tension_systolique || '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 100 – 139 mmHg</div>
            </div>

            {/* 3. Pression Diastolique (PAD) */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <span>PAD (Diastolique)</span>
                </div>
                {consultation.tension_diastolique && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.tension_diastolique >= 90 ? 'bg-rose-100 text-rose-700' :
                    consultation.tension_diastolique < 60 ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.tension_diastolique >= 90 ? 'Élevée' :
                     consultation.tension_diastolique < 60 ? 'Basse' : 'Normale'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.tension_diastolique || '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 60 – 89 mmHg</div>
            </div>

            {/* 4. Pouls / Fréquence Cardiaque */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Pouls (Fréq. card.)</span>
                </div>
                {consultation.pouls && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.pouls > 100 ? 'bg-rose-100 text-rose-700' :
                    consultation.pouls < 60 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.pouls > 100 ? 'Tachy' :
                     consultation.pouls < 60 ? 'Brady' : 'Normal'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.pouls || '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">bpm</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 60 – 100 bpm</div>
            </div>

            {/* 5. Saturation en Oxygène (SpO2) */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span>Saturation SpO₂</span>
                </div>
                {consultation.spo2 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.spo2 < 90 ? 'bg-rose-100 text-rose-700' :
                    consultation.spo2 < 95 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.spo2 < 90 ? 'Hypoxie' :
                     consultation.spo2 < 95 ? 'Désat.' : 'Normale'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.spo2 || '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">%</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 95 – 100 %</div>
            </div>

            {/* 6. Fréquence Respiratoire (FR) */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-sky-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Wind className="w-4 h-4 text-sky-500" />
                  <span>Fréq. Respiratoire</span>
                </div>
                {consultation.frequence_respiratoire && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.frequence_respiratoire > 20 ? 'bg-amber-100 text-amber-700' :
                    consultation.frequence_respiratoire < 12 ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.frequence_respiratoire > 20 ? 'Polypnée' :
                     consultation.frequence_respiratoire < 12 ? 'Bradypnée' : 'Eupnéique'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.frequence_respiratoire || '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">/min</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Norme : 12 – 20 cycles/min</div>
            </div>

            {/* 7. Poids Corporel */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Poids mesuré</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                  Balance
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.poids ? `${consultation.poids}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">kg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pesée balance de triage</div>
            </div>

            {/* 8. Taille Toisée */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Ruler className="w-4 h-4 text-teal-600" />
                  <span>Taille toisée</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                  {consultation.taille ? `${(consultation.taille / 100).toFixed(2)} m` : 'Toise'}
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.taille ? `${consultation.taille}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">cm</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Mesure sous toise standard</div>
            </div>

            {/* 9. Échelle Douleur (EVA) */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  <span>Douleur (EVA)</span>
                </div>
                {consultation.douleur !== undefined && consultation.douleur !== null && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    consultation.douleur >= 7 ? 'bg-rose-100 text-rose-700' :
                    consultation.douleur >= 4 ? 'bg-amber-100 text-amber-700' :
                    consultation.douleur > 0 ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {consultation.douleur >= 7 ? 'Intense' :
                     consultation.douleur >= 4 ? 'Modérée' :
                     consultation.douleur > 0 ? 'Légère' : 'Indolore'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.douleur !== undefined && consultation.douleur !== null ? `${consultation.douleur}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">/ 10</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Échelle visuelle analogique</div>
            </div>

          </div>
        </div>

        {/* 2. PARAMÈTRES & INDICES CALCULÉS SÉPARÉMENT */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Paramètres Dérivés & Indices Calculés Automatiquement</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
            {/* PAM */}
            <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100">
              <div className="text-indigo-900 text-[11px] font-semibold flex items-center justify-between">
                <span>PAM (Pression Moyenne)</span>
                {consultation.pam && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    consultation.pam >= 70 && consultation.pam <= 105 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {consultation.pam >= 70 && consultation.pam <= 105 ? 'Normale' : 'Anormale'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-indigo-950 mt-1">
                {consultation.pam ? `${consultation.pam}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
              </div>
              <div className="text-[10px] text-indigo-700/80 mt-0.5">Formule : (PAS + 2×PAD) / 3</div>
              <div className="text-[9px] text-slate-400">Norme : 70 – 105 mmHg</div>
            </div>

            {/* Pression Pulsée (Différentielle) */}
            {(() => {
              const diffTension = consultation.pression_pulsee ?? (
                consultation.tension_systolique && consultation.tension_diastolique
                  ? consultation.tension_systolique - consultation.tension_diastolique
                  : null
              );
              return (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-700 text-[11px] font-semibold flex items-center justify-between">
                    <span>Pression Différentielle</span>
                    {diffTension !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        diffTension >= 30 && diffTension <= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {diffTension >= 30 && diffTension <= 50 ? 'Normale' : 'Écartée'}
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {diffTension !== null ? `${diffTension}` : '-'}
                    <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Formule : PAS – PAD</div>
                  <div className="text-[9px] text-slate-400">Norme : 30 – 50 mmHg</div>
                </div>
              );
            })()}

            {/* IMC & Catégorie OMS */}
            <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
              <div className="text-emerald-900 text-[11px] font-semibold flex items-center justify-between">
                <span>Indice IMC</span>
                {consultation.categorie_imc && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 truncate max-w-[85px]">
                    {consultation.categorie_imc}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-emerald-950 mt-1">
                {consultation.imc ? `${consultation.imc}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">kg/m²</span>
              </div>
              <div className="text-[10px] text-emerald-800 font-medium truncate mt-0.5">
                {consultation.categorie_imc || 'Formule : Poids / Taille²'}
              </div>
              <div className="text-[9px] text-slate-400">Norme : 18.5 – 24.9 kg/m²</div>
            </div>

            {/* Surface Corporelle (SC) */}
            <div className="bg-teal-50/40 p-3 rounded-xl border border-teal-100">
              <div className="text-teal-900 text-[11px] font-semibold flex items-center justify-between">
                <span>Surface Corporelle</span>
                <span className="text-[10px] font-medium text-teal-700">Mosteller</span>
              </div>
              <div className="text-xl font-black text-teal-950 mt-1">
                {consultation.surface_corporelle ? `${consultation.surface_corporelle}` : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">m²</span>
              </div>
              <div className="text-[10px] text-teal-800 mt-0.5">Formule : √((Poids×Taille)/3600)</div>
              <div className="text-[9px] text-slate-400">Indexation posologies</div>
            </div>

            {/* Tension Globale */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-700 text-[11px] font-semibold flex items-center justify-between">
                <span>Profil Tensionnel</span>
                <span className="text-[10px] font-medium text-slate-400">PAS / PAD</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {consultation.tension_systolique && consultation.tension_diastolique
                  ? `${consultation.tension_systolique}/${consultation.tension_diastolique}`
                  : '-'}
                <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Valeurs combinées</div>
              <div className="text-[9px] text-slate-400">Réf. : &lt; 140/90 mmHg</div>
            </div>

          </div>
        </div>

        {/* Alertes constantes si détectées lors du triage */}
        {consultation.alertes_constantes && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Alerte(s) constantes identifiée(s) au triage : </span>
              {(() => {
                try {
                  const parsed = JSON.parse(consultation.alertes_constantes);
                  return Array.isArray(parsed) ? parsed.join(', ') : consultation.alertes_constantes;
                } catch {
                  return consultation.alertes_constantes;
                }
              })()}
            </div>
          </div>
        )}
      </div>

      {/* VOLET DÉDIÉ : INTERPRÉTATION DES RÉSULTATS D'ANALYSES */}
      {(consultation.type_visite === 'INTERPRETATION_RESULTATS' || consultation.interpretation_context) && (
        <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 rounded-xl border-2 border-purple-300 p-5 shadow-xs space-y-4">
          
          {/* En-tête Interprétation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-purple-200 gap-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-700 text-white rounded-xl shadow-xs">
                <FileSearch className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-black text-purple-950">
                    Dossier & Examens pour Interprétation des Résultats
                  </h3>
                  <span className="bg-purple-700 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                    VISITE D'INTERPRÉTATION
                  </span>
                </div>
                <p className="text-xs text-purple-800">
                  Le patient revient pour interprétation médicale et avis sur les examens prescrits.
                </p>
              </div>
            </div>

            {/* Examens ciblés par la réception */}
            {consultation.interpretation_context?.elements_selectionnes && (
              <div className="flex flex-wrap gap-1">
                {consultation.interpretation_context.elements_selectionnes.map((item: string, idx: number) => (
                  <span
                    key={idx}
                    className="bg-purple-200/80 text-purple-900 border border-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-md"
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Colonne Gauche : Contexte de la consultation d'origine (5/12) */}
            <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-purple-200 space-y-3 text-xs shadow-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 text-purple-900">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <span>1. Contexte de la Consultation d'Origine</span>
              </h4>

              {consultation.interpretation_context?.consultation_origine ? (
                <div className="space-y-2.5 text-slate-700">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400">Date consultation :</span>
                    <span className="font-bold text-slate-900">
                      {new Date(consultation.interpretation_context.consultation_origine.date_consultation).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400">Médecin prescripteur :</span>
                    <span className="font-bold text-purple-900">
                      Dr. {consultation.interpretation_context.consultation_origine.medecin_nom}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400">Épisode / Visite :</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {consultation.interpretation_context.consultation_origine.numero_visite || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Motif initial exprimé :</span>
                    <p className="bg-slate-50 p-2 rounded-lg border border-slate-200 italic text-slate-800">
                      "{consultation.interpretation_context.consultation_origine.motif_consultation || 'Non renseigné'}"
                    </p>
                  </div>
                  {consultation.interpretation_context.consultation_origine.diagnostic_principal && (
                    <div>
                      <span className="text-slate-400 block mb-0.5">Hypothèse diagnostique initiale :</span>
                      <p className="bg-purple-50/60 p-2 rounded-lg border border-purple-200 font-semibold text-purple-900">
                        {consultation.interpretation_context.consultation_origine.diagnostic_principal}
                      </p>
                    </div>
                  )}
                  {consultation.interpretation_context.consultation_origine.histoire_maladie && (
                    <div>
                      <span className="text-slate-400 block mb-0.5">Histoire de la maladie :</span>
                      <p className="text-[11px] text-slate-600 line-clamp-3">
                        {consultation.interpretation_context.consultation_origine.histoire_maladie}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg text-slate-400 italic text-center">
                  Aucun dossier antérieur lié à cette visite d'interprétation.
                </div>
              )}
            </div>

            {/* Colonne Droite : Résultats des Analyses du Laboratoire (7/12) */}
            <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-purple-200 space-y-3 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 text-purple-900">
                  <Microscope className="w-4 h-4 text-purple-600" />
                  <span>2. Résultats des Examens Biologiques</span>
                </h4>
                
                {/* Bouton pour insérer la synthèse dans le formulaire */}
                <button
                  type="button"
                  onClick={() => {
                    const labList: string[] = [];
                    consultation.interpretation_context?.lab_orders?.forEach((lo: any) => {
                      lo.analyses?.forEach((an: any) => {
                        const val = an.valeur_trouvee ? `${an.valeur_trouvee} ${an.unite || ''}` : 'En attente';
                        const ref = an.valeurs_reference ? ` (Normes: ${an.valeurs_reference})` : '';
                        const anorm = an.est_anormal ? ' [ANORMAL]' : '';
                        labList.push(`- ${an.nom_analyse} : ${val}${ref}${anorm}`);
                      });
                    });
                    if (labList.length > 0) {
                      const synthese = `\n\n--- SYNTHÈSE DES RÉSULTATS D'ANALYSES ---\n${labList.join('\n')}\n`;
                      setHistoire((prev) => prev ? prev + synthese : synthese);
                      setSuccessMessage('Synthèse des résultats insérée dans la note médicale !');
                      setTimeout(() => setSuccessMessage(null), 3000);
                    }
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-purple-800 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Insérer synthèse dans l'histoire</span>
                </button>
              </div>

              {consultation.interpretation_context?.lab_orders && consultation.interpretation_context.lab_orders.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {consultation.interpretation_context.lab_orders.map((lo: any) => (
                    <div key={lo.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700">
                          Prescription du {new Date(lo.date_prescription).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="font-mono text-purple-700 font-bold uppercase text-[10px]">
                          {lo.statut}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-slate-100">
                        {lo.analyses?.map((an: any) => {
                          const isAnormal = an.est_anormal === 1 || an.est_anormal === true;
                          return (
                            <div key={an.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-900 text-xs">{an.nom_analyse}</span>
                                  {isAnormal ? (
                                    <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-xs font-bold border border-rose-300">
                                      PATHOLOGIQUE
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-xs font-bold">
                                      NORMAL
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Valeurs de référence : <strong>{an.valeurs_reference || 'Non spécifiées'}</strong>
                                  {an.valide_par_nom && <span> • Validé par {an.valide_par_nom}</span>}
                                </div>
                              </div>

                              <div className="text-right">
                                <span className={`text-sm font-black font-mono ${
                                  isAnormal ? 'text-rose-700' : 'text-slate-900'
                                }`}>
                                  {an.valeur_trouvee ? `${an.valeur_trouvee} ${an.unite || ''}` : 'En cours d\'analyse'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-400 italic">
                  Aucun résultat de laboratoire disponible dans le dossier lié.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* FORMULAIRE CLINIQUE DU MÉDECIN */}
      <div id="sec_clinique" className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        
        {/* Motif de la consultation */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              1. Motif de Consultation *
            </label>
            <span className="text-[11px] text-slate-400">Raison médicale de la venue</span>
          </div>
          <input
            type="text"
            disabled={isReadOnly}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex: Fièvre persistante depuis 3 jours, céphalées intenses, altération de l'état général..."
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900"
          />
        </div>

        {/* Histoire de la maladie / Anamnèse */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              2. Histoire de la Maladie / Anamnèse
            </label>
            <span className="text-[11px] text-slate-400">Chronologie des symptômes, prise médicamenteuse préalable</span>
          </div>
          <textarea
            rows={4}
            disabled={isReadOnly}
            value={histoire}
            onChange={(e) => setHistoire(e.target.value)}
            placeholder="Description détaillée de l'épisode actuel : mode de début (brutal/progressif), évolution des symptômes, traitements déjà pris (automédication), facteurs déclenchants..."
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-sans"
          />
        </div>

        {/* Examen physique */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              3. Examen Physique Structuré
            </label>
            <span className="text-[11px] text-slate-400">Signes cliniques objectifs par appareil</span>
          </div>
          <textarea
            rows={5}
            disabled={isReadOnly}
            value={examen}
            onChange={(e) => setExamen(e.target.value)}
            placeholder={`- État général : Patient conscient, orienté, état d'hydratation, muqueuses...
- Cardio-vasculaire : Bruits du cœur réguliers, absence de souffle, pouls périphériques perçus.
- Pleuro-pulmonaire : Murmure vésiculaire présent bilatéralement, pas de râles.
- Abdomen : Souple, dépressible, indolore, pas d'hépato-splénomégalie.
- ORL / Neuro / Cutané : Pharynx calme, pupilles isochores, absence de purpura.`}
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-mono text-xs"
          />
        </div>

        {/* ========================================================================= */}
        {/* BLOC 1 : HYPOTHÈSES DIAGNOSTIQUES [+ Ajouter] */}
        {/* ========================================================================= */}
        <div id="sec_diagnostics" className="p-5 bg-amber-50/40 border border-amber-200 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <Lightbulb className="w-4 h-4" />
                </span>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  4.A. Hypothèses Diagnostiques
                </label>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  {hypothesesDiagnostiques.length}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 mt-1">
                Diagnostic suspecté mais pas encore retenu • Reste en attente de résultats de labo, imagerie ou examens
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowAddHypothese(!showAddHypothese)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Ajouter une hypothèse
              </button>
            )}
          </div>

          {/* Formulaire d'ajout d'une hypothèse diagnostique */}
          {showAddHypothese && !isReadOnly && (
            <div className="p-4 bg-white border border-amber-300 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-amber-900 flex items-center">
                  <Plus className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Nouvelle Hypothèse Diagnostique
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddHypothese(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Pathologie / Diagnostic suspecté *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newHypotheseLibelle}
                  onChange={(e) => setNewHypotheseLibelle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHypothese();
                    }
                  }}
                  placeholder="Ex : Suspicion d'accès palustre, Gastro-entérite aiguë, Pneumopathie, Méningite..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Statut d'investigation
                  </label>
                  <select
                    value={newHypotheseStatut}
                    onChange={(e) => setNewHypotheseStatut(e.target.value as StatutHypothese)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-slate-800"
                  >
                    <option value="SUSPECTE">Suspicion clinique initiale (En observation)</option>
                    <option value="EN_ATTENTE_LABO">En attente de résultats de Laboratoire</option>
                    <option value="EN_ATTENTE_IMAGERIE">En attente de résultats d'Imagerie (Rx, Écho, Scanner)</option>
                    <option value="EN_ATTENTE_EXAMENS">En attente d'autres examens / Avis spécialisé</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Degré de suspicion
                  </label>
                  <select
                    value={newHypotheseCertitude}
                    onChange={(e) => setNewHypotheseCertitude(e.target.value as any)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-slate-800"
                  >
                    <option value="FORTE">Forte suspicion clinique</option>
                    <option value="MOYENNE">Suspicion moyenne / Différentielle</option>
                    <option value="FAIBLE">Hypothèse d'élimination (Faible)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Examens ou éléments complémentaires attendus (optionnel)
                </label>
                <input
                  type="text"
                  value={newHypotheseAttente}
                  onChange={(e) => setNewHypotheseAttente(e.target.value)}
                  placeholder="Ex : En attente Goutte épaisse + NFS, Rx Thorax de face, Échographie abdominale..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddHypothese(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddHypothese}
                  disabled={!newHypotheseLibelle.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Valider l'hypothèse
                </button>
              </div>
            </div>
          )}

          {/* Liste des hypothèses enregistrées */}
          <div className="space-y-2.5">
            {hypothesesDiagnostiques.length === 0 ? (
              <div className="p-4 bg-white/70 border border-dashed border-amber-200 rounded-xl text-center">
                <HelpCircle className="w-6 h-6 mx-auto text-amber-400 mb-1" />
                <p className="text-xs font-semibold text-amber-900">Aucune hypothèse diagnostique enregistrée</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">
                  Si un diagnostic est actuellement suspecté ou en attente d'analyses, cliquez sur <strong>[+ Ajouter une hypothèse]</strong>.
                </p>
              </div>
            ) : (
              hypothesesDiagnostiques.map((hypo) => {
                const badgeColor = 
                  hypo.statut === 'EN_ATTENTE_LABO' 
                    ? 'bg-amber-100 text-amber-800 border-amber-300' 
                    : hypo.statut === 'EN_ATTENTE_IMAGERIE'
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : hypo.statut === 'EN_ATTENTE_EXAMENS'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300';

                const labelStatut =
                  hypo.statut === 'EN_ATTENTE_LABO'
                    ? 'En attente Laboratoire'
                    : hypo.statut === 'EN_ATTENTE_IMAGERIE'
                    ? 'En attente Imagerie'
                    : hypo.statut === 'EN_ATTENTE_EXAMENS'
                    ? 'En attente Examens'
                    : 'Suspicion Clinique';

                return (
                  <div
                    key={hypo.id}
                    className="p-3.5 bg-white border border-amber-200/90 rounded-xl shadow-2xs space-y-2 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">{hypo.libelle}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {labelStatut}
                        </span>
                        {hypo.certitude && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Suspicion : {hypo.certitude}
                          </span>
                        )}
                      </div>
                    </div>

                    {hypo.attente_details && (
                      <div className="p-2 bg-amber-50/60 rounded-lg text-xs text-amber-900 border border-amber-100 flex items-start space-x-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                        <span><strong>Attente : </strong>{hypo.attente_details}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-amber-800/70 italic text-[10px]">
                        Suspecté • Non encore retenu
                      </span>

                      {!isReadOnly && (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handlePromoteHypotheseToRetenu(hypo)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center shadow-2xs transition-colors text-xs"
                            title="Action explicite : Retenir cette hypothèse après évaluation"
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1" />
                            Retenir ce diagnostic
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveHypothese(hypo.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                            title="Supprimer cette hypothèse"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-[11px] text-amber-900/80 bg-amber-100/40 p-2.5 rounded-lg border border-amber-200/60 flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong>Règle clinique :</strong> Une hypothèse ne devient jamais automatiquement un diagnostic retenu. Son passage vers les diagnostics retenus est une action explicite du médecin.
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BLOC 2 : DIAGNOSTICS RETENUS [+ Ajouter] */}
        {/* ========================================================================= */}
        <div className="p-5 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  4.B. Diagnostics Retenus *
                </label>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  {diagnosticsRetenus.length}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-1">
                Diagnostic finalement retenu après évaluation clinique et examens disponibles • Au moins 1 requis pour finaliser
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowAddRetenu(!showAddRetenu)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Ajouter un diagnostic retenu
              </button>
            )}
          </div>

          {/* Formulaire d'ajout d'un diagnostic retenu */}
          {showAddRetenu && !isReadOnly && (
            <div className="p-4 bg-white border border-emerald-300 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-emerald-900 flex items-center">
                  <Plus className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Nouveau Diagnostic Retenu
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddRetenu(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Intitulé du diagnostic retenu *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newRetenuLibelle}
                  onChange={(e) => setNewRetenuLibelle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDiagnosticRetenu();
                    }
                  }}
                  placeholder="Ex : Paludisme simple à Plasmodium falciparum, Bronchopneumopathie aiguë, HTA stade 2..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Statut du diagnostic
                  </label>
                  <select
                    value={newRetenuStatut}
                    onChange={(e) => setNewRetenuStatut(e.target.value as StatutDiagnosticRetenu)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-800"
                  >
                    <option value="RETENU">Retenu (Clinique / Présomptif)</option>
                    <option value="CONFIRME">Confirmé (Biologique / Imagerie / Certitude)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={newRetenuIsPrincipal || diagnosticsRetenus.length === 0}
                      onChange={(e) => setNewRetenuIsPrincipal(e.target.checked)}
                      className="w-4 h-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Définir comme Diagnostic Principal</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Précisions / Justificatif ou Preuve diagnostique (optionnel)
                </label>
                <input
                  type="text"
                  value={newRetenuPrecision}
                  onChange={(e) => setNewRetenuPrecision(e.target.value)}
                  placeholder="Ex : Confirmé par TDR positif, Goutte épaisse 15000 trophozoïtes/µL, Rx pulmonaire..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRetenu(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddDiagnosticRetenu}
                  disabled={!newRetenuLibelle.trim()}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Valider le diagnostic retenu
                </button>
              </div>
            </div>
          )}

          {/* Liste des diagnostics retenus */}
          <div className="space-y-2.5">
            {diagnosticsRetenus.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-300/80 rounded-xl text-center space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-amber-600 mb-1" />
                <p className="text-xs font-bold text-amber-950">Aucun diagnostic retenu pour l'instant</p>
                <p className="text-[11px] text-amber-800">
                  Pour finaliser la consultation, vous devez retenir au moins un diagnostic : cliquez sur <strong>[+ Ajouter un diagnostic retenu]</strong> ou retenez une hypothèse ci-dessus.
                </p>
              </div>
            ) : (
              diagnosticsRetenus.map((item, idx) => {
                const isMain = item.is_principal || (idx === 0 && !diagnosticsRetenus.some(d => d.is_principal));
                const isConfirmed = item.statut === 'CONFIRME';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 bg-white border-2 rounded-xl shadow-2xs space-y-2 transition-all ${
                      isMain ? 'border-emerald-500/80 bg-emerald-50/20 ring-1 ring-emerald-500/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        {isMain && (
                          <span className="bg-emerald-700 text-white font-black px-2 py-0.5 rounded-md text-[10px] tracking-wide uppercase shadow-xs">
                            PRINCIPAL
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-900">{item.libelle}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isConfirmed ? (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            CONFIRMÉ
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            <Stethoscope className="w-3 h-3 mr-1 text-slate-500" />
                            RETENU (CLINIQUE)
                          </span>
                        )}
                      </div>
                    </div>

                    {item.precision && (
                      <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200">
                        <strong className="text-slate-800">Précision / Éléments : </strong>{item.precision}
                      </div>
                    )}

                    {!isReadOnly && (
                      <div className="flex flex-wrap items-center justify-between pt-1.5 border-t border-slate-100 text-xs gap-2">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatutConfirmation(item.id)}
                            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline flex items-center"
                          >
                            {isConfirmed ? 'Basculer en Retenu non confirmé' : 'Marquer comme Confirmé'}
                          </button>

                          {!isMain && (
                            <button
                              type="button"
                              onClick={() => handleSetPrincipalRetenu(item.id)}
                              className="text-[11px] font-medium text-slate-600 hover:text-emerald-700 underline"
                            >
                              Définir comme principal
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDiagnosticRetenu(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          title="Supprimer ce diagnostic retenu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Conduite à tenir */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              5. Conduite à Tenir & Plan Thérapeutique *
            </label>
            <span className="text-[11px] text-slate-400">Consignes de soins, posologies, surveillance, retour</span>
          </div>
          <textarea
            rows={4}
            disabled={isReadOnly}
            value={conduiteATenir}
            onChange={(e) => setConduiteATenir(e.target.value)}
            placeholder={`1. Mesures thérapeutiques préconisées : antipyrétiques, réhydratation orale...
2. Surveillance clinique de la température et de l'état d'hydratation à domicile.
3. Signes d'alerte nécessitant une consultation urgente : convulsions, léthargie, vomissements incoercibles.
4. Rendez-vous de contrôle suggéré sous 48 à 72 heures si pas d'amélioration.`}
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-sans"
          />
        </div>

        {/* Notes confidentielles (Secret Médical Absolu) */}
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
              <Lock className="w-4 h-4 mr-1.5 text-amber-400" />
              6. Notes Confidentielles du Praticien (Strictement Réservées au Médecin)
            </label>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
              Non divulgué à Réception / Caisse / Labo / Admin
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Ces annotations cliniques privées ne sont visibles que par vous et vos confrères médecins autorisés. Elles ne figurent sur aucun document de facturation ou administratif.
          </p>
          <textarea
            rows={3}
            disabled={isReadOnly}
            value={notesConfidentielles}
            onChange={(e) => setNotesConfidentielles(e.target.value)}
            placeholder="Impressions cliniques personnelles, doutes diagnostiques, éléments psycho-sociaux confidentiels..."
            className="w-full text-xs p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-hidden text-slate-100 disabled:bg-slate-950 font-sans"
          />
        </div>

        {/* SECTION DÉDIÉE : PRESCRIPTIONS MÉDICALES & ORDONNANCES (PHASE 2C-1) */}
        <div id="sec_prescriptions" className="pt-2">
          <PrescriptionManager
            consultationId={consultation.id}
            patientId={consultation.patient_id}
            visiteId={consultation.visite_id}
            isConsultationFinalized={isFinalized}
            isAmendmentMode={isAmendmentMode}
            amendementMotif={amendementMotif}
            initialPrescriptions={consultation.prescriptions || []}
            onPrescriptionsUpdated={() => fetchConsultation(true)}
          />
        </div>

        {/* SECTION DÉDIÉE : DEMANDES D'ANALYSES DE LABORATOIRE (PHASE 2C-2) */}
        <div id="sec_labo" className="pt-2">
          <LabOrderManager
            consultationId={consultation.id}
            patientId={consultation.patient_id}
            visiteId={consultation.visite_id}
            isConsultationFinalized={isFinalized}
            isAmendmentMode={isAmendmentMode}
            amendementMotif={amendementMotif}
            initialLabOrders={consultation.lab_orders || []}
            onLabOrdersUpdated={() => fetchConsultation(true)}
          />
        </div>

        {/* SECTION DÉDIÉE : RENDEZ-VOUS DE CONTRÔLE & SUIVI CLINIQUE (ÉTAPE 7 - CALENDRIER PARTAGÉ) */}
        <div id="sec_suivi" className="pt-2">
          <FollowUpAppointmentSection
            consultationId={consultation.id}
            patientId={consultation.patient_id}
            visiteId={consultation.visite_id}
            medecinId={consultation.medecin_id}
            patientNom={consultation.patient_nom}
            patientPrenom={consultation.patient_prenom}
            isConsultationFinalized={isFinalized}
          />
        </div>

      </div>

      {/* BOUTONS EXTENSIONS DISPONIBLES DANS PHASES SUIVANTES */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-slate-500 font-medium">
          Modules complémentaires du workflow clinique :
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="px-3 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg flex items-center font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Ordonnance Thérapeutique (Opérationnelle - Phase 2C-1)
          </span>
          <span
            className="px-3 py-1.5 bg-indigo-100 border border-indigo-300 text-indigo-900 rounded-lg flex items-center font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 mr-1.5 text-indigo-700" />
            Analyses Laboratoire (Opérationnel - Phase 2C-2)
          </span>
          <button
            type="button"
            disabled
            title="Sera développé dans la Phase 2D"
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-400 rounded-lg cursor-not-allowed flex items-center"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Orientation Spécialiste Externe (Phase 2D)
          </button>
        </div>
      </div>

      {/* MODALE HISTORIQUE PATIENT */}
      {showHistoryModal && (
        <PatientHistoryModal
          patientId={consultation.patient_id}
          patientName={`${consultation.patient_nom} ${consultation.patient_prenom}`}
          patientDossier={consultation.numero_dossier || 'Dossier'}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* MODALE DE CONFIRMATION DE FINALISATION */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center space-x-3 text-emerald-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Finalisation de la Consultation</h3>
                <p className="text-xs text-slate-500">Clôture clinique et verrouillage du dossier</p>
              </div>
            </div>

            {validationErrors.length > 0 ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-rose-800 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1 text-rose-600" />
                  Champs obligatoires manquants avant finalisation :
                </div>
                <ul className="list-disc list-inside text-xs text-rose-700 space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-rose-600 mt-2">
                  Veuillez compléter ces rubriques médicales pour pouvoir finaliser la consultation.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div><strong>Patient : </strong>{consultation.patient_nom} {consultation.patient_prenom}</div>
                  <div>
                    <strong>Diagnostic Principal Retenu : </strong>
                    <span className="text-emerald-800 font-bold">
                      {diagnosticsRetenus.find(d => d.is_principal)?.libelle || diagnosticsRetenus[0]?.libelle || 'Non spécifié'}
                    </span>
                    {diagnosticsRetenus.find(d => d.is_principal)?.statut === 'CONFIRME' && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-semibold rounded text-[10px]">
                        CONFIRMÉ
                      </span>
                    )}
                  </div>
                  {diagnosticsRetenus.length > 1 && (
                    <div>
                      <strong>Autres Diagnostics Retenus ({diagnosticsRetenus.length - 1}) : </strong>
                      <span className="text-slate-800">
                        {diagnosticsRetenus.filter((d, i) => i !== 0 && !d.is_principal).map(d => d.libelle).join(', ')}
                      </span>
                    </div>
                  )}
                  {hypothesesDiagnostiques.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <strong>Hypothèses Diagnostiques actives ({hypothesesDiagnostiques.length}) : </strong>
                      <span className="text-amber-800 font-medium">
                        {hypothesesDiagnostiques.map(h => h.libelle).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                <p>
                  En validant cette finalisation :
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Le statut de la consultation passera définitivement à <strong>FINALISÉE</strong>.</li>
                  <li>La visite médicale sera marquée comme <strong>CLÔTURÉE</strong>.</li>
                  <li>Le dossier sera verrouillé pour protéger les conclusions médicales.</li>
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowFinalizeConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                {validationErrors.length > 0 ? 'Fermer et corriger' : 'Annuler'}
              </button>

              {validationErrors.length === 0 && (
                <button
                  onClick={handleConfirmFinalize}
                  disabled={finalizing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center disabled:opacity-50"
                >
                  {finalizing ? (
                    <>
                      <Activity className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Finalisation en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Confirmer la finalisation
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* BARRE D'ACTIONS FLOTTANTE SUR MOBILE (Android / Tactile - Règle 6 & 7) */}
      {!isFinalized && (
        <div className="sm:hidden fixed bottom-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 shadow-lg flex items-center justify-between gap-2">
          <button
            onClick={() => handleSave('BROUILLON')}
            disabled={saving || finalizing}
            className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center space-x-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Brouillon</span>
          </button>

          <button
            onClick={() => handleSave('EN_COURS')}
            disabled={saving || finalizing}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center space-x-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>

          <button
            onClick={handleOpenFinalizeModal}
            disabled={saving || finalizing}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center space-x-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finaliser</span>
          </button>
        </div>
      )}

      {isFinalized && !isAmendmentMode && (
        <div className="sm:hidden fixed bottom-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg flex items-center justify-end">
          <button
            onClick={() => setIsAmendmentMode(true)}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors min-h-[44px] flex items-center justify-center space-x-1.5"
          >
            <Unlock className="w-4 h-4" />
            <span>Modifier la consultation (Amendement)</span>
          </button>
        </div>
      )}

    </div>
  );
};
