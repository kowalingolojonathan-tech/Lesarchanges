import React, { useState, useEffect } from 'react';
import { 
  Pill, Plus, Trash2, CheckCircle2, AlertCircle, Lock, Edit3, 
  Printer, Clock, FileText, ChevronDown, ChevronUp, Save, 
  X, AlertTriangle, ShieldAlert, Sparkles, RefreshCw, ShieldCheck, Send
} from 'lucide-react';
import { Prescription, PrescriptionItem, PrescriptionStatut } from '../../types';
import { apiFetch } from '../../lib/api';

interface PrescriptionManagerProps {
  consultationId: string;
  patientId: string;
  visiteId: string;
  isConsultationFinalized: boolean;
  isAmendmentMode?: boolean;
  amendementMotif?: string;
  initialPrescriptions?: Prescription[];
  onPrescriptionsUpdated?: () => void;
}

export const PrescriptionManager: React.FC<PrescriptionManagerProps> = ({
  consultationId,
  isConsultationFinalized,
  isAmendmentMode = false,
  amendementMotif = '',
  initialPrescriptions = [],
  onPrescriptionsUpdated,
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // État du formulaire
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(null);
  const [activeStatut, setActiveStatut] = useState<PrescriptionStatut>('BROUILLON');
  const [observations, setObservations] = useState<string>('');
  const [items, setItems] = useState<Partial<PrescriptionItem>[]>([
    {
      nom_medicament: '',
      dosage: '',
      forme: 'Comprimé',
      voie_administration: 'Orale',
      frequence: '',
      duree: '',
      quantite: 1,
      instructions: ''
    }
  ]);

  // Mode amendement spécifique à la prescription
  const [prescAmendmentMode, setPrescAmendmentMode] = useState<boolean>(false);
  const [prescAmendmentMotif, setPrescAmendmentMotif] = useState<string>('');

  // Impression / Aperçu Ordonnance
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null);
  const [expandedPrescIds, setExpandedPrescIds] = useState<Record<string, boolean>>({});

  // Recharger les prescriptions depuis l'API
  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/medical/consultations/${consultationId}/prescriptions`);
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data.prescriptions || []);
        // Par défaut, ouvrir la première prescription
        if (data.prescriptions && data.prescriptions.length > 0) {
          setExpandedPrescIds(prev => ({
            ...prev,
            [data.prescriptions[0].id]: true
          }));
        }
      }
    } catch (err: any) {
      console.error('Erreur chargement prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultationId) {
      fetchPrescriptions();
    }
  }, [consultationId]);

  const toggleExpand = (id: string) => {
    setExpandedPrescIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Démarrer une nouvelle prescription
  const handleStartNew = () => {
    if (isConsultationFinalized && !isAmendmentMode) {
      setError("La consultation est finalisée. Veuillez activer le mode d'amendement de la consultation pour ajouter une nouvelle prescription.");
      return;
    }
    setActivePrescriptionId(null);
    setActiveStatut('BROUILLON');
    setObservations('');
    setItems([
      {
        nom_medicament: '',
        dosage: '',
        forme: 'Comprimé',
        voie_administration: 'Orale',
        frequence: '',
        duree: '',
        quantite: 1,
        instructions: ''
      }
    ]);
    setPrescAmendmentMode(false);
    setPrescAmendmentMotif('');
    setIsEditing(true);
    setError(null);
  };

  // Charger une prescription existante pour modification
  const handleEdit = (p: Prescription) => {
    setActivePrescriptionId(p.id);
    setActiveStatut(p.statut);
    setObservations(p.observations || '');
    if (p.items && p.items.length > 0) {
      setItems(p.items.map(item => ({ ...item })));
    } else {
      setItems([
        {
          nom_medicament: '',
          dosage: '',
          forme: 'Comprimé',
          voie_administration: 'Orale',
          frequence: '',
          duree: '',
          quantite: 1,
          instructions: ''
        }
      ]);
    }
    setPrescAmendmentMode(false);
    setPrescAmendmentMotif('');
    setIsEditing(true);
    setError(null);
  };

  // Ajouter une ligne de médicament
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        nom_medicament: '',
        dosage: '',
        forme: 'Comprimé',
        voie_administration: 'Orale',
        frequence: '',
        duree: '',
        quantite: 1,
        instructions: ''
      }
    ]);
  };

  // Supprimer une ligne de médicament
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      // Réinitialiser la seule ligne plutôt que supprimer
      setItems([{
        nom_medicament: '',
        dosage: '',
        forme: 'Comprimé',
        voie_administration: 'Orale',
        frequence: '',
        duree: '',
        quantite: 1,
        instructions: ''
      }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Mettre à jour une ligne
  const handleItemChange = (index: number, field: keyof PrescriptionItem, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  // Validation
  const validateItems = (): string | null => {
    const validItems = items.filter(it => it.nom_medicament && it.nom_medicament.trim().length > 0);
    if (validItems.length === 0) {
      return "Au moins un médicament avec un nom valide est obligatoire.";
    }
    return null;
  };

  // Sauvegarder en brouillon
  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Si amendement nécessaire
      const isAmending = (isConsultationFinalized && isAmendmentMode) || prescAmendmentMode;
      const motifFinal = prescAmendmentMotif.trim() || amendementMotif.trim();

      if (activeStatut === 'TERMINEE' && !isAmending) {
        setError("Cette prescription est déjà finalisée. Veuillez activer l'amendement avec un motif pour la modifier.");
        return;
      }

      if (isAmending && (!motifFinal || motifFinal.length < 5)) {
        setError("Un motif explicite d'au moins 5 caractères est obligatoire pour amender une prescription ou consultation finalisée.");
        return;
      }

      const payload = {
        consultation_id: consultationId,
        observations: observations.trim() || null,
        statut: 'BROUILLON',
        items: items.map((it, idx) => ({
          ...it,
          nom_medicament: it.nom_medicament?.trim() || '',
          dosage: it.dosage?.trim() || null,
          forme: it.forme?.trim() || null,
          voie_administration: it.voie_administration?.trim() || null,
          frequence: it.frequence?.trim() || null,
          duree: it.duree?.trim() || null,
          quantite: it.quantite ? Math.max(1, Number(it.quantite)) : 1,
          instructions: it.instructions?.trim() || null,
          ordre: idx
        })),
        is_amendment: isAmending,
        amendement_motif: isAmending ? motifFinal : null
      };

      let res;
      if (activePrescriptionId) {
        res = await apiFetch(`/api/medical/prescriptions/${activePrescriptionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/medical/prescriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'enregistrement de la prescription");
      }

      setSuccessMessage("Brouillon de prescription enregistré avec succès.");
      setIsEditing(false);
      await fetchPrescriptions();
      onPrescriptionsUpdated?.();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Finaliser la prescription
  const handleFinalize = async () => {
    try {
      const validationError = validateItems();
      if (validationError) {
        setError(validationError);
        return;
      }

      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const isAmending = (isConsultationFinalized && isAmendmentMode) || prescAmendmentMode;
      const motifFinal = prescAmendmentMotif.trim() || amendementMotif.trim();

      // Nettoyer les items
      const cleanItems = items
        .filter(it => it.nom_medicament && it.nom_medicament.trim().length > 0)
        .map((it, idx) => ({
          ...it,
          nom_medicament: it.nom_medicament!.trim(),
          dosage: it.dosage?.trim() || null,
          forme: it.forme?.trim() || null,
          voie_administration: it.voie_administration?.trim() || null,
          frequence: it.frequence?.trim() || null,
          duree: it.duree?.trim() || null,
          quantite: it.quantite ? Math.max(1, Number(it.quantite)) : 1,
          instructions: it.instructions?.trim() || null,
          ordre: idx
        }));

      let prescriptionId = activePrescriptionId;

      // Si pas encore d'ID (nouvelle prescription), créer d'abord en statut BROUILLON
      if (!prescriptionId) {
        const createRes = await apiFetch('/api/medical/prescriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultation_id: consultationId,
            observations: observations.trim() || null,
            statut: 'BROUILLON',
            items: cleanItems,
            is_amendment: isAmending,
            amendement_motif: isAmending ? motifFinal : null
          })
        });

        if (!createRes.ok) {
          const errData = await createRes.json();
          throw new Error(errData.error || "Erreur lors de la création de la prescription");
        }

        const createData = await createRes.json();
        prescriptionId = createData.prescription.id;
      }

      // Appeler le endpoint de validation officielle du médecin (BROUILLON -> VALIDEE)
      const valRes = await apiFetch(`/api/medical/prescriptions/${prescriptionId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observations: observations.trim() || null,
          items: cleanItems
        })
      });

      if (!valRes.ok) {
        const errData = await valRes.json();
        throw new Error(errData.error || "Erreur lors de la validation de la prescription");
      }

      setSuccessMessage("Ordonnance médicale validée avec succès. Elle est désormais disponible à la réception pour impression.");
      setIsEditing(false);
      await fetchPrescriptions();
      onPrescriptionsUpdated?.();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation");
    } finally {
      setSaving(false);
    }
  };

  // Validation directe d'une prescription existante en brouillon
  const handleValidateDirect = async (id: string) => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/medical/prescriptions/${id}/validate`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la validation");
      }
      setSuccessMessage("Ordonnance validée par le médecin. Disponible à la réception pour impression.");
      await fetchPrescriptions();
      onPrescriptionsUpdated?.();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation");
    } finally {
      setSaving(false);
    }
  };

  // Traçabilité de l'impression côté médecin (VALIDEE -> IMPRIMEE)
  const handlePrintPrescription = async (p: Prescription) => {
    try {
      const res = await apiFetch(`/api/medical/prescriptions/${p.id}/print`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prescription) {
          setPrescriptions(prev => prev.map(item => item.id === p.id ? { ...item, statut: data.prescription.statut } : item));
        }
      }
    } catch (err) {
      console.error('Erreur traçabilité impression:', err);
    }
    setPreviewPrescription(p);
  };

  // Remise de l'ordonnance au patient (IMPRIMEE / VALIDEE -> REMISE)
  const handleDeliverDirect = async (id: string) => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/medical/prescriptions/${id}/deliver`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la remise au patient");
      }
      setSuccessMessage("Ordonnance marquée comme remise au patient.");
      await fetchPrescriptions();
      onPrescriptionsUpdated?.();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la remise au patient");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (statut: PrescriptionStatut) => {
    switch (statut) {
      case 'REMISE':
      case 'TERMINEE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Remise au patient
          </span>
        );
      case 'IMPRIMEE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <Printer className="w-3 h-3 mr-1" />
            Imprimée (Prête pour remise)
          </span>
        );
      case 'VALIDEE':
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Validée (Disponible à la réception)
          </span>
        );
      case 'ANNULEE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <X className="w-3 h-3 mr-1" />
            Annulée
          </span>
        );
      case 'BROUILLON':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Edit3 className="w-3 h-3 mr-1" />
            Brouillon
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* En-tête de section */}
      <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-700/80 rounded-lg">
            <Pill className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center">
              Prescription Médicale & Ordonnance Thérapeutique
              <span className="ml-2.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-600/60 text-emerald-100 px-2 py-0.5 rounded-full">
                Phase 2C-1
              </span>
            </h3>
            <p className="text-xs text-emerald-200">
              Lignes de médicaments, posologies, durées et instructions certifiées par le médecin traitant
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleStartNew}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouvelle Prescription
          </button>
        )}
      </div>

      {/* Messages d'alerte / succès */}
      {error && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start">
          <AlertCircle className="w-4 h-4 text-rose-600 mr-2 mt-0.5 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 mt-0.5 shrink-0" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Contenu principal */}
      <div className="p-4">
        {/* FORMULAIRE D'ÉDITION */}
        {isEditing ? (
          <div className="space-y-4 bg-slate-50 p-4 border border-slate-300 rounded-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-sm">
                  {activePrescriptionId ? 'Modifier la prescription' : 'Rédiger une nouvelle prescription'}
                </span>
                {getStatusBadge(activeStatut)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avertissement / Mode amendement si finalisée */}
            {activeStatut === 'TERMINEE' && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-2">
                <div className="flex items-center font-bold">
                  <Lock className="w-4 h-4 mr-1.5 text-amber-700" />
                  Prescription déjà finalisée (Verrouillée)
                </div>
                <p>
                  Toute modification nécessite un motif explicite d'amendement qui sera scellé dans le journal d'audit conformément à la déontologie médicale.
                </p>
                <div>
                  <label className="block font-semibold mb-1">Motif d'amendement obligatoire :</label>
                  <input
                    type="text"
                    value={prescAmendmentMotif}
                    onChange={(e) => setPrescAmendmentMotif(e.target.value)}
                    placeholder="Ex: Adaptation posologique suite à intolérance gastrique / Remplacement de molécule..."
                    className="w-full text-xs p-2 bg-white border border-amber-400 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Lignes de Médicaments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Lignes de Médicaments ({items.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-md transition-colors flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Ajouter un médicament
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pb-1.5 border-b border-slate-100">
                      <span>Médicament #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-500 hover:text-rose-700 flex items-center text-xs"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Supprimer
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      {/* Nom Médicament */}
                      <div className="md:col-span-2">
                        <label className="block text-slate-700 font-medium mb-1">
                          Nom de la spécialité ou DCI *
                        </label>
                        <input
                          type="text"
                          value={item.nom_medicament || ''}
                          onChange={(e) => handleItemChange(idx, 'nom_medicament', e.target.value)}
                          placeholder="Ex: Amoxicilline / Paracétamol / Artéméther-Luméfantrine..."
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-slate-900"
                        />
                      </div>

                      {/* Dosage */}
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Dosage
                        </label>
                        <input
                          type="text"
                          value={item.dosage || ''}
                          onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                          placeholder="Ex: 500 mg / 1 g / 20/120 mg"
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {/* Forme */}
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Forme galénique
                        </label>
                        <select
                          value={item.forme || 'Comprimé'}
                          onChange={(e) => handleItemChange(idx, 'forme', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        >
                          <option value="Comprimé">Comprimé</option>
                          <option value="Gélule">Gélule</option>
                          <option value="Sirop / Suspension">Sirop / Suspension</option>
                          <option value="Injectable (IV/IM)">Injectable (IV/IM)</option>
                          <option value="Pommade / Crème">Pommade / Crème</option>
                          <option value="Collyre">Collyre</option>
                          <option value="Suppositoire">Suppositoire</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>

                      {/* Voie */}
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Voie d'administration
                        </label>
                        <select
                          value={item.voie_administration || 'Orale'}
                          onChange={(e) => handleItemChange(idx, 'voie_administration', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        >
                          <option value="Orale">Orale</option>
                          <option value="Intraveineuse (IV)">Intraveineuse (IV)</option>
                          <option value="Intramusculaire (IM)">Intramusculaire (IM)</option>
                          <option value="Sous-cutanée">Sous-cutanée</option>
                          <option value="Cutanée / Locale">Cutanée / Locale</option>
                          <option value="Oculaire">Oculaire</option>
                          <option value="Rectale">Rectale</option>
                          <option value="Inhalée">Inhalée</option>
                        </select>
                      </div>

                      {/* Posologie / Fréquence */}
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Posologie & Fréquence
                        </label>
                        <input
                          type="text"
                          value={item.frequence || ''}
                          onChange={(e) => handleItemChange(idx, 'frequence', e.target.value)}
                          placeholder="Ex: 1 cp matin et soir"
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        />
                      </div>

                      {/* Durée */}
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Durée du traitement
                        </label>
                        <input
                          type="text"
                          value={item.duree || ''}
                          onChange={(e) => handleItemChange(idx, 'duree', e.target.value)}
                          placeholder="Ex: 5 jours / 7 jours / 1 mois"
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Quantité & Instructions particulières */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Quantité (boîtes/flacons)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantite !== undefined && item.quantite !== null ? item.quantite : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleItemChange(idx, 'quantite', val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                          }}
                          placeholder="1"
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900 font-semibold"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-slate-700 font-medium mb-1">
                          Instructions particulières au patient
                        </label>
                        <input
                          type="text"
                          value={item.instructions || ''}
                          onChange={(e) => handleItemChange(idx, 'instructions', e.target.value)}
                          placeholder="Ex: À prendre au milieu des repas avec un grand verre d'eau. Ne pas interrompre le traitement."
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observations / Recommandations générales */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Observations & Précautions Particulières
              </label>
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Hydratation abondante recommandée. Revenir en urgence si apparition d'ictère ou de fièvre persistante."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
              />
            </div>

            {/* Boutons d'action du formulaire */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Annuler
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? 'Enregistrement...' : 'Enregistrer Brouillon'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinalize}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {saving ? 'Finalisation...' : 'Finaliser la Prescription'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* LISTE DES PRESCRIPTIONS EXISTANTES */}
        {prescriptions.length === 0 && !isEditing ? (
          <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
            <Pill className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">
              Aucune prescription médicale enregistrée pour cette consultation
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Cliquez sur "Nouvelle Prescription" ci-dessus pour rédiger une ordonnance thérapeutique avec posologies et durées.
            </p>
          </div>
        ) : null}

        {!isEditing && prescriptions.length > 0 && (
          <div className="space-y-3">
            {prescriptions.map((p) => {
              const isExpanded = !!expandedPrescIds[p.id];
              return (
                <div 
                  key={p.id}
                  className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white"
                >
                  {/* Ligne d'en-tête de la prescription */}
                  <div 
                    onClick={() => toggleExpand(p.id)}
                    className="p-3.5 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-md">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">
                            Prescription du {new Date(p.date_prescription).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {getStatusBadge(p.statut)}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Prescripteur : Dr. {p.medecin_nom || 'Médecin'} • {p.items?.length || 0} médicament(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {/* Action selon le statut */}
                      {p.statut === 'BROUILLON' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleValidateDirect(p.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center shadow-xs"
                          title="Valider l'ordonnance et la rendre disponible à la réception"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Valider
                        </button>
                      )}

                      {p.statut === 'VALIDEE' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintPrescription(p)}
                            className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-md transition-colors flex items-center shadow-xs"
                            title="Imprimer l'ordonnance médicale"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Imprimer
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleDeliverDirect(p.id)}
                            className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-md transition-colors flex items-center"
                            title="Marquer comme remise directement au patient"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Remettre
                          </button>
                        </>
                      )}

                      {p.statut === 'IMPRIMEE' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintPrescription(p)}
                            className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-md transition-colors flex items-center shadow-xs"
                            title="Réimprimer l'ordonnance"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Réimprimer
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleDeliverDirect(p.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center shadow-xs"
                            title="Marquer comme remise au patient"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Remettre au patient
                          </button>
                        </>
                      )}

                      {p.statut === 'REMISE' && (
                        <button
                          type="button"
                          onClick={() => handlePrintPrescription(p)}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors flex items-center"
                          title="Imprimer un duplicata"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          Duplicata
                        </button>
                      )}

                      {/* Modification / Édition possible si BROUILLON */}
                      {p.statut === 'BROUILLON' && (
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors flex items-center"
                          title="Modifier le brouillon"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Éditer
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(p.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Détail déplié */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
                      {p.observations && (
                        <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">Recommandations générales : </span>
                          {p.observations}
                        </div>
                      )}

                      {p.amendement_motif && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                          <span className="font-bold">Motif d'amendement tracé : </span>
                          {p.amendement_motif}
                        </div>
                      )}

                      {/* Tableau des médicaments */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Médicament & Forme</th>
                              <th className="p-2.5">Dosage</th>
                              <th className="p-2.5">Voie</th>
                              <th className="p-2.5">Posologie & Fréquence</th>
                              <th className="p-2.5">Durée</th>
                              <th className="p-2.5">Qté</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {p.items && p.items.length > 0 ? (
                              p.items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/60">
                                  <td className="p-2.5 font-semibold text-slate-900">
                                    {item.nom_medicament}
                                    {item.forme && (
                                      <span className="block text-[11px] font-normal text-slate-500">
                                        Forme : {item.forme}
                                      </span>
                                    )}
                                    {item.instructions && (
                                      <span className="block text-[11px] italic font-normal text-emerald-700 mt-0.5">
                                        Conseil : {item.instructions}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-slate-700">{item.dosage || '—'}</td>
                                  <td className="p-2.5 text-slate-700">{item.voie_administration || 'Orale'}</td>
                                  <td className="p-2.5 font-medium text-slate-800">{item.frequence || '—'}</td>
                                  <td className="p-2.5 text-slate-700">{item.duree || '—'}</td>
                                  <td className="p-2.5 font-semibold text-slate-900">{item.quantite || 1}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="p-3 text-center text-slate-400 italic">
                                  Aucun médicament listé.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALE D'IMPRESSION / PRÉVISUALISATION ORDONNANCE */}
      {previewPrescription && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Barre d'outils de la modale */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-bold text-slate-800 text-sm flex items-center">
                <Printer className="w-4 h-4 mr-2 text-emerald-700" />
                Aperçu de l'Ordonnance Médicale
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintPrescription(previewPrescription);
                    window.print();
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPrescription(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Ordonnance Clinique Les Archanges */}
            <div className="p-8 space-y-6 text-slate-900 font-serif">
              {/* En-tête clinique officiel */}
              <div className="border-b-2 border-emerald-800 pb-4 text-center">
                <h1 className="text-xl font-bold tracking-wider text-emerald-900 uppercase">
                  Clinique Les Archanges
                </h1>
                <p className="text-xs text-slate-600 font-sans tracking-wide">
                  À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.
                </p>
                <p className="text-[11px] text-slate-500 font-sans">
                  Téléphone : +243 989 715 771 • Horaires : Ouvert 24h/24 et 7j/7.
                </p>
              </div>

              {/* Renseignements praticien et patient */}
              <div className="grid grid-cols-2 gap-4 text-xs font-sans pb-4 border-b border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block uppercase">Praticien Prescripteur :</span>
                  <span className="text-slate-900 font-semibold">Dr. {previewPrescription.medecin_nom || 'Médecin'}</span>
                  <span className="block text-slate-500">Médecine Générale & Prise en Charge Clinique</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 block uppercase">Date d'émission :</span>
                  <span className="text-slate-900 font-semibold">
                    {new Date(previewPrescription.date_prescription).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="block text-slate-500">Réf : {previewPrescription.id}</span>
                </div>
              </div>

              {/* Titre Ordonnance */}
              <div className="text-center py-2">
                <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 font-sans border-y border-slate-300 py-1 inline-block px-8">
                  ORDONNANCE MÉDICALE
                </h2>
              </div>

              {/* Lignes de traitement */}
              <div className="space-y-4 font-sans text-xs min-h-[180px]">
                {previewPrescription.items && previewPrescription.items.map((item, idx) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {idx + 1}. {item.nom_medicament} {item.dosage ? `— ${item.dosage}` : ''}
                      </span>
                      <span className="font-medium text-slate-600">
                        {item.quantite ? `[ Qté : ${item.quantite} ]` : ''}
                      </span>
                    </div>
                    <p className="text-slate-700 pl-4 font-medium">
                      • {item.forme || 'Comprimé'} ({item.voie_administration || 'Voie orale'}) : {item.frequence || 'Selon prescription'} {item.duree ? `pendant ${item.duree}` : ''}
                    </p>
                    {item.instructions && (
                      <p className="text-slate-500 pl-4 text-[11px] italic">
                        Note : {item.instructions}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {previewPrescription.observations && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs font-sans text-slate-700 border border-slate-200">
                  <span className="font-bold text-slate-900">Conseils hygiéno-diététiques & Recommandations : </span>
                  {previewPrescription.observations}
                </div>
              )}

              {/* Signature du praticien */}
              <div className="pt-8 flex justify-end font-sans">
                <div className="text-center w-56 border-t border-slate-400 pt-2">
                  <p className="text-xs font-bold text-slate-800">Signature et Cachet du Médecin</p>
                  <p className="text-[11px] text-slate-500 italic mt-8">Dr. {previewPrescription.medecin_nom || 'Médecin'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
