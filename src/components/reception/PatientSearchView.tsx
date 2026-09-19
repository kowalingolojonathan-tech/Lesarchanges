import React, { useState, useEffect } from 'react';
import { Patient, Visite } from '../../types/index.js';
import { Search, UserPlus, FilePlus2, User, Phone, Calendar, Heart, AlertCircle, Clock, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { NewPatientModal } from './NewPatientModal.js';
import { NewVisiteModal } from './NewVisiteModal.js';
import { apiFetch } from '../../lib/api';

interface PatientSearchViewProps {
  onVisiteCreated: (visite: Visite) => void;
  onTriageRequested: (visite: Visite) => void;
}

export const PatientSearchView: React.FC<PatientSearchViewProps> = ({ onVisiteCreated, onTriageRequested }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientVisites, setPatientVisites] = useState<Visite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVisites, setIsLoadingVisites] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewVisiteModal, setShowNewVisiteModal] = useState(false);

  // Recherche des patients (debounced ou déclenchée)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await apiFetch(`/api/patients/search?q=${encodeURIComponent(searchTerm.trim())}`);
        const data = await res.json();
        if (res.ok) {
          setSearchResults(data.patients || []);
        } else {
          setErrorMessage(data.error || 'Erreur lors de la recherche.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Erreur réseau.');
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Charger les visites du patient sélectionné
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setIsLoadingVisites(true);
    try {
      const res = await apiFetch(`/api/visites?patient_id=${patient.id}`);
      const data = await res.json();
      if (res.ok) {
        setPatientVisites(data.visites || []);
      }
    } catch (err) {
      console.error('Erreur chargement visites patient:', err);
    } finally {
      setIsLoadingVisites(false);
    }
  };

  const handlePatientCreated = async (newPatient: Patient, createVisiteImmediately: boolean) => {
    setShowNewPatientModal(false);
    setSelectedPatient(newPatient);
    setSearchTerm(newPatient.numero_dossier);
    setSearchResults([newPatient]);

    if (createVisiteImmediately) {
      setShowNewVisiteModal(true);
    }
  };

  const handleVisiteCreated = (createdVisite: Visite) => {
    setShowNewVisiteModal(false);
    onVisiteCreated(createdVisite);
    // Rafraîchir l'historique des visites du patient sélectionné
    if (selectedPatient) {
      handleSelectPatient(selectedPatient);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre d'outils supérieure */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par N° Dossier (ex: ARCH-2026-...), Nom, Prénom, Téléphone (+243...) ou Date de naissance..."
            className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 absolute right-3.5 top-3.5" />
          )}
        </div>

        <button
          onClick={() => setShowNewPatientModal(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 shadow-xs shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Créer un Nouveau Patient</span>
        </button>
      </div>

      {/* Grille principale : Résultats / Fiche sélectionnée */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne gauche : Liste des résultats (4/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Résultats de recherche ({searchResults.length})
              </span>
              {searchTerm && (
                <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                  Filtre : "{searchTerm}"
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {!searchTerm && searchResults.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold text-slate-600">Recherche rapide de dossier permanent</p>
                  <p className="mt-1">Saisissez un nom, un téléphone ou un numéro de dossier ci-dessus.</p>
                </div>
              ) : searchResults.length === 0 && !isLoading ? (
                <div className="p-8 text-center text-slate-500 text-xs space-y-3">
                  <p>Aucun patient ne correspond à cette recherche.</p>
                  <button
                    onClick={() => setShowNewPatientModal(true)}
                    className="px-3 py-1.5 bg-emerald-700 text-white rounded-md text-xs font-semibold hover:bg-emerald-800 transition-colors"
                  >
                    Créer ce patient (Nouveau dossier)
                  </button>
                </div>
              ) : (
                searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-start justify-between ${
                      selectedPatient?.id === patient.id ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {patient.nom} {patient.prenom}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                          patient.sexe === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {patient.sexe}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span className="font-mono font-semibold text-emerald-700">{patient.numero_dossier}</span>
                        <span>•</span>
                        <span>{patient.telephone}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Né(e) le : {patient.date_naissance}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Colonne droite : Détail du dossier permanent & Historique des visites (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPatient ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header patient */}
              <div className="bg-slate-800 text-white p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-base text-white">
                      {selectedPatient.nom.charAt(0)}{selectedPatient.prenom.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">
                        {selectedPatient.nom} {selectedPatient.prenom}
                      </h2>
                      <div className="flex items-center space-x-2 text-xs text-slate-300">
                        <span>Dossier permanent :</span>
                        <span className="font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-sm">
                          {selectedPatient.numero_dossier}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowNewVisiteModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Ouvrir une Nouvelle Visite</span>
                </button>
              </div>

              {/* Informations du dossier */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                  Informations Générales & Données Administratives
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Date de naissance</span>
                    <span className="font-medium text-slate-800">{selectedPatient.date_naissance}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Sexe</span>
                    <span className="font-medium text-slate-800">{selectedPatient.sexe === 'M' ? 'Masculin' : 'Féminin'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Téléphone</span>
                    <span className="font-mono font-medium text-slate-800">{selectedPatient.telephone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Adresse de résidence</span>
                    <span className="font-medium text-slate-800">{selectedPatient.adresse || 'Non renseignée'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Groupe Sanguin</span>
                    <span className="font-bold text-rose-700">{selectedPatient.groupe_sanguin || 'Inconnu'}</span>
                  </div>
                  {selectedPatient.allergies && (
                    <div className="col-span-2 sm:col-span-3 bg-amber-50 p-2.5 rounded-md border border-amber-200 text-amber-900">
                      <span className="font-bold">Allergies connues : </span>
                      <span>{selectedPatient.allergies}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Historique des visites du patient */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>Historique des Épisodes de Soin ({patientVisites.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Dossier unique conservé pour toutes les venues
                  </span>
                </div>

                {isLoadingVisites ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-600" />
                    Chargement de l'historique...
                  </div>
                ) : patientVisites.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs">
                    <p>Aucune visite antérieure enregistrée pour ce dossier.</p>
                    <button
                      onClick={() => setShowNewVisiteModal(true)}
                      className="mt-2 text-emerald-700 font-bold hover:underline"
                    >
                      + Créer la première visite
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {patientVisites.map((vis) => (
                      <div
                        key={vis.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {vis.numero_visite}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              vis.statut === 'ATTENTE_TRIAGE' ? 'bg-amber-100 text-amber-800' :
                              vis.statut === 'TRIAGE_TERMINE' ? 'bg-blue-100 text-blue-800' :
                              vis.statut === 'ATTENTE_MEDECIN' ? 'bg-purple-100 text-purple-800' :
                              vis.statut === 'CLOTUREE' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {vis.statut}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(vis.date_arrivee).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            <span className="text-slate-400">Motif :</span> {vis.motif_venue || 'Consultation standard'}
                          </p>
                          {vis.medecin_nom && (
                            <p className="text-[11px] text-slate-500">
                              Médecin : <span className="font-medium text-slate-700">Dr. {vis.medecin_nom}</span>
                            </p>
                          )}
                        </div>

                        {/* Action si visite en attente */}
                        {vis.statut === 'ATTENTE_TRIAGE' && (
                          <button
                            onClick={() => onTriageRequested(vis)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
                          >
                            Prendre constantes (Triage)
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
              <User className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-700">Sélectionnez un patient</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Cliquez sur un résultat à gauche pour afficher son dossier permanent ou ouvrez une nouvelle fiche patient.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewPatientModal && (
        <NewPatientModal
          onClose={() => setShowNewPatientModal(false)}
          onSuccess={handlePatientCreated}
        />
      )}

      {showNewVisiteModal && selectedPatient && (
        <NewVisiteModal
          patient={selectedPatient}
          onClose={() => setShowNewVisiteModal(false)}
          onSuccess={handleVisiteCreated}
        />
      )}
    </div>
  );
};
