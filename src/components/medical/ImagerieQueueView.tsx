import React, { useState, useEffect } from 'react';
import {
  Scan, Camera, Activity, Brain, ShieldCheck, AlertCircle,
  Loader, FileText, CheckCircle2, Clock, XCircle,
  UserCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import type { ImagerieDemande, ImagerieDemandeStatut } from '../../types';

interface ImagerieCategorie {
  id: string;
  nom: string;
  description: string;
  icone: string;
  actif: boolean;
}

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

const STATUT_Classes: Record<ImagerieDemandeStatut, string> = {
  DEMANDE_CREEE: 'bg-slate-100 text-slate-700 border-slate-200',
  PRISE_EN_CHARGE: 'bg-blue-100 text-blue-700 border-blue-200',
  EN_REALISATION: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  RESULTATS_A_SAISIR: 'bg-orange-100 text-orange-700 border-orange-200',
  RESULTATS_SAISIS: 'bg-purple-100 text-purple-700 border-purple-200',
  RESULTAT_A_VALIDER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  RESULTATS_VALIDES: 'bg-teal-100 text-teal-700 border-teal-200',
  RESULTAT_VALIDE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  TRANSMIS_AU_MEDECIN: 'bg-green-100 text-green-700 border-green-200',
  TERMINEE: 'bg-gray-100 text-gray-600 border-gray-200',
  ANNULEE: 'bg-red-100 text-red-600 border-red-200'
};

export const ImagerieQueueView: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demandes, setDemandes] = useState<ImagerieDemande[]>([]);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDemande, setSelectedDemande] = useState<ImagerieDemande | null>(null);

  const categories: ImagerieCategorie[] = [
    {
      id: 'radio',
      nom: 'Radiographie',
      description: 'Examens radiologiques standards — Thorax, squelette, abdomen, membres.',
      icone: 'scan',
      actif: true,
    },
    {
      id: 'echo-gen',
      nom: 'Échographie Générale',
      description: 'Échographie abdominale, thyroïde, mammaire, vasculaire et musculo-squelettique.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-pelv',
      nom: 'Échographie Pelvienne',
      description: 'Échographie pelvienne transabdominale et trans-vaginale — organes génitaux féminins et vessie.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-gyn',
      nom: 'Échographie Gynécologique',
      description: 'Bilan gynécologique échographique complet — utérus, annexes, doppler ovarien.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'echo-obs',
      nom: 'Échographie Obstétricale',
      description: 'Suivi de grossesse — datation, anatomie fœtale, dopplers, morphologie.',
      icone: 'camera',
      actif: true,
    },
    {
      id: 'scanner',
      nom: 'Scanner (TDM)',
      description: 'Tomodensitométrie — corps entier, crâne, thorax, abdomen, pelvis, angio-scanner.',
      icone: 'activity',
      actif: true,
    },
    {
      id: 'irm',
      nom: 'IRM',
      description: 'Imagerie par Résonance Magnétique — encéphale, rachis, articulations, abdomen, angio-IRM.',
      icone: 'brain',
      actif: true,
    },
  ];

  const getIcon = (icone: string) => {
    switch (icone) {
      case 'scan':
        return <Scan className="w-8 h-8" />;
      case 'camera':
        return <Camera className="w-8 h-8" />;
      case 'activity':
        return <Activity className="w-8 h-8" />;
      case 'brain':
        return <Brain className="w-8 h-8" />;
      default:
        return <Scan className="w-8 h-8" />;
    }
  };

  const fetchDemandes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/medical/imagerie-demandes', {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setDemandes(data.demandes || []);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandes();
  }, []);

  const filteredDemandes = demandes.filter(d => {
    const matchStatut = filterStatut === 'all' || d.statut === filterStatut;
    const matchSearch = searchTerm === '' ||
      d.patient_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.numero_demande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatut && matchSearch;
  });

  const handleTakeCharge = async (demandeId: string) => {
    try {
      const res = await apiFetch(`/api/medical/imagerie-demande/${demandeId}/take-charge`, {
        method: 'PATCH'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur prise en charge');
      }
      setSuccess('Demande prise en charge avec succès');
      fetchDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRealize = async (demandeId: string) => {
    try {
      const demande = demandes.find(d => d.id === demandeId);
      if (!demande) return;
      const res = await apiFetch(`/api/medical/imagerie-demande/${demandeId}/realize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentaire: demande.commentaire,
          document_url: demande.document_url,
          document_nom: demande.document_nom
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur réalisation');
      }
      setSuccess('Réalisation enregistrée avec succès');
      fetchDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleWriteReport = async (demandeId: string) => {
    try {
      const demande = demandes.find(d => d.id === demandeId);
      if (!demande) return;
      const res = await apiFetch(`/api/medical/imagerie-demande/${demandeId}/write-report`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compte_rendu_texte: demande.compte_rendu_texte,
          compte_rendu_url: demande.compte_rendu_url,
          compte_rendu_nom: demande.compte_rendu_nom
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur rédaction');
      }
      setSuccess('Compte rendu rédigé avec succès');
      fetchDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleValidate = async (demandeId: string) => {
    try {
      const res = await apiFetch(`/api/medical/imagerie-demande/${demandeId}/validate`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur validation');
      }
      setSuccess('Résultat validé avec succès');
      fetchDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAmend = async (demandeId: string) => {
    try {
      const demande = demandes.find(d => d.id === demandeId);
      if (!demande) return;
      const res = await apiFetch(`/api/medical/imagerie-demande/${demandeId}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nouveau_compte_rendu_texte: demande.compte_rendu_texte,
          nouveau_compte_rendu_url: demande.compte_rendu_url,
          nouveau_compte_rendu_nom: demande.compte_rendu_nom,
          motif: demande.amendement_motif || 'Correction du compte rendu'
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur amendement');
      }
      setSuccess('Compte rendu amendé avec succès');
      fetchDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center">
              <Scan className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                Imagerie Médicale
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Demande et suivi des examens d&apos;imagerie — Phase 7.1
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Module actif</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm text-slate-500 font-medium">Chargement des demandes...</p>
        </div>
      ) : (
        <>
          {/* Filtres et recherche */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Rechercher</label>
                <input
                  type="text"
                  placeholder="Patient, numéro demande, dossier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Filtrer par statut</label>
                <select
                  value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="DEMANDE_CREEE">Demande créée</option>
                  <option value="PRISE_EN_CHARGE">Prise en charge</option>
                  <option value="RESULTATS_A_SAISIR">Résultats à saisir</option>
                  <option value="RESULTATS_SAISIS">Résultats saisis</option>
                  <option value="RESULTAT_A_VALIDER">En attente de validation</option>
                  <option value="RESULTAT_VALIDE">Résultat validé</option>
                  <option value="TRANSMIS_AU_MEDECIN">Transmis au médecin</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchDemandes}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualiser
                </button>
              </div>
            </div>
          </div>

          {/* Liste des demandes */}
          <div className="space-y-3">
            {filteredDemandes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Aucune demande d&apos;imagerie trouvée</p>
              </div>
            ) : (
              filteredDemandes.map((demande) => (
                <div
                  key={demande.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUT_Classes[demande.statut as ImagerieDemandeStatut] || 'bg-slate-100'}`}>
                            {STATUT_LIBELLE[demande.statut as ImagerieDemandeStatut] || demande.statut}
                          </span>
                          {demande.urgence === 'URGENTE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              URGENT
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1">
                          {demande.patient_nom} {demande.patient_prenom}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Dossier: {demande.numero_dossier} • Visite: {demande.numero_visite}
                        </p>
                        {demande.indication_clinique && (
                          <p className="text-xs text-slate-600 mt-2 italic">
                            Indication: {demande.indication_clinique}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">{demande.numero_demande}</span>
                        <button
                          onClick={() => setSelectedDemande(selectedDemande?.id === demande.id ? null : demande)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                          {selectedDemande?.id === demande.id ? 'Réduire' : 'Détails'}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Actions selon statut et rôle */}
                    {selectedDemande?.id === demande.id && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                          <div>
                            <span className="font-medium">Médecin prescripteur:</span> {demande.medecin_nom}
                          </div>
                          {demande.medecin_realisateur_id && (
                            <div>
                              <span className="font-medium">Réalisateur:</span> {demande.medecin_realisateur_nom || 'Non assigné'}
                            </div>
                          )}
                          {demande.medecin_validateur_id && (
                            <div>
                              <span className="font-medium">Validateur:</span> {demande.medecin_validateur_nom || 'Non validé'}
                            </div>
                          )}
                          {demande.date_realisation && (
                            <div>
                              <span className="font-medium">Date réalisation:</span> {new Date(demande.date_realisation).toLocaleString('fr-FR')}
                            </div>
                          )}
                          {demande.date_validation && (
                            <div>
                              <span className="font-medium">Date validation:</span> {new Date(demande.date_validation).toLocaleString('fr-FR')}
                            </div>
                          )}
                          {demande.compte_rendu_nom && (
                            <div>
                              <span className="font-medium">Compte rendu:</span> {demande.compte_rendu_nom}
                            </div>
                          )}
                        </div>

                        {/* Actions du service d'imagerie */}
                        {user?.role === 'LABORATOIRE' && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {demande.statut === 'DEMANDE_CREEE' && (
                              <button
                                onClick={() => handleTakeCharge(demande.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
                              >
                                <UserCircle className="w-3 h-3" />
                                Prendre en charge
                              </button>
                            )}
                            {demande.statut === 'PRISE_EN_CHARGE' && (
                              <button
                                onClick={() => handleRealize(demande.id)}
                                className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3" />
                                Réaliser l&apos;examen
                              </button>
                            )}
                            {demande.statut === 'RESULTATS_A_SAISIR' && (
                              <button
                                onClick={() => handleWriteReport(demande.id)}
                                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                Rédiger le compte rendu
                              </button>
                            )}
                            {demande.statut === 'RESULTATS_SAISIS' && (
                              <button
                                onClick={() => {
                                  // Soumettre pour validation
                                }}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                Soumettre pour validation
                              </button>
                            )}
                            {demande.statut === 'RESULTAT_A_VALIDER' && (
                              <button
                                onClick={() => handleValidate(demande.id)}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Valider le résultat
                              </button>
                            )}
                            {demande.statut === 'RESULTAT_VALIDE' && (
                              <button
                                onClick={() => handleAmend(demande.id)}
                                className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Amender le compte rendu
                              </button>
                            )}
                            {demande.statut === 'TRANSMIS_AU_MEDECIN' && (
                              <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Transmis
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
