import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, Users, Clock, CheckCircle2, AlertTriangle, 
  HeartPulse, Activity, ChevronRight, Play, RefreshCw, FileText,
  UserCheck, ShieldCheck, Calendar, ArrowRight, Eye
} from 'lucide-react';
import { DoctorQueueData, Visite, Consultation } from '../../types';
import { ConsultationWorkspaceView } from './ConsultationWorkspaceView';
import { apiFetch } from '../../lib/api';

export const DoctorDashboardView: React.FC = () => {
  const [data, setData] = useState<DoctorQueueData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attente' | 'en_cours' | 'a_finaliser' | 'terminees_jour' | 'dernieres'>('attente');
  
  // Consultation active en cours de travail
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);
  const [startingVisiteId, setStartingVisiteId] = useState<string | null>(null);

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
                    const isStarting = startingVisiteId === v.id;

                    return (
                      <div 
                        key={v.id} 
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 ${
                          isUrgence 
                            ? 'bg-rose-50/40 border-rose-200' 
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isUrgence ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {v.patient_sexe === 'F' ? 'F' : 'M'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-bold text-sm text-slate-900">
                                {v.patient_nom} {v.patient_prenom}
                              </h3>
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                                {v.numero_dossier}
                              </span>
                              {isUrgence && (
                                <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                  URGENCE
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 mt-1">
                              Visite N° <strong className="font-mono text-slate-700">{v.numero_visite}</strong> • Arrivée : {new Date(v.date_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Motif : <span className="italic text-slate-700">{v.motif_venue || 'Non précisé'}</span>
                            </p>

                            {/* Signes vitaux résumés */}
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                <HeartPulse className="w-3.5 h-3.5 mr-1 text-rose-500" />
                                T°: {v.temperature ? `${v.temperature}°C` : '-'}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                TA: {v.tension_systolique && v.tension_diastolique ? `${v.tension_systolique}/${v.tension_diastolique}` : '-'}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                Pouls: {v.pouls ? `${v.pouls} bpm` : '-'}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                SpO2: {v.spo2 ? `${v.spo2}%` : '-'}
                              </span>
                              {v.imc && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  IMC: {v.imc} ({v.categorie_imc || ''})
                                </span>
                              )}
                              {v.douleur !== null && v.douleur !== undefined && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold">
                                  Douleur: {v.douleur}/10
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end md:self-center">
                          <button
                            onClick={() => handleStartConsultation(v.id)}
                            disabled={isStarting}
                            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                          >
                            {isStarting ? (
                              <>
                                <Activity className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Ouverture...
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                                Prendre en charge
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
                        {c.diagnostic_principal && (
                          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md mt-2 inline-block font-medium">
                            Diagnostic en cours : <strong>{c.diagnostic_principal}</strong>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveConsultationId(c.id)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors self-end md:self-center"
                      >
                        Reprendre la consultation
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </button>
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
                      </div>

                      <button
                        onClick={() => setActiveConsultationId(c.id)}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors self-end md:self-center"
                      >
                        Finaliser le dossier
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </button>
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
