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
  Coins
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

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    fetchDossiers();
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
                  Orientation Médecin
                </span>
              </h3>
              <p className="text-xs text-purple-200">
                Patient revenant pour avis médical sur des examens de laboratoire déjà prescrits et réalisés.
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

          {/* ACTIONS */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPatient || !selectedDoctorId}
              className="px-5 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Validation en cours...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Valider l'Orientation vers le Médecin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
