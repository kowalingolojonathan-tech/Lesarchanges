import React, { useState, useEffect } from 'react';
import { Visite, ReceptionDashboardStats, VisiteStatut } from '../../types/index.js';
import { 
  Users, Activity, Stethoscope, Clock, UserPlus, Search, 
  RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck,
  Heart, Thermometer, Scale, ChevronRight, FileSearch, Printer, Calendar,
  Bell, CreditCard
} from 'lucide-react';
import { TriageVitalsModal } from './TriageVitalsModal.js';
import { AssignDoctorModal } from './AssignDoctorModal.js';
import { NewPatientModal } from './NewPatientModal.js';
import { InterpretationVisiteModal } from './InterpretationVisiteModal';
import { ReceptionPrescriptionsModal } from './ReceptionPrescriptionsModal';
import { ReceptionAppointmentsModal } from './ReceptionAppointmentsModal';
import { apiFetch } from '../../lib/api';

interface ReceptionDashboardViewProps {
  onGoToSearch: () => void;
  onGoToCashier?: () => void;
}

export const ReceptionDashboardView: React.FC<ReceptionDashboardViewProps> = ({ onGoToSearch, onGoToCashier }) => {
  const [stats, setStats] = useState<ReceptionDashboardStats>({
    total_visites_jour: 0,
    attente_triage: 0,
    triage_termine: 0,
    attente_medecin: 0,
    nouveaux_patients_jour: 0,
    total_patients_clinique: 0,
  });

  const [visites, setVisites] = useState<Visite[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ATTENTE_TRIAGE' | 'TRIAGE_TERMINE' | 'ATTENTE_MEDECIN'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedVisiteForVitals, setSelectedVisiteForVitals] = useState<Visite | null>(null);
  const [selectedVisiteForDoctor, setSelectedVisiteForDoctor] = useState<Visite | null>(null);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showInterpretationModal, setShowInterpretationModal] = useState(false);
  const [showPrescriptionsModal, setShowPrescriptionsModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);

  // Charger les statistiques et les visites du jour
  const loadData = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Stats
      const statsRes = await apiFetch('/api/visites/dashboard-stats');
      const statsData = await statsRes.json();
      if (statsRes.ok && statsData.stats) {
        setStats(statsData.stats);
      }

      // Visites du jour
      const res = await apiFetch(`/api/visites?date=${today}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.visites)) {
        setVisites(data.visites);
      }
    } catch (err) {
      console.error('Erreur chargement données accueil:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVitalsSuccess = (updatedVisite: Visite) => {
    setSelectedVisiteForVitals(null);
    loadData();
    // Enchaînement direct fluide du workflow : après triage -> affectation médecin !
    setSelectedVisiteForDoctor(updatedVisite);
  };

  const handleDoctorSuccess = () => {
    setSelectedVisiteForDoctor(null);
    loadData();
  };

  const filteredVisites = visites.filter((v) => {
    if (activeFilter === 'ALL') return true;
    return v.statut === activeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Bandeau d'actions rapides et état de synchronisation */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Guichet d'Accueil & Triage
            </h2>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              V1 Opérationnelle
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dossiers permanents, arrivées du jour, prise de constantes et orientation vers les praticiens.
          </p>
        </div>

        {/* Boutons d'action sur tablette/desktop */}
        <div className="hidden md:flex items-center flex-wrap gap-2 shrink-0">
          <button
            onClick={loadData}
            title="Rafraîchir les données"
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onGoToSearch}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center space-x-1.5"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span>Rechercher Patient</span>
          </button>

          <button
            onClick={() => setShowPrescriptionsModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-sky-900 bg-sky-50 border border-sky-300 hover:bg-sky-100 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
            title="Délivrance et impression des ordonnances"
          >
            <Printer className="w-4 h-4 text-sky-700" />
            <span>Ordonnances</span>
          </button>

          <button
            onClick={() => setShowAppointmentsModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
            title="Planning général des rendez-vous"
          >
            <Calendar className="w-4 h-4 text-indigo-700" />
            <span>Rendez-vous</span>
          </button>

          {onGoToCashier && (
            <button
              onClick={onGoToCashier}
              className="px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <CreditCard className="w-4 h-4 text-emerald-700" />
              <span>Caisse & Paiements</span>
            </button>
          )}

          <button
            onClick={() => setShowNewPatientModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nouveau Patient</span>
          </button>
        </div>
      </div>

      {/* BLOC ACTIONS RAPIDES MOBILE (Mis en évidence sur téléphone Android - Règle 8) */}
      <div className="md:hidden bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Actions Réception Rapides
          </span>
          <button
            onClick={loadData}
            className="p-1 text-slate-500 hover:text-slate-800 rounded"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* 1. Nouveau Patient */}
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="p-3 bg-emerald-700 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 shadow-xs min-h-[56px] active:scale-95 transition-transform"
          >
            <UserPlus className="w-5 h-5" />
            <span>Nouveau Patient</span>
          </button>

          {/* 2. Rendez-vous */}
          <button
            onClick={() => setShowAppointmentsModal(true)}
            className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 hover:bg-indigo-100 min-h-[56px] active:scale-95 transition-transform"
          >
            <Calendar className="w-5 h-5 text-indigo-700" />
            <span>Rendez-vous</span>
          </button>

          {/* 3. Arrivées / Recherche */}
          <button
            onClick={onGoToSearch}
            className="p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 hover:bg-slate-100 min-h-[56px] active:scale-95 transition-transform"
          >
            <Search className="w-5 h-5 text-slate-600" />
            <span>Arrivées / Dossiers</span>
          </button>

          {/* 4. Paiements / Caisse */}
          <button
            onClick={onGoToCashier ? onGoToCashier : () => setShowInterpretationModal(true)}
            className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 hover:bg-emerald-100 min-h-[56px] active:scale-95 transition-transform"
          >
            <CreditCard className="w-5 h-5 text-emerald-700" />
            <span>Paiements / Caisse</span>
          </button>

          {/* 5. Ordonnances */}
          <button
            onClick={() => setShowPrescriptionsModal(true)}
            className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 hover:bg-sky-100 min-h-[56px] active:scale-95 transition-transform"
          >
            <Printer className="w-5 h-5 text-sky-700" />
            <span>Ordonnances</span>
          </button>

          {/* 6. Notifications */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
            className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl font-bold text-xs flex flex-col items-center justify-center text-center space-y-1 hover:bg-amber-100 min-h-[56px] active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5 text-amber-700" />
            <span>Notifications</span>
          </button>
        </div>
      </div>

      {/* Grille des 5 indicateurs clés du jour */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total visites */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Visites Jour</span>
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-md">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{stats.total_visites_jour}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Toutes étapes confondues</span>
        </div>

        {/* En attente Triage */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Attente Triage</span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-md">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2 font-mono">{stats.attente_triage}</p>
          <span className="text-[10px] text-amber-700 mt-1 block">Signes vitaux à mesurer</span>
        </div>

        {/* Triage Terminé */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Triage Fait</span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-2 font-mono">{stats.triage_termine}</p>
          <span className="text-[10px] text-blue-700 mt-1 block">Prêt pour médecin</span>
        </div>

        {/* En attente Médecin */}
        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Attente Médecin</span>
            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-900 mt-2 font-mono">{stats.attente_medecin}</p>
          <span className="text-[10px] text-purple-700 mt-1 block">Médecin affecté</span>
        </div>

        {/* Nouveaux Patients Jour */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nouveaux Dossiers</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2 font-mono">{stats.nouveaux_patients_jour}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Créés aujourd'hui</span>
        </div>

        {/* Total Dossiers Clinique */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Patients</span>
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-md">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{stats.total_patients_clinique}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Fiches permanentes</span>
        </div>
      </div>

      {/* Tableau des Visites du Jour */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Barre des onglets de filtrage */}
        <div className="border-b border-slate-200 px-5 py-3 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mr-2">
              File d'accueil active :
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Toutes ({visites.length})
              </button>
              <button
                onClick={() => setActiveFilter('ATTENTE_TRIAGE')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeFilter === 'ATTENTE_TRIAGE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                En attente Triage ({stats.attente_triage})
              </button>
              <button
                onClick={() => setActiveFilter('TRIAGE_TERMINE')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeFilter === 'TRIAGE_TERMINE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Triage Terminé ({stats.triage_termine})
              </button>
              <button
                onClick={() => setActiveFilter('ATTENTE_MEDECIN')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeFilter === 'ATTENTE_MEDECIN'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                En attente Médecin ({stats.attente_medecin})
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400">
            Date du jour : {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Table desktop (hidden sur mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Heure / Type</th>
                <th className="py-3 px-4">Patient & Dossier Permanent</th>
                <th className="py-3 px-4">Motif de venue</th>
                <th className="py-3 px-4">Constantes & Calculs (Triage)</th>
                <th className="py-3 px-4">Statut & Praticien</th>
                <th className="py-3 px-4 text-right">Actions Requises</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-semibold text-slate-600">Aucune visite dans cette file d'attente.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Utilisez "Nouveau Patient" ou "Rechercher Patient" pour enregistrer une arrivée.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVisites.map((vis) => {
                  const arrivalTime = new Date(vis.date_arrivee).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <tr key={vis.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Heure et Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 text-sm block">{arrivalTime}</span>
                        <div className="flex items-center space-x-1 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                            vis.type_visite === 'URGENCE' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            vis.type_visite === 'CONTROLE' ? 'bg-blue-100 text-blue-800' :
                            vis.type_visite === 'INTERPRETATION_RESULTATS' ? 'bg-purple-100 text-purple-900 border border-purple-300 font-bold' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {vis.type_visite === 'INTERPRETATION_RESULTATS' ? 'INTERPRÉTATION RÉSULTATS' : vis.type_visite}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{vis.numero_visite}</span>
                        </div>
                      </td>

                      {/* Patient & Dossier */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {vis.patient_nom} {vis.patient_prenom}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-xs border border-emerald-200">
                            {vis.numero_dossier}
                          </span>
                          <span>•</span>
                          <span>{vis.patient_sexe === 'M' ? 'Masculin' : 'Féminin'}</span>
                          {vis.patient_telephone && (
                            <>
                              <span>•</span>
                              <span>{vis.patient_telephone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Motif de venue */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="text-slate-700 line-clamp-2">
                          {vis.motif_venue || 'Consultation générale'}
                        </span>
                      </td>

                      {/* Constantes & Calculs */}
                      <td className="py-3.5 px-4">
                        {vis.temperature ? (
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-800">{vis.temperature}°C</span>
                              <span className="text-slate-400">•</span>
                              <span className="font-semibold text-slate-800">{vis.tension_systolique}/{vis.tension_diastolique} mmHg</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-700">{vis.pouls} bpm</span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px]">
                              {vis.pam && (
                                <span className="text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded-xs border border-blue-200 font-mono">
                                  PAM : {vis.pam}
                                </span>
                              )}
                              {vis.imc && (
                                <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-xs border border-emerald-200 font-mono">
                                  IMC : {vis.imc} ({vis.categorie_imc})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200 text-[11px] inline-block font-medium">
                            En attente de constantes
                          </span>
                        )}
                      </td>

                      {/* Statut & Médecin */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          vis.statut === 'ATTENTE_TRIAGE' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          vis.statut === 'TRIAGE_TERMINE' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          vis.statut === 'ATTENTE_MEDECIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          vis.statut === 'EN_CONSULTATION' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {vis.statut === 'ATTENTE_TRIAGE' ? 'En attente de triage' :
                           vis.statut === 'TRIAGE_TERMINE' ? 'Triage terminé' :
                           vis.statut === 'ATTENTE_MEDECIN' ? 'En attente médecin' : vis.statut}
                        </span>

                        <div className="mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            vis.statut_paiement === 'PAYÉ' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : vis.statut_paiement === 'PARTIELLEMENT PAYÉ'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            Paiement : {vis.statut_paiement || 'NON PAYÉ'}
                          </span>
                        </div>

                        {vis.medecin_nom && (
                          <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-1">
                            <Stethoscope className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>Dr. {vis.medecin_nom}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions selon statut */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {vis.statut === 'ATTENTE_TRIAGE' && (
                          <button
                            onClick={() => setSelectedVisiteForVitals(vis)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold transition-colors inline-flex items-center space-x-1 shadow-xs"
                          >
                            <Activity className="w-3.5 h-3.5 mr-1" />
                            <span>Triage / Signes Vitaux</span>
                          </button>
                        )}

                        {vis.statut === 'TRIAGE_TERMINE' && (
                          <button
                            onClick={() => setSelectedVisiteForDoctor(vis)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors inline-flex items-center space-x-1 shadow-xs"
                          >
                            <Stethoscope className="w-3.5 h-3.5 mr-1" />
                            <span>Affecter Médecin</span>
                          </button>
                        )}

                        {vis.statut === 'ATTENTE_MEDECIN' && (
                          <div className="flex items-center justify-end space-x-2">
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                              Prêt pour consultation
                            </span>
                            <button
                              onClick={() => setSelectedVisiteForDoctor(vis)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline"
                              title="Changer de médecin"
                            >
                              Réassigner
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* VUE MOBILE : Cartes empilées sans débordement horizontal (Règle 5) */}
        <div className="md:hidden divide-y divide-slate-200">
          {filteredVisites.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-semibold text-slate-600 text-sm">Aucune visite dans cette file.</p>
              <p className="text-xs text-slate-400 mt-1">Utilisez les boutons d'action rapide ci-dessus pour enregistrer une arrivée.</p>
            </div>
          ) : (
            filteredVisites.map((vis) => {
              const arrivalTime = new Date(vis.date_arrivee).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
              });

              return (
                <div key={vis.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-base leading-tight">
                          {vis.patient_nom} {vis.patient_prenom}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                          vis.patient_sexe === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {vis.patient_sexe}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                        <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {vis.numero_dossier}
                        </span>
                        <span>•</span>
                        <span>Arrivé à <strong className="text-slate-800 font-mono">{arrivalTime}</strong></span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      vis.type_visite === 'URGENCE' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      vis.type_visite === 'INTERPRETATION_RESULTATS' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {vis.type_visite === 'INTERPRETATION_RESULTATS' ? 'INTERPRÉTATION' : vis.type_visite}
                    </span>
                  </div>

                  {/* Motif & Constantes */}
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                    <div>
                      <span className="text-slate-400">Motif :</span>{' '}
                      <span className="font-medium text-slate-800">{vis.motif_venue || 'Consultation générale'}</span>
                    </div>

                    {vis.temperature ? (
                      <div className="text-[11px] text-slate-700 pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-2">
                        <span className="font-medium">🌡️ {vis.temperature}°C</span>
                        <span className="font-medium">🩺 {vis.tension_systolique}/{vis.tension_diastolique} mmHg</span>
                        <span className="font-medium">💓 {vis.pouls} bpm</span>
                        {vis.imc && (
                          <span className="font-mono text-emerald-800 bg-emerald-50 px-1 rounded">
                            IMC: {vis.imc}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 font-medium pt-1">
                        ⚠️ Constantes non encore saisies
                      </div>
                    )}
                  </div>

                  {/* Badges statut & praticien */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        vis.statut === 'ATTENTE_TRIAGE' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        vis.statut === 'TRIAGE_TERMINE' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        vis.statut === 'ATTENTE_MEDECIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {vis.statut === 'ATTENTE_TRIAGE' ? 'Attente triage' :
                         vis.statut === 'TRIAGE_TERMINE' ? 'Triage terminé' :
                         vis.statut === 'ATTENTE_MEDECIN' ? 'Attente médecin' : vis.statut}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        vis.statut_paiement === 'PAYÉ' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {vis.statut_paiement || 'NON PAYÉ'}
                      </span>
                    </div>

                    {vis.medecin_nom && (
                      <span className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                        <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                        Dr. {vis.medecin_nom}
                      </span>
                    )}
                  </div>

                  {/* Boutons d'action tactiles pleines largeurs */}
                  {vis.statut === 'ATTENTE_TRIAGE' && (
                    <button
                      onClick={() => setSelectedVisiteForVitals(vis)}
                      className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs min-h-[44px]"
                    >
                      <Activity className="w-4 h-4" />
                      <span>Prendre Signes Vitaux (Triage)</span>
                    </button>
                  )}

                  {vis.statut === 'TRIAGE_TERMINE' && (
                    <button
                      onClick={() => setSelectedVisiteForDoctor(vis)}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs min-h-[44px]"
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span>Affecter un Médecin</span>
                    </button>
                  )}

                  {vis.statut === 'ATTENTE_MEDECIN' && (
                    <div className="flex items-center justify-between bg-purple-50 p-2.5 rounded-lg border border-purple-200 text-xs">
                      <span className="font-semibold text-purple-900">En attente d'appel médecin</span>
                      <button
                        onClick={() => setSelectedVisiteForDoctor(vis)}
                        className="text-xs text-purple-700 underline font-semibold p-1"
                      >
                        Changer de médecin
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals de flux */}
      {selectedVisiteForVitals && (
        <TriageVitalsModal
          visite={selectedVisiteForVitals}
          onClose={() => setSelectedVisiteForVitals(null)}
          onSuccess={handleVitalsSuccess}
        />
      )}

      {selectedVisiteForDoctor && (
        <AssignDoctorModal
          visite={selectedVisiteForDoctor}
          onClose={() => setSelectedVisiteForDoctor(null)}
          onSuccess={handleDoctorSuccess}
        />
      )}

      {showNewPatientModal && (
        <NewPatientModal
          onClose={() => setShowNewPatientModal(false)}
          onSuccess={() => {
            setShowNewPatientModal(false);
            loadData();
          }}
        />
      )}

      {showInterpretationModal && (
        <InterpretationVisiteModal
          onClose={() => setShowInterpretationModal(false)}
          onSuccess={() => {
            setShowInterpretationModal(false);
            loadData();
          }}
        />
      )}

      {showPrescriptionsModal && (
        <ReceptionPrescriptionsModal
          onClose={() => {
            setShowPrescriptionsModal(false);
            loadData();
          }}
        />
      )}

      {showAppointmentsModal && (
        <ReceptionAppointmentsModal
          onClose={() => {
            setShowAppointmentsModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
