import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, UserCheck, Clock, AlertTriangle, CheckCircle2, 
  RefreshCw, Search, ArrowRight, Eye, Shield, Users, Layers,
  ChevronRight, Printer, AlertCircle, X, Check, FileText, CheckCheck,
  Edit3, Lock, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { DemandeLaboratoire, LaborantinUser, LaboratoryQueueData } from '../../types';
import { LabResultEntryModal } from '../laboratory/LabResultEntryModal';
import { LabReportModal } from './LabReportModal';

export const LaboratoryQueueView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my_orders' | 'general' | 'all' | 'completed'>('my_orders');
  const [loading, setLoading] = useState<boolean>(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterUrgence, setFilterUrgence] = useState<string>('ALL');

  // Queue Data
  const [queueData, setQueueData] = useState<LaboratoryQueueData>({
    general_orders: [],
    my_orders: [],
    other_assigned_orders: [],
    completed_orders: [],
    total_count: 0
  });

  // Modales Phase 2C-4
  const [selectedOrderForResults, setSelectedOrderForResults] = useState<DemandeLaboratoire | null>(null);
  const [selectedOrderIdForBulletin, setSelectedOrderIdForBulletin] = useState<string | null>(null);

  // Reassignment Modal state
  const [reassignOrder, setReassignOrder] = useState<DemandeLaboratoire | null>(null);
  const [laborantinsList, setLaborantinsList] = useState<LaborantinUser[]>([]);
  const [selectedTargetLabId, setSelectedTargetLabId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  // Preview Modal
  const [previewOrder, setPreviewOrder] = useState<DemandeLaboratoire | null>(null);

  // Charger la file de laboratoire
  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/laboratory/queue');
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Erreur lors du chargement de la file laboratoire.');
      }
    } catch (err: any) {
      console.error('Erreur chargement file laboratoire:', err);
      setError('Impossible de communiquer avec le serveur du laboratoire.');
    } finally {
      setLoading(false);
    }
  };

  // Charger les laborantins actifs
  const fetchLaborantins = async () => {
    try {
      const res = await apiFetch('/api/laborantins');
      if (res.ok) {
        const data = await res.json();
        setLaborantinsList(data.laborantins || []);
      }
    } catch (err) {
      console.error('Erreur chargement liste laborantins:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchLaborantins();
  }, []);

  // Prise en charge atomique (Claim)
  const handleClaimOrder = async (order: DemandeLaboratoire) => {
    try {
      setClaimingId(order.id);
      setError(null);

      const res = await apiFetch(`/api/laboratory/orders/${order.id}/claim`, {
        method: 'POST'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la prise en charge de la demande.');
      }

      setSuccessMessage(`Demande ${order.numero_demande || order.id} prise en charge avec succès ! Elle est désormais assignée à votre paillasse.`);
      await fetchQueue();
      setActiveTab('my_orders');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Échec de la prise en charge.');
    } finally {
      setClaimingId(null);
    }
  };

  // Réaffectation ou remise en file générale
  const handleConfirmReassignment = async () => {
    if (!reassignOrder) return;

    try {
      setIsReassigning(true);
      setError(null);

      const res = await apiFetch(`/api/laboratory/orders/${reassignOrder.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laborantin_id: selectedTargetLabId && selectedTargetLabId !== 'none' ? selectedTargetLabId : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la réaffectation');
      }

      setSuccessMessage(data.message || 'Affectation mise à jour.');
      setReassignOrder(null);
      await fetchQueue();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      setError(err.message || 'Échec de la réaffectation.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Liste active selon l'onglet
  let displayOrders: DemandeLaboratoire[] = [];
  if (activeTab === 'my_orders') {
    displayOrders = queueData.my_orders;
  } else if (activeTab === 'general') {
    displayOrders = queueData.general_orders;
  } else if (activeTab === 'completed') {
    displayOrders = queueData.completed_orders || [];
  } else {
    displayOrders = [
      ...queueData.my_orders,
      ...queueData.general_orders,
      ...queueData.other_assigned_orders,
      ...(queueData.completed_orders || [])
    ];
  }

  // Filtre recherche et urgence
  const filteredOrders = displayOrders.filter(o => {
    if (filterUrgence !== 'ALL' && o.urgence !== filterUrgence) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const patientFullName = `${o.patient_nom || ''} ${o.patient_prenom || ''}`.toLowerCase();
    const num = (o.numero_demande || '').toLowerCase();
    const dossier = (o.numero_dossier || '').toLowerCase();
    const doc = (o.medecin_nom || '').toLowerCase();
    return patientFullName.includes(term) || num.includes(term) || dossier.includes(term) || doc.includes(term);
  });

  return (
    <div className="space-y-6">
      
      {/* Bannière d'en-tête */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-indigo-900/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <FlaskConical className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight">Plateau Technique & Paillasse Laboratoire</h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Phase 2C-3 Opérationnelle
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1">
                Attribution nominative des demandes, prise en charge atomique et gestion de la file générale d'analyses
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 text-right">
              <div className="text-[11px] text-slate-400">Connecté en tant que</div>
              <div className="text-xs font-bold text-white flex items-center justify-end gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                {user?.nom_complet}
              </div>
            </div>

            <button
              onClick={fetchQueue}
              disabled={loading}
              className="p-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl shadow-xs transition-colors"
              title="Rafraîchir la file"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compteurs de la file */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-indigo-800/40">
          <div 
            onClick={() => setActiveTab('my_orders')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              activeTab === 'my_orders'
                ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md'
                : 'bg-slate-800/40 border-slate-700/50 text-indigo-200/70 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Mes Demandes</span>
              <span className="text-xs bg-indigo-500/30 text-indigo-200 font-bold px-2 py-0.5 rounded-full">
                Personnel
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {queueData.my_orders.length}
            </div>
            <div className="text-[11px] text-indigo-200/60">Demandes qui vous sont spécifiquement assignées</div>
          </div>

          <div 
            onClick={() => setActiveTab('general')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              activeTab === 'general'
                ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md'
                : 'bg-slate-800/40 border-slate-700/50 text-indigo-200/70 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">File Générale</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                À Prendre
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {queueData.general_orders.length}
            </div>
            <div className="text-[11px] text-indigo-200/60">Demandes disponibles pour tout le laboratoire</div>
          </div>

          <div 
            onClick={() => setActiveTab('all')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              activeTab === 'all'
                ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md'
                : 'bg-slate-800/40 border-slate-700/50 text-indigo-200/70 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Vue d'Équipe</span>
              <span className="text-xs bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {queueData.total_count}
            </div>
            <div className="text-[11px] text-indigo-200/60">Totalité des demandes en cours au laboratoire</div>
          </div>
        </div>
      </div>

      {/* Alertes erreurs et succès */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workflow Laboratoire : Demandes → Prélèvements → Échantillons → Analyses → Résultats → Validation (Règle 10) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
            <span>Workflow Analytique Biomédical</span>
          </div>
          <span className="text-[10px] text-slate-400">Circuit sécurisé 6 étapes</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {/* 1. Demandes */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold text-slate-400">Étape 1</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">Demandes</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Prescriptions Dr</div>
          </div>
          {/* 2. Prélèvements */}
          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-center">
            <div className="text-[10px] font-bold text-purple-500">Étape 2</div>
            <div className="text-xs font-bold text-purple-900 mt-0.5">Prélèvements</div>
            <div className="text-[10px] text-purple-700 mt-0.5">Tube / Flacon</div>
          </div>
          {/* 3. Échantillons */}
          <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-center">
            <div className="text-[10px] font-bold text-sky-500">Étape 3</div>
            <div className="text-xs font-bold text-sky-900 mt-0.5">Échantillons</div>
            <div className="text-[10px] text-sky-700 mt-0.5">Code & Conformité</div>
          </div>
          {/* 4. Analyses */}
          <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-center">
            <div className="text-[10px] font-bold text-indigo-500">Étape 4</div>
            <div className="text-xs font-bold text-indigo-900 mt-0.5">Analyses</div>
            <div className="text-[10px] text-indigo-700 mt-0.5">Paillasse active</div>
          </div>
          {/* 5. Résultats */}
          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-center">
            <div className="text-[10px] font-bold text-blue-500">Étape 5</div>
            <div className="text-xs font-bold text-blue-900 mt-0.5">Résultats</div>
            <div className="text-[10px] text-blue-700 mt-0.5">Saisie laborantin</div>
          </div>
          {/* 6. Validation */}
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
            <div className="text-[10px] font-bold text-emerald-600">Étape 6</div>
            <div className="text-xs font-bold text-emerald-950 mt-0.5">Validation</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Bulletin officiel</div>
          </div>
        </div>
      </div>

      {/* Barre d'outils, onglets et filtres */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Sélecteur d'onglets */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('my_orders')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'my_orders'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            Mes Demandes ({queueData.my_orders.length})
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            File Générale ({queueData.general_orders.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-600" />
            En Cours ({queueData.total_count})
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
            Validés & Clôturés ({(queueData.completed_orders || []).length})
          </button>
        </div>

        {/* Filtres de recherche */}
        <div className="flex items-center space-x-3 grow sm:grow-0">
          <div className="relative grow sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher patient, N° demande..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterUrgence}
            onChange={(e) => setFilterUrgence(e.target.value)}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">Toutes urgences</option>
            <option value="URGENTE">🚨 URGENTE</option>
            <option value="NORMALE">NORMALE</option>
          </select>
        </div>
      </div>

      {/* Règle de Confidentialité Médicale garantie */}
      <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center space-x-3 text-xs text-indigo-900">
        <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
        <span>
          <strong>Confidentialité stricte garantie :</strong> Le personnel de laboratoire accède exclusivement aux demandes d'examens, types d'échantillons et indications cliniques pertinentes. Les notes privées de consultation médicale restent strictement inaccessibles.
        </span>
      </div>

      {/* Liste des demandes */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold">Chargement des demandes de laboratoire...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Aucune demande trouvée</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {activeTab === 'my_orders'
              ? "Vous n'avez aucune demande actuellement attribuée à votre nom. Consultez la file générale pour prendre en charge de nouvelles demandes."
              : "Aucune demande ne correspond à vos critères de filtrage."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isAssignedToMe = order.laborantin_id === user?.id;
            const isUnassigned = !order.laborantin_id;
            const isUrgent = order.urgence === 'URGENTE';
            const isClaiming = claimingId === order.id;

            return (
              <div 
                key={order.id} 
                className={`bg-white rounded-2xl border transition-all p-5 shadow-xs hover:shadow-sm ${
                  isUrgent 
                    ? 'border-rose-300 ring-1 ring-rose-200/50' 
                    : isAssignedToMe
                      ? 'border-indigo-300 bg-indigo-50/10'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  
                  {/* Informations Patient & Demande */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900 uppercase">
                        {order.patient_nom} {order.patient_prenom}
                      </span>
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        {order.numero_dossier || 'Dossier'}
                      </span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isUrgent ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.urgence}
                      </span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        order.statut === 'PRISE_EN_CHARGE'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.statut === 'PRISE_EN_CHARGE' ? 'PRISE EN CHARGE (PAILLASSE)' : order.statut}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span className="font-mono text-slate-700 font-semibold">
                        {order.numero_demande || order.id}
                      </span>
                      <span>•</span>
                      <span>Visite : {order.numero_visite || 'N/A'}</span>
                      <span>•</span>
                      <span>Prescrit par {order.medecin_nom || 'Dr. traitant'}</span>
                      <span>•</span>
                      <span>{new Date(order.date_demande || order.created_at).toLocaleString('fr-FR')}</span>
                    </div>

                    {order.bloque_caisse && (
                      <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-[11px] font-medium">
                        <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>En attente de paiement à la réception (Caisse) : Le patient doit régler ou obtenir dérogation au guichet d'accueil avant le démarrage.</span>
                      </div>
                    )}
                  </div>

                  {/* État d'attribution, Statut & Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    
                    {/* Badge Statut Paiement (Lecture seule Laboratoire) */}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                      order.statut_paiement === 'PAYÉ' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : order.statut_paiement === 'PARTIELLEMENT PAYÉ'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : order.has_derogation
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {order.statut_paiement === 'PAYÉ' 
                        ? 'PAYÉ' 
                        : order.statut_paiement === 'PARTIELLEMENT PAYÉ' 
                        ? 'PARTIELLEMENT PAYÉ' 
                        : order.has_derogation 
                        ? 'NON PAYÉ (Dérogation Caisse)' 
                        : 'NON PAYÉ (En attente Caisse)'}
                    </span>

                    {/* Badge Statut Biologique */}
                    {['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut) ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Résultats Validés
                      </span>
                    ) : order.statut === 'RESULTATS_SAISIS' ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Résultats Saisis (À Valider)
                      </span>
                    ) : order.statut === 'PRELEVEMENT_EFFECTUE' ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        Prélèvement Effectué
                      </span>
                    ) : null}

                    {/* Badge Laborantin */}
                    {order.laborantin_nom ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl flex items-center gap-1.5 border ${
                        isAssignedToMe
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {isAssignedToMe ? 'Attribué à moi' : `Assigné à ${order.laborantin_nom}`}
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-600" />
                        File Générale (Disponible)
                      </span>
                    )}

                    {/* Bouton Claim si non attribué */}
                    {isUnassigned && (
                      <button
                        onClick={() => handleClaimOrder(order)}
                        disabled={isClaiming || order.bloque_caisse}
                        title={order.bloque_caisse ? 'Encaissement obligatoire à la réception avant prise en charge' : undefined}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                          order.bloque_caisse
                            ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                        }`}
                      >
                        {isClaiming ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : order.bloque_caisse ? (
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{order.bloque_caisse ? 'En attente Caisse' : 'Prendre en charge (Claim)'}</span>
                      </button>
                    )}

                    {/* Bouton Saisir / Gérer les résultats */}
                    {(isAssignedToMe || ['RESULTATS_SAISIS', 'PRELEVEMENT_EFFECTUE', 'EN_ANALYSE', 'PRISE_EN_CHARGE', 'RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)) && (
                      <button
                        onClick={() => {
                          if (order.bloque_caisse) {
                            setError("Règlement en attente : Le patient doit d'abord régler ses examens à la réception/caisse ou consigner une dérogation.");
                            return;
                          }
                          setSelectedOrderForResults(order);
                        }}
                        disabled={order.bloque_caisse}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                          order.bloque_caisse
                            ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                            : ['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
                            ? 'bg-slate-700 hover:bg-slate-800 text-white'
                            : order.statut === 'RESULTATS_SAISIS'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {order.bloque_caisse ? (
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Edit3 className="w-3.5 h-3.5" />
                        )}
                        {order.bloque_caisse
                          ? 'Bloqué Caisse'
                          : ['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(order.statut)
                          ? 'Détails & Amendement'
                          : order.statut === 'RESULTATS_SAISIS'
                          ? 'Vérifier & Valider'
                          : 'Saisir les résultats'}
                      </button>
                    )}

                    {/* Bouton Réaffecter */}
                    <button
                      onClick={() => {
                        setReassignOrder(order);
                        setSelectedTargetLabId(order.laborantin_id || '');
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Modifier l'attribution"
                    >
                      Transférer
                    </button>

                    {/* Bouton Bulletin Officiel format Clinique */}
                    <button
                      onClick={() => setSelectedOrderIdForBulletin(order.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Consulter le bulletin officiel d'analyses"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      Bulletin
                    </button>
                  </div>
                </div>

                {/* Renseignements cliniques pertinents pour le biologiste */}
                {order.indication_clinique && (
                  <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                    <strong className="text-slate-900">Renseignement clinique médecin : </strong>
                    {order.indication_clinique}
                  </div>
                )}

                {/* Liste des analyses à faire */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Analyses demandées ({order.analyses?.length || 0})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {order.analyses?.map((ana, idx) => (
                      <div 
                        key={idx}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{ana.nom_analyse}</div>
                          {ana.instructions && (
                            <div className="text-[10px] text-slate-500 italic">{ana.instructions}</div>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          ana.type_echantillon === 'SANG' ? 'bg-rose-100 text-rose-800' :
                          ana.type_echantillon === 'URINE' ? 'bg-amber-100 text-amber-800' :
                          ana.type_echantillon === 'SELLES' ? 'bg-orange-100 text-orange-800' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {ana.type_echantillon}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE DE RÉAFFECTATION / ATTRIBUTION */}
      {reassignOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Affecter la Demande de Laboratoire</h3>
              </div>
              <button 
                onClick={() => setReassignOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Demande : <strong className="font-mono text-slate-900">{reassignOrder.numero_demande || reassignOrder.id}</strong></div>
              <div>Patient : <strong className="text-slate-900">{reassignOrder.patient_nom} {reassignOrder.patient_prenom}</strong></div>
              <div>Attribution actuelle : <strong>{reassignOrder.laborantin_nom || 'File générale du laboratoire'}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Nouveau laborantin assigné :
              </label>
              <select
                value={selectedTargetLabId}
                onChange={(e) => setSelectedTargetLabId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Remettre en File Générale (Attribution automatique) --</option>
                {laborantinsList.map(lab => (
                  <option key={lab.id} value={lab.id}>
                    🧪 {lab.nom_complet} (@{lab.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setReassignOrder(null)}
                disabled={isReassigning}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignment}
                disabled={isReassigning}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isReassigning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Valider l'affectation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE D'APERÇU / IMPRESSION DU BULLETIN */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Bulletin Officiel de Demande de Laboratoire</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer
                </button>
                <button
                  onClick={() => setPreviewOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* En-tête Clinique */}
            <div className="border-b-2 border-indigo-950 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black text-indigo-950 uppercase">Clinique Les Archanges</h2>
                <p className="text-xs text-slate-600 font-medium">À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.</p>
                <p className="text-[11px] text-slate-500">Téléphone : +243 989 715 771 • Horaires : Ouvert 24h/24 et 7j/7.</p>
              </div>
              <div className="text-right text-xs">
                <div className="font-mono font-bold text-indigo-900">{previewOrder.numero_demande || previewOrder.id}</div>
                <div className="text-slate-500">Date : {new Date(previewOrder.date_demande || previewOrder.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

            {/* Cartouche */}
            <div className="p-3 bg-slate-50 border rounded-xl grid grid-cols-2 gap-2 text-xs">
              <div>Patient : <strong className="uppercase text-slate-900">{previewOrder.patient_nom} {previewOrder.patient_prenom}</strong></div>
              <div>Dossier : <strong className="font-mono">{previewOrder.numero_dossier}</strong></div>
              <div>Médecin Prescripteur : <strong>{previewOrder.medecin_nom}</strong></div>
              <div>Urgence : <strong className="text-indigo-900">{previewOrder.urgence}</strong></div>
              <div className="col-span-2 border-t pt-1 text-slate-600">
                Attribution : <strong className="text-indigo-900">{previewOrder.laborantin_nom ? `Attribué à ${previewOrder.laborantin_nom}` : 'File générale'}</strong>
              </div>
            </div>

            {/* Tableau examens */}
            <table className="w-full text-left text-xs border">
              <thead className="bg-slate-100 border-b text-slate-700 font-bold">
                <tr>
                  <th className="py-2 px-3">Analyse</th>
                  <th className="py-2 px-3">Échantillon</th>
                  <th className="py-2 px-3">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewOrder.analyses?.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 px-3 font-medium">{a.nom_analyse}</td>
                    <td className="py-2 px-3 font-semibold">{a.type_echantillon}</td>
                    <td className="py-2 px-3 text-slate-500">{a.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE DE SAISIE ET VALIDATION DES RÉSULTATS (Phase 2C-4) */}
      {selectedOrderForResults && (
        <LabResultEntryModal
          order={selectedOrderForResults}
          onClose={() => setSelectedOrderForResults(null)}
          onOrderUpdated={(updated) => {
            fetchQueue();
            setSelectedOrderForResults(updated);
          }}
          onOpenBulletin={(id) => {
            setSelectedOrderIdForBulletin(id);
          }}
        />
      )}

      {/* MODALE OFFICIELLE DE BULLETIN D'ANALYSES (Phase 2C-4) */}
      {selectedOrderIdForBulletin && (
        <LabReportModal
          orderId={selectedOrderIdForBulletin}
          onClose={() => setSelectedOrderIdForBulletin(null)}
        />
      )}

    </div>
  );
};
