import React, { useState, useEffect } from 'react';
import { X, Package, CheckCircle2, DollarSign, TrendingUp, Calendar, AlertTriangle, ShieldCheck, User, Search, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { CatalogueMedicament, LotMedicament } from '../../types/index';
import { useAuth } from '../../context/AuthContext.js';

type ActiveTab = 'DETAILS' | 'SELECTION' | 'RESUME' | 'HISTORIQUE';

interface PharmacyPosPrescription {
  id: string;
  code: string;
  nom_commercial: string;
  nom_generique?: string | null;
  classe_therapeutique?: string | null;
  forme?: string | null;
  dosage_unit?: string | null;
  actif: number | boolean;
  prix_autorise_usd: number;
  stock_disponible: number;
  alerte?: string | null;
  lot_info?: PharmacyPosLot | null;
}

interface PharmacyPosLot {
  id: string;
  numero_lot: string;
  date_peremption: string;
  quantite_recue: number;
  quantite_en_cours: number;
  fournisseur?: string | null;
}

interface PharmacyPosData {
  patient: {
    id: string;
    numero_dossier: string;
    nom: string;
    prenom: string;
    telephone: string;
  };
  prescription: {
    id: string;
    numero_visite: string;
    medecin_nom: string;
    statut: string;
    items: PharmacyPosPrescription[];
  };
  medicaments: PharmacyPosPrescription[];
  total_prescrit: number;
}

interface SelectionItem {
  item_id: string;
  nom_medicament: string;
  quantite_prescrite: number;
  quantite_selectionnee: number;
  prix_unitaire: number;
  sous_total: number;
  lot_info: PharmacyPosLot | null;
  actif: boolean;
}

interface PharmacyPosState {
  medicaments: PharmacyPosPrescription[];
  selections: SelectionItem[];
  total_usd: number;
  total_fc: number;
  loading: boolean;
  error: string | null;
  patient: {
    id: string;
    numero_dossier: string;
    nom: string;
    prenom: string;
    telephone: string;
  };
  prescription_id: string;
  visite_id: string;
  medecin_nom: string;
  statut: string;
  cultureRate: number;
}

const calculateFC = (usd: number, rate: number): number => {
  return Math.round(usd * rate);
};

interface PharmacyPosViewProps {
  prescriptionId: string;
  onNavigate: (tab: string) => void;
}

export const PharmacyPosView: React.FC<PharmacyPosViewProps> = ({ prescriptionId, onNavigate }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('DETAILS');
  const [posData, setPosData] = useState<PharmacyPosState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quantiteSelectionnee, setQuantiteSelectionnee] = useState<number>(1);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [cultureRate, setCultureRate] = useState<number>(2850);
  const [lastFactureId, setLastFactureId] = useState<string | null>(null);

  // Charger le taux de change
  useEffect(() => {
    apiFetch('/api/billing/exchange-rate')
      .then((res) => {
        if (res.ok) {
          res.json().then((data) => {
            setCultureRate(data.rate || 2850);
          });
        }
      })
      .catch((err) => console.error('Erreur taux de change:', err));
  }, []);

  // Charger les données POS lorsqu'une prescription est sélectionnée
  const loadPosData = async (presId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/pharmacie/pos', {
        method: 'POST',
        body: JSON.stringify({ prescription_id: presId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const initialSelections: SelectionItem[] = (data.medicaments || []).map((med: any) => ({
          item_id: med.item_id || med.id,
          nom_medicament: med.nom_medicament || med.nom_commercial,
          quantite_prescrite: med.quantite_prescrite || 1,
          quantite_selectionnee: 0,
          prix_unitaire: med.prix_unitaire || med.prix_autorise_usd || 0,
          sous_total: 0,
          lot_info: med.lot_info ? {
            id: med.lot_info.lot_id || med.lot_info.id,
            numero_lot: med.lot_info.numero_lot,
            date_peremption: med.lot_info.date_peremption,
            quantite_recue: med.lot_info.quantite_recue,
            quantite_en_cours: med.lot_info.quantite_en_cours,
            fournisseur: med.lot_info.fournisseur
          } : null,
          actif: med.actif !== false
        }));
        setPosData({
          ...data,
          selections: initialSelections,
          total_usd: 0,
          total_fc: 0,
          loading: false,
          error: null
        });
      } else {
        setError(data.error || 'Erreur chargement POS pharmacie');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prescriptionId) {
      loadPosData(prescriptionId);
    }
  }, [prescriptionId]);

  // Mettre à jour la sélection d'un médicament
  const handleSelectMedicament = (itemId: string, quantite: number) => {
    setPosData((prev) => {
      if (!prev) return prev;

      const newSelections = prev.selections.map((sel) => {
        if (sel.item_id === itemId) {
          const nouvelleQuantite = Math.max(0, Math.min(
            sel.quantite_prescrite,
            quantite
          ));
          const sous_total = Math.round(nouvelleQuantite * sel.prix_unitaire * 100) / 100;
          return {
            ...sel,
            quantite_selectionnee: nouvelleQuantite,
            sous_total: isFinite(sous_total) ? sous_total : 0
          };
        }
        return sel;
      });

      const nouveauTotal = newSelections.reduce(
        (sum, sel) => sum + sel.sous_total, 0
      );

      return {
        ...prev,
        selections: newSelections,
        total_usd: nouveauTotal,
        total_fc: calculateFC(nouveauTotal, cultureRate)
      };
    });
  };

  // Valider la sélection et créer la facture
  const handleConfirmer = async () => {
    if (!posData) return;

    // Vérifier qu'au moins un médicament est sélectionné
    const selectionsNonVides = posData.selections.filter((s) => s.quantite_selectionnee > 0);
    if (selectionsNonVides.length === 0) {
      setError('Veuillez sélectionner au moins un médicament.');
      return;
    }

    setShowConfirmation(false);
    setLoading(true);
    setError(null);

    try {
      // 1. Créer la facture avec seulement les médicaments sélectionnés
      const itemsASigner = posData.selections
        .filter((s) => s.quantite_selectionnee > 0)
        .map((s) => ({
          description: s.nom_medicament,
          categorie: 'PHARMACIE',
          quantite: s.quantite_selectionnee,
          prix_unitaire: s.prix_unitaire,
          tarif_id: s.item_id
        }));

      const factureResult = await apiFetch('/api/pharmacie/pos/facture', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: posData.patient.id,
          visite_id: posData.visite_id,
          type_prestation: 'PHARMACIE',
          items: itemsASigner,
          emise_par_id: user?.id || 'usr-recep-01'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const factureData = await factureResult.json();
      if (!factureResult.ok) {
        throw new Error(factureData.error || 'Erreur création facture');
      }

      if (factureData.isDuplicate) {
        throw new Error('Une facture identique existe déjà pour cette vente.');
      }

      const nouvelleFacture = factureData.facture;
      setLastFactureId(nouvelleFacture?.id || null);

      // 2. Enregistrer le paiement (montant en USD)
      const montantUsd = nouvelleFacture?.montant_total || 0;
      const resPaiement = await apiFetch('/api/pharmacie/pos/paiement', {
        method: 'POST',
        body: JSON.stringify({
          id: nouvelleFacture.id,
          prescription_id: posData.prescription_id,
          montant_paye: montantUsd,
          devise: 'USD',
          mode_paiement: 'ESPECES'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const paiementResult = await resPaiement.json();
      if (!resPaiement.ok) {
        throw new Error(paiementResult.error || 'Erreur enregistrement paiement');
      }

      setPosData(null);
      setShowSuccess(true);
      setLoading(false);

      setTimeout(() => {
        setShowSuccess(false);
        onNavigate('dashboard');
      }, 3000);
    } catch (err: any) {
      console.error('Erreur confirmation POS:', err);
      setError(err.message || 'Erreur lors de la confirmation');
      setLoading(false);
    }
  };

  // Annuler la sélection
  const handleAnnuler = () => {
    setPosData(null);
    setError(null);
    setQuantiteSelectionnee(1);
    setShowConfirmation(false);
    setLastFactureId(null);
    onNavigate('dashboard');
  };

  useEffect(() => {
    // Le chargement se fait via useEffect sur prescriptionId
  }, []);

  return (
    <div className="space-y-6">
      {posData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              <Package className="w-6 h-6 mr-2 text-emerald-600" />
              Pharmacie - Point de Vente
            </h2>
            <button onClick={handleAnnuler} className="p-2 rounded-full hover:bg-slate-100 transition-colors" title="Annuler">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-bold text-slate-900">Patient :</div>
                <div className="text-slate-700">
                  {posData.patient.nom} {posData.patient.prenom}
                  <span className="text-xs text-slate-500">({posData.patient.numero_dossier})</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-slate-600" />
              <div>
                <div className="font-bold text-slate-900">Ordonnance :</div>
                <div className="text-slate-700">
                  {posData.prescription_id} — {posData.statut || 'EN_COURS'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-4">
            <button onClick={() => setActiveTab('DETAILS')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'DETAILS' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              Détails des médicaments
            </button>
            <button onClick={() => setActiveTab('SELECTION')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'SELECTION' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              Sélection médicaments
            </button>
            <button onClick={() => setActiveTab('RESUME')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'RESUME' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              Résumé & Paiement
            </button>
          </div>

          {activeTab === 'DETAILS' && (
            <div className="space-y-4">
              {posData?.medicaments.map((med) => (
                <div key={med.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{med.nom_commercial}</h3>
                      {med.alerte && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {med.alerte}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {med.stock_disponible !== undefined ? `Stock: ${med.stock_disponible}` : 'Stock inconnu'}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Quantité prescrite: {med.stock_disponible} unité(s)
                    {med.forme && `, Forme: ${med.forme}`}
                    {med.dosage_unit && `, Dosage: ${med.dosage_unit}`}
                  </p>
                  {med.lot_info && (
                    <p className="text-xs text-slate-500">
                      Lot: {med.lot_info.numero_lot} — Péremption: {med.lot_info.date_peremption}
                      {med.lot_info.quantite_en_cours > 0 ? ` (Stock: ${med.lot_info.quantite_en_cours})` : ' (Stock épuisé)'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'SELECTION' && (
            <div className="space-y-4">
              {posData?.medicaments.map((med) => {
                const selectionExistante = posData.selections.find(
                  (s) => s.item_id === med.id
                );
                const quantitePrescrite = med.stock_disponible || 1;
                const quantiteDisponible = med.stock_disponible || 0;

                return (
                  <div key={med.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">{med.nom_commercial}</h3>
                        {med.alerte && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            {med.alerte}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <span className="font-mono text-emerald-600">
                          {quantitePrescrite} prescrite
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Qté à sélectionner (max {quantitePrescrite})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={quantitePrescrite}
                        value={quantiteSelectionnee}
                        onChange={(e) => setQuantiteSelectionnee(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-xs text-slate-500">
                        Disponible: {quantiteDisponible} unité(s)
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectMedicament(med.id, quantiteSelectionnee)}
                      disabled={quantiteSelectionnee > quantitePrescrite}
                      className="mt-3 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {quantiteSelectionnee > 0
                        ? `Ajouter ${quantiteSelectionnee} unité(s) au panier`
                        : 'Sélectionner quantité'}
                    </button>
                  </div>
                );
              })}

              {posData?.selections.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-slate-800">Médicaments sélectionnés</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-700">
                      <thead className="bg-slate-50 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-4 py-3">Médicament</th>
                          <th className="px-4 py-3 text-right">Qté</th>
                          <th className="px-4 py-3 text-right">Prix unitaire</th>
                          <th className="px-4 py-3 text-right">Sous-total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posData.selections.map((sel) => (
                          <tr key={sel.item_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">{sel.nom_medicament}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                max={sel.quantite_prescrite}
                                value={sel.quantite_selectionnee}
                                onChange={(e) => handleSelectMedicament(sel.item_id, parseInt(e.target.value, 10))}
                                className="w-20 pl-1 py-1 text-center text-sm border rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {sel.prix_unitaire?.toFixed(2)} $
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">
                              {sel.sous_total?.toFixed(2)} $
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Sous-total USD</span>
                      <span className="font-bold text-emerald-600">{posData.total_usd?.toFixed(2)} $</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Total FC</span>
                      <span className="font-bold text-emerald-600">
                        {posData.total_fc?.toLocaleString('fr-FR')} FC
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'RESUME' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="font-bold text-emerald-800 mb-3">
                  <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
                  Résumé de la vente
                </h3>
                <p className="text-slate-700">
                  Cette vente sera liée à l'ordonnance n° {posData.prescription_id} pour le patient
                  {posData.patient.prenom} {posData.patient.nom}.
                </p>
                <p className="text-slate-700 mb-2">
                  Médicaments sélectionnés : {posData.selections.filter(
                    (s) => s.quantite_selectionnee > 0
                  ).length} sur {posData.medicaments.length} prescrits.
                </p>
                <p className="text-slate-700">
                  Montant USD : {posData.total_usd?.toFixed(2)} $ — Total FC : {posData.total_fc?.toLocaleString('fr-FR')} FC
                </p>
              </div>

              {showConfirmation && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                  <h3 className="font-bold text-slate-900 mb-4">
                    <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
                    Confirmer la vente ?
                  </h3>
                  <p className="text-slate-700">
                    Êtes-vous sûr de vouloir finaliser cette vente ? Cette action créera une facture,
                    enregistrera le paiement et déduira le stock des lots médicaments.
                  </p>
                  <div className="flex space-x-3">
                    <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold">
                      Annuler
                    </button>
                    <button onClick={() => handleConfirmer()} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold">
                      {loading ? 'Enregistrement...' : 'Finaliser la vente'}
                    </button>
                  </div>
                </div>
              )}

              {showSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <h3 className="font-bold text-emerald-800 mb-3">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                    Vente confirmée
                  </h3>
                  <p className="text-slate-700">
                    La vente a été enregistrée avec succès.
                    • Facture créée avec les médicaments sélectionnés
                    • Paiement enregistré
                    • Stock mis à jour atomiquement
                  </p>
                  <p className="text-slate-700 mt-2">
                    Facture ID: {lastFactureId || posData?.prescription_id || 'N/A'}
                  </p>
                  <button onClick={handleAnnuler} className="mt-3 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold">
                    Fermer
                  </button>
                </div>
              )}

              {!showSuccess && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={loading}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
                  >
                    {loading ? 'Traitement en cours...' : 'Finaliser la vente'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!posData && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 text-center">
          <Package className="w-10 h-10 text-emerald-500 mb-3" />
          <h3 className="text-xl font-bold text-slate-900">Sélectionner une ordonnance</h3>
          <p className="text-slate-600">
            Cliquez sur « Vendre à la pharmacie de l'hôpital » dans la modal de réception
            pour ouvrir le point de vente avec une ordonnance préremplie.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <span className="text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
};
