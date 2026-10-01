import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, Users, Clock, CheckCircle2, AlertTriangle, 
  HeartPulse, Activity, ChevronRight, Play, RefreshCw, FileText,
  UserCheck, ShieldCheck, Calendar, ArrowRight, Eye, FileSearch, Microscope,
  Thermometer, Wind, Scale, Ruler, Heart, FlaskConical
} from 'lucide-react';
import { DoctorQueueData, Visite, Consultation } from '../../types';
import { ConsultationWorkspaceView } from './ConsultationWorkspaceView';
import { apiFetch } from '../../lib/api';

interface DoctorDashboardViewProps {
  onNavigate?: (tab: string) => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DoctorQueueData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attente' | 'en_cours' | 'a_finaliser' | 'terminees_jour' | 'dernieres'>('attente');
  
  // Consultation active en cours de travail
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);
  const [startingVisiteId, setStartingVisiteId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Horloge temps réel pour mise à jour continue du compteur d'attente patient
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Calcul du temps d'attente patient et des alertes :
  // < 30 min : normal
  // 30 à 59 min : alerte visuelle
  // ≥ 60 min : alerte forte
  const getWaitingTimeInfo = (orientationIso?: string | null, arrivalIso?: string | null) => {
    const startTime = orientationIso || arrivalIso;
    if (!startTime) {
      return { minutes: 0, formattedDuration: '0 min', alertLevel: 'normal' as const, timeStr: '--:--' };
    }
    const startDate = new Date(startTime);
    const diffMs = currentTime - startDate.getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    
    let formattedDuration = `${minutes} min`;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      formattedDuration = `${hours}h ${String(mins).padStart(2, '0')} min (${minutes} min)`;
    }

    const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let alertLevel: 'normal' | 'visuelle' | 'forte' = 'normal';
    if (minutes >= 60) {
      alertLevel = 'forte';
    } else if (minutes >= 30) {
      alertLevel = 'visuelle';
    }

    return { minutes, formattedDuration, alertLevel, timeStr };
  };

  const fetchDoctorQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/medical/queue');

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Impossible de récupérer la file d’attente médecin');
      }

      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de la file d’attente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorQueue();
  }, []);

  // Action : Prendre en charge un patient en attente (commence ou reprend la consultation)
  const handleStartConsultation = async (visiteId: string) => {
    setStartingVisiteId(visiteId);
    setError(null);
    try {
      const res = await apiFetch('/api/medical/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visite_id: visiteId })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Erreur lors de l’ouverture de la consultation');
      }

      if (resData.consultation?.id) {
        setActiveConsultationId(resData.consultation.id);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de démarrer la consultation.');
    } finally {
      setStartingVisiteId(null);
    }
  };

  // Si une consultation est active, afficher le poste de travail clinique
  if (activeConsultationId) {
    return (
      <ConsultationWorkspaceView
        consultationId={activeConsultationId}
        onBack={() => {
          setActiveConsultationId(null);
          fetchDoctorQueue();
        }}
        onConsultationFinalized={() => {
          fetchDoctorQueue();
        }}
      />
    );
  }

  // Rendu modulaire complet de tous les signes vitaux saisis chacun séparément + calculs
  const renderVitalsBadges = (v: any) => {
    const diffTension = v.pression_pulsee ?? (
      v.tension_systolique && v.tension_diastolique ? v.tension_systolique - v.tension_diastolique : null
    );

    const hasAnyVitals = v.temperature !== undefined || v.tension_systolique || v.pouls || v.spo2 || v.poids;
    if (!hasAnyVitals) return null;

    return (
      <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-slate-500 mr-0.5 text-[10px] uppercase tracking-wider">
            Constantes Saisies :
          </span>

          {/* Température */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60 font-medium">
            <Thermometer className="w-3 h-3 mr-1 text-amber-500 shrink-0" />
            T° : <strong className="ml-1 font-bold">{v.temperature !== undefined && v.temperature !== null ? `${v.temperature}°C` : '-'}</strong>
          </span>

          {/* PAS */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200/60 font-medium">
            <Activity className="w-3 h-3 mr-1 text-rose-500 shrink-0" />
            PAS : <strong className="ml-1 font-bold">{v.tension_systolique ? `${v.tension_systolique}` : '-'}</strong>&nbsp;mmHg
          </span>

          {/* PAD */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200/60 font-medium">
            <Activity className="w-3 h-3 mr-1 text-indigo-500 shrink-0" />
            PAD : <strong className="ml-1 font-bold">{v.tension_diastolique ? `${v.tension_diastolique}` : '-'}</strong>&nbsp;mmHg
          </span>

          {/* Pouls */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200/60 font-medium">
            <Heart className="w-3 h-3 mr-1 text-rose-500 shrink-0" />
            Pouls : <strong className="ml-1 font-bold">{v.pouls ? `${v.pouls} bpm` : '-'}</strong>
          </span>

          {/* SpO2 */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200/60 font-medium">
            <ShieldCheck className="w-3 h-3 mr-1 text-blue-500 shrink-0" />
            SpO₂ : <strong className="ml-1 font-bold">{v.spo2 ? `${v.spo2}%` : '-'}</strong>
          </span>

          {/* FR */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200/60 font-medium">
            <Wind className="w-3 h-3 mr-1 text-sky-500 shrink-0" />
            FR : <strong className="ml-1 font-bold">{v.frequence_respiratoire ? `${v.frequence_respiratoire}/min` : '-'}</strong>
          </span>

          {/* Poids */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200/60 font-medium">
            <Scale className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
            Poids : <strong className="ml-1 font-bold">{v.poids ? `${v.poids} kg` : '-'}</strong>
          </span>

          {/* Taille */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200/60 font-medium">
            <Ruler className="w-3 h-3 mr-1 text-teal-600 shrink-0" />
            Taille : <strong className="ml-1 font-bold">{v.taille ? `${v.taille} cm` : '-'}</strong>
          </span>

          {/* Douleur */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200/60 font-medium">
            <HeartPulse className="w-3 h-3 mr-1 text-rose-500 shrink-0" />
            Douleur : <strong className="ml-1 font-bold">{v.douleur !== null && v.douleur !== undefined ? `${v.douleur}/10` : '-'}</strong>
          </span>
        </div>

        {/* Paramètres & indices calculés */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
          <span className="font-bold text-slate-500 mr-0.5 text-[10px] uppercase tracking-wider">
            Calculs :
          </span>

          {v.pam && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-900 border border-indigo-200/70 font-medium">
              PAM : <strong className="ml-1">{v.pam} mmHg</strong>
            </span>
          )}

          {diffTension !== null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              Diff. : <strong className="ml-1">{diffTension} mmHg</strong>
            </span>
          )}

          {v.imc && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50/80 text-emerald-900 border border-emerald-200/70 font-medium">
              IMC : <strong className="ml-1">{v.imc} kg/m²</strong> {v.categorie_imc ? `(${v.categorie_imc})` : ''}
            </span>
          )}

          {v.surface_corporelle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50/80 text-teal-900 border border-teal-200/70 font-medium">
              SC : <strong className="ml-1">{v.surface_corporelle} m²</strong>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* En-tête Espace Médecin */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">Espace Médical & Consultations</h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Corps Médical
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Praticien connecté : <strong className="text-slate-800">{data?.doctor?.nom_complet || 'Médecin Traitant'}</strong>
              <span className="mx-2">•</span>
              File personnelle hermétique (Dr A ≠ Dr B)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDoctorQueue}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Rafraîchir la file"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Barre d'accès rapide Médecin (Mobile & Desktop - Règle 9) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Accès Rapide Médecin</span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Poste Clinique</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {/* Patients */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('reception-patients') : null}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <Users className="w-5 h-5 text-slate-700 group-hover:text-emerald-700 mb-1" />
            <span className="text-xs font-bold text-slate-800">Patients</span>
            <span className="text-[10px] text-slate-400">Dossiers</span>
          </button>

          {/* Rendez-vous */}
          <button
            type="button"
            onClick={() => setActiveTab('attente')}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <Calendar className="w-5 h-5 text-slate-700 group-hover:text-blue-700 mb-1" />
            <span className="text-xs font-bold text-slate-800">Rendez-vous</span>
            <span className="text-[10px] text-slate-400">Arrivées du jour</span>
          </button>

          {/* Consultations */}
          <button
            type="button"
            onClick={() => setActiveTab('en_cours')}
            className="p-2.5 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <Stethoscope className="w-5 h-5 text-blue-700 mb-1" />
            <span className="text-xs font-bold text-blue-900">Consultations</span>
            <span className="text-[10px] text-blue-600 font-semibold">{data?.stats?.en_cours || 0} active(s)</span>
          </button>

          {/* Ordonnances */}
          <button
            type="button"
            onClick={() => setActiveTab('terminees_jour')}
            className="p-2.5 bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <FileText className="w-5 h-5 text-emerald-700 mb-1" />
            <span className="text-xs font-bold text-emerald-900">Ordonnances</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Historique</span>
          </button>

          {/* Laboratoire */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('lab-worklist') : null}
            className="p-2.5 bg-purple-50/60 hover:bg-purple-100/80 border border-purple-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <FlaskConical className="w-5 h-5 text-purple-700 mb-1" />
            <span className="text-xs font-bold text-purple-900">Laboratoire</span>
            <span className="text-[10px] text-purple-600 font-semibold">Examens</span>
          </button>

          {/* Finalisation */}
          <button
            type="button"
            onClick={() => setActiveTab('a_finaliser')}
            className="p-2.5 bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200 rounded-xl flex flex-col items-center justify-center text-center transition-all min-h-[48px] group"
          >
            <CheckCircle2 className="w-5 h-5 text-amber-700 mb-1" />
            <span className="text-xs font-bold text-amber-900">Finalisation</span>
            <span className="text-[10px] text-amber-700 font-bold">{data?.stats?.a_finaliser || 0} en attente</span>
          </button>
        </div>
      </div>

      {/* Cartes métriques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <button
          onClick={() => setActiveTab('attente')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'attente' 
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Triage OK
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data?.stats?.attente || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Patients en Attente
          </div>
        </button>

        <button
          onClick={() => setActiveTab('en_cours')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'en_cours' 
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <Activity className="w-5 h-5" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Actives
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data?.stats?.en_cours || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Consultations en Cours
          </div>
        </button>

        <button
          onClick={() => setActiveTab('a_finaliser')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'a_finaliser' 
              ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              Brouillons
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data?.stats?.a_finaliser || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            À Finaliser
          </div>
        </button>

        <button
          onClick={() => setActiveTab('terminees_jour')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'terminees_jour' 
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Aujourd'hui
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data?.stats?.terminees_jour || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Terminées du Jour
          </div>
        </button>

      </div>

      {/* Onglets de sélection de vue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 overflow-x-auto gap-2">
          
          <button
            onClick={() => setActiveTab('attente')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'attente'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Patients en Attente</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {data?.queue?.attente?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('en_cours')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'en_cours'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Consultations en Cours</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {data?.queue?.en_cours?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('a_finaliser')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'a_finaliser'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>À Finaliser</span>
            <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {data?.queue?.a_finaliser?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('terminees_jour')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'terminees_jour'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Terminées Aujourd'hui</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {data?.queue?.terminees_jour?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dernieres')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'dernieres'
                ? 'border-slate-700 text-slate-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Dernières Consultations</span>
          </button>

        </div>

        {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}
        <div className="p-6">
          
          {loading && (
            <div className="py-16 text-center text-sm text-slate-500">
              <Activity className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              Actualisation de la file d'attente...
            </div>
          )}

          {/* VUE 1 : PATIENTS EN ATTENTE (ATTENTE_MEDECIN) */}
          {!loading && activeTab === 'attente' && (
            <div className="space-y-4">
              {data?.queue?.attente && data.queue.attente.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.queue.attente.map((v: any) => {
                    const isUrgence = v.type_visite === 'URGENCE';
                    const isInterpretation = v.type_visite === 'INTERPRETATION_RESULTATS';
                    const isStarting = startingVisiteId === v.id;

                    return (
                      <div 
                        key={v.id} 
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 ${
                          isUrgence 
                            ? 'bg-rose-50/40 border-rose-200' 
                            : isInterpretation
                            ? 'bg-purple-50/30 border-purple-200 hover:border-purple-300'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isUrgence ? 'bg-rose-100 text-rose-700' : isInterpretation ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {v.patient_sexe === 'F' ? 'F' : 'M'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="font-bold text-sm text-slate-900">
                                {v.patient_nom} {v.patient_prenom}
                              </h3>
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                                {v.numero_dossier}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                v.statut_paiement === 'PAYÉ' 
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                  : v.statut_paiement === 'PARTIELLEMENT PAYÉ'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                {v.statut_paiement === 'PAYÉ' ? 'PAYÉ' : v.statut_paiement === 'PARTIELLEMENT PAYÉ' ? 'PARTIELLEMENT PAYÉ' : 'NON PAYÉ'}
                              </span>
                              {isUrgence && (
                                <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                  URGENCE
                                </span>
                              )}
                              {isInterpretation && (
                                <span className="bg-purple-700 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center shadow-xs">
                                  <FileSearch className="w-3 h-3 mr-1" />
                                  <span>INTERPRÉTATION RÉSULTATS</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 mt-1">
                              Visite N° <strong className="font-mono text-slate-700">{v.numero_visite}</strong> • Arrivée : {new Date(v.date_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Motif : <span className="italic text-slate-700">{v.motif_venue || 'Non précisé'}</span>
                            </p>

                            {/* COMPTEUR EN TEMPS RÉEL DU TEMPS D'ATTENTE PATIENT (ORIENTATION -> PRISE EN CHARGE) */}
                            <div className="mt-2">
                              {(() => {
                                const wait = getWaitingTimeInfo(v.heure_orientation, v.date_arrivee);

                                if (wait.alertLevel === 'forte') {
                                  return (
                                    <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-950 border-2 border-rose-500 ring-2 ring-rose-400/40 animate-pulse text-xs font-black shadow-xs">
                                      <div className="flex items-center space-x-1.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                                        <span>🚨 Attente : {wait.formattedDuration}</span>
                                      </div>
                                      <span className="bg-rose-700 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                                        Alerte forte (≥ 60 min)
                                      </span>
                                      <span className="text-rose-800 text-[11px] font-medium border-l border-rose-300 pl-2">
                                        Orienté à {wait.timeStr}
                                      </span>
                                    </div>
                                  );
                                }

                                if (wait.alertLevel === 'visuelle') {
                                  return (
                                    <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-400 ring-1 ring-amber-400/50 text-xs font-bold shadow-2xs">
                                      <div className="flex items-center space-x-1.5">
                                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                                        <span>⚠️ Attente : {wait.formattedDuration}</span>
                                      </div>
                                      <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                        Alerte visuelle (30–59 min)
                                      </span>
                                      <span className="text-amber-800 text-[11px] font-normal border-l border-amber-300 pl-2">
                                        Orienté à {wait.timeStr}
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-semibold">
                                    <div className="flex items-center space-x-1.5">
                                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>⏱️ Attente : {wait.formattedDuration}</span>
                                    </div>
                                    <span className="bg-emerald-200 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-medium">
                                      Normal (&lt; 30 min)
                                    </span>
                                    <span className="text-emerald-700 text-[11px] font-normal border-l border-emerald-200 pl-2">
                                      Orienté à {wait.timeStr}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Examens ciblés si interprétation */}
                            {v.elements_a_interpreter && (
                              <div className="mt-1.5 text-xs text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 inline-flex items-center space-x-1.5 font-medium">
                                <Microscope className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>
                                  Examens ciblés : {(() => {
                                    try {
                                      const parsed = JSON.parse(v.elements_a_interpreter);
                                      return Array.isArray(parsed) ? parsed.join(', ') : v.elements_a_interpreter;
                                    } catch {
                                      return v.elements_a_interpreter;
                                    }
                                  })()}
                                </span>
                              </div>
                            )}

                            {/* Signes vitaux & Calculs résumés */}
                            {renderVitalsBadges(v)}
                          </div>
                        </div>

                        <div className="w-full md:w-auto flex items-center justify-end pt-2 md:pt-0">
                          <button
                            onClick={() => handleStartConsultation(v.id)}
                            disabled={isStarting}
                            className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
                          >
                            {isStarting ? (
                              <>
                                <Activity className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Ouverture du poste...
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                                Prendre en charge la consultation
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Aucun patient en attente pour le moment dans votre file.
                </div>
              )}
            </div>
          )}

          {/* VUE 2 : CONSULTATIONS EN COURS */}
          {!loading && activeTab === 'en_cours' && (
            <div className="space-y-4">
              {data?.queue?.en_cours && data.queue.en_cours.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.queue.en_cours.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-slate-900">
                            {c.patient_nom} {c.patient_prenom}
                          </h3>
                          <span className="font-mono text-xs bg-white text-slate-700 px-2 py-0.5 rounded-md border font-semibold">
                            {c.numero_dossier}
                          </span>
                          <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {c.statut}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Visite N° <strong className="font-mono text-slate-700">{c.numero_visite}</strong> • Motif : <span className="italic text-slate-700">{c.motif_consultation || 'Consultation générale'}</span>
                        </p>

                        {/* Traçabilité des temps : Temps d'attente arrêté & Durée en direct */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {c.heure_orientation && c.heure_prise_en_charge && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                              <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              Attente arrêtée : <strong className="ml-1">{Math.max(0, Math.round((new Date(c.heure_prise_en_charge).getTime() - new Date(c.heure_orientation).getTime()) / 60000))} min</strong>
                              <span className="text-[10px] text-amber-700 ml-1">
                                ({new Date(c.heure_orientation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(c.heure_prise_en_charge).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </span>
                          )}
                          {c.heure_debut_consultation && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 border border-blue-200 font-medium">
                              <Stethoscope className="w-3.5 h-3.5 mr-1 text-blue-600" />
                              Consultation en cours : <strong className="ml-1">{Math.max(0, Math.floor((currentTime - new Date(c.heure_debut_consultation).getTime()) / 60000))} min</strong>
                              <span className="text-[10px] text-blue-700 ml-1">
                                (débutée à {new Date(c.heure_debut_consultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </span>
                          )}
                        </div>
                        {c.diagnostic_principal && (
                          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md mt-2 inline-block font-medium">
                            Diagnostic en cours : <strong>{c.diagnostic_principal}</strong>
                          </div>
                        )}

                        {/* Signes vitaux complets */}
                        {renderVitalsBadges(c)}
                      </div>

                      <div className="w-full md:w-auto flex items-center justify-end pt-2 md:pt-0">
                        <button
                          onClick={() => setActiveConsultationId(c.id)}
                          className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors min-h-[44px]"
                        >
                          <span>Reprendre la consultation</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Aucune consultation active en cours actuellement.
                </div>
              )}
            </div>
          )}

          {/* VUE 3 : À FINALISER */}
          {!loading && activeTab === 'a_finaliser' && (
            <div className="space-y-4">
              {data?.queue?.a_finaliser && data.queue.a_finaliser.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.queue.a_finaliser.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-slate-900">
                            {c.patient_nom} {c.patient_prenom}
                          </h3>
                          <span className="font-mono text-xs bg-white text-slate-700 px-2 py-0.5 rounded-md border font-semibold">
                            {c.numero_dossier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Visite N° <strong className="font-mono text-slate-700">{c.numero_visite}</strong> • Motif : <span className="italic text-slate-700">{c.motif_consultation}</span>
                        </p>

                        {/* Signes vitaux complets */}
                        {renderVitalsBadges(c)}
                      </div>

                      <div className="w-full md:w-auto flex items-center justify-end pt-2 md:pt-0">
                        <button
                          onClick={() => setActiveConsultationId(c.id)}
                          className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors min-h-[44px]"
                        >
                          <span>Finaliser le dossier</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  Tous vos dossiers cliniques en cours sont finalisés !
                </div>
              )}
            </div>
          )}

          {/* VUE 4 : TERMINÉES DU JOUR */}
          {!loading && activeTab === 'terminees_jour' && (
            <div className="space-y-4">
              {data?.queue?.terminees_jour && data.queue.terminees_jour.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.queue.terminees_jour.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-slate-900">
                            {c.patient_nom} {c.patient_prenom}
                          </h3>
                          <span className="font-mono text-xs bg-white text-slate-700 px-2 py-0.5 rounded-md border font-semibold">
                            {c.numero_dossier}
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            FINALISÉE
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Diagnostic : <strong className="text-emerald-900">{c.diagnostic_principal || 'Non renseigné'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Finalisée à {c.finalisee_le ? new Date(c.finalisee_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {c.heure_orientation && c.heure_prise_en_charge && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              Attente : <strong className="ml-1">{Math.max(0, Math.round((new Date(c.heure_prise_en_charge).getTime() - new Date(c.heure_orientation).getTime()) / 60000))} min</strong>
                            </span>
                          )}
                          {c.heure_debut_consultation && (c.heure_fin_consultation || c.finalisee_le) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-[11px]">
                              <Stethoscope className="w-3 h-3 mr-1 text-blue-600" />
                              Consultation : <strong className="ml-1">{Math.max(0, Math.round((new Date(c.heure_fin_consultation || c.finalisee_le).getTime() - new Date(c.heure_debut_consultation).getTime()) / 60000))} min</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveConsultationId(c.id)}
                        className="inline-flex items-center px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors self-end md:self-center"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        Consulter le dossier
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Aucune consultation finalisée aujourd'hui pour l'instant.
                </div>
              )}
            </div>
          )}

          {/* VUE 5 : DERNIÈRES CONSULTATIONS DU PRATICIEN */}
          {!loading && activeTab === 'dernieres' && (
            <div className="space-y-4">
              {data?.queue?.dernieres_consultations && data.queue.dernieres_consultations.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.queue.dernieres_consultations.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-slate-900">
                            {c.patient_nom} {c.patient_prenom}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ({c.numero_dossier})
                          </span>
                          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                            c.statut === 'FINALISEE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {c.statut}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Date : {new Date(c.date_consultation).toLocaleDateString('fr-FR')} • Diag : <strong className="text-slate-700">{c.diagnostic_principal || 'Non renseigné'}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveConsultationId(c.id)}
                        className="inline-flex items-center px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors self-end md:self-center"
                      >
                        <Eye className="w-3 h-3 mr-1 text-slate-500" />
                        Ouvrir
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  Aucune consultation enregistrée.
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
