import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckCircle2, Search, RefreshCw, 
  Send, User, Calendar, ShieldCheck, Pill, AlertCircle, Clock
} from 'lucide-react';
import { Prescription, PrescriptionStatut } from '../../types';
import { apiFetch } from '../../lib/api';

interface ReceptionPrescriptionsModalProps {
  onClose: () => void;
  initialVisiteId?: string;
}

export const ReceptionPrescriptionsModal: React.FC<ReceptionPrescriptionsModalProps> = ({
  onClose,
  initialVisiteId
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatut, setSelectedStatut] = useState<'ALL' | 'VALIDEE' | 'IMPRIMEE' | 'REMISE'>('ALL');
  
  // Aperçu pour impression
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = selectedStatut === 'ALL' 
        ? `/api/reception/prescriptions` 
        : `/api/reception/prescriptions?statut=${selectedStatut}`;
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors du chargement des ordonnances');
      }
      const data = await res.json();
      setPrescriptions(data.prescriptions || []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [selectedStatut]);

  // Impression par la réception (VALIDEE -> IMPRIMEE, réimpression si REMISE)
  const handlePrint = async (p: Prescription) => {
    try {
      setProcessingId(p.id);
      const res = await apiFetch(`/api/medical/prescriptions/${p.id}/print`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prescription) {
          setPrescriptions(prev => prev.map(item => item.id === p.id ? { ...item, statut: data.prescription.statut } : item));
          if (previewPrescription && previewPrescription.id === p.id) {
            setPreviewPrescription(prev => prev ? { ...prev, statut: data.prescription.statut } : null);
          }
        }
      }
    } catch (err) {
      console.error('Erreur enregistrement impression:', err);
    } finally {
      setProcessingId(null);
    }
    setPreviewPrescription(p);
  };

  // Remise au patient par la réception (IMPRIMEE / VALIDEE -> REMISE)
  const handleDeliver = async (p: Prescription) => {
    try {
      setProcessingId(p.id);
      setError(null);
      const res = await apiFetch(`/api/medical/prescriptions/${p.id}/deliver`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la remise au patient');
      }
      const data = await res.json();
      setSuccessMessage(`Ordonnance remise au patient (${p.patient_nom} ${p.patient_prenom}) avec succès.`);
      await fetchPrescriptions();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la remise');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    if (initialVisiteId && p.visite_id !== initialVisiteId) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nom = (p.patient_nom || '').toLowerCase();
    const prenom = (p.patient_prenom || '').toLowerCase();
    const dossier = (p.numero_dossier || '').toLowerCase();
    const medecin = (p.medecin_nom || '').toLowerCase();
    const visite = (p.numero_visite || '').toLowerCase();
    return nom.includes(q) || prenom.includes(q) || dossier.includes(q) || medecin.includes(q) || visite.includes(q);
  });

  const getStatusBadge = (statut: PrescriptionStatut) => {
    switch (statut) {
      case 'VALIDEE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Validée par le médecin (À imprimer)
          </span>
        );
      case 'IMPRIMEE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <Printer className="w-3.5 h-3.5 mr-1" />
            Imprimée (Prête pour remise)
          </span>
        );
      case 'REMISE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Remise au patient
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            {statut}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-700/80 rounded-lg">
              <Printer className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center">
                Délivrance & Impression des Ordonnances Médicales
                <span className="ml-2.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-600/70 text-emerald-100 px-2 py-0.5 rounded-full">
                  Guichet Réception
                </span>
              </h3>
              <p className="text-xs text-emerald-200">
                Ordonnances certifiées par les médecins traitants • Impression papier & remise au patient
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 text-rose-600 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barre de recherche et filtres */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            <button
              onClick={() => setSelectedStatut('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedStatut === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Toutes ({prescriptions.length})
            </button>
            <button
              onClick={() => setSelectedStatut('VALIDEE')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedStatut === 'VALIDEE'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              À imprimer (VALIDÉE)
            </button>
            <button
              onClick={() => setSelectedStatut('IMPRIMEE')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedStatut === 'IMPRIMEE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              À remettre (IMPRIMÉE)
            </button>
            <button
              onClick={() => setSelectedStatut('REMISE')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedStatut === 'REMISE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Remises (REMISE)
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-72">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher patient, dossier, Dr..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={fetchPrescriptions}
              title="Rafraîchir"
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Liste des ordonnances */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && prescriptions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Chargement des ordonnances validées...</p>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Aucune ordonnance disponible</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Les prescriptions n'apparaissent à la réception qu'une fois validées formellement par le médecin traitant.
              </p>
            </div>
          ) : (
            filteredPrescriptions.map((p) => (
              <div 
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-xs transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {p.patient_nom} {p.patient_prenom}
                      </span>
                      <span className="text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                        {p.numero_dossier}
                      </span>
                      {getStatusBadge(p.statut)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Praticien : <strong className="text-slate-700">Dr. {p.medecin_nom || 'Médecin'}</strong></span>
                      <span>•</span>
                      <span>Visite : <strong className="font-mono text-slate-700">{p.numero_visite}</strong></span>
                      <span>•</span>
                      <span>Date : {new Date(p.date_prescription).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</span>
                    </div>
                  </div>

                  {/* Actions Réception */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      disabled={processingId === p.id}
                      onClick={() => handlePrint(p)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center shadow-xs ${
                        p.statut === 'VALIDEE' 
                          ? 'bg-sky-700 hover:bg-sky-800 text-white' 
                          : 'bg-purple-700 hover:bg-purple-800 text-white'
                      }`}
                      title="Imprimer l'ordonnance"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1.5" />
                      {p.statut === 'VALIDEE' ? 'Imprimer' : p.statut === 'IMPRIMEE' ? 'Réimprimer' : 'Duplicata'}
                    </button>

                    {p.statut !== 'REMISE' && (
                      <button
                        type="button"
                        disabled={processingId === p.id}
                        onClick={() => handleDeliver(p)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center shadow-xs"
                        title="Marquer comme remise au patient"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Remettre au patient
                      </button>
                    )}

                    {p.statut === 'REMISE' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Remise effectuée
                      </span>
                    )}
                  </div>
                </div>

                {/* Traçabilité des statuts */}
                {(p.validee_le || p.imprimee_le || p.remise_le) && (
                  <div className="mt-2.5 pt-2 flex flex-wrap gap-4 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                    {p.validee_le && (
                      <div>
                        Validée le : <strong className="text-slate-700">{new Date(p.validee_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
                      </div>
                    )}
                    {p.imprimee_le && (
                      <div>
                        Imprimée le : <strong className="text-slate-700">{new Date(p.imprimee_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong> {p.imprimee_par ? `par ${p.imprimee_par}` : ''}
                      </div>
                    )}
                    {p.remise_le && (
                      <div>
                        Remise le : <strong className="text-emerald-700">{new Date(p.remise_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong> {p.remise_par ? `par ${p.remise_par}` : ''}
                      </div>
                    )}
                  </div>
                )}

                {/* Contenu médical en lecture seule (strictement non modifiable par la réception) */}
                <div className="mt-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center">
                    <Pill className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    Médicaments prescrits ({p.items?.length || 0})
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                    {p.items && p.items.length > 0 ? (
                      p.items.map((it, idx) => (
                        <div key={it.id || idx} className="p-2 text-xs flex items-baseline justify-between">
                          <div>
                            <span className="font-semibold text-slate-900">
                              {idx + 1}. {it.nom_medicament}
                            </span>
                            {it.dosage && <span className="text-slate-600 ml-1">({it.dosage})</span>}
                            <span className="text-slate-500 ml-2">
                              • {it.frequence || '1 prise'} {it.duree ? `pendant ${it.duree}` : ''}
                            </span>
                          </div>
                          <span className="font-mono text-slate-700 font-semibold shrink-0">
                            Qté : {it.quantite || 1}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-slate-400 italic">Aucun détail disponible</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          Règle clinique : Le contenu médical est certifié par le médecin prescripteur et ne peut pas être modifié au guichet d'accueil.
        </div>
      </div>

      {/* Modale d'aperçu d'impression de l'ordonnance (Clinique Les Archanges) */}
      {previewPrescription && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Barre d'outils de la modale */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-bold text-slate-800 text-sm flex items-center">
                <Printer className="w-4 h-4 mr-2 text-emerald-700" />
                Aperçu Officiel de l'Ordonnance Médicale
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    handlePrint(previewPrescription);
                    window.print();
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Imprimer (Papier)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPrescription(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Ordonnance Clinique Les Archanges */}
            <div className="p-8 space-y-6 text-slate-900 font-serif">
              {/* En-tête clinique officiel */}
              <div className="border-b-2 border-emerald-800 pb-4 text-center">
                <h1 className="text-xl font-bold tracking-wider text-emerald-900 uppercase">
                  Clinique Les Archanges
                </h1>
                <p className="text-xs text-slate-600 font-sans tracking-wide">
                  À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.
                </p>
                <p className="text-[11px] text-slate-500 font-sans">
                  Téléphone : +243 989 715 771 • Horaires : Ouvert 24h/24 et 7j/7.
                </p>
              </div>

              {/* Renseignements praticien et patient */}
              <div className="grid grid-cols-2 gap-4 text-xs font-sans pb-4 border-b border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block uppercase">Praticien Prescripteur :</span>
                  <span className="text-slate-900 font-semibold">Dr. {previewPrescription.medecin_nom || 'Médecin Traitant'}</span>
                  <span className="block text-slate-500">Médecine Générale & Prise en Charge Clinique</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 block uppercase">Date d'émission :</span>
                  <span className="text-slate-900 font-semibold">
                    {new Date(previewPrescription.date_prescription).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="block text-slate-500 font-mono">Dossier : {previewPrescription.numero_dossier}</span>
                </div>
              </div>

              {/* Patient */}
              <div className="bg-slate-50 p-3 rounded-lg text-xs font-sans flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Patient : </span>
                  <strong className="text-slate-900 uppercase">{previewPrescription.patient_nom} {previewPrescription.patient_prenom}</strong>
                </div>
                <div>
                  <span className="text-slate-500">N° Visite : </span>
                  <strong className="font-mono text-slate-900">{previewPrescription.numero_visite}</strong>
                </div>
              </div>

              {/* Titre Ordonnance */}
              <div className="text-center py-2">
                <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 font-sans border-y border-slate-300 py-1 inline-block px-8">
                  ORDONNANCE MÉDICALE
                </h2>
              </div>

              {/* Lignes de traitement */}
              <div className="space-y-4 font-sans text-xs min-h-[180px]">
                {previewPrescription.items && previewPrescription.items.map((item, idx) => (
                  <div key={item.id || idx} className="space-y-0.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {idx + 1}. {item.nom_medicament} {item.dosage ? `— ${item.dosage}` : ''}
                      </span>
                      <span className="font-medium text-slate-600">
                        {item.quantite ? `[ Qté : ${item.quantite} ]` : ''}
                      </span>
                    </div>
                    <p className="text-slate-700 pl-4 font-medium">
                      • {item.forme || 'Comprimé'} ({item.voie_administration || 'Voie orale'}) : {item.frequence || 'Selon prescription'} {item.duree ? `pendant ${item.duree}` : ''}
                    </p>
                    {item.instructions && (
                      <p className="text-slate-500 pl-4 text-[11px] italic">
                        Note : {item.instructions}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {previewPrescription.observations && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs font-sans text-slate-700 border border-slate-200">
                  <span className="font-bold text-slate-900">Conseils hygiéno-diététiques & Recommandations : </span>
                  {previewPrescription.observations}
                </div>
              )}

              {/* Signature du praticien */}
              <div className="pt-8 flex justify-end font-sans">
                <div className="text-center w-56 border-t border-slate-400 pt-2">
                  <p className="text-xs font-bold text-slate-800">Signature et Cachet du Médecin</p>
                  <p className="text-[11px] text-slate-500 italic mt-8">Dr. {previewPrescription.medecin_nom || 'Médecin'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
