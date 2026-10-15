import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, CheckCircle2, XCircle, Search, RefreshCw, Calendar, AlertCircle, ShieldCheck, Printer, Filter, ChevronRight, X, DollarSign, TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { CatalogueMedicament, LotMedicament, MouvementStock, StockVue, AlertePharmacie } from '../../types/index.js';

type ActiveTab = 'CATALOGUE' | 'LOTS' | 'MOUVEMENTS' | 'ALERTES' | 'STOCK';

interface PharmacyManagementViewProps {
  onClose: () => void;
}

export const PharmacyManagementView: React.FC<PharmacyManagementViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('CATALOGUE');
  const [loading, setLoading] = useState<boolean>(false);

  // Catalogue
  const [catalogue, setCatalogue] = useState<CatalogueMedicament[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  // Lots
  const [lots, setLots] = useState<LotMedicament[]>([]);
  const [lotsError, setLotsError] = useState<string | null>(null);

  // Mouvements
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [mouvementsError, setMouvementsError] = useState<string | null>(null);

  // Alertes
  const [alertes, setAlertes] = useState<AlertePharmacie>({ stock_faible: [], peremption_proche: [], peremption_expiree: [] });
  const [alertesLoading, setAlertesLoading] = useState<boolean>(false);

  // Stock vue
  const [stockVue, setStockVue] = useState<StockVue[]>([]);

  // Modal états
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [editingMedicament, setEditingMedicament] = useState<CatalogueMedicament | null>(null);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');

  const [formCode, setFormCode] = useState('');
  const [formNomCommercial, setFormNomCommercial] = useState('');
  const [formNomGenerique, setFormNomGenerique] = useState('');
  const [formClasse, setFormClasse] = useState('');
  const [formCategorie, setFormCategorie] = useState('');
  const [formForme, setFormForme] = useState('');
  const [formDosage, setFormDosage] = useState('');
  const [formPrix, setFormPrix] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCatalogue = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/pharmacie/catalogue${catalogueSearch ? `?search=${encodeURIComponent(catalogueSearch)}` : ''}`);
      const data = await res.json();
      if (res.ok) {
        setCatalogue(data.medicaments || []);
      } else {
        setCatalogueError(data.error || 'Erreur chargement catalogue');
      }
    } catch (err) {
      setCatalogueError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const loadLots = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/pharmacie/lots');
      const data = await res.json();
      if (res.ok) {
        setLots(data.lots || []);
      } else {
        setLotsError(data.error || 'Erreur chargement lots');
      }
    } catch (err) {
      setLotsError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const loadMouvements = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/pharmacie/mouvements');
      const data = await res.json();
      if (res.ok) {
        setMouvements(data.mouvements || []);
      } else {
        setMouvementsError(data.error || 'Erreur chargement mouvements');
      }
    } catch (err) {
      setMouvementsError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const loadAlertes = async () => {
    setAlertesLoading(true);
    try {
      const res = await apiFetch('/api/pharmacie/alertes');
      const data = await res.json();
      if (res.ok) {
        setAlertes(data);
      }
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
    } finally {
      setAlertesLoading(false);
    }
  };

  const loadStockVue = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/pharmacie/stocks');
      const data = await res.json();
      if (res.ok) {
        setStockVue(data.stocks || []);
      }
    } catch (err) {
      console.error('Erreur chargement stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CATALOGUE') loadCatalogue();
    else if (activeTab === 'LOTS') loadLots();
    else if (activeTab === 'MOUVEMENTS') loadMouvements();
    else if (activeTab === 'ALERTES' || activeTab === 'STOCK') {
      loadAlertes();
      loadStockVue();
    }
  }, [activeTab]);

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setEditingMedicament(null);
    setFormCode('');
    setFormNomCommercial('');
    setFormNomGenerique('');
    setFormClasse('');
    setFormCategorie('');
    setFormForme('');
    setFormDosage('');
    setFormPrix('');
    setSuccessMessage(null);
    setShowCatalogueModal(true);
  };

const handleOpenEditModal = (med: CatalogueMedicament) => {
    setModalMode('EDIT');
    setEditingMedicament(med);
    setFormCode(med.code);
    setFormNomCommercial(med.nom_commercial);
    setFormNomGenerique(med.nom_generique || '');
    setFormClasse(med.classe_therapeutique || '');
    setFormCategorie(med.categorie || '');
    setFormForme(med.forme || '');
    setFormDosage(med.dosage_unit || '');
    setFormPrix(String(med.prix_autorise_usd));
    setSuccessMessage(null);
    setShowCatalogueModal(true);
  };

  const handleToggleActif = async (med: CatalogueMedicament) => {
    try {
      const res = await apiFetch(`/api/pharmacie/catalogue/${med.id}/toggle-active`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        setCatalogue(prev => prev.map(m => m.id === med.id ? { ...m, actif: data.actif, stock_disponible: med.stock_disponible, alerte: med.alerte } : m));
        setSuccessMessage(`Médicament ${med.nom_commercial} mis à jour`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Erreur basculement:', err);
    }
  };

  const handleSaveMedicament = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        code: formCode.trim(),
        nom_commercial: formNomCommercial.trim(),
        nom_generique: formNomGenerique.trim() || null,
        classe_therapeutique: formClasse.trim() || null,
        categorie: formCategorie.trim() || null,
        forme: formForme.trim() || null,
        dosage_unit: formDosage.trim() || null,
        prix_autorise_usd: parseFloat(formPrix) || 0
      };

      const res = await apiFetch(
        editingMedicament
          ? `/api/pharmacie/catalogue/${editingMedicament.id}`
          : '/api/pharmacie/catalogue',
        {
          method: editingMedicament ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      if (res.ok && data.medicament) {
        if (editingMedicament) {
          setCatalogue(prev => prev.map(m => m.id === editingMedicament.id ? data.medicament : m));
          setSuccessMessage('Médicament mis à jour');
        } else {
          setCatalogue(prev => [...prev, data.medicament]);
          setSuccessMessage('Médicament créé');
        }
        setShowCatalogueModal(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setCatalogueError(data.error || 'Erreur enregistrement');
      }
    } catch (err) {
      setCatalogueError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  // Stock movements type
  type MouvementType = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'PEREMPTION' | 'RETOUR';

  const handleCreateMouvement = () => {
    setSelectedLot('');
    setSelectedMedic('');
    setMouvementType('ENTREE');
    setMouvementQty('');
    setMouvementRef('');
    setMouvementComment('');
    setShowMouvementModal(true);
  };

  const tabConfig: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'CATALOGUE', label: 'Catalogue Médicaments', icon: Package },
    { id: 'LOTS', label: 'Gestion des Lots', icon: Calendar },
    { id: 'MOUVEMENTS', label: 'Mouvements de Stock', icon: RefreshCw },
    { id: 'ALERTES', label: 'Alertes & Ruptures', icon: AlertTriangle },
    { id: 'STOCK', label: 'Vue du Stock', icon: TrendingUp }
  ];

  // Modal Mouvement état local
  const [showMouvementModal, setShowMouvementModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<string>('');
  const [selectedMedic, setSelectedMedic] = useState<string>('');
  const [mouvementType, setMouvementType] = useState<MouvementType>('ENTREE');
  const [mouvementQty, setMouvementQty] = useState('');
  const [mouvementRef, setMouvementRef] = useState('');
  const [mouvementComment, setMouvementComment] = useState('');

  const handleSaveMouvement = async () => {
    if (!selectedLot || !selectedMedic || !mouvementQty) {
      alert('Lot, médicament et quantité requis');
      return;
    }

    const qty = parseInt(mouvementQty, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantité doit être un entier positif');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/pharmacie/mouvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot,
          catalogue_id: selectedMedic,
          type: mouvementType,
          quantite: qty,
          reference_id: mouvementRef || null,
          commentaire: mouvementComment || null,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Mouvement enregistré');
        loadMouvements();
        setShowMouvementModal(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSuccessMessage(`Erreur: ${data.error}`);
      }
    } catch (err) {
      setSuccessMessage('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Package className="w-6 h-6 mr-2 text-emerald-600" />
            Back-office Pharmacie
          </h1>
          <p className="text-sm text-slate-600 mt-1">Gestion du catalogue, des lots et des mouvements de stock.</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5">
        <div className="flex space-x-1 overflow-x-auto">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Succès message */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        {activeTab === 'CATALOGUE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un médicament..."
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  className="w-64 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un médicament</span>
              </button>
            </div>

            {catalogueError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {catalogueError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogue.map((med) => (
                <div key={med.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{med.nom_commercial}</h3>
                      {med.nom_generique && (
                        <p className="text-xs text-slate-500">{med.nom_generique}</p>
                      )}
                      {med.code && (
                        <p className="text-xs font-mono text-slate-400">Code: {med.code}</p>
                      )}
                    </div>
                    {med.alerte && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Stock faible
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    {med.classe_therapeutique && (
                      <p><span className="text-slate-500">Classe:</span> {med.classe_therapeutique}</p>
                    )}
                    {med.categorie && (
                      <p><span className="text-slate-500">Catégorie:</span> {med.categorie}</p>
                    )}
                    {med.forme && (
                      <p><span className="text-slate-500">Forme:</span> {med.forme}</p>
                    )}
                    {med.dosage_unit && (
                      <p><span className="text-slate-500">Dosage:</span> {med.dosage_unit}</p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-emerald-600 font-bold">{med.prix_autorise_usd?.toFixed(2)} $</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleToggleActif(med)}
                          className="p-1 rounded hover:bg-slate-100"
                          title={med.actif ? "Désactiver" : "Activer"}
                        >
                          {med.actif ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(med)}
                          className="p-1 rounded hover:bg-slate-100"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                    {med.stock_disponible !== undefined && (
                      <p><span className="text-slate-500">Stock disponible:</span> {med.stock_disponible}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'LOTS' && (
          <div className="space-y-4">
            {lotsError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {lotsError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">N° Lot</th>
                    <th className="px-4 py-3">Médicament</th>
                    <th className="px-4 py-3">Date péremption</th>
                    <th className="px-4 py-3">Qté reçue</th>
                    <th className="px-4 py-3">Qté en cours</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lots.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Aucun lot trouvé
                      </td>
                    </tr>
                  ) : (
                    lots.map((lot) => {
                      const periode = lot.date_peremption ? new Date(lot.date_peremption) : new Date();
                      const today = new Date();
                      const diffDays = Math.ceil((periode.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const estExpire = diffDays <= 0;
                      const estProche = diffDays <= 90 && diffDays > 0;

                      return (
                        <tr key={lot.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono">{lot.numero_lot}</td>
                          <td className="px-4 py-3">{lot.nom_commercial || lot.code}</td>
                          <td className="px-4 py-3">
                            <span className={estExpire ? 'text-red-600 font-semibold' : estProche ? 'text-amber-600' : 'text-slate-700'}>
                              {lot.date_peremption}
                            </span>
                          </td>
                          <td className="px-4 py-3">{lot.quantite_recue}</td>
                          <td className="px-4 py-3 font-semibold">{lot.quantite_en_cours}</td>
                          <td className="px-4 py-3 text-center">
                            {estExpire ? (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Expiré</span>
                            ) : estProche ? (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Proche</span>
                            ) : (
                              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'MOUVEMENTS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Historique des mouvements</h2>
              <button
                onClick={handleCreateMouvement}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau mouvement</span>
              </button>
            </div>

            {mouvementsError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {mouvementsError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Médicament</th>
                    <th className="px-4 py-3">Lot</th>
                    <th className="px-4 py-3 text-right">Qté</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mouvements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Aucun mouvement enregistré
                      </td>
                    </tr>
                  ) : (
                    mouvements.slice(0, 50).map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold
                            ${mov.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-800' :
                              mov.type === 'SORTIE' ? 'bg-blue-100 text-blue-800' :
                              mov.type === 'AJUSTEMENT' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'}`}>
                            {mov.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{mov.nom_commercial || mov.code}</td>
                        <td className="px-4 py-3 font-mono">{mov.numero_lot || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{mov.quantite}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{mov.created_at ? new Date(mov.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{mov.commentaire || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'ALERTES' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Stock Faible */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-900 flex items-center mb-2">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Stock Faible
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alertesLoading ? (
                    <p className="text-xs text-amber-700">Chargement...</p>
                  ) : alertes.stock_faible.length === 0 ? (
                    <p className="text-xs text-amber-700">Aucun problème de stock</p>
                  ) : (
                    alertes.stock_faible.slice(0, 5).map((item) => (
                      <div key={item.catalogue_id} className="bg-white p-2 rounded border border-amber-100 text-xs">
                        <p className="font-semibold text-amber-800">{item.nom_commercial}</p>
                        <p className="text-amber-600">Stock: {item.stock_disponible}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Péremption Proche */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-orange-900 flex items-center mb-2">
                  <Calendar className="w-4 h-4 mr-1.5" />
                  Péremption Proche
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alertesLoading ? (
                    <p className="text-xs text-orange-700">Chargement...</p>
                  ) : alertes.peremption_proche.length === 0 ? (
                    <p className="text-xs text-orange-700">Aucune date proche</p>
                  ) : (
                    alertes.peremption_proche.slice(0, 5).map((lot) => (
                      <div key={lot.lot_id} className="bg-white p-2 rounded border border-orange-100 text-xs">
                        <p className="font-semibold text-orange-800">{lot.nom_commercial}</p>
                        <p className="text-orange-600">Péremption: {lot.date_peremption}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Expirés */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-red-900 flex items-center mb-2">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Expirés
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alertesLoading ? (
                    <p className="text-xs text-red-700">Chargement...</p>
                  ) : alertes.peremption_expiree.length === 0 ? (
                    <p className="text-xs text-red-700">Aucun lot expiré</p>
                  ) : (
                    alertes.peremption_expiree.slice(0, 5).map((lot) => (
                      <div key={lot.lot_id} className="bg-white p-2 rounded border border-red-100 text-xs">
                        <p className="font-semibold text-red-800">{lot.nom_commercial}</p>
                        <p className="text-red-600">Péremption: {lot.date_peremption}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'STOCK' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Vue d'ensemble du stock</h2>
              <button
                onClick={loadStockVue}
                disabled={loading}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Médicament</th>
                    <th className="px-4 py-3">Stock Disponible</th>
                    <th className="px-4 py-3">Stock Total</th>
                    <th className="px-4 py-3">Lots Actifs</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockVue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Aucun médicament enregistré
                      </td>
                    </tr>
                  ) : (
                    stockVue.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono">{med.code}</td>
                        <td className="px-4 py-3 font-semibold">{med.nom_commercial}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{med.stock_disponible}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.stock_total_incl_expires}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.nb_lots_actifs}</td>
                        <td className="px-4 py-3 text-center">
                          {med.actif ? (
                            <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Catalogue */}
      {showCatalogueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {modalMode === 'CREATE' ? 'Nouveau Médicament' : 'Modifier le Médicament'}
              </h3>
              <button
                onClick={() => setShowCatalogueModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catalogueError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {catalogueError}
              </div>
            )}

            <form onSubmit={handleSaveMedicament} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom commercial *</label>
                  <input
                    type="text"
                    value={formNomCommercial}
                    onChange={(e) => setFormNomCommercial(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom générique</label>
                  <input
                    type="text"
                    value={formNomGenerique}
                    onChange={(e) => setFormNomGenerique(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Classe thérapeutique</label>
                  <input
                    type="text"
                    value={formClasse}
                    onChange={(e) => setFormClasse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={formCategorie}
                    onChange={(e) => setFormCategorie(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Forme</label>
                  <input
                    type="text"
                    value={formForme}
                    onChange={(e) => setFormForme(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dosage unité</label>
                  <input
                    type="text"
                    value={formDosage}
                    onChange={(e) => setFormDosage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prix (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrix}
                    onChange={(e) => setFormPrix(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCatalogueModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center space-x-1"
                >
                  {submitting ? (
                    <span>Enregistrement...</span>
                  ) : (
                    <span>Sauvegarder</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Création Mouvement */}
      {showMouvementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Nouveau Mouvement</h3>
              <button onClick={() => setShowMouvementModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Type de mouvement *</label>
                <select
                  value={mouvementType}
                  onChange={(e) => setMouvementType(e.target.value as MouvementType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="ENTREE">ENTREE - Réception</option>
                  <option value="SORTIE">SORTIE - Délivrance</option>
                  <option value="AJUSTEMENT">AJUSTEMENT - Correction inventaire</option>
                  <option value="PEREMPTION">PEREMPTION - Lot expiré</option>
                  <option value="RETOUR">RETOUR - Retour fournisseur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lot *</label>
                <select
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Sélectionner un lot</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>{l.numero_lot} ({l.quantite_en_cours} dispo)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantité *</label>
                <input
                  type="number"
                  min="1"
                  value={mouvementQty}
                  onChange={(e) => setMouvementQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Référence (cmd, livraison)</label>
                <input
                  type="text"
                  value={mouvementRef}
                  onChange={(e) => setMouvementRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Commentaire</label>
                <textarea
                  value={mouvementComment}
                  onChange={(e) => setMouvementComment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowMouvementModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveMouvement}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};