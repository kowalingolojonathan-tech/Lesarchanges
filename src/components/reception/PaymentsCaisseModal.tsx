import React, { useState, useEffect } from 'react';
import {
  X, CreditCard, DollarSign, User, FlaskConical, CheckCircle2, RefreshCw, FileText
} from 'lucide-react';
import { CollectLabOrderModal } from './CollectLabOrderModal';
import { apiFetch } from '../../lib/api';

interface PaymentsCaisseModalProps {
  onClose: () => void;
}

export const PaymentsCaisseModal: React.FC<PaymentsCaisseModalProps> = ({ onClose }) => {
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(2850);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await apiFetch('/api/billing/lab-orders-to-collect');
      if (res.ok) {
        const data = await res.json();
        setLabOrders(data.lab_orders || []);
      }
    } catch (err) {
      console.error('Erreur chargement examens à encaisser:', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/api/factures?statut=NON%20PAY%E9');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.factures || []);
      }
    } catch (err) {
      console.error('Erreur chargement factures:', err);
    }
  };

  const fetchRate = async () => {
    try {
      const res = await apiFetch('/api/billing/exchange-rate');
      if (res.ok) {
        const data = await res.json();
        if (data.rate) setExchangeRate(data.rate);
      }
    } catch (err) {
      console.error('Erreur taux de change:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchOrders(), fetchInvoices(), fetchRate()]).finally(() => setLoading(false));
  }, []);

  const unpaidLabOrders = labOrders.filter((o) =>
    o.statut_paiement !== 'PAYÉ' &&
    (o.solde_usd === undefined || o.solde_usd > 0.01) &&
    !o.is_paid
  );

  const partialLabOrders = labOrders.filter((o) => o.statut_paiement === 'PARTIELLEMENT PAYÉ');
  const pendingInvoices = invoices.filter((f) => f.statut === 'NON PAYÉ' || f.statut === 'PARTIELLEMENT PAYÉ');

  const totalPendingUsd = unpaidLabOrders.reduce((sum, o) => sum + (o.total_amount_usd || 0), 0)
    + pendingInvoices.reduce((sum, f) => sum + (f.montant_total || 0), 0);
  const totalPartialUsd = partialLabOrders.reduce((sum, o) => sum + (o.solde_usd || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* En-tête */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Paiements / Caisse — Encaissements en attente</h3>
              <p className="text-xs text-emerald-200">
                {unpaidLabOrders.length + pendingInvoices.length} facture(s) en attente • Taux: {exchangeRate.toLocaleString('fr-FR')} FC/$
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => Promise.all([fetchOrders(), fetchInvoices(), fetchRate()])}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/60 rounded-lg transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Résumé financier */}
        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-700">Total en attente:</span>
            <span className="font-black text-emerald-900 font-mono">{totalPendingUsd.toFixed(2)} $</span>
            <span className="text-[10px] text-emerald-600 font-mono">(~{Math.round(totalPendingUsd * exchangeRate).toLocaleString('fr-FR')} FC)</span>
          </div>
          {partialLabOrders.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-amber-700">Soldes partiel:</span>
              <span className="font-black text-amber-900 font-mono">{totalPartialUsd.toFixed(2)} $</span>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-slate-400">Chargement des encaissements...</p>
            </div>
          ) : unpaidLabOrders.length === 0 && pendingInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-sm font-semibold text-slate-500">Aucun encaissement en attente</p>
              <p className="text-xs mt-1">Toutes les factures sont réglées.</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* Factures impayées */}
              {pendingInvoices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Factures à encaisser</span>
                    <span className="text-[10px] font-bold px-2 py-0.25 rounded-full bg-rose-100 text-rose-700 border border-rose-300">{pendingInvoices.length}</span>
                  </div>
                  <div className="space-y-2">
                    {pendingInvoices.map((fac) => {
                      const solde = fac.solde_usd !== undefined ? fac.solde_usd : fac.montant_total;
                      return (
                        <div key={fac.id} className="bg-white rounded-xl border border-rose-200 p-3 flex items-center gap-3 hover:border-rose-400 transition-colors">
                          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">{fac.numero_facture || 'FAC'}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.25 rounded-full border ${
                                fac.statut === 'PARTIELLEMENT PAYÉ' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                {fac.statut}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-700 font-medium truncate">
                              {fac.patient_nom} {fac.patient_prenom}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Dossier: {fac.numero_dossier} • Visites: {fac.numero_visite || '-'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-slate-900 font-mono text-sm">{solde.toFixed(2)} $</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ~{Math.round(solde * exchangeRate).toLocaleString('fr-FR')} FC
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Examens labo à encaisser */}
              {unpaidLabOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="w-4 h-4 text-emerald-700" />
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Examens labo à encaisser</span>
                    <span className="text-[10px] font-bold px-2 py-0.25 rounded-full bg-rose-100 text-rose-700 border border-rose-300">{unpaidLabOrders.length}</span>
                  </div>
                  <div className="space-y-2">
                    {unpaidLabOrders.map((order) => {
                      const totalUsd = order.total_amount_usd || 10;
                      const totalFc = Math.round(totalUsd * exchangeRate);
                      const isPartial = order.statut_paiement === 'PARTIELLEMENT PAYÉ';
                      const hasDerogation = order.has_derogation;

                      return (
                        <div
                          key={order.id}
                          className={`rounded-xl border p-3 flex flex-col gap-2 transition-all hover:shadow-sm ${
                            isPartial ? 'border-amber-300 bg-amber-50/30' :
                            hasDerogation ? 'border-blue-200 bg-blue-50/30' :
                            'border-rose-200 bg-rose-50/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-2 rounded-lg shrink-0 ${
                                isPartial ? 'bg-amber-100 text-amber-700' :
                                hasDerogation ? 'bg-blue-100 text-blue-700' :
                                'bg-rose-100 text-rose-700'
                              }`}>
                                <FlaskConical className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {order.numero_demande || 'LAB-BON'}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.25 rounded-full border ${
                                    isPartial ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                    hasDerogation ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                    'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {isPartial ? 'PARTIEL' : hasDerogation ? 'DÉROGATION' : 'À ENCAISSER'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {order.patient_nom} {order.patient_prenom}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {order.numero_dossier}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Prescrit par <strong className="text-slate-700">{order.medecin_nom || 'Médecin'}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-black text-slate-900 font-mono text-sm">
                                {totalUsd.toFixed(2)} $
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                ~{totalFc.toLocaleString('fr-FR')} FC
                              </div>
                            </div>
                          </div>

                          {order.analyses && order.analyses.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {order.analyses.map((a: any, idx: number) => (
                                <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                  🔬 {a.nom_analyse}
                                </span>
                              ))}
                            </div>
                          )}

                          {hasDerogation && order.motif && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-900">
                              <strong>Motif dérogation:</strong> {order.motif}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Encaisser maintenant</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Soldes partiels labo */}
              {partialLabOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="w-4 h-4 text-amber-700" />
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Soldes restants (labo)</span>
                    <span className="text-[10px] font-bold px-2 py-0.25 rounded-full bg-amber-100 text-amber-700 border border-amber-300">{partialLabOrders.length}</span>
                  </div>
                  <div className="space-y-2">
                    {partialLabOrders.map((order) => {
                      const soldeUsd = order.solde_usd || 0;
                      return (
                        <div key={order.id} className="rounded-xl border border-amber-300 bg-amber-50/40 p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                                <FlaskConical className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {order.numero_demande || 'LAB-BON'}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                    PARTIEL
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {order.patient_nom} {order.patient_prenom}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {order.numero_dossier}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Prescrit par <strong className="text-slate-700">{order.medecin_nom || 'Médecin'}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-black text-amber-900 font-mono text-sm">
                                {soldeUsd.toFixed(2)} $
                              </div>
                              <div className="text-[10px] text-amber-700 font-mono">
                                ~{Math.round(soldeUsd * exchangeRate).toLocaleString('fr-FR')} FC restant
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Encaisser le solde</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal d'encaissement individuel */}
      {selectedOrder && (
        <CollectLabOrderModal
          order={selectedOrder}
          exchangeRate={exchangeRate}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            Promise.all([fetchOrders(), fetchInvoices()]).then(fetchRate);
          }}
        />
      )}
    </div>
  );
};
