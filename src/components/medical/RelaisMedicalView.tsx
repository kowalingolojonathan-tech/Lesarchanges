import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  UserCheck,
  UserX,
  AlertCircle,
  Loader,
  ArrowRight,
  Clock,
  FileText,
  Users,
  Stethoscope,
  History,
  Plus,
  X,
  UserPlus,
  Eye,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { RelaisMedical } from '../../types/index.js';

interface RelaisItem extends RelaisMedical {
  can_act: boolean;
  is_originator: boolean;
  numero_visite?: string;
  date_arrivee?: string;
  motif_consultation?: string;
  diagnostic_principal?: string;
  active_consultation_id?: string;
  active_medecin_id?: string;
  active_medecin_nom?: string;
  active_statut?: string;
  active_date?: string;
}

interface RelaisMedicalViewProps {
  userRole?: string;
  userId?: string;
  userName?: string;
  onNavigate?: (tab: string) => void;
}

export const RelaisMedicalView: React.FC<RelaisMedicalViewProps> = ({ userRole, userId, userName, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'reprise' | 'history'>('pending');
  const [pending, setPending] = useState<RelaisItem[]>([]);
  const [reprise, setReprise] = useState<RelaisItem[]>([]);
  const [history, setHistory] = useState<RelaisItem[]>([]);
  const [inProgress, setInProgress] = useState<RelaisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    consultation_id: '',
    motif: '',
    medecin_destinataire_id: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [destinataires, setDestinataires] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [patientRelaisHistory, setPatientRelaisHistory] = useState<Record<string, RelaisItem[]>>({});
  const currentUserId = userId || '';

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendRes, repRes, histRes, docRes, queueRes, progRes] = await Promise.all([
        api.get<{ relais: any[] }>('/api/medical/relais/pending'),
        api.get<{ relais: any[] }>('/api/medical/relais/patients-to-reprise'),
        api.get<{ relais: any[] }>('/api/medical/relais/history'),
        api.get<any>('/api/doctors'),
        api.get<any>('/api/medical/queue'),
        api.get<{ relais: any[] }>('/api/medical/relais/patients-in-progress'),
      ]);
      setPending(
        (pendRes.relais || []).map((r) => ({
          ...r,
          can_act: !r.medecin_destinataire_id || r.medecin_destinataire_id === currentUserId,
          is_originator: r.medecin_origine_id === currentUserId,
        }))
      );
      setReprise(
        (repRes.relais || []).map((r) => ({
          ...r,
          can_act: r.accepte_par_id === currentUserId,
          is_originator: r.medecin_origine_id === currentUserId,
        }))
      );
      setHistory(
        (histRes.relais || []).map((r) => ({
          ...r,
          can_act: false,
          is_originator: r.medecin_origine_id === currentUserId,
        }))
      );
      setInProgress(
        (progRes.relais || []).map((r) => ({
          ...r,
          can_act: false,
          is_originator: r.medecin_origine_id === currentUserId,
        }))
      );
      setDestinataires(docRes?.doctors || []);
      if (queueRes.queue && queueRes.queue.dernieres_consultations) {
        setConsultations(queueRes.queue.dernieres_consultations);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientHistory = async (patientId: string) => {
    try {
      const res = await api.get<{ relais: any[] }>(`/api/medical/relais/patient/${patientId}`);
      setPatientRelaisHistory((prev) => ({
        ...prev,
        [patientId]: (res.relais || []).map((r) => ({
          ...r,
          can_act: false,
          is_originator: r.medecin_origine_id === currentUserId,
        })),
      }));
    } catch {
      // silent fail
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await api.post(`/api/medical/relais/${id}/accept`);
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Échec de l\'acceptation');
    }
  };

  const handleRefuse = async (id: string) => {
    if (!confirm('Confirmer le refus de ce relais médical ?')) return;
    try {
      await api.post(`/api/medical/relais/${id}/refuse`);
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Échec du refus');
    }
  };

  const handleStartConsultation = async (relaisId: string, visiteId: string) => {
    setStartingId(relaisId);
    try {
      const res: any = await api.post(`/api/medical/relais/${relaisId}/start-consultation`, {
        visite_id: visiteId,
      });
      if (res.consultation_id && onNavigate) {
        onNavigate('doctor-consultations');
      }
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Échec de la création de la consultation');
    } finally {
      setStartingId(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.consultation_id || !createForm.motif.trim()) {
      setCreateError('Veuillez remplir l\'ID de consultation et le motif.');
      return;
    }
    if (createForm.motif.trim().length < 5) {
      setCreateError('Le motif doit contenir au moins 5 caractères.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/api/medical/relais/create', {
        consultation_id: createForm.consultation_id,
        motif: createForm.motif,
        medecin_destinataire_id: createForm.medecin_destinataire_id || null,
      });
      setShowCreateModal(false);
      setCreateForm({ consultation_id: '', motif: '', medecin_destinataire_id: '' });
      await loadAll();
    } catch (e: any) {
      setCreateError(e.message || 'Échec de la création');
    } finally {
      setCreating(false);
    }
  };

  const getStatutLabel = (statut: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      EN_ATTENTE: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En attente' },
      ACCEPTÉ: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Accepté' },
      REFUSÉ: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé' },
      ANNULÉ: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Annulé' },
      EN_COURS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En cours' },
    };
    const s = map[statut] || map['EN_ATTENTE'];
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const formatDateTime = (dt: string | null | undefined) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('fr-FR', { hour12: false });
  };

  const getActiveConsultation = (patientId: string) => {
    const item = inProgress.find((r) => r.patient_id === patientId && r.active_consultation_id);
    if (item && item.active_medecin_nom) {
      return { id: item.active_consultation_id, nom: item.active_medecin_nom, date: item.active_date };
    }
    return null;
  };

  const getPatientHistory = (patientId: string): RelaisItem[] => {
    return patientRelaisHistory[patientId] || [];
  };

  const renderPending = () => {
    const items = pending.filter((r) => r.statut === 'EN_ATTENTE');
    return (
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun relais médical en attente</p>
          </div>
        ) : (
          items.map((r) => {
            const active = getActiveConsultation(r.patient_id);
            const history = getPatientHistory(r.patient_id);
            const showHistory = history.length > 0;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatutLabel(r.statut)}
                      <span className="text-xs text-slate-500 font-mono">{r.numero_dossier || r.patient_id}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{r.patient_nom} {r.patient_prenom}</span>
                      {r.patient_sexe && (
                        <span className="text-xs text-slate-500">{r.patient_sexe === 'M' ? 'Homme' : 'Femme'}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />Médecin origine: {r.medecin_origine_nom || r.medecin_origine_id}</span>
                      {r.medecin_destinataire_id && (
                        <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />Destinataire: {r.medecin_destinataire_nom || r.medecin_destinataire_id}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Visite N°{r.numero_visite || r.visite_id}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 mb-2">
                      <div className="text-xs text-slate-500 mb-1">Motif du relais</div>
                      <div className="text-sm text-slate-800">{r.motif}</div>
                    </div>
                    {active && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-2 flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="text-xs text-rose-700 font-semibold">Dossier actuellement en cours de prise en charge par :</span>
                          <span className="text-xs text-rose-900 font-bold ml-1">{active.nom}</span>
                          <span className="text-xs text-rose-500 ml-1">· consultation {active.id}</span>
                        </div>
                      </div>
                    )}
                    {r.actions_realisees && (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />Actions: {r.actions_realisees}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Créé le {formatDateTime(r.created_at)}
                    </div>
                    {showHistory && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1">
                          <History className="w-3 h-3" />Parcours du patient ({history.length} relais)
                        </summary>
                        <div className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
                          {history.map((h: RelaisItem) => (
                            <div key={h.id} className="flex items-center gap-2 text-slate-600">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                h.statut === 'ACCEPTÉ' ? 'bg-emerald-100 text-emerald-800' :
                                h.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-800' :
                                h.statut === 'REFUSÉ' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>{h.statut}</span>
                              <span>Dr. {h.medecin_origine_nom || h.medecin_origine_id}</span>
                              {h.medecin_destinataire_id && <span>→ Dr. {h.medecin_destinataire_nom || h.medecin_destinataire_id}</span>}
                              {h.accepte_par_id && <span className="text-emerald-600">accepté par Dr. {h.accepte_par_nom || h.accepte_par_id}</span>}
                              {h.accepte_le && <span className="text-slate-400 ml-auto">{formatDateTime(h.accepte_le)}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4 shrink-0">
                    {r.can_act && (
                      <>
                        <button
                          onClick={() => handleAccept(r.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />Accepter
                        </button>
                        <button
                          onClick={() => handleRefuse(r.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />Refuser
                        </button>
                      </>
                    )}
                    {!r.can_act && r.is_originator && (
                      <span className="text-xs text-slate-400 text-center">En attente d'acceptation</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderReprise = () => {
    const items = reprise.filter((r) => r.statut === 'ACCEPTÉ');
    return (
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun patient à reprendre pour le moment</p>
          </div>
        ) : (
          items.map((r) => {
            const active = getActiveConsultation(r.patient_id);
            const history = getPatientHistory(r.patient_id);
            const showHistory = history.length > 0;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Accepté</span>
                      <span className="text-xs text-slate-500 font-mono">{r.numero_dossier || r.patient_id}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{r.patient_nom} {r.patient_prenom}</span>
                      {r.patient_sexe && (
                        <span className="text-xs text-slate-500">{r.patient_sexe === 'M' ? 'Homme' : 'Femme'}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />Médecin origine: {r.medecin_origine_nom || r.medecin_origine_id}</span>
                      <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />Visite: {r.numero_visite || r.visite_id}</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 mb-2">
                      <div className="text-xs text-emerald-700 font-semibold mb-1">Motif du relais</div>
                      <div className="text-sm text-emerald-900">{r.motif}</div>
                    </div>
                    {active && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-2 flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="text-xs text-rose-700 font-semibold">En cours actuellement par :</span>
                          <span className="text-xs text-rose-900 font-bold ml-1">{active.nom}</span>
                        </div>
                      </div>
                    )}
                    {r.actions_realisees && (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />Actions: {r.actions_realisees}
                      </div>
                    )}
                    {r.diagnostic_principal && (
                      <div className="text-xs text-slate-600 mt-1">
                        Diag. original: <strong className="text-slate-800">{r.diagnostic_principal}</strong>
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Accepté le {formatDateTime(r.accepte_le)}
                    </div>
                    {showHistory && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1">
                          <History className="w-3 h-3" />Parcours du patient ({history.length} relais)
                        </summary>
                        <div className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
                          {history.map((h: RelaisItem) => (
                            <div key={h.id} className="flex items-center gap-2 text-slate-600">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                h.statut === 'ACCEPTÉ' ? 'bg-emerald-100 text-emerald-800' :
                                h.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-800' :
                                h.statut === 'REFUSÉ' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>{h.statut}</span>
                              <span>Dr. {h.medecin_origine_nom || h.medecin_origine_id}</span>
                              {h.medecin_destinataire_id && <span>→ Dr. {h.medecin_destinataire_nom || h.medecin_destinataire_id}</span>}
                              {h.accepte_par_id && <span className="text-emerald-600">accepté par Dr. {h.accepte_par_nom || h.accepte_par_id}</span>}
                              {h.accepte_le && <span className="text-slate-400 ml-auto">{formatDateTime(h.accepte_le)}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleStartConsultation(r.id, r.visite_id)}
                      disabled={startingId === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {startingId === r.id ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Stethoscope className="w-3.5 h-3.5" />
                      )}
                       {startingId === r.id ? 'Ouverture...' : 'Ouvrir le dossier'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun historique de relais médical</p>
          </div>
        ) : (
          history.map((r) => {
            const active = getActiveConsultation(r.patient_id);
            const his = getPatientHistory(r.patient_id);
            const showHis = his.length > 0;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-80">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatutLabel(r.statut)}
                      <span className="text-xs text-slate-500 font-mono">{r.numero_dossier || r.patient_id}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{r.patient_nom} {r.patient_prenom}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      Médecin origine: {r.medecin_origine_nom || r.medecin_origine_id}
                      {r.medecin_destinataire_id && (
                        <span className="ml-2">→ Destinataire: {r.medecin_destinataire_nom || r.medecin_destinataire_id}</span>
                      )}
                      {r.accepte_par_id && (
                        <span className="ml-2 text-emerald-700">• Accepté par: {r.accepte_par_nom || r.accepte_par_id}</span>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 mb-2">
                      <div className="text-xs text-slate-600">{r.motif}</div>
                    </div>
                    {active && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-2 flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="text-xs text-rose-700 font-semibold">En cours par :</span>
                          <span className="text-xs text-rose-900 font-bold ml-1">{active.nom}</span>
                        </div>
                      </div>
                    )}
                    {r.actions_realisees && (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />{r.actions_realisees}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Créé le {formatDateTime(r.created_at)}
                    </div>
                    {showHis && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1">
                          <History className="w-3 h-3" />Parcours complet du patient ({his.length} relais)
                        </summary>
                        <div className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
                          {his.map((h: RelaisItem) => (
                            <div key={h.id} className="flex items-center gap-2 text-slate-600">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                h.statut === 'ACCEPTÉ' ? 'bg-emerald-100 text-emerald-800' :
                                h.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-800' :
                                h.statut === 'REFUSÉ' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>{h.statut}</span>
                              <span>Dr. {h.medecin_origine_nom || h.medecin_origine_id}</span>
                              {h.medecin_destinataire_id && <span>→ Dr. {h.medecin_destinataire_nom || h.medecin_destinataire_id}</span>}
                              {h.accepte_par_id && <span className="text-emerald-600">accepté par Dr. {h.accepte_par_nom || h.accepte_par_id}</span>}
                              {h.accepte_le && <span className="text-slate-400 ml-auto">{formatDateTime(h.accepte_le)}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Relais Médical</h1>
              <p className="text-xs text-slate-500">Continuité des soins — Assurer le suivi patient lors d'un remplacement</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />Créer un relais
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
        {[
          { key: 'pending' as const, label: 'En attente', count: pending.filter((r) => r.statut === 'EN_ATTENTE').length },
          { key: 'reprise' as const, label: 'Patients à reprendre', count: reprise.filter((r) => r.statut === 'ACCEPTÉ').length },
          { key: 'history' as const, label: 'Historique', count: history.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading && !error ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-8 h-8 text-cyan-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={loadAll} className="ml-auto text-sm text-red-600 hover:text-red-800 font-semibold">Réessayer</button>
        </div>
      ) : (
        <div>
          {activeTab === 'pending' && renderPending()}
          {activeTab === 'reprise' && renderReprise()}
          {activeTab === 'history' && renderHistory()}
        </div>
      )}

      {/* Modal de création de relais */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-cyan-50">
              <h2 className="text-sm font-bold text-slate-900">Créer un relais médical</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consultation *</label>
                <input
                  type="text"
                  value={createForm.consultation_id}
                  onChange={(e) => setCreateForm({ ...createForm, consultation_id: e.target.value })}
                  placeholder="ID de la consultation (ex: csl-xxx)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {consultations.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-1">Consultations récentes :</div>
                    {consultations.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCreateForm({ ...createForm, consultation_id: c.id })}
                        className="w-full text-left px-2 py-1 text-xs text-cyan-700 hover:bg-cyan-50 rounded"
                      >
                        {c.id} — {c.patient_nom} {c.patient_prenom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Motif du relais *</label>
                <textarea
                  value={createForm.motif}
                  onChange={(e) => setCreateForm({ ...createForm, motif: e.target.value })}
                  placeholder="Décrire le motif de la continuité des soins..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Médecin destinataire (facultatif)</label>
                <select
                  value={createForm.medecin_destinataire_id}
                  onChange={(e) => setCreateForm({ ...createForm, medecin_destinataire_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Non désigné — tout médecin autorisé peut reprendre</option>
                  {destinataires
                    .filter((d) => d.id !== currentUserId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>{d.nom_complet}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Si aucun médecin n'est désigné, un médecin autorisé pourra reprendre le dossier.</p>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-2 bg-slate-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {creating ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Créer le relais
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
