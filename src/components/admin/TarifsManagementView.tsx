import React, { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, CheckCircle2, XCircle, Search, RefreshCw, 
  DollarSign, Coins, TrendingUp, Layers, Check, X, ShieldAlert 
} from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { PrestationTarif, PrestationCategorie, ExchangeRateInfo } from '../../types/index.js';

export const TarifsManagementView: React.FC = () => {
  const [tarifs, setTarifs] = useState<PrestationTarif[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateInfo>({
    rate: 2850,
    currency_from: 'USD',
    currency_to: 'FC',
    updated_at: new Date().toISOString()
  });

  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [newRateInput, setNewRateInput] = useState('2850');
  const [rateSuccessMessage, setRateSuccessMessage] = useState<string | null>(null);

  // Modal Ajout/Modification
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [currentTarifId, setCurrentTarifId] = useState<string | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formCategorie, setFormCategorie] = useState<PrestationCategorie>('CONSULTATION');
  const [formPrixUsd, setFormPrixUsd] = useState('');
  const [formActif, setFormActif] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { key: 'ALL', label: 'Toutes les prestations' },
    { key: 'TYPE_VISITE', label: 'Type de visite' },
    { key: 'CONSULTATION', label: 'Consultation' },
    { key: 'EXAMEN_LABORATOIRE', label: 'Examen laboratoire' },
    { key: 'IMAGERIE', label: 'Imagerie' },
    { key: 'ACTE_SERVICE', label: 'Acte / Service' },
  ];

  const categoryBadgeColors: Record<PrestationCategorie, string> = {
    TYPE_VISITE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    CONSULTATION: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EXAMEN_LABORATOIRE: 'bg-purple-100 text-purple-800 border-purple-200',
    IMAGERIE: 'bg-sky-100 text-sky-800 border-sky-200',
    ACTE_SERVICE: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Taux de change
      const rateRes = await apiFetch('/api/billing/exchange-rate');
      const rateData = await rateRes.json();
      if (rateRes.ok && rateData.rate) {
        setExchangeRate(rateData);
        setNewRateInput(String(rateData.rate));
      }

      // 2. Tarifs
      const tarifsRes = await apiFetch('/api/tarifs');
      const tarifsData = await tarifsRes.json();
      if (tarifsRes.ok && Array.isArray(tarifsData.tarifs)) {
        setTarifs(tarifsData.tarifs);
      }
    } catch (err) {
      console.error('Erreur chargement tarifs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateRate = async () => {
    const val = parseFloat(newRateInput);
    if (isNaN(val) || val <= 0) {
      alert('Veuillez saisir un taux de change valide supérieur à 0.');
      return;
    }

    try {
      const res = await apiFetch('/api/billing/exchange-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: val })
      });
      const data = await res.json();
      if (res.ok) {
        setExchangeRate(data);
        setEditingRate(false);
        setRateSuccessMessage(`Taux officiel mis à jour : 1 USD = ${data.rate} FC`);
        setTimeout(() => setRateSuccessMessage(null), 4000);
      } else {
        alert(data.error || 'Erreur lors de la mise à jour du taux.');
      }
    } catch (err) {
      alert('Erreur réseau lors de la mise à jour du taux.');
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setCurrentTarifId(null);
    setFormNom('');
    setFormCategorie(selectedCategory !== 'ALL' ? (selectedCategory as PrestationCategorie) : 'CONSULTATION');
    setFormPrixUsd('');
    setFormActif(true);
    setFormDescription('');
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (t: PrestationTarif) => {
    setModalMode('EDIT');
    setCurrentTarifId(t.id);
    setFormNom(t.nom);
    setFormCategorie(t.categorie);
    setFormPrixUsd(String(t.prix_usd));
    setFormActif(Boolean(t.actif));
    setFormDescription(t.description || '');
    setFormError(null);
    setShowModal(true);
  };

  const handleToggleActif = async (t: PrestationTarif) => {
    try {
      const res = await apiFetch(`/api/tarifs/${t.id}/toggle-actif`, { method: 'PATCH' });
      if (res.ok) {
        setTarifs(prev => prev.map(item => item.id === t.id ? { ...item, actif: item.actif ? 0 : 1 } : item));
      }
    } catch (err) {
      console.error('Erreur bascule actif:', err);
    }
  };

  const handleSaveTarif = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formNom.trim()) {
      setFormError('Le nom de la prestation est obligatoire.');
      return;
    }

    const prix = parseFloat(formPrixUsd);
    if (isNaN(prix) || prix < 0) {
      setFormError('Le prix en USD doit être un nombre positif ou nul.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nom: formNom.trim(),
        categorie: formCategorie,
        prix_usd: prix,
        actif: formActif ? 1 : 0,
        description: formDescription.trim() || undefined
      };

      if (modalMode === 'CREATE') {
        const res = await apiFetch('/api/tarifs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.tarif) {
          setTarifs(prev => [...prev, data.tarif]);
          setShowModal(false);
        } else {
          setFormError(data.error || 'Erreur lors de la création de la prestation.');
        }
      } else {
        const res = await apiFetch(`/api/tarifs/${currentTarifId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.tarif) {
          setTarifs(prev => prev.map(item => item.id === currentTarifId ? data.tarif : item));
          setShowModal(false);
        } else {
          setFormError(data.error || 'Erreur lors de la modification de la prestation.');
        }
      }
    } catch (err) {
      setFormError('Erreur de communication avec le serveur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTarifs = tarifs.filter(t => {
    if (selectedCategory !== 'ALL' && t.categorie !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.nom.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center">
            <Tag className="w-6 h-6 mr-2 text-emerald-600" />
            Administration des Tarifs & Devises (USD / FC)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configuration officielle des prestations médicales, grille tarifaire en USD et taux de change appliqué à la caisse.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            title="Rafraîchir"
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une prestation</span>
          </button>
        </div>
      </div>

      {/* SECTION 2 : TAUX USD -> FC */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 p-6 rounded-xl text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-xs font-semibold">
              <Coins className="w-4 h-4" />
              <span>Taux de change officiel Clinique Les Archanges</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-3">
              <span>1 USD = {exchangeRate.rate.toLocaleString('fr-FR')} FC</span>
            </h2>
            <p className="text-xs text-emerald-200/90 max-w-xl">
              Ce taux est scellé lors de chaque facture et chaque encaissement. Les conversions historiques ne sont jamais altérées en cas de fluctuation future du taux officiel.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shrink-0">
            {editingRate ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-white uppercase tracking-wider">
                  Nouveau taux (1 USD = X FC)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="10"
                    value={newRateInput}
                    onChange={(e) => setNewRateInput(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white text-slate-900 rounded font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="2850"
                  />
                  <span className="text-xs font-bold text-white">FC</span>
                  <button
                    onClick={handleUpdateRate}
                    className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded font-bold transition-colors"
                    title="Confirmer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingRate(false);
                      setNewRateInput(String(exchangeRate.rate));
                    }}
                    className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold transition-colors"
                    title="Annuler"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div>
                  <div className="text-[11px] text-emerald-200">Dernière mise à jour</div>
                  <div className="text-xs font-semibold text-white">
                    {new Date(exchangeRate.updated_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setEditingRate(true)}
                  className="px-3 py-1.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Modifier le taux
                </button>
              </div>
            )}
          </div>
        </div>

        {rateSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400 text-emerald-100 rounded-lg text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <span>{rateSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* SECTION 1 : TARIFS DES PRESTATIONS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filtres par Catégorie et Recherche */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCategory === cat.key
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une prestation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Tableau des Tarifs Desktop (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Prestation / Acte</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4 text-right">Prix (USD)</th>
                <th className="py-3 px-4 text-right">Équivalent (FC)</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTarifs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucune prestation trouvée pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredTarifs.map((t) => {
                  const equivFc = Math.round(t.prix_usd * exchangeRate.rate);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{t.nom}</div>
                        {t.description && (
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5">{t.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${categoryBadgeColors[t.categorie]}`}>
                          {t.categorie.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {t.prix_usd.toFixed(2)} $
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {equivFc.toLocaleString('fr-FR')} FC
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActif(t)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                            t.actif 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="Cliquer pour basculer actif/inactif"
                        >
                          {t.actif ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Actif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inactif</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs font-semibold inline-flex items-center space-x-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Présentation Cartes Mobile (md:hidden - Règle 5 & 11) */}
        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {filteredTarifs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Aucune prestation trouvée pour ce filtre.
            </div>
          ) : (
            filteredTarifs.map((t) => {
              const equivFc = Math.round(t.prix_usd * exchangeRate.rate);
              return (
                <div key={t.id} className="pt-3 first:pt-0 space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-sm">{t.nom}</div>
                      {t.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${categoryBadgeColors[t.categorie]}`}>
                      {t.categorie.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/60">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Prix Unitaire</div>
                      <div className="text-sm font-mono font-black text-emerald-700">{t.prix_usd.toFixed(2)} $</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Équivalent FC</div>
                      <div className="text-xs font-mono font-bold text-slate-700">{equivFc.toLocaleString('fr-FR')} FC</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleToggleActif(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 min-h-[44px] border ${
                        t.actif 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {t.actif ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Actif</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-slate-400" />
                          <span>Inactif</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(t)}
                      className="flex-1 py-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 min-h-[44px]"
                    >
                      <Edit2 className="w-4 h-4 text-slate-600" />
                      <span>Modifier</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Ajout / Modification */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <span>{modalMode === 'CREATE' ? 'Ajouter une prestation' : 'Modifier la prestation'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTarif} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom de la prestation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Consultation Pédiatrique, NFS, Échographie..."
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catégorie de prestation *
                </label>
                <select
                  value={formCategorie}
                  onChange={(e) => setFormCategorie(e.target.value as PrestationCategorie)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="TYPE_VISITE">Type de visite</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="EXAMEN_LABORATOIRE">Examen laboratoire</option>
                  <option value="IMAGERIE">Imagerie</option>
                  <option value="ACTE_SERVICE">Acte / Service</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix en USD ($) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="20"
                    value={formPrixUsd}
                    onChange={(e) => setFormPrixUsd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Équivalent indicatif FC
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono font-semibold">
                    {formPrixUsd && !isNaN(parseFloat(formPrixUsd)) 
                      ? `${Math.round(parseFloat(formPrixUsd) * exchangeRate.rate).toLocaleString('fr-FR')} FC`
                      : '0 FC'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Consignes cliniques
                </label>
                <textarea
                  rows={2}
                  placeholder="Précisions sur l'acte ou indications..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="actif_checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="actif_checkbox" className="font-semibold text-slate-700 select-none">
                  Prestation active et disponible à la facturation
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <span>Enregistrement...</span>
                  ) : (
                    <span>{modalMode === 'CREATE' ? 'Créer la prestation' : 'Mettre à jour'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
