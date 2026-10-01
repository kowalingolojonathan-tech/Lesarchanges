import React from 'react';
import { Printer, X, FileText, Receipt, CheckCircle, Clock } from 'lucide-react';
import { Facture, Paiement, BillingReportsData } from '../../types/index.js';

export type BillingPrintType = 'FACTURE' | 'RECU' | 'ETAT_CAISSE' | 'RAPPORT_FINANCIER';

interface BillingPrintModalProps {
  type: BillingPrintType;
  facture?: Facture | null;
  paiement?: Paiement | null;
  reportsData?: BillingReportsData | null;
  reportPeriod?: string;
  onClose: () => void;
}

export const BillingPrintModal: React.FC<BillingPrintModalProps> = ({
  type,
  facture,
  paiement,
  reportsData,
  reportPeriod,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Barre d'outils (Non imprimée) */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print sticky top-0 z-10">
          <span className="font-bold text-slate-800 text-sm flex items-center">
            {type === 'FACTURE' && <FileText className="w-4 h-4 mr-2 text-emerald-700" />}
            {type === 'RECU' && <Receipt className="w-4 h-4 mr-2 text-emerald-700" />}
            {(type === 'ETAT_CAISSE' || type === 'RAPPORT_FINANCIER') && <Printer className="w-4 h-4 mr-2 text-purple-700" />}
            {type === 'FACTURE' && `Aperçu Impression — Facture ${facture?.numero_facture || ''}`}
            {type === 'RECU' && `Aperçu Impression — Reçu N° ${paiement?.numero_recu || ''}`}
            {type === 'ETAT_CAISSE' && 'Aperçu Impression — État de Caisse'}
            {type === 'RAPPORT_FINANCIER' && 'Aperçu Impression — Rapport Financier Autorisé'}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimer Document
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zone imprimable officielle scellée */}
        <div id="printable-document" className="p-8 sm:p-10 text-slate-900 bg-white font-sans text-xs">
          {/* En-tête officiel de la clinique */}
          <div className="border-b-2 border-emerald-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-emerald-900">
                  Clinique Les Archanges
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Téléphone : +243 989 715 771 • Horaires : Ouvert 24h/24 et 7j/7.
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs uppercase rounded">
                  {type === 'FACTURE' && 'Facture Officielle'}
                  {type === 'RECU' && 'Reçu de Paiement'}
                  {type === 'ETAT_CAISSE' && 'Journal de Caisse'}
                  {type === 'RAPPORT_FINANCIER' && 'Rapport Financier'}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Édité le {todayStr}</p>
              </div>
            </div>
          </div>

          {/* 1. VUE FACTURE */}
          {type === 'FACTURE' && facture && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Références Facture</div>
                  <div className="font-mono font-bold text-sm text-slate-900">{facture.numero_facture}</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Date d'émission : {new Date(facture.created_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Statut : <strong className={facture.statut === 'PAYÉ' ? 'text-emerald-700' : facture.statut === 'PARTIELLEMENT PAYÉ' ? 'text-amber-700' : 'text-rose-700'}>{facture.statut}</strong>
                  </div>
                  {facture.emise_par_nom && (
                    <div className="text-[11px] text-slate-500">Émise par : {facture.emise_par_nom}</div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Patient Facturé</div>
                  <div className="font-bold text-sm text-slate-900">
                    {facture.patient_nom} {facture.patient_prenom}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 mt-1">
                    Dossier N° : <strong>{facture.numero_dossier}</strong>
                  </div>
                  {facture.patient_telephone && (
                    <div className="text-[11px] text-slate-600">Tél : {facture.patient_telephone}</div>
                  )}
                  {facture.numero_visite && (
                    <div className="text-[11px] text-slate-500">Visite N° : {facture.numero_visite}</div>
                  )}
                </div>
              </div>

              {/* Tableau des prestations */}
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-[11px] uppercase text-slate-700 font-bold">
                      <th className="py-2">Description de la Prestation</th>
                      <th className="py-2 text-center">Catégorie</th>
                      <th className="py-2 text-center">Quantité</th>
                      <th className="py-2 text-right">Prix Unitaire (USD)</th>
                      <th className="py-2 text-right">Total (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {facture.items && facture.items.length > 0 ? (
                      facture.items.map((it, idx) => (
                        <tr key={idx} className="py-2">
                          <td className="py-2 font-medium">{it.description}</td>
                          <td className="py-2 text-center text-slate-500 text-[10px]">{it.categorie || '—'}</td>
                          <td className="py-2 text-center font-mono">{it.quantite}</td>
                          <td className="py-2 text-right font-mono">{it.prix_unitaire.toFixed(2)} $</td>
                          <td className="py-2 text-right font-mono font-bold">{it.montant_ligne.toFixed(2)} $</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">Aucune ligne enregistrée</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Synthèse financière avec taux scellé */}
              <div className="flex justify-end pt-2">
                <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 font-mono">
                  <div className="flex justify-between text-xs font-bold border-b border-slate-200 pb-1.5">
                    <span className="font-sans font-normal text-slate-600">Total Prestations (USD) :</span>
                    <span>{facture.montant_total_usd.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span className="font-sans">Taux de conversion scellé :</span>
                    <span>1 $ = {facture.taux_usd_fc.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold border-b border-slate-200 pb-1.5">
                    <span className="font-sans font-normal text-slate-600">Équivalent Franc Congolais :</span>
                    <span>{facture.montant_total_fc.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700">
                    <span className="font-sans">Total Déjà Réglé :</span>
                    <span className="font-bold">{facture.total_paye_usd.toFixed(2)} $ ({facture.total_paye_fc.toLocaleString('fr-FR')} FC)</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-rose-700 pt-1 border-t border-slate-300">
                    <span className="font-sans">Solde Restant Dû :</span>
                    <span>{facture.solde_usd.toFixed(2)} $</span>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 font-sans">
                    soit {facture.solde_fc.toLocaleString('fr-FR')} FC
                  </div>
                </div>
              </div>

              {/* Historique des paiements versés */}
              {facture.paiements && facture.paiements.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-800 uppercase mb-2">Historique des versements :</div>
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600">
                        <th className="py-1.5 px-2">Reçu N°</th>
                        <th className="py-1.5 px-2">Date</th>
                        <th className="py-1.5 px-2">Mode</th>
                        <th className="py-1.5 px-2 text-right">Montant Perçu</th>
                        <th className="py-1.5 px-2 text-right">Taux Appliqué</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {facture.paiements.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-1 px-2 font-bold">{p.numero_recu}</td>
                          <td className="py-1 px-2">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                          <td className="py-1 px-2 font-sans">{p.mode_paiement}</td>
                          <td className="py-1 px-2 text-right font-bold text-emerald-700">
                            {p.devise === 'USD' ? `${p.montant_paye} $` : `${p.montant_paye.toLocaleString('fr-FR')} FC`}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-500">1 $ = {p.taux_usd_fc} FC</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center">
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Le Patient / Mandataire</p>
                  <div className="h-16 border-b border-slate-300 mt-2"></div>
                  <p className="text-[10px] text-slate-400 mt-1">Signature pour accord</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Service de Facturation & Caisse</p>
                  <div className="h-16 border-b border-slate-300 mt-2 flex items-center justify-center">
                    <span className="text-[10px] uppercase text-slate-400 border border-dashed border-slate-300 px-3 py-1">
                      Cachet & Signature
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Clinique Les Archanges Kinshasa</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. VUE REÇU DE PAIEMENT */}
          {type === 'RECU' && paiement && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Références Reçu</div>
                  <div className="font-mono font-bold text-base text-emerald-800">{paiement.numero_recu}</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Date : {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')} {new Date(paiement.date_paiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {paiement.numero_facture && (
                    <div className="text-[11px] text-slate-600">Facture liée : <strong>{paiement.numero_facture}</strong></div>
                  )}
                  {paiement.encaisse_par_nom && (
                    <div className="text-[11px] text-slate-500">Encaissé par : {paiement.encaisse_par_nom}</div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Patient</div>
                  <div className="font-bold text-sm text-slate-900">
                    {paiement.patient_nom} {paiement.patient_prenom}
                  </div>
                  {paiement.numero_dossier && (
                    <div className="text-[11px] font-mono text-slate-600 mt-1">
                      Dossier N° : <strong>{paiement.numero_dossier}</strong>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-600">
                    Mode d'encaissement : <strong>{paiement.mode_paiement}</strong>
                  </div>
                  {paiement.reference_transaction && (
                    <div className="text-[10px] font-mono text-slate-500">Réf : {paiement.reference_transaction}</div>
                  )}
                </div>
              </div>

              {/* Montant scellé */}
              <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-1">
                <span className="text-xs uppercase font-bold text-emerald-900 tracking-wider">Montant Réellement Perçu</span>
                <div className="text-2xl font-black text-emerald-900 font-mono">
                  {paiement.devise === 'USD'
                    ? `${paiement.montant_paye.toFixed(2)} USD`
                    : `${paiement.montant_paye.toLocaleString('fr-FR')} FC`}
                </div>
                <div className="text-xs text-emerald-700 font-mono pt-1">
                  {paiement.devise === 'USD'
                    ? `Soit ~${paiement.equivalent_fc.toLocaleString('fr-FR')} FC au taux scellé de 1 USD = ${paiement.taux_usd_fc} FC`
                    : `Soit ~${paiement.equivalent_usd.toFixed(2)} USD au taux scellé de 1 USD = ${paiement.taux_usd_fc} FC`}
                </div>
              </div>

              {/* État de la facture si fournie */}
              {facture && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono space-y-1.5">
                  <div className="text-[10px] font-bold font-sans uppercase text-slate-500 mb-1">
                    Situation du compte après ce versement :
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-600">Total facturé :</span>
                    <span>{facture.montant_total_usd.toFixed(2)} USD ({facture.montant_total_fc.toLocaleString('fr-FR')} FC)</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span className="font-sans">Total versé cumulé :</span>
                    <span>{facture.total_paye_usd.toFixed(2)} USD ({facture.total_paye_fc.toLocaleString('fr-FR')} FC)</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold border-t border-slate-200 pt-1">
                    <span className="font-sans">Solde restant dû :</span>
                    <span>{facture.solde_usd.toFixed(2)} USD ({facture.solde_fc.toLocaleString('fr-FR')} FC)</span>
                  </div>
                  <div className="flex justify-between text-slate-800">
                    <span className="font-sans font-bold">Statut de la facture :</span>
                    <span className="font-bold">{facture.statut}</span>
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center">
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Le Patient / Dépositaire</p>
                  <div className="h-16 border-b border-slate-300 mt-2"></div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Pour Acquit — Caissier</p>
                  <div className="h-16 border-b border-slate-300 mt-2 flex items-center justify-center">
                    <span className="text-[10px] uppercase text-emerald-800 font-bold border border-dashed border-emerald-400 px-3 py-1">
                      Payé & Encaissé
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Clinique Les Archanges</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. VUE ÉTAT DE CAISSE / RAPPORT FINANCIER */}
          {(type === 'ETAT_CAISSE' || type === 'RAPPORT_FINANCIER') && reportsData && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Période concernée : </span>
                  <strong className="text-slate-900">{reportPeriod || 'Période courante'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Nombre de règlements : </span>
                  <strong className="text-slate-900 font-mono">{reportsData.paiements.length}</strong>
                </div>
              </div>

              {/* Totaux séparés et globaux */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-[10px] text-blue-700 font-sans font-bold">Total Perçu en USD</div>
                  <div className="text-base font-black text-blue-950 mt-1">
                    {reportsData.totaux_separes.total_paye_usd.toFixed(2)} $
                  </div>
                  <div className="text-[10px] text-blue-600 font-sans mt-0.5">
                    {reportsData.totaux_separes.nb_paiements_usd} versement(s)
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-[10px] text-emerald-700 font-sans font-bold">Total Perçu en FC</div>
                  <div className="text-base font-black text-emerald-950 mt-1">
                    {reportsData.totaux_separes.total_paye_fc.toLocaleString('fr-FR')} FC
                  </div>
                  <div className="text-[10px] text-emerald-600 font-sans mt-0.5">
                    {reportsData.totaux_separes.nb_paiements_fc} versement(s)
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-[10px] text-purple-700 font-sans font-bold">Total Global (en FC)</div>
                  <div className="text-base font-black text-purple-950 mt-1">
                    {reportsData.total_global.montant_fc.toLocaleString('fr-FR')} FC
                  </div>
                  <div className="text-[10px] text-purple-600 font-sans mt-0.5">
                    Conversion scellée
                  </div>
                </div>

                <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg">
                  <div className="text-[10px] text-slate-700 font-sans font-bold">Total Global (en USD)</div>
                  <div className="text-base font-black text-slate-900 mt-1">
                    {reportsData.total_global.montant_usd.toFixed(2)} $
                  </div>
                  <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                    Tous modes confondus
                  </div>
                </div>
              </div>

              {/* Journal détaillé des paiements */}
              <div>
                <div className="text-xs font-bold text-slate-800 uppercase mb-2">
                  Détail chronologique des encaissements :
                </div>
                <table className="w-full text-left border-collapse text-[10px] font-mono">
                  <thead>
                    <tr className="bg-slate-800 text-white font-sans uppercase">
                      <th className="py-1.5 px-2">Reçu N°</th>
                      <th className="py-1.5 px-2">Date</th>
                      <th className="py-1.5 px-2">Facture</th>
                      <th className="py-1.5 px-2">Patient</th>
                      <th className="py-1.5 px-2">Mode</th>
                      <th className="py-1.5 px-2 text-right">Montant Perçu</th>
                      <th className="py-1.5 px-2 text-right">Équiv. FC</th>
                      <th className="py-1.5 px-2 text-right">Équiv. USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportsData.paiements && reportsData.paiements.length > 0 ? (
                      reportsData.paiements.map((p, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="py-1.5 px-2 font-bold">{p.numero_recu}</td>
                          <td className="py-1.5 px-2">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                          <td className="py-1.5 px-2">{p.numero_facture || '—'}</td>
                          <td className="py-1.5 px-2 font-sans">{p.patient_nom} {p.patient_prenom}</td>
                          <td className="py-1.5 px-2 font-sans">{p.mode_paiement}</td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-800">
                            {p.devise === 'USD' ? `${p.montant_paye} $` : `${p.montant_paye.toLocaleString('fr-FR')} FC`}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">{p.equivalent_fc.toLocaleString('fr-FR')} FC</td>
                          <td className="py-1.5 px-2 text-right text-slate-600">{p.equivalent_usd.toFixed(2)} $</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-slate-400">Aucun encaissement sur cette période</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center">
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Le Responsable de Caisse</p>
                  <div className="h-16 border-b border-slate-300 mt-2"></div>
                  <p className="text-[10px] text-slate-400 mt-1">Certification de l'exactitude des écritures</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">Visa de la Direction / Administration</p>
                  <div className="h-16 border-b border-slate-300 mt-2 flex items-center justify-center">
                    <span className="text-[10px] uppercase text-slate-400 border border-dashed border-slate-300 px-3 py-1">
                      Approuvé & Enregistré
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Clinique Les Archanges</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
