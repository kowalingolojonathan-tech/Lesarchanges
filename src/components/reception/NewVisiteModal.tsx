import React, { useState, useEffect, useRef } from 'react';
import { Patient, Visite, VisiteType, PrestationTarif } from '../../types/index.js';
import { FilePlus2, X, AlertCircle, CheckCircle2, ShieldCheck, Tag, Coins } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { InterpretationVisiteModal } from './InterpretationVisiteModal';

interface NewVisiteModalProps {
  patient: Patient;
  onClose: () => void;
  onSuccess: (visite: Visite) => void;
}

export const NewVisiteModal: React.FC<NewVisiteModalProps> = ({ patient, onClose, onSuccess }) => {
  const [motifVenue, setMotifVenue] = useState('Consultation générale');
  const [typeVisite, setTypeVisite] = useState<VisiteType>('STANDARD');
  const [selectedTarifId, setSelectedTarifId] = useState<string>('tar-csl-01');
  const [tarifs, setTarifs] = useState<PrestationTarif[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(2850);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, []);

  // Charger les tarifs actifs et le taux officiel USD -> FC
  useEffect(() => {
    const fetchTarifsAndRate = async () => {
      try {
        const [tarifsRes, rateRes] = await Promise.all([
          apiFetch('/api/tarifs?actif=true'),
          apiFetch('/api/settings/exchange-rate')
        ]);

        if (tarifsRes.ok) {
          const tData = await tarifsRes.json();
          setTarifs(tData.tarifs || []);
          const defConsult = (tData.tarifs || []).find((t: PrestationTarif) => t.id === 'tar-csl-01' || t.nom.toLowerCase().includes('consultation'));
          if (defConsult) {
            setSelectedTarifId(defConsult.id);
          }
        }

        if (rateRes.ok) {
          const rData = await rateRes.json();
          if (rData.rate) setExchangeRate(rData.rate);
        }
      } catch (err) {
        console.error('Erreur chargement tarifs:', err);
      }
    };
    fetchTarifsAndRate();
  }, []);

  const selectedTarif = tarifs.find(t => t.id === selectedTarifId) || {
    id: 'tar-csl-01',
    nom: 'Consultation Médecine Générale',
    prix_usd: 20,
    categorie: 'CONSULTATION'
  };

  const prixUsd = selectedTarif ? Number(selectedTarif.prix_usd) : 20;
  const prixFc = Math.round(prixUsd * exchangeRate);

  if (showInterpretation) {
    return (
      <InterpretationVisiteModal
        initialPatient={patient}
        onClose={() => setShowInterpretation(false)}
        onSuccess={onSuccess}
      />
    );
  }

  const handleTypeSelect = (type: VisiteType) => {
    setTypeVisite(type);
    if (type === 'URGENCE') {
      const urgenceTarif = tarifs.find(t => t.id === 'tar-vis-02' || t.nom.toLowerCase().includes('urgence'));
      if (urgenceTarif) setSelectedTarifId(urgenceTarif.id);
      setMotifVenue('Consultation d’urgence / Prise en charge prioritaire');
    } else if (type === 'CONTROLE') {
      const controleTarif = tarifs.find(t => t.id === 'tar-vis-03' || t.nom.toLowerCase().includes('contrôle'));
      if (controleTarif) setSelectedTarifId(controleTarif.id);
      setMotifVenue('Visite de contrôle / Suivi médical');
    } else {
      const consultTarif = tarifs.find(t => t.id === 'tar-csl-01' || t.nom.toLowerCase().includes('médecine générale'));
      if (consultTarif) setSelectedTarifId(consultTarif.id);
      setMotifVenue('Consultation générale');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch('/api/visites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          motif_venue: motifVenue,
          type_visite: typeVisite,
          tarif_id: selectedTarifId,
          create_facture: true
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors de la création de la visite.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden" id="modal_new_visite_overlay">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden" id="modal_new_visite_container">
        
        {/* Header fixé */}
        <div className="shrink-0 bg-slate-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between" id="modal_new_visite_header">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <FilePlus2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Nouvelle Visite d'Accueil</h3>
              <p className="text-xs text-slate-300">Épisode de soin du jour — Statut initial : ATTENTE_TRIAGE</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire avec scroll interne fluide */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_new_visite">
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Fiche récapitulative du patient */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 text-sm">
                  {patient.nom} {patient.prenom}
                </span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-sm">
                  {patient.numero_dossier}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400">Né(e) le : </span>
                  <span className="font-medium text-slate-800">{patient.date_naissance}</span> ({patient.sexe === 'M' ? 'Homme' : 'Femme'})
                </div>
                <div>
                  <span className="text-slate-400">Téléphone : </span>
                  <span className="font-mono text-slate-800">{patient.telephone || 'Non renseigné'}</span>
                </div>
                {patient.allergies && (
                  <div className="col-span-2 text-amber-800 bg-amber-50 p-1.5 rounded-sm border border-amber-200">
                    <span className="font-bold">Allergies signalées : </span>
                    <span>{patient.allergies}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Type de visite */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Type de visite / Priorité d'accueil *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeSelect('STANDARD')}
                  className={`p-2.5 text-xs font-bold rounded-lg border text-center transition-all ${
                    typeVisite === 'STANDARD'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeSelect('URGENCE')}
                  className={`p-2.5 text-xs font-bold rounded-lg border text-center transition-all ${
                    typeVisite === 'URGENCE'
                      ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs ring-1 ring-rose-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Urgence
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeSelect('CONTROLE')}
                  className={`p-2.5 text-xs font-bold rounded-lg border text-center transition-all ${
                    typeVisite === 'CONTROLE'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Contrôle
                </button>
                <button
                  type="button"
                  onClick={() => setShowInterpretation(true)}
                  className="p-2.5 text-xs font-bold rounded-lg border text-center transition-all flex flex-col items-center justify-center border-purple-300 bg-purple-50/70 text-purple-900 hover:bg-purple-100 shadow-xs"
                >
                  <span>Interprétation</span>
                  <span className="text-[10px] font-normal opacity-80">des Résultats</span>
                </button>
              </div>
            </div>

            {/* Prestation & Facturation liée automatique */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Prestation & Facturation Liée</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-sm font-semibold">
                  Taux : 1 $ = {exchangeRate.toLocaleString('fr-FR')} FC
                </span>
              </div>

              <div>
                <select
                  value={selectedTarifId}
                  onChange={(e) => {
                    setSelectedTarifId(e.target.value);
                    const selected = tarifs.find(t => t.id === e.target.value);
                    if (selected) {
                      setMotifVenue(selected.nom);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium text-slate-800"
                >
                  {tarifs
                    .filter(t => t.categorie === 'CONSULTATION' || t.categorie === 'TYPE_VISITE')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nom} — {t.prix_usd} $ ({Math.round(t.prix_usd * exchangeRate).toLocaleString('fr-FR')} FC)
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Prix automatique configuré :</span>
                <div className="text-right">
                  <span className="font-bold font-mono text-emerald-800 text-sm">{prixUsd.toFixed(2)} USD</span>
                  <span className="text-slate-500 text-xs ml-1.5">({prixFc.toLocaleString('fr-FR')} FC)</span>
                </div>
              </div>

              <p className="text-[11px] text-emerald-800 italic">
                * Une facture liée à la visite est générée automatiquement au statut <strong>NON PAYÉ</strong> pour enregistrement immédiat ou ultérieur à la caisse.
              </p>
            </div>

            {/* Motif de venue */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif de venue / Plaintes exprimées *
              </label>
              <textarea
                required
                rows={2}
                value={motifVenue}
                onChange={(e) => setMotifVenue(e.target.value)}
                placeholder="Ex: Fièvre, céphalées et fatigue intense depuis 3 jours..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Règle d'intégrité :</strong> Cette visite est enregistrée sous le dossier permanent <strong>{patient.numero_dossier}</strong> sans altération des visites antérieures.
              </span>
            </div>
          </div>

          {/* Actions tactiles mobiles fixées en bas */}
          <div className="shrink-0 bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {isSubmitting ? (
                <span>Création & facturation...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Ouvrir la Visite & Diriger vers le Triage</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
