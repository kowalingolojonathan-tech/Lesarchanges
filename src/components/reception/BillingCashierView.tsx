import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, Search, RefreshCw, FileText, CheckCircle2, 
  Clock, AlertCircle, ArrowRight, DollarSign, Coins, Printer,
  Calendar, User, ChevronRight, X, Filter, BarChart3, Receipt
} from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { BillingPrintModal, BillingPrintType } from '../common/BillingPrintModal.js';
import { 
  Facture, PrestationTarif, Patient, Visite, 
  BillingReportsData, FactureStatut, PrestationCategorie, Paiement 
} from '../../types/index.js';

interface PrestationSelection {
  tarif: PrestationTarif;
  quantite: number;
}

export const BillingCashierView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FACTURES' | 'NOUVELLE' | 'RAPPORTS'>('FACTURES');
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NON PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'PAYÉ'>('ALL');
  const [prestationFilter, setPrestationFilter] = useState<'ALL' | 'LABORATOIRE' | 'CONSULTATION'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Taux officiel actuel
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number>(2850);

  // Modal de paiement
  const [selectedFactureForPayment, setSelectedFactureForPayment] = useState<Facture | null>(null);
  const [paymentDevise, setPaymentDevise] = useState<'USD' | 'FC'>('USD');
  const [paymentMontant, setPaymentMontant] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'ESPECES' | 'MOBILE_MONEY' | 'CARTE_BANCAIRE'>('ESPECES');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // Modal de détails / reçu
  const [selectedFactureForDetails, setSelectedFactureForDetails] = useState<Facture | null>(null);

  // Formulaire Nouvelle Facture Multi-Prestations
  const [availableTarifs, setAvailableTarifs] = useState<PrestationTarif[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedVisiteId, setSelectedVisiteId] = useState<string>('');
  const [patientVisites, setPatientVisites] = useState<Visite[]>([]);
  const [selectedPrestations, setSelectedPrestations] = useState<PrestationSelection[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // Rapports de Facturation & Caisse
  const [reportsData, setReportsData] = useState<BillingReportsData | null>(null);
  const [reportDeviseVue, setReportDeviseVue] = useState<'FC' | 'USD'>('FC'); // Par défaut en FC
  const [reportDateRange, setReportDateRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');
  const [loadingReports, setLoadingReports] = useState(false);

  const { user } = useAuth();
  const canViewReports = user?.role === 'ADMINISTRATEUR' || user?.permissions?.includes('rapports_financiers:voir');

  // État impression modale officielle
  const [printModalState, setPrintModalState] = useState<{
    isOpen: boolean;
    type: BillingPrintType;
    facture?: Facture | null;
    paiement?: Paiement | null;
    reportsData?: BillingReportsData | null;
    period?: string;
  }>({
    isOpen: false,
    type: 'FACTURE',
  });

  const handlePrintFacture = (f: Facture) => {
    setPrintModalState({
      isOpen: true,
      type: 'FACTURE',
      facture: f,
    });
  };

  const handlePrintPaiement = (p: Paiement, f?: Facture | null) => {
    setPrintModalState({
      isOpen: true,
      type: 'RECU',
      paiement: p,
      facture: f || null,
    });
  };

  const handlePrintEtatCaisse = () => {
    const periodStr = reportDateRange === 'TODAY' ? "Aujourd'hui" : reportDateRange === 'WEEK' ? '7 derniers jours' : reportDateRange === 'MONTH' ? '30 derniers jours' : 'Toutes dates';
    setPrintModalState({
      isOpen: true,
      type: 'ETAT_CAISSE',
      reportsData,
      period: periodStr,
    });
  };

  const handlePrintRapportFinancier = () => {
    const periodStr = reportDateRange === 'TODAY' ? "Aujourd'hui" : reportDateRange === 'WEEK' ? '7 derniers jours' : reportDateRange === 'MONTH' ? '30 derniers jours' : 'Toutes dates';
    setPrintModalState({
      isOpen: true,
      type: 'RAPPORT_FINANCIER',
      reportsData,
      period: periodStr,
    });
  };

  // Charger factures et taux
  const loadFactures = async () => {
    setLoading(true);
    try {
      const rateRes = await apiFetch('/api/billing/exchange-rate');
      const rateData = await rateRes.json();
      if (rateRes.ok && rateData.rate) {
        setCurrentExchangeRate(rateData.rate);
      }

      const res = await apiFetch('/api/factures');
      const data = await res.json();
      if (res.ok && Array.isArray(data.factures)) {
        setFactures(data.factures);
      }
    } catch (err) {
      console.error('Erreur chargement factures:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger tarifs pour la création de facture
  const loadTarifs = async () => {
    try {
      const res = await apiFetch('/api/tarifs?actif=1');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.tarifs)) {
            setAvailableTarifs(data.tarifs);
          }
        }
      }
    } catch (err) {
      console.error('Erreur chargement tarifs:', err);
    }
  };

  // Charger rapports
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      let queryParams = `devise_vue=${reportDeviseVue}`;
      const now = new Date();
      if (reportDateRange === 'TODAY') {
        const todayStr = now.toISOString().slice(0, 10);
        queryParams += `&start_date=${todayStr}&end_date=${todayStr}`;
      } else if (reportDateRange === 'WEEK') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        queryParams += `&start_date=${d.toISOString().slice(0, 10)}`;
      } else if (reportDateRange === 'MONTH') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        queryParams += `&start_date=${d.toISOString().slice(0, 10)}`;
      }

      const res = await apiFetch(`/api/billing/reports?${queryParams}`);
      const data = await res.json();
      if (res.ok) {
        setReportsData(data);
      }
    } catch (err) {
      console.error('Erreur chargement rapports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    loadFactures();
    loadTarifs();
  }, []);

  useEffect(() => {
    if (activeTab === 'RAPPORTS') {
      loadReports();
    }
  }, [activeTab, reportDeviseVue, reportDateRange]);

  // Recherche patient dynamique pour nouvelle facture
  useEffect(() => {
    if (!patientSearch.trim() || selectedPatient) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const res = await apiFetch(`/api/patients/search?q=${encodeURIComponent(patientSearch.trim())}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.patients)) {
          setPatientSearchResults(data.patients);
        }
      } catch (err) {
        console.error('Erreur recherche patient:', err);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch, selectedPatient]);

  // Quand un patient est sélectionné, récupérer ses visites actives/récentes
  const handleSelectPatient = async (p: Patient) => {
    setSelectedPatient(p);
    setPatientSearch(`${p.nom} ${p.prenom} (${p.numero_dossier})`);
    setPatientSearchResults([]);
    try {
      const res = await apiFetch(`/api/visites?patient_id=${p.id}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.visites)) {
        setPatientVisites(data.visites);
        if (data.visites.length > 0) {
          setSelectedVisiteId(data.visites[0].id);
        }
      }
    } catch (err) {
      console.error('Erreur récupération visites patient:', err);
    }
  };

  // Ajout / Retrait de prestations
  const handleAddPrestation = (t: PrestationTarif) => {
    setSelectedPrestations(prev => {
      const existing = prev.find(item => item.tarif.id === t.id);
      if (existing) {
        return prev.map(item => item.tarif.id === t.id ? { ...item, quantite: item.quantite + 1 } : item);
      }
      return [...prev, { tarif: t, quantite: 1 }];
    });
  };

  const handleUpdateQuantite = (tarifId: string, qte: number) => {
    if (qte <= 0) {
      setSelectedPrestations(prev => prev.filter(item => item.tarif.id !== tarifId));
    } else {
      setSelectedPrestations(prev => prev.map(item => item.tarif.id === tarifId ? { ...item, quantite: qte } : item));
    }
  };

  // Calcul totaux nouvelle facture
  const invoiceTotalUsd = selectedPrestations.reduce((acc, curr) => acc + (curr.tarif.prix_usd * curr.quantite), 0);
  const invoiceTotalFc = Math.round(invoiceTotalUsd * currentExchangeRate);

  const handleCreateInvoice = async () => {
    setInvoiceError(null);
    if (!selectedPatient) {
      setInvoiceError('Veuillez sélectionner un dossier patient.');
      return;
    }
    if (selectedPrestations.length === 0) {
      setInvoiceError('Veuillez ajouter au moins une prestation ou acte à facturer.');
      return;
    }

    setIsCreatingInvoice(true);
    try {
      const payload = {
        patient_id: selectedPatient.id,
        visite_id: selectedVisiteId || null,
        notes: invoiceNotes.trim() || undefined,
        items: selectedPrestations.map(p => ({
          tarif_id: p.tarif.id,
          description: p.tarif.nom,
          categorie: p.tarif.categorie,
          quantite: p.quantite,
          prix_unitaire: p.tarif.prix_usd
        }))
      };

      const res = await apiFetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.facture) {
        // Succès : rafraîchir et ouvrir le modal de paiement
        await loadFactures();
        setSelectedPatient(null);
        setPatientSearch('');
        setSelectedPrestations([]);
        setInvoiceNotes('');
        setActiveTab('FACTURES');
        handleOpenPaymentModal(data.facture);
      } else {
        setInvoiceError(data.error || 'Erreur lors de l\'émission de la facture.');
      }
    } catch (err) {
      setInvoiceError('Erreur de communication avec le serveur.');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Ouverture modal de paiement
  const handleOpenPaymentModal = (facture: Facture) => {
    setSelectedFactureForPayment(facture);
    setPaymentDevise('USD');
    setPaymentMontant(facture.solde_usd.toString());
    setPaymentMode('ESPECES');
    setPaymentRef('');
    setPaymentNotes('');
    setPaymentError(null);
    setLastReceipt(null);
  };

  // Bascule devise de paiement
  const handleTogglePaymentDevise = (devise: 'USD' | 'FC') => {
    setPaymentDevise(devise);
    if (!selectedFactureForPayment) return;
    if (devise === 'USD') {
      setPaymentMontant(selectedFactureForPayment.solde_usd.toString());
    } else {
      // Montant complet en FC calculé au taux actuel
      const amountFc = Math.round(selectedFactureForPayment.solde_usd * currentExchangeRate);
      setPaymentMontant(amountFc.toString());
    }
  };

  // Validation d'un règlement
  const handleProcessPayment = async () => {
    setPaymentError(null);
    if (!selectedFactureForPayment) return;

    const val = parseFloat(paymentMontant);
    if (isNaN(val) || val <= 0) {
      setPaymentError('Veuillez saisir un montant valide strictement positif.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await apiFetch(`/api/factures/${selectedFactureForPayment.id}/paiements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant_paye: val,
          devise: paymentDevise,
          mode_paiement: paymentMode,
          reference_transaction: paymentRef.trim() || undefined,
          notes: paymentNotes.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.paiement) {
        setLastReceipt({
          ...data.paiement,
          facture: data.facture
        });
        await loadFactures();
      } else {
        setPaymentError(data.error || 'Erreur lors de l\'encaissement du paiement.');
      }
    } catch (err) {
      setPaymentError('Erreur de communication avec le serveur.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStatusBadge = (statut: FactureStatut) => {
    switch (statut) {
      case 'PAYÉ':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            PAYÉ
          </span>
        );
      case 'PARTIELLEMENT PAYÉ':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 mr-1" />
            PARTIELLEMENT PAYÉ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            NON PAYÉ
          </span>
        );
    }
  };

  const isLabFacture = (f: Facture) => {
    if (f.type_prestation === 'LABORATOIRE') return true;
    if (f.numero_facture && f.numero_facture.includes('LAB')) return true;
    if (f.items && f.items.some(it => it.categorie === 'EXAMEN_LABORATOIRE' || (it.description && it.description.toLowerCase().includes('lab')))) return true;
    return false;
  };

  const filteredFactures = factures.filter(f => {
    if (statusFilter !== 'ALL' && f.statut !== statusFilter) return false;
    if (prestationFilter === 'LABORATOIRE' && !isLabFacture(f)) return false;
    if (prestationFilter === 'CONSULTATION' && isLabFacture(f)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patientMatch = (f.patient_nom && f.patient_nom.toLowerCase().includes(q)) || 
                           (f.patient_prenom && f.patient_prenom.toLowerCase().includes(q)) ||
                           (f.numero_dossier && f.numero_dossier.toLowerCase().includes(q));
      const invoiceMatch = f.numero_facture.toLowerCase().includes(q);
      return patientMatch || invoiceMatch;
    }
    return true;
  });

  // Règle stricte de confidentialité : le médecin ne voit pas la caisse ni les rapports financiers
  const isDoctorOnly = user && (
    ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE'].includes(user.role) ||
    user.role_categorie === 'MÉDECIN'
  ) && user.role !== 'ADMINISTRATEUR' && user.role !== 'DIRECTEUR';

  if (isDoctorOnly) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-xl mx-auto my-12">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Accès Caisse & Rapports Réservé</h3>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Conformément aux règles de confidentialité médicale et administrative, le corps médical ne peut pas accéder aux modules de caisse ni aux rapports financiers.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Dans vos dossiers patients et consultations, le statut utile de facturation (<strong className="text-emerald-700">PAYÉ</strong> / <strong className="text-amber-700">PARTIELLEMENT PAYÉ</strong> / <strong className="text-rose-700">NON PAYÉ</strong>) est directement affiché.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête Caisse & Devises */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center">
              <CreditCard className="w-6 h-6 mr-2 text-emerald-600" />
              Caisse, Facturation & Règlements (USD / FC)
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Taux : 1 $ = {currentExchangeRate.toLocaleString('fr-FR')} FC
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Facturation multi-prestations, gestion des encaissements en USD ou FC, règlements partiels et rapports financiers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadFactures}
            title="Rafraîchir"
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveTab('NOUVELLE')}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture</span>
          </button>
        </div>
      </div>

      {/* Onglets de navigation */}
      <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('FACTURES')}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'FACTURES'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Factures & Règlements ({factures.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('NOUVELLE')}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'NOUVELLE'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Créer Facture Multi-Prestations</span>
        </button>

        {canViewReports && (
          <button
            onClick={() => setActiveTab('RAPPORTS')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'RAPPORTS'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Rapports de Caisse & Devises</span>
          </button>
        )}
      </div>

      {/* CONTENU ONGLET 1 : FACTURES & RÈGLEMENTS */}
      {activeTab === 'FACTURES' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-xs overflow-hidden">
          {/* Barre de filtres */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filtres par statut */}
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'NON PAYÉ', 'PARTIELLEMENT PAYÉ', 'PAYÉ'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      statusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st === 'ALL' ? 'Tous les statuts' : st}
                  </button>
                ))}
              </div>

              {/* Barre de recherche */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par patient, N° dossier ou facture..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Filtre par type de prestation (Laboratoire vs Consultation) */}
            <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setPrestationFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  prestationFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Toutes prestations
              </button>
              <button
                type="button"
                onClick={() => setPrestationFilter('LABORATOIRE')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors flex items-center space-x-1 cursor-pointer ${
                  prestationFilter === 'LABORATOIRE'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-800 hover:bg-emerald-100/60'
                }`}
              >
                <span>🔬 Examens Labo (Reçus & Factures)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrestationFilter('CONSULTATION')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  prestationFilter === 'CONSULTATION'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🩺 Consultations
              </button>
            </div>
          </div>

          {/* Tableau des factures Desktop (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Facture & Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4 text-right">Montant Facturé</th>
                  <th className="py-3 px-4 text-right">Montant Payé</th>
                  <th className="py-3 px-4 text-right">Solde Restant</th>
                  <th className="py-3 px-4 text-center">Taux Utilisé</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFactures.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Aucune facture enregistrée pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredFactures.map((f) => {
                    const taux = f.taux_usd_fc || currentExchangeRate;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <div>{f.numero_facture}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {new Date(f.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {f.patient_nom} {f.patient_prenom}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Dossier : <span className="font-mono">{f.numero_dossier}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-bold text-slate-900">{f.montant_total_usd.toFixed(2)} $</div>
                          <div className="text-[11px] text-slate-500">
                            {f.montant_total_fc.toLocaleString('fr-FR')} FC
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-bold text-emerald-700">{f.total_paye_usd.toFixed(2)} $</div>
                          <div className="text-[11px] text-slate-500">
                            {Math.round(f.total_paye_usd * taux).toLocaleString('fr-FR')} FC
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className={`font-bold ${f.solde_usd > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                            {f.solde_usd.toFixed(2)} $
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {f.solde_fc.toLocaleString('fr-FR')} FC
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-600">
                          1 $ = {taux.toLocaleString('fr-FR')} FC
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(f.statut)}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handlePrintFacture(f)}
                            className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-semibold text-xs inline-flex items-center space-x-1 transition-colors cursor-pointer"
                            title="Imprimer la facture officielle"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Imprimer</span>
                          </button>
                          {f.solde_usd > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(f)}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs inline-flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Encaisser</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedFactureForDetails(f)}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Détails
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Présentation Cartes Factures Mobile (md:hidden - Règle 5 & 8) */}
          <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {filteredFactures.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Aucune facture enregistrée pour ce filtre.
              </div>
            ) : (
              filteredFactures.map((f) => {
                const taux = f.taux_usd_fc || currentExchangeRate;
                return (
                  <div key={f.id} className="pt-3 first:pt-0 space-y-2.5 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-xs text-slate-900">
                          {f.numero_facture}
                        </div>
                        <div className="font-bold text-sm text-slate-900 mt-0.5">
                          {f.patient_nom} {f.patient_prenom}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Dossier : {f.numero_dossier}
                        </div>
                      </div>

                      <div className="text-right">
                        {getStatusBadge(f.statut)}
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(f.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short'
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Grille Montants */}
                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/60 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                        <div className="font-mono font-bold text-slate-900">{f.montant_total_usd.toFixed(2)} $</div>
                        <div className="text-[10px] text-slate-500 font-mono">{f.montant_total_fc.toLocaleString('fr-FR')} FC</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Payé</div>
                        <div className="font-mono font-bold text-emerald-700">{f.total_paye_usd.toFixed(2)} $</div>
                        <div className="text-[10px] text-emerald-600 font-mono">{Math.round(f.total_paye_usd * taux).toLocaleString('fr-FR')} FC</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Solde</div>
                        <div className={`font-mono font-bold ${f.solde_usd > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                          {f.solde_usd.toFixed(2)} $
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{f.solde_fc.toLocaleString('fr-FR')} FC</div>
                      </div>
                    </div>

                    {/* Actions tactiles mobiles min-h-[44px] */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {f.solde_usd > 0 && (
                        <button
                          onClick={() => handleOpenPaymentModal(f)}
                          className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs min-h-[44px]"
                        >
                          <Coins className="w-4 h-4" />
                          <span>Encaisser</span>
                        </button>
                      )}

                      <button
                        onClick={() => handlePrintFacture(f)}
                        className="flex-1 py-2.5 text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 min-h-[44px]"
                      >
                        <Printer className="w-4 h-4 text-emerald-700" />
                        <span>Imprimer</span>
                      </button>

                      <button
                        onClick={() => setSelectedFactureForDetails(f)}
                        className="px-3 py-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-xs min-h-[44px] flex items-center justify-center"
                      >
                        Détails
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 2 : NOUVELLE FACTURE MULTI-PRESTATIONS */}
      {activeTab === 'NOUVELLE' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>Facturation Multi-Prestations & Visites</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sélectionnez le patient puis cumulez plusieurs actes : type de visite, consultation, examens de laboratoire, imagerie et soins.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Taux officiel appliqué</div>
              <div className="text-sm font-bold font-mono text-emerald-800">
                1 USD = {currentExchangeRate.toLocaleString('fr-FR')} FC
              </div>
            </div>
          </div>

          {invoiceError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {invoiceError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Colonne 1 : Sélection Patient & Épisode */}
            <div className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                <span>1. Patient & Visite</span>
              </h3>

              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rechercher le dossier patient *
                </label>
                <input
                  type="text"
                  placeholder="Nom, prénom ou N° de dossier..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    if (selectedPatient) setSelectedPatient(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Résultats de recherche */}
                {patientSearchResults.length > 0 && !selectedPatient && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {patientSearchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPatient(p)}
                        className="p-2.5 hover:bg-emerald-50 cursor-pointer text-xs"
                      >
                        <div className="font-bold text-slate-900">
                          {p.nom} {p.prenom}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          N° Dossier : {p.numero_dossier} | Tél : {p.telephone}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPatient && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-emerald-950">
                    {selectedPatient.nom} {selectedPatient.prenom}
                  </div>
                  <div className="text-emerald-800 text-[11px]">
                    Né(e) le : {selectedPatient.date_naissance} ({selectedPatient.sexe})
                  </div>
                  <div className="text-emerald-800 text-[11px] font-mono">
                    Dossier : {selectedPatient.numero_dossier}
                  </div>
                </div>
              )}

              {/* Sélection visite associée */}
              {selectedPatient && patientVisites.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rattacher à une visite clinique (Optionnel)
                  </label>
                  <select
                    value={selectedVisiteId}
                    onChange={(e) => setSelectedVisiteId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white"
                  >
                    <option value="">-- Aucune visite spécifique --</option>
                    {patientVisites.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.numero_visite} - {v.type_visite} ({new Date(v.date_arrivee).toLocaleDateString('fr-FR')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observations / Références
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes sur la facture..."
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Colonne 2 : Catalogue des prestations cliquables */}
            <div className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>2. Ajouter des Prestations au Panier</span>
              </h3>

              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {availableTarifs.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleAddPrestation(t)}
                    className="p-3 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-lg cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-emerald-950">
                        {t.nom}
                      </div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {t.categorie.toLowerCase().replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-xs text-slate-900">
                        {t.prix_usd.toFixed(2)} $
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round(t.prix_usd * currentExchangeRate).toLocaleString('fr-FR')} FC
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne 3 : Panier & Récapitulatif multi-prestations */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200 flex items-center justify-between">
                  <span>3. Prestations Sélectionnées ({selectedPrestations.length})</span>
                  {selectedPrestations.length > 0 && (
                    <button
                      onClick={() => setSelectedPrestations([])}
                      className="text-[11px] text-rose-600 hover:underline font-normal"
                    >
                      Vider
                    </button>
                  )}
                </h3>

                {selectedPrestations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Cliquez sur les prestations à gauche pour les ajouter à cette facture.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 mt-2 max-h-[240px] overflow-y-auto">
                    {selectedPrestations.map((item) => (
                      <div key={item.tarif.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="pr-2">
                          <div className="font-semibold text-slate-900">{item.tarif.nom}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.tarif.prix_usd} $ x {item.quantite}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="font-bold font-mono text-slate-900">
                            {(item.tarif.prix_usd * item.quantite).toFixed(2)} $
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleUpdateQuantite(item.tarif.id, item.quantite - 1)}
                              className="w-5 h-5 bg-white border border-slate-300 rounded text-center leading-none font-bold hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-bold text-xs">{item.quantite}</span>
                            <button
                              onClick={() => handleUpdateQuantite(item.tarif.id, item.quantite + 1)}
                              className="w-5 h-5 bg-white border border-slate-300 rounded text-center leading-none font-bold hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totaux & validation */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total en USD :</span>
                  <span className="font-black font-mono text-base text-slate-900">
                    {invoiceTotalUsd.toFixed(2)} $
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Équivalent en Franc Congolais :</span>
                  <span className="font-bold font-mono text-sm text-emerald-800">
                    {invoiceTotalFc.toLocaleString('fr-FR')} FC
                  </span>
                </div>

                <button
                  onClick={handleCreateInvoice}
                  disabled={isCreatingInvoice || selectedPrestations.length === 0 || !selectedPatient}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  {isCreatingInvoice ? (
                    <span>Émission en cours...</span>
                  ) : (
                    <>
                      <span>Émettre la facture</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 3 : RAPPORTS DE CAISSE & DEVISES */}
      {activeTab === 'RAPPORTS' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>Rapports Comptables & Journal de Caisse</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ventilation exacte des encaissements par devise d'origine (USD et FC). Conversion scellée au taux du paiement.
              </p>
            </div>

            {/* Sélecteurs de filtre */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Période */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReportDateRange(r)}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      reportDateRange === r ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r === 'TODAY' ? 'Aujourd\'hui' : r === 'WEEK' ? '7 jours' : r === 'MONTH' ? '30 jours' : 'Global'}
                  </button>
                ))}
              </div>

              {/* Devise d'affichage global */}
              <div className="flex items-center space-x-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs">
                <span className="text-emerald-950 font-bold">Devise du rapport :</span>
                <button
                  onClick={() => setReportDeviseVue('FC')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    reportDeviseVue === 'FC' ? 'bg-emerald-700 text-white' : 'text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  FC (Par défaut)
                </button>
                <button
                  onClick={() => setReportDeviseVue('USD')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    reportDeviseVue === 'USD' ? 'bg-emerald-700 text-white' : 'text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  USD ($)
                </button>
              </div>

              {/* Boutons d'impression officiels des rapports financiers et de caisse */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintEtatCaisse}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Imprimer l'état de caisse de la période"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Imprimer État de Caisse</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintRapportFinancier}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Imprimer le rapport financier détaillé"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Rapport Financier</span>
                </button>
              </div>
            </div>
          </div>

          {loadingReports ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Calcul du rapport financier...
            </div>
          ) : reportsData ? (
            <div className="space-y-6">
              {/* 3 Cartes de synthèse financière */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Carte 1 : Total payé en USD */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Encaissé en USD ($)
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {reportsData.totaux_separes.total_paye_usd.toFixed(2)} $
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {reportsData.totaux_separes.nb_paiements_usd} encaissement(s) en devises étrangères
                  </div>
                </div>

                {/* Carte 2 : Total payé en FC */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Encaissé en FC (Franc Congolais)
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {reportsData.totaux_separes.total_paye_fc.toLocaleString('fr-FR')} FC
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {reportsData.totaux_separes.nb_paiements_fc} encaissement(s) en monnaie nationale
                  </div>
                </div>

                {/* Carte 3 : Total Global Consolidé (FC ou USD) */}
                <div className="bg-emerald-900 text-white p-5 rounded-xl border border-emerald-800 shadow-sm space-y-1">
                  <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider flex items-center justify-between">
                    <span>Total Global Consolidé</span>
                    <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded text-emerald-100">
                      Vue : {reportDeviseVue}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-white">
                    {reportDeviseVue === 'FC'
                      ? `${reportsData.total_global.montant_fc.toLocaleString('fr-FR')} FC`
                      : `${reportsData.total_global.montant_usd.toFixed(2)} $`}
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Conversions historiques basées sur le taux scellé à chaque paiement
                  </div>
                </div>
              </div>

              {/* Tableau du journal des encaissements */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                  Journal Chronologique des Règlements Encaissés
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">N° Reçu</th>
                        <th className="py-2.5 px-4">Date & Heure</th>
                        <th className="py-2.5 px-4">Patient</th>
                        <th className="py-2.5 px-4 text-right">Montant Réel Payé</th>
                        <th className="py-2.5 px-4 text-center">Devise</th>
                        <th className="py-2.5 px-4 text-center">Taux Scellé</th>
                        <th className="py-2.5 px-4 text-right">Équivalent ({reportDeviseVue})</th>
                        <th className="py-2.5 px-4">Caissier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportsData.paiements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400">
                            Aucun paiement enregistré pour cette période.
                          </td>
                        </tr>
                      ) : (
                        reportsData.paiements.map((p) => {
                          const equiv = reportDeviseVue === 'FC' 
                            ? `${p.equivalent_fc.toLocaleString('fr-FR')} FC`
                            : `${p.equivalent_usd.toFixed(2)} $`;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 font-mono">
                              <td className="py-2.5 px-4 font-bold text-slate-900">{p.numero_recu}</td>
                              <td className="py-2.5 px-4 text-slate-600 font-sans">
                                {new Date(p.date_paiement).toLocaleDateString('fr-FR', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </td>
                              <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                                {p.patient_nom} {p.patient_prenom} ({p.numero_dossier})
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                                {p.devise === 'USD' ? `${p.montant_paye.toFixed(2)} $` : `${p.montant_paye.toLocaleString('fr-FR')} FC`}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  p.devise === 'USD' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {p.devise}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center text-slate-500 text-[11px]">
                                1 $ = {p.taux_usd_fc.toLocaleString('fr-FR')} FC
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                                {equiv}
                              </td>
                              <td className="py-2.5 px-4 font-sans text-slate-600 text-[11px]">
                                {p.encaisse_par_nom || 'Caisse'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* MODAL ENCAISSEMENT / RÈGLEMENT */}
      {selectedFactureForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden" id="modal_cashier_payment_overlay">
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in" id="modal_cashier_payment_container">
            {lastReceipt ? (
              // Reçu confirmé
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="shrink-0 bg-slate-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm">Paiement Enregistré avec Succès</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFactureForPayment(null);
                      setLastReceipt(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Règlement Validé & Reçu Émis</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Reçu N° <span className="font-mono font-bold text-slate-800">{lastReceipt.numero_recu}</span>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Montant versé :</span>
                      <span className="font-bold text-slate-900">
                        {lastReceipt.devise === 'USD' ? `${lastReceipt.montant_paye} USD` : `${lastReceipt.montant_paye.toLocaleString('fr-FR')} FC`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Taux appliqué :</span>
                      <span>1 USD = {lastReceipt.taux_usd_fc} FC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Nouveau statut :</span>
                      <span className="font-bold text-emerald-700">{lastReceipt.facture.statut}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Solde restant :</span>
                      <span className="font-bold text-rose-700">{lastReceipt.facture.solde_usd.toFixed(2)} USD ({lastReceipt.facture.solde_fc.toLocaleString('fr-FR')} FC)</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 bg-slate-50 px-5 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedFactureForPayment(null);
                      setLastReceipt(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold min-h-[44px] flex items-center justify-center cursor-pointer"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pmtObj: Paiement = {
                        id: lastReceipt.paiement?.id || `pmt-${Date.now()}`,
                        numero_recu: lastReceipt.numero_recu,
                        facture_id: selectedFactureForPayment?.id || '',
                        montant_paye: lastReceipt.montant_paye,
                        devise: lastReceipt.devise,
                        taux_usd_fc: lastReceipt.taux_usd_fc,
                        equivalent_usd: lastReceipt.paiement?.equivalent_usd || (lastReceipt.devise === 'USD' ? lastReceipt.montant_paye : lastReceipt.montant_paye / lastReceipt.taux_usd_fc),
                        equivalent_fc: lastReceipt.paiement?.equivalent_fc || (lastReceipt.devise === 'FC' ? lastReceipt.montant_paye : lastReceipt.montant_paye * lastReceipt.taux_usd_fc),
                        mode_paiement: lastReceipt.paiement?.mode_paiement || paymentMode,
                        date_paiement: lastReceipt.paiement?.date_paiement || new Date().toISOString(),
                        encaisse_par_id: lastReceipt.paiement?.encaisse_par_id || '',
                        patient_nom: selectedFactureForPayment?.patient_nom,
                        patient_prenom: selectedFactureForPayment?.patient_prenom,
                        numero_dossier: selectedFactureForPayment?.numero_dossier,
                        numero_facture: selectedFactureForPayment?.numero_facture,
                      };
                      handlePrintPaiement(pmtObj, lastReceipt.facture);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs min-h-[44px]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer Reçu Officiel</span>
                  </button>
                </div>
              </div>
            ) : (
              // Formulaire d'encaissement
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="shrink-0 bg-slate-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
                  <h3 className="font-bold text-white text-base flex items-center space-x-2">
                    <Coins className="w-5 h-5 text-emerald-400" />
                    <span>Encaisser un règlement</span>
                  </h3>
                  <button
                    onClick={() => setSelectedFactureForPayment(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                  {/* Synthèse Facture */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Facture :</span>
                      <span className="font-bold text-slate-900">{selectedFactureForPayment.numero_facture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Patient :</span>
                      <span className="font-bold font-sans text-slate-900">
                        {selectedFactureForPayment.patient_nom} {selectedFactureForPayment.patient_prenom}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Solde à payer :</span>
                      <span className="font-black text-rose-700 text-sm">
                        {selectedFactureForPayment.solde_usd.toFixed(2)} $ (~{selectedFactureForPayment.solde_fc.toLocaleString('fr-FR')} FC)
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-sans">
                      <span>Taux officiel :</span>
                      <span>1 USD = {currentExchangeRate.toLocaleString('fr-FR')} FC</span>
                    </div>
                  </div>

                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                      {paymentError}
                    </div>
                  )}

                  {/* Choix de la Devise */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Devise de paiement acceptée au guichet *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePaymentDevise('USD')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
                          paymentDevise === 'USD'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>USD ($)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePaymentDevise('FC')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
                          paymentDevise === 'FC'
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Coins className="w-4 h-4" />
                        <span>FC (Franc Congolais)</span>
                      </button>
                    </div>
                  </div>

                  {/* Saisie du montant versé */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Montant réellement versé ({paymentDevise}) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (paymentDevise === 'USD') {
                            setPaymentMontant(selectedFactureForPayment.solde_usd.toString());
                          } else {
                            setPaymentMontant(Math.round(selectedFactureForPayment.solde_usd * currentExchangeRate).toString());
                          }
                        }}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        Régler la totalité
                      </button>
                    </div>
                    <input
                      type="number"
                      step={paymentDevise === 'USD' ? '0.5' : '100'}
                      min="0"
                      value={paymentMontant}
                      onChange={(e) => setPaymentMontant(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {paymentDevise === 'FC' && paymentMontant && !isNaN(parseFloat(paymentMontant)) && (
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Équivaut à : ~{(parseFloat(paymentMontant) / currentExchangeRate).toFixed(2)} USD au taux scellé de {currentExchangeRate} FC
                      </div>
                    )}
                  </div>

                  {/* Mode de règlement */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mode d'encaissement *
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white"
                    >
                      <option value="ESPECES">Espèces (Cash)</option>
                      <option value="MOBILE_MONEY">Mobile Money (M-Pesa, Orange, Airtel)</option>
                      <option value="CARTE_BANCAIRE">Carte Bancaire / POS</option>
                    </select>
                  </div>

                  {/* Référence transaction si mobile money */}
                  {paymentMode !== 'ESPECES' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Référence transaction / N° bordereau
                      </label>
                      <input
                        type="text"
                        placeholder="ex: MPESA-88492049"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Actions fixées en bas */}
                <div className="shrink-0 bg-slate-50 px-5 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFactureForPayment(null)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold min-h-[44px] flex items-center justify-center cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    disabled={isProcessingPayment || !paymentMontant}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-1.5 min-h-[44px] cursor-pointer"
                  >
                    {isProcessingPayment ? (
                      <span>Encaissement en cours...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider le règlement</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS FACTURE */}
      {selectedFactureForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-mono">
                  {selectedFactureForDetails.numero_facture}
                </h3>
                <div className="text-xs text-slate-500 font-sans">
                  Patient : <strong>{selectedFactureForDetails.patient_nom} {selectedFactureForDetails.patient_prenom}</strong>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePrintFacture(selectedFactureForDetails)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Facture</span>
                </button>
                <button
                  onClick={() => setSelectedFactureForDetails(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Détail financier */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs font-mono border border-slate-200">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Total Facturé</div>
                <div className="font-bold text-slate-900">{selectedFactureForDetails.montant_total_usd.toFixed(2)} $</div>
                <div className="text-[10px] text-slate-500">{selectedFactureForDetails.montant_total_fc.toLocaleString('fr-FR')} FC</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Total Payé</div>
                <div className="font-bold text-emerald-700">{selectedFactureForDetails.total_paye_usd.toFixed(2)} $</div>
                <div className="text-[10px] text-slate-500">{selectedFactureForDetails.total_paye_fc.toLocaleString('fr-FR')} FC</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Solde Dû</div>
                <div className="font-bold text-rose-700">{selectedFactureForDetails.solde_usd.toFixed(2)} $</div>
                <div className="text-[10px] text-slate-500">{selectedFactureForDetails.solde_fc.toLocaleString('fr-FR')} FC</div>
              </div>
            </div>

            {/* Lignes de prestations */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">Prestations facturées :</div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {selectedFactureForDetails.items && selectedFactureForDetails.items.length > 0 ? (
                  selectedFactureForDetails.items.map((it, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{it.description}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Quantité : {it.quantite} x {it.prix_unitaire} $</div>
                      </div>
                      <div className="font-bold font-mono text-slate-900">
                        {it.montant_ligne.toFixed(2)} $
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-400 text-center">Aucun détail de ligne</div>
                )}
              </div>
            </div>

            {/* Paiements effectués */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">Historique des versements :</div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {selectedFactureForDetails.paiements && selectedFactureForDetails.paiements.length > 0 ? (
                  selectedFactureForDetails.paiements.map((pmt, idx) => (
                    <div key={idx} className="p-2 flex justify-between items-center text-xs font-mono">
                      <div>
                        <div className="font-bold text-slate-800">{pmt.numero_recu}</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {new Date(pmt.date_paiement).toLocaleDateString('fr-FR')} - {pmt.mode_paiement}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="font-bold text-emerald-800">
                            {pmt.devise === 'USD' ? `${pmt.montant_paye} $` : `${pmt.montant_paye.toLocaleString('fr-FR')} FC`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Taux scellé : 1 $ = {pmt.taux_usd_fc} FC
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePrintPaiement({
                            ...pmt,
                            patient_nom: selectedFactureForDetails.patient_nom,
                            patient_prenom: selectedFactureForDetails.patient_prenom,
                            numero_dossier: selectedFactureForDetails.numero_dossier,
                            numero_facture: selectedFactureForDetails.numero_facture,
                          }, selectedFactureForDetails)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                          title="Imprimer ce reçu d'encaissement"
                        >
                          <Printer className="w-4 h-4 text-emerald-700" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-400 text-center">Aucun versement enregistré</div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => handlePrintFacture(selectedFactureForDetails)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer la Facture</span>
              </button>
              <button
                onClick={() => setSelectedFactureForDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D'IMPRESSION OFFICIELLE SCELLÉE */}
      {printModalState.isOpen && (
        <BillingPrintModal
          type={printModalState.type}
          facture={printModalState.facture}
          paiement={printModalState.paiement}
          reportsData={printModalState.reportsData}
          reportPeriod={printModalState.period}
          onClose={() => setPrintModalState(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};
