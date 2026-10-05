import React, { useState, useEffect, useRef } from 'react';
import { Patient, Visite, Doctor } from '../../types/index.js';
import {
  FileSearch,
  X,
  AlertCircle,
  CheckCircle2,
  User,
  Search,
  Calendar,
  Stethoscope,
  Microscope,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Clock,
  Tag,
  Coins,
  CreditCard
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface InterpretationVisiteModalProps {
  initialPatient?: Patient | null;
  onClose: () => void;
  onSuccess: (visite: Visite) => void;
}

export const InterpretationVisiteModal: React.FC<InterpretationVisiteModalProps> = ({
  initialPatient,
  onClose,
  onSuccess,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, []);
  // Étape 1 : Patient
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);

  // Étape 2 : Dossiers / Consultations du patient
  const [isLoadingDossiers, setIsLoadingDossiers] = useState(false);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);

  // Étape 3 : Éléments / Examens concernés
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [notesComplementaires, setNotesComplementaires] = useState('');

  // Étape 4 : Orientation Médecin
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Orientation externe — retour d'orientation
  const [orientationsPatient, setOrientationsPatient] = useState<any[]>([]);
  const [isLoadingOrientations, setIsLoadingOrientations] = useState(false);
  const [selectedOrientationId, setSelectedOrientationId] = useState<string | null>(null);
  const [selectedOrientation, setSelectedOrientation] = useState<any | null>(null);

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Encaissement Réception (Caisse Directe)
  const [typeEncaissement, setTypeEncaissement] = useState<'COMPLET' | 'PARTIEL' | 'NON_PAYE'>('COMPLET');
  const [devisePaiement, setDevisePaiement] = useState<'USD' | 'FC'>('USD');
  const [modePaiement, setModePaiement] = useState<'ESPECES' | 'MOBILE_MONEY' | 'CARTE_BANCAIRE'>('ESPECES');
  const [montantPayeCustom, setMontantPayeCustom] = useState<string>('');
  const [montantRecuClient, setMontantRecuClient] = useState<string>('');
  const [motifNonPaiement, setMotifNonPaiement] = useState<string>('');

  const tarifInterpretationUsd = 10;
  const exchangeRate = 2850;
  const tarifInterpretationFc = Math.round(tarifInterpretationUsd * exchangeRate);

  const montantPayeNum = montantPayeCustom !== '' 
    ? parseFloat(montantPayeCustom) 
    : (devisePaiement === 'USD' ? tarifInterpretationUsd : tarifInterpretationFc);

  const totalDueInDevise = devisePaiement === 'USD' ? tarifInterpretationUsd : tarifInterpretationFc;
  const soldeRestantUsd = typeEncaissement === 'PARTIEL' 
    ? Math.max(0, tarifInterpretationUsd - (devisePaiement === 'USD' ? (montantPayeNum || 0) : (montantPayeNum || 0) / exchangeRate))
    : (typeEncaissement === 'NON_PAYE' ? tarifInterpretationUsd : 0);

  const monnaieRendue = montantRecuClient && !isNaN(parseFloat(montantRecuClient))
    ? Math.max(0, parseFloat(montantRecuClient) - montantPayeNum)
    : null;

  // Charger la liste des médecins actifs
  useEffect(() => {
    const fetchDoctors = async () => {
      setIsLoadingDoctors(true);
      try {
        const res = await apiFetch('/api/doctors');
        if (res.ok) {
          const data = await res.json();
          setDoctors(data.doctors || []);
        }
      } catch (err) {
        console.error('Erreur chargement médecins:', err);
      } finally {
        setIsLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, []);

  // Recherche de patients si pas de patient initial
  const handleSearchPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingPatient(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch(`/api/patients?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.patients || []);
        if ((data.patients || []).length === 0) {
          setErrorMessage('Aucun patient trouvé avec ce critère de recherche.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la recherche du patient.');
    } finally {
      setIsSearchingPatient(false);
    }
  };

  // Dès qu'un patient est sélectionné, charger ses dossiers pertinents
  useEffect(() => {
    if (!selectedPatient) return;

    const fetchDossiers = async () => {
      setIsLoadingDossiers(true);
      setErrorMessage(null);
      try {
        const res = await apiFetch(`/api/visites/patient/${selectedPatient.id}/interpretation-dossiers`);
        if (res.ok) {
          const data = await res.json();
          setDossiers(data.dossiers || []);
          if (data.dossiers && data.dossiers.length > 0) {
            // Sélectionner par défaut la consultation la plus récente
            const first = data.dossiers[0];
            setSelectedConsultationId(first.id);
            if (first.medecin_id) {
              setSelectedDoctorId(first.medecin_id);
            }
            // Cocher par défaut tous les examens validés ou disponibles de cette consultation
            const elements: string[] = [];
            first.lab_orders?.forEach((lo: any) => {
              lo.analyses?.forEach((an: any) => {
                elements.push(an.nom_analyse);
              });
            });
            setSelectedElements(elements);
          }
        } else {
          const errData = await res.json();
          setErrorMessage(errData.error || 'Erreur lors du chargement des dossiers du patient.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erreur de connexion au serveur.');
      } finally {
        setIsLoadingDossiers(false);
      }
    };

    const fetchOrientations = async () => {
      setIsLoadingOrientations(true);
      setSelectedOrientationId(null);
      setSelectedOrientation(null);
      try {
        const res = await apiFetch(`/api/medical/patients/${selectedPatient.id}/orientations-pending`);
        if (res.ok) {
          const data = await res.json();
          setOrientationsPatient(data.orientations || []);
        }
      } catch {
        // Silently ignore — patient peut n'avoir aucune orientation
      } finally {
        setIsLoadingOrientations(false);
      }
    };

    fetchDossiers();
    fetchOrientations();
  }, [selectedPatient]);

  // Consultation sélectionnée actuelle
  const activeConsultation = dossiers.find((d) => d.id === selectedConsultationId);

  // Changer de consultation sélectionnée
  const handleSelectConsultation = (c: any) => {
    setSelectedConsultationId(c.id);
    if (c.medecin_id) {
      setSelectedDoctorId(c.medecin_id);
    }
    const elements: string[] = [];
    c.lab_orders?.forEach((lo: any) => {
      lo.analyses?.forEach((an: any) => {
        elements.push(an.nom_analyse);
      });
    });
    setSelectedElements(elements);
  };

  // Toggle examen individuel
  const toggleElement = (nom: string) => {
    setSelectedElements((prev) =>
      prev.includes(nom) ? prev.filter((item) => item !== nom) : [...prev, nom]
    );
  };

  // Tout cocher / Tout décocher
  const toggleAllElements = (allNames: string[]) => {
    if (selectedElements.length === allNames.length) {
      setSelectedElements([]);
    } else {
      setSelectedElements([...allNames]);
    }
  };

  // Soumission pour orientation vers le médecin
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setErrorMessage('Veuillez sélectionner un patient.');
      return;
    }

    if (!selectedDoctorId) {
      setErrorMessage('Veuillez sélectionner le médecin vers qui orienter le patient.');
      return;
    }

    if (typeEncaissement === 'NON_PAYE' && (!motifNonPaiement || motifNonPaiement.trim().length < 4)) {
      setErrorMessage('Un motif explicite est strictement obligatoire pour déroger au paiement immédiat (ex: Urgence vitale).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        patient_id: selectedPatient.id,
        consultation_origine_id: selectedConsultationId,
        elements_a_interpreter: selectedElements,
        medecin_id: selectedDoctorId,
        motif_venue: notesComplementaires.trim()
          ? `Interprétation résultats : ${selectedElements.join(', ')} (${notesComplementaires.trim()})`
          : selectedElements.length > 0
          ? `Interprétation des résultats : ${selectedElements.join(', ')}`
          : 'Interprétation des résultats d’analyses',
        reglement_immediat: true,
        type_encaissement: typeEncaissement,
        montant_paye: typeEncaissement === 'NON_PAYE' ? 0 : montantPayeNum,
        devise: devisePaiement,
        mode_paiement: modePaiement,
        motif_non_paiement: typeEncaissement === 'NON_PAYE' ? motifNonPaiement.trim() : undefined,
        orientation_id: selectedOrientationId || undefined
      };

      const res = await apiFetch('/api/visites/interpretation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors de la création de la visite d’interprétation.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de communication avec le serveur.');
      setIsSubmitting(false);
    }
  };

  const allAvailableAnalyses: string[] = [];
  activeConsultation?.lab_orders?.forEach((lo: any) => {
    lo.analyses?.forEach((an: any) => {
      allAvailableAnalyses.push(an.nom_analyse);
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden" id="modal_interpretation_overlay">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden" id="modal_interpretation_container">
        
        {/* En-tête */}
        <div className="shrink-0 bg-gradient-to-r from-purple-800 to-indigo-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <FileSearch className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <span>Nouvelle Visite : Interprétation des Résultats</span>
                <span className="text-[10px] bg-purple-500/40 text-purple-100 px-2 py-0.5 rounded-full font-semibold">
                  {selectedOrientation ? 'Retour d\'orientation' : 'Orientation Médecin'}
                </span>
              </h3>
              <p className="text-xs text-purple-200">
                {selectedOrientation
                  ? `Patient revenant pour interpréter les résultats de l'orientation vers ${selectedOrientation.etablissement_destinataire}.`
                  : 'Patient revenant pour avis médical sur des examens de laboratoire déjà prescrits et réalisés.'
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-purple-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_interpretation">
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Message d'erreur */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

          {/* ÉTAPE 1 : IDENTIFICATION DU PATIENT */}
          {!selectedPatient ? (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Rechercher le patient concerné *
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom, prénom, N° dossier ou téléphone..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchPatient}
                  disabled={isSearchingPatient}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSearchingPatient ? 'Recherche...' : 'Chercher'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto bg-white rounded-lg border border-slate-200">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-2.5 hover:bg-purple-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {p.nom} {p.prenom}
                        </span>
                        <span className="ml-2 font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {p.numero_dossier}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Né(e) le {p.date_naissance} • {p.telephone || 'Sans tél.'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold">
                  {selectedPatient.sexe === 'F' ? 'F' : 'M'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedPatient.nom} {selectedPatient.prenom}
                    </span>
                    <span className="font-mono text-xs bg-purple-200 text-purple-900 px-2 py-0.5 rounded-md font-bold">
                      {selectedPatient.numero_dossier}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Né(e) le {selectedPatient.date_naissance} • Tél : {selectedPatient.telephone || 'Non renseigné'}
                  </p>
                </div>
              </div>
              {!initialPatient && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setDossiers([]);
                    setSelectedConsultationId(null);
                    setSelectedElements([]);
                  }}
                  className="text-xs text-purple-700 hover:text-purple-900 underline font-semibold px-2 py-1"
                >
                  Changer
                </button>
              )}
            </div>
          )}

          {/* ÉTAPE 2 : SÉLECTION DU DOSSIER / CONSULTATION CONCERNÉ */}
          {selectedPatient && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>2. Identifier la consultation d'origine *</span>
                </label>
                {isLoadingDossiers && (
                  <span className="text-[11px] text-purple-600 animate-pulse">Recherche des dossiers...</span>
                )}
              </div>

              {dossiers.length === 0 && !isLoadingDossiers ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  Aucune consultation antérieure enregistrée pour ce patient.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {dossiers.map((c) => {
                    const isSelected = selectedConsultationId === c.id;
                    const totalExamens = c.lab_orders?.reduce(
                      (acc: number, lo: any) => acc + (lo.analyses?.length || 0),
                      0
                    );

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectConsultation(c)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-200'
                            : 'bg-white border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-900">
                                Consultation du {new Date(c.date_consultation).toLocaleDateString('fr-FR')}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                par Dr. {c.medecin_nom}
                              </span>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                {c.numero_visite}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              <strong>Motif :</strong> {c.motif_consultation || 'Consultation médicale'}
                              {c.diagnostic_principal ? ` • Diag : ${c.diagnostic_principal}` : ''}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                              totalExamens > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {totalExamens} examen(s) lié(s)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 3 : SÉLECTION DES ÉLÉMENTS / ANALYSES À INTERPRÉTER */}
          {activeConsultation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Microscope className="w-4 h-4 text-purple-600" />
                  <span>3. Sélectionner les examens concernés *</span>
                </label>
                {allAvailableAnalyses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleAllElements(allAvailableAnalyses)}
                    className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold"
                  >
                    {selectedElements.length === allAvailableAnalyses.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </button>
                )}
              </div>

              {allAvailableAnalyses.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  Aucun examen biologique enregistré dans cette consultation. Vous pouvez préciser les éléments manuellement ci-dessous.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {activeConsultation.lab_orders?.map((lo: any) =>
                    lo.analyses?.map((an: any) => {
                      const isChecked = selectedElements.includes(an.nom_analyse);
                      return (
                        <div
                          key={an.id}
                          onClick={() => toggleElement(an.nom_analyse)}
                          className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            isChecked
                              ? 'bg-purple-100/70 border-purple-400 text-purple-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-purple-700 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs font-semibold">{an.nom_analyse}</span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              an.statut === 'VALIDE' || an.statut === 'TERMINE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {an.statut || 'En attente'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Champ libre complémentaire */}
              <div>
                <input
                  type="text"
                  value={notesComplementaires}
                  onChange={(e) => setNotesComplementaires(e.target.value)}
                  placeholder="Précisions ou examens externes apportés (ex : Scanner externe, Radio thorax...)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* ÉTAPE 3.5 : RETOUR D'ORIENTATION EXTERNE (optionnel) */}
          {selectedPatient && orientationsPatient.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <ArrowRight className="w-4 h-4 text-violet-600" />
                <span>3.5. Retour d'orientation externe (optionnel)</span>
              </label>

              <p className="text-[11px] text-slate-500 mb-1.5">
                Si le patient revient pour interpréter les résultats d'une orientation externe déjà créée, sélectionnez-la ci-dessous.
              </p>

              {isLoadingOrientations ? (
                <div className="text-xs text-slate-400">Chargement des orientations en attente...</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {orientationsPatient.map((o: any) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        if (selectedOrientationId === o.id) {
                          setSelectedOrientationId(null);
                          setSelectedOrientation(null);
                        } else {
                          setSelectedOrientationId(o.id);
                          setSelectedOrientation(o);
                        }
                      }}
                      className={`text-left p-2.5 rounded-lg border transition-colors ${
                        selectedOrientationId === o.id
                          ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200'
                          : 'bg-slate-50 border-slate-200 hover:border-violet-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                            EXTERNE
                          </span>
                          <span className="text-xs font-bold text-slate-900">{o.specialite}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {o.statut === 'ENVOYE' ? 'En attente de CR' : 'CR reçu'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        <strong className="text-slate-700">Établissement : </strong>{o.etablissement_destinataire}
                        {o.praticien_destinataire && <span> — Dr. {o.praticien_destinataire}</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Motif : {o.motif_orientation}
                      </p>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-400 font-mono">N° {o.numero_orientation}</span>
                        <span className="text-[10px] text-slate-400">
                          Créée le {new Date(o.date_orientation).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedOrientation && (
                <div className="p-2.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-800 flex items-start space-x-2">
                  <ArrowRight className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Retour d'orientation externe sélectionnée.</strong>
                    <p className="mt-0.5">Cette orientation sera liée à la visite d'interprétation créée. Les informations originales de l'orientation sont conservées.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 4 : ORIENTATION VERS LE MÉDECIN */}
          {selectedPatient && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <span>4. Orientation vers le Praticien *</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  >
                    <option value="">-- Sélectionner le médecin traitant --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.nom_complet}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Règle d'intégrité :</strong> La réception oriente uniquement. L'interprétation médicale est assurée par le médecin.
                  </span>
                </div>
              </div>
            </div>
          )}

            {/* Prestation & Tarif */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-950 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-700" />
                  <span>Prestation : Interprétation des Résultats</span>
                </span>
                <span className="text-[11px] font-mono text-purple-800 bg-purple-100 px-2 py-0.5 rounded-sm font-semibold">
                  Taux officiel : 1 USD = 2 850 FC
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-purple-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Tarif officiel :</span>
                <div className="text-right">
                  <span className="font-bold font-mono text-purple-900 text-sm">10.00 USD</span>
                  <span className="text-slate-500 text-xs ml-1.5">(28 500 FC)</span>
                </div>
              </div>
            </div>

            {/* SECTION ENCAISSEMENT DIRECT (RÉCEPTION FAISANT OFFICE DE CAISSE) */}
            <div className="bg-purple-950/5 border-2 border-purple-500/40 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-950 flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-purple-700" />
                  <span>Encaissement Réception (Caisse Directe)</span>
                </span>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                  Paiement préalable obligatoire
                </span>
              </div>

              {/* Sélection Type d'encaissement */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTypeEncaissement('COMPLET');
                    setMontantPayeCustom('');
                  }}
                  className={`py-2 px-1.5 rounded-lg font-bold border text-center transition-all ${
                    typeEncaissement === 'COMPLET'
                      ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Payé Total ({devisePaiement === 'USD' ? '10 $' : '28 500 FC'})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeEncaissement('PARTIEL');
                    if (!montantPayeCustom) {
                      setMontantPayeCustom(devisePaiement === 'USD' ? '5' : '14250');
                    }
                  }}
                  className={`py-2 px-1.5 rounded-lg font-bold border text-center transition-all ${
                    typeEncaissement === 'PARTIEL'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Paiement Partiel
                </button>
                <button
                  type="button"
                  onClick={() => setTypeEncaissement('NON_PAYE')}
                  className={`py-2 px-1.5 rounded-lg font-bold border text-center transition-all ${
                    typeEncaissement === 'NON_PAYE'
                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Dérogation / Non Payé
                </button>
              </div>

              {/* Détails du règlement si Payé ou Partiel */}
              {typeEncaissement !== 'NON_PAYE' ? (
                <div className="space-y-2.5 pt-1 border-t border-purple-200/60">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Devise de paiement
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDevisePaiement('USD');
                            setMontantPayeCustom('');
                          }}
                          className={`py-1.5 text-xs font-bold rounded-md border text-center transition-colors ${
                            devisePaiement === 'USD' ? 'bg-purple-700 text-white border-purple-800' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDevisePaiement('FC');
                            setMontantPayeCustom('');
                          }}
                          className={`py-1.5 text-xs font-bold rounded-md border text-center transition-colors ${
                            devisePaiement === 'FC' ? 'bg-purple-700 text-white border-purple-800' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          FC (CDF)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Mode de paiement
                      </label>
                      <select
                        value={modePaiement}
                        onChange={(e: any) => setModePaiement(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-800"
                      >
                        <option value="ESPECES">Espèces (Cash)</option>
                        <option value="MOBILE_MONEY">Mobile Money (M-Pesa, Orange, Airtel)</option>
                        <option value="CARTE_BANCAIRE">Carte Bancaire</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Montant à encaisser ({devisePaiement}) *
                      </label>
                      <input
                        type="number"
                        step={devisePaiement === 'USD' ? '1' : '500'}
                        value={typeEncaissement === 'COMPLET' ? totalDueInDevise : (montantPayeCustom || '')}
                        disabled={typeEncaissement === 'COMPLET'}
                        onChange={(e) => setMontantPayeCustom(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-bold text-slate-900 bg-white border border-purple-400 rounded-md focus:ring-2 focus:ring-purple-500 font-mono disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Montant remis par le patient
                      </label>
                      <input
                        type="number"
                        placeholder="Calcul monnaie"
                        value={montantRecuClient}
                        onChange={(e) => setMontantRecuClient(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                  </div>

                  {monnaieRendue !== null && monnaieRendue > 0 && (
                    <div className="p-2 bg-purple-100/70 border border-purple-300 rounded-lg text-xs flex items-center justify-between">
                      <span className="font-semibold text-purple-900">Monnaie à rendre :</span>
                      <span className="font-mono font-bold text-purple-900 text-sm">
                        {monnaieRendue.toLocaleString('fr-FR')} {devisePaiement}
                      </span>
                    </div>
                  )}

                  {typeEncaissement === 'PARTIEL' && soldeRestantUsd > 0 && (
                    <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-xs flex items-center justify-between">
                      <span className="font-semibold text-amber-900">Solde restant dû :</span>
                      <span className="font-mono font-bold text-amber-900 text-xs">
                        {soldeRestantUsd.toFixed(2)} USD ({Math.round(soldeRestantUsd * exchangeRate).toLocaleString('fr-FR')} FC)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 pt-1 border-t border-rose-200">
                  <label className="block text-[11px] font-semibold text-rose-800">
                    Motif obligatoire de dérogation financière *
                  </label>
                  <input
                    type="text"
                    required
                    value={motifNonPaiement}
                    onChange={(e) => setMotifNonPaiement(e.target.value)}
                    placeholder="Ex: Urgence vitale, Entente administrative, Accord direction..."
                    className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-md focus:ring-2 focus:ring-rose-500 font-medium text-rose-900"
                  />
                  <p className="text-[10px] text-rose-700 italic">
                    * L'admission sera autorisée avec le motif dérogatoire consigné dans le journal financier d'audit.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ACTIONS FIXÉES EN BAS */}
          <div className="shrink-0 bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPatient || !selectedDoctorId}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {isSubmitting ? (
                <span>Validation caisse & orientation...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>
                    {typeEncaissement === 'COMPLET' 
                      ? `Encaisser ${devisePaiement === 'USD' ? '10 $' : '28 500 FC'} & Orienter vers le Médecin`
                      : (typeEncaissement === 'PARTIEL' 
                          ? `Valider Acompte (${montantPayeNum} ${devisePaiement}) & Médecin` 
                          : 'Valider Dérogation & Orienter Médecin')}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
