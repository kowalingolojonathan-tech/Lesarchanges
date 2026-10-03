import React, { useState } from 'react';
import { 
  X, Check, AlertCircle, DollarSign, Printer, CheckCircle2, 
  CreditCard, ShieldAlert, FileText, User, ArrowRight
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface LabOrderModalProps {
  order: any;
  exchangeRate?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const CollectLabOrderModal: React.FC<LabOrderModalProps> = ({
  order,
  exchangeRate = 2850,
  onClose,
  onSuccess
}) => {
  const [typeReglement, setTypeReglement] = useState<'COMPLET' | 'PARTIEL' | 'NON_PAYE'>('COMPLET');
  const [modePaiement, setModePaiement] = useState<'ESPECES' | 'MOBILE_MONEY' | 'CARTE_BANCAIRE'>('ESPECES');
  const [devisePaiement, setDevisePaiement] = useState<'USD' | 'FC'>('USD');
  const [montantPayeCustom, setMontantPayeCustom] = useState<string>('');
  const [montantRecuClient, setMontantRecuClient] = useState<string>('');
  const [referenceTransaction, setReferenceTransaction] = useState<string>('');
  const [motifNonPaiement, setMotifNonPaiement] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  const isAlreadyPaid = Boolean(
    order.statut_paiement === 'PAYÉ' ||
    (order.solde_usd !== undefined && order.solde_usd <= 0.005) ||
    order.statut_paiement_labo === 'PAYÉ' ||
    order.is_paid
  );

  React.useEffect(() => {
    if (isAlreadyPaid && !successReceipt) {
      setSuccessReceipt({
        recu: order.facture_numero ? `REC-${order.facture_numero}` : `REC-LAB-${order.numero_demande || order.id}`,
        statut_paiement: 'PAYÉ',
        message: 'Cette facture est déjà intégralement payée. Le bon d\'examen est débloqué pour le laboratoire.',
        montant_paye: order.total_paye_usd || order.montant_total_usd || (order.total_amount_usd || 10),
        devise: 'USD',
        mode_paiement: 'RÈGLEMENT GUICHET',
        date: order.date_demande ? new Date(order.date_demande).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
        patient_nom: `${order.patient_nom || ''} ${order.patient_prenom || ''}`.trim(),
        numero_dossier: order.numero_dossier,
        numero_demande: order.numero_demande,
        is_already_paid: true
      });
    }
  }, [isAlreadyPaid, order]);

  const totalUsd = order.total_amount_usd || (order.analyses ? order.analyses.length * 10 : 10);
  const totalFc = Math.round(totalUsd * exchangeRate);

  const totalDueInDevise = devisePaiement === 'USD' ? totalUsd : totalFc;

  const montantPayeNum = typeReglement === 'COMPLET' 
    ? totalDueInDevise 
    : (parseFloat(montantPayeCustom) || 0);

  const equivalentPayeUsd = devisePaiement === 'USD' 
    ? montantPayeNum 
    : (montantPayeNum / exchangeRate);

  const soldeRestantUsd = Math.max(0, totalUsd - (typeReglement === 'NON_PAYE' ? 0 : equivalentPayeUsd));
  const soldeRestantFc = Math.round(soldeRestantUsd * exchangeRate);

  const montantRecuNum = parseFloat(montantRecuClient) || 0;
  const monnaieRendre = Math.max(0, montantRecuNum - montantPayeNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (typeReglement === 'NON_PAYE' && (!motifNonPaiement || motifNonPaiement.trim().length < 4)) {
      setError('Un motif explicite est strictement obligatoire pour autoriser un examen non payé (ex: Urgence vitale, Entente administrative).');
      return;
    }

    if (typeReglement === 'PARTIEL' && (!montantPayeNum || montantPayeNum <= 0)) {
      setError('Veuillez saisir un montant versé valide supérieur à 0.');
      return;
    }

    if (typeReglement === 'PARTIEL' && montantPayeNum >= totalDueInDevise) {
      setError('Pour régler la totalité, sélectionnez "Paiement Complet".');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await apiFetch(`/api/billing/lab-orders-to-collect/${order.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_reglement: typeReglement,
          montant_paye: typeReglement === 'NON_PAYE' ? 0 : montantPayeNum,
          devise: devisePaiement,
          mode_paiement: modePaiement,
          reference_transaction: referenceTransaction || undefined,
          motif: typeReglement === 'NON_PAYE' ? motifNonPaiement.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'encaissement du bon de laboratoire.');
      }

      setSuccessReceipt({
        recu: data.recu,
        statut_paiement: data.facture?.statut || data.statut_paiement || 'PAYÉ',
        message: data.message,
        montant_paye: data.paiement?.montant_paye !== undefined ? data.paiement.montant_paye : (typeReglement === 'NON_PAYE' ? 0 : montantPayeNum),
        devise: data.paiement?.devise || devisePaiement,
        mode_paiement: data.paiement?.mode_paiement || modePaiement,
        date: data.paiement?.date_paiement ? new Date(data.paiement.date_paiement).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
        patient_nom: `${order.patient_nom || ''} ${order.patient_prenom || ''}`.trim(),
        numero_dossier: order.numero_dossier,
        numero_demande: order.numero_demande,
        is_already_paid: Boolean(data.already_paid)
      });
    } catch (err: any) {
      setError(err.message || 'Échec de la validation de l\'encaissement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in flex flex-col my-auto max-h-[92vh]">
        
        {/* En-tête */}
        <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-xl">
              <DollarSign className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">Encaissement Réception (Caisse Directe)</h3>
              <p className="text-xs text-emerald-200">
                Bon d'examen : <strong>{order.numero_demande || order.id}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (successReceipt) {
                onSuccess();
              } else {
                onClose();
              }
            }}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{error}</div>
            </div>
          )}

          {/* Écran Reçu de succès après encaissement */}
          {successReceipt ? (
            <div className="space-y-4 text-center py-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {successReceipt.is_already_paid ? 'Bon d\'Examen Intégralement Réglé' : 'Encaissement Validé avec Succès !'}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {successReceipt.message || 'Les examens sont débloqués et immédiatement visibles par le technicien au laboratoire.'}
                </p>
              </div>

              {/* Fiche Reçu officiel */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-left font-mono space-y-2 text-xs shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900">REÇU DE CAISSE ACCUEIL</span>
                  <span className="text-emerald-700 font-bold">{successReceipt.recu || 'QUITTANCE'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                  <div>Patient : <strong>{successReceipt.patient_nom}</strong></div>
                  <div>Dossier : <strong>{successReceipt.numero_dossier}</strong></div>
                  <div>Bon Labo : <strong>{successReceipt.numero_demande}</strong></div>
                  <div>Statut : <strong>{successReceipt.statut_paiement}</strong></div>
                  <div>Mode : <strong>{successReceipt.mode_paiement}</strong></div>
                  <div>Date : <strong>{successReceipt.date}</strong></div>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Montant perçu :</span>
                  <span className="text-emerald-800">
                    {successReceipt.montant_paye} {successReceipt.devise}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Reçu Patient</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Terminer</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Récapitulatif du bon et du patient */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-900 text-sm">
                      {order.patient_nom} {order.patient_prenom}
                    </span>
                    <span className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      {order.numero_dossier}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Prescrit par {order.medecin_nom || 'Médecin'}
                  </span>
                </div>

                {/* Examens demandés */}
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">
                    Examens prescrits à réaliser :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {order.analyses && order.analyses.length > 0 ? (
                      order.analyses.map((a: any, idx: number) => (
                        <span key={idx} className="bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                          🔬 {a.nom_analyse}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-[11px]">Bilan de laboratoire standard</span>
                    )}
                  </div>
                </div>

                {/* Montant total à percevoir */}
                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Total Prestation :</span>
                  <div className="text-right">
                    <span className="font-black text-slate-900 font-mono text-sm">{totalUsd.toFixed(2)} $</span>
                    <span className="text-[11px] text-slate-500 block font-mono">~{totalFc.toLocaleString('fr-FR')} FC (Taux: {exchangeRate})</span>
                  </div>
                </div>
              </div>

              {/* Sélection Type d'encaissement */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 block text-xs">
                  Option d'encaissement au guichet :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTypeReglement('COMPLET')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      typeReglement === 'COMPLET'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>Paiement Complet</div>
                    <div className="text-[10px] font-normal text-emerald-700 mt-0.5">Totalité réglée</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypeReglement('PARTIEL')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      typeReglement === 'PARTIEL'
                        ? 'bg-amber-50 text-amber-900 border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>Paiement Partiel</div>
                    <div className="text-[10px] font-normal text-amber-700 mt-0.5">Acompte versé</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypeReglement('NON_PAYE')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      typeReglement === 'NON_PAYE'
                        ? 'bg-rose-50 text-rose-900 border-rose-600 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>Non Payé</div>
                    <div className="text-[10px] font-normal text-rose-700 mt-0.5">Avec Dérogation</div>
                  </button>
                </div>
              </div>

              {/* Si Dérogation (Non payé) */}
              {typeReglement === 'NON_PAYE' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 text-rose-900 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Dérogation Financière Obligatoire</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Un motif explicite est requis pour autoriser l'exécution des examens sans paiement préalable (ex: Urgence vitale, Indigent prise en charge direction, Entente mutuelle).
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Motif de la dérogation (traçabilité audit) *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={motifNonPaiement}
                      onChange={(e) => setMotifNonPaiement(e.target.value)}
                      placeholder="Ex: Urgence médicale vitale validée par la direction, paiement différé après stabilisation..."
                      className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Si Paiement Complet ou Partiel */}
              {typeReglement !== 'NON_PAYE' && (
                <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Devise */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Devise perçue :
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDevisePaiement('USD')}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            devisePaiement === 'USD'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDevisePaiement('FC')}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            devisePaiement === 'FC'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          FC (Franc)
                        </button>
                      </div>
                    </div>

                    {/* Mode de règlement */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Moyen de paiement :
                      </label>
                      <select
                        value={modePaiement}
                        onChange={(e) => setModePaiement(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                      >
                        <option value="ESPECES">Espèces (Cash)</option>
                        <option value="MOBILE_MONEY">Mobile Money (M-Pesa/Airtel/Orange)</option>
                        <option value="CARTE_BANCAIRE">Carte Bancaire / TPE</option>
                      </select>
                    </div>
                  </div>

                  {/* Montant perçu */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      Montant encaissé ({devisePaiement}) :
                    </label>
                    <input
                      type="number"
                      step={devisePaiement === 'USD' ? '0.5' : '100'}
                      min="0.1"
                      value={typeReglement === 'COMPLET' ? totalDueInDevise : (montantPayeCustom || '')}
                      disabled={typeReglement === 'COMPLET'}
                      onChange={(e) => setMontantPayeCustom(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg font-mono font-bold text-sm ${
                        typeReglement === 'COMPLET'
                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-white text-slate-900 border-emerald-500 ring-2 ring-emerald-500/20'
                      }`}
                    />
                  </div>

                  {/* Monnaie si espèces */}
                  {modePaiement === 'ESPECES' && (
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1 text-[10px]">
                          Somme remise par le patient :
                        </label>
                        <input
                          type="number"
                          step={devisePaiement === 'USD' ? '1' : '500'}
                          value={montantRecuClient}
                          placeholder={String(montantPayeNum)}
                          onChange={(e) => setMontantRecuClient(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1 text-[10px]">
                          Monnaie à rendre :
                        </label>
                        <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg font-mono font-bold text-emerald-800 text-xs">
                          {monnaieRendre.toLocaleString('fr-FR')} {devisePaiement}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Référence mobile */}
                  {modePaiement !== 'ESPECES' && (
                    <div>
                      <label className="block font-medium text-slate-600 mb-1 text-[11px]">
                        N° de référence transaction / reçu :
                      </label>
                      <input
                        type="text"
                        value={referenceTransaction}
                        placeholder="Ex: MPESA-89218320"
                        onChange={(e) => setReferenceTransaction(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {/* Si partiel, rappel du solde restant */}
                  {typeReglement === 'PARTIEL' && soldeRestantUsd > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-[11px] text-amber-900 font-mono">
                      <span>Reste à payer :</span>
                      <strong>{soldeRestantUsd.toFixed(2)} $ (~{soldeRestantFc.toLocaleString('fr-FR')} FC)</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Bouton de validation */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting 
                      ? 'Validation en cours...' 
                      : (typeReglement === 'NON_PAYE'
                          ? 'Valider Dérogation & Débloquer au Labo'
                          : `Encaisser ${montantPayeNum} ${devisePaiement} & Débloquer au Labo`)}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
