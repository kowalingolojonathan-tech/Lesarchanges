import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  History,
  Info,
  FlaskConical
} from 'lucide-react';
import { api } from '../../lib/api';

interface LabReportModalProps {
  orderId: string;
  onClose: () => void;
}

export const LabReportModal: React.FC<LabReportModalProps> = ({ orderId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [bulletin, setBulletin] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBulletin() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<{ bulletin: any }>(`/api/medical/lab-orders/${orderId}/bulletin`);
        setBulletin(data.bulletin);
      } catch (err: any) {
        console.error('Erreur chargement bulletin:', err);
        setError(err.message || 'Impossible de charger le bulletin d\'analyses.');
      } finally {
        setLoading(false);
      }
    }
    loadBulletin();
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Barre d'outils supérieure (Masquée à l'impression) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-base">Bulletin Officiel d'Analyses Biologiques</h2>
            {bulletin?.demande?.statut === 'RESULTATS_VALIDES' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> Validé & Conforme
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !bulletin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimer le Compte Rendu
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps du Bulletin (Feuille d'analyse médicale officielle) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50 print:bg-white print:p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">Génération du bulletin officiel en cours...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <p className="text-sm text-rose-700 font-medium">{error}</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">Fermer</button>
            </div>
          ) : bulletin ? (
            <div className="bg-white p-8 sm:p-10 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              
              {/* En-tête officiel Clinique */}
              <div className="border-b-2 border-emerald-700 pb-5 mb-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-lg">
                        ✝
                      </div>
                      <div>
                        <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                          {bulletin.clinique.nom}
                        </h1>
                        <p className="text-xs text-emerald-800 font-semibold tracking-wide">
                          {bulletin.clinique.departement}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      « {bulletin.clinique.devise} »
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                    <p>{bulletin.clinique.adresse}</p>
                    <p>Tél : {bulletin.clinique.telephone}</p>
                    <p>Courriel : {bulletin.clinique.email}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-900 tracking-wider">BULLETIN D'EXAMENS BIOLOGIQUES</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">N° {bulletin.demande.numero_demande || bulletin.demande.id}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Date prescription : <span className="font-semibold text-slate-800">{formatDate(bulletin.demande.date_demande)}</span>
                  </div>
                </div>
              </div>

              {/* Cadres Métadonnées : Patient & Prescription */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
                {/* Patient */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold border-b border-slate-200 pb-1 mb-2">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>IDENTITÉ DU PATIENT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Nom & Prénom :</span>
                    <span className="col-span-2 font-bold text-slate-900 uppercase">
                      {bulletin.patient.nom} {bulletin.patient.prenom}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Dossier N° :</span>
                    <span className="col-span-2 font-mono font-semibold text-slate-800">{bulletin.patient.numero_dossier}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Âge / Sexe :</span>
                    <span className="col-span-2 text-slate-800 font-medium">
                      {bulletin.patient.age !== null ? `${bulletin.patient.age} ans` : '—'} ({bulletin.patient.sexe === 'M' ? 'Masculin' : 'Féminin'})
                    </span>
                  </div>
                  {bulletin.patient.groupe_sanguin && (
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-slate-500">Groupe sanguin :</span>
                      <span className="col-span-2 font-bold text-rose-700">{bulletin.patient.groupe_sanguin}</span>
                    </div>
                  )}
                </div>

                {/* Prescription & Prélèvement */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold border-b border-slate-200 pb-1 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>PRESCRIPTION & PRÉLÈVEMENT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Médecin :</span>
                    <span className="col-span-2 font-semibold text-slate-900">Dr. {bulletin.prescripteur.nom}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Visite / Bon :</span>
                    <span className="col-span-2 font-mono text-slate-700">{bulletin.prescripteur.numero_visite || '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Date prélèvement :</span>
                    <span className="col-span-2 font-medium text-slate-800">{formatDate(bulletin.demande.date_prelevement)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Prélevé par :</span>
                    <span className="col-span-2 text-slate-800">{bulletin.demande.preleve_par_nom || 'Laboratoire de la Clinique'}</span>
                  </div>
                  {bulletin.prescripteur.indication_clinique && (
                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Indication :</span>
                      <span className="col-span-2 text-slate-800 italic">{bulletin.prescripteur.indication_clinique}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tableau structuré des analyses — responsive, sans scroll horizontal */}
              <div className="mb-6">
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                          <th className="py-2.5 px-3">Examen / Paramètre</th>
                          <th className="py-2.5 px-3 text-center">Échantillon</th>
                          <th className="py-2.5 px-3 text-right">Résultat mesuré</th>
                          <th className="py-2.5 px-3 text-center">Unité</th>
                          <th className="py-2.5 px-3 text-center">Valeurs Usuelles</th>
                          <th className="py-2.5 px-3 text-center">Interprétation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {bulletin.analyses && bulletin.analyses.length > 0 ? (
                          bulletin.analyses.map((an: any) => {
                            const isAnormal = an.interpretation === 'ANORMAL';
                            const isCritique = an.interpretation === 'CRITIQUE';
                            
                            let parsedDetails: any = null;
                            if (an.resultats_detailles) {
                              try {
                                parsedDetails = typeof an.resultats_detailles === 'string'
                                  ? JSON.parse(an.resultats_detailles)
                                  : an.resultats_detailles;
                              } catch {}
                            }

                            return (
                              <React.Fragment key={an.id}>
                                <tr className={`hover:bg-slate-50/50 ${isCritique ? 'bg-rose-50/40' : isAnormal ? 'bg-amber-50/30' : ''}`}>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {an.nom_analyse}
                                    {an.observation && (
                                      <p className="text-[11px] text-slate-500 font-normal italic mt-0.5">
                                        Note : {an.observation}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      {an.type_echantillon}
                                    </span>
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-bold font-mono text-sm ${
                                    isCritique ? 'text-rose-700' : isAnormal ? 'text-amber-700' : 'text-slate-900'
                                  }`}>
                                    {an.valeur_mesuree || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                                    {an.unite || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                                    {an.valeurs_reference || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {an.interpretation ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isCritique 
                                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                          : isAnormal 
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        {an.interpretation}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>

                                {/* Affichage des sous-paramètres structurés le cas échéant (ex: NFS, ECBU) */}
                                {parsedDetails && Array.isArray(parsedDetails) && parsedDetails.length > 0 && (
                                  <tr className="bg-slate-50/70">
                                    <td colSpan={6} className="py-2 px-4">
                                      <div className="rounded border border-slate-200 bg-white p-2.5 space-y-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                          Sous-paramètres détaillés ({an.nom_analyse}) :
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                                          {parsedDetails.map((sub: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                                              <span className="text-slate-600">{sub.label || sub.param} :</span>
                                              <span className="font-mono font-semibold text-slate-900">{sub.value} {sub.unite}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">
                              Aucune analyse enregistrée.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Conclusion Biologique & Remarques */}
              {(bulletin.validation.conclusion_globale || bulletin.validation.remarques_techniques) && (
                <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200/80 mb-6 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold uppercase tracking-wider">
                    <Info className="w-4 h-4 text-emerald-700" />
                    <span>Conclusion & Interprétation Biologique</span>
                  </div>
                  {bulletin.validation.conclusion_globale && (
                    <p className="text-slate-800 leading-relaxed font-medium">
                      {bulletin.validation.conclusion_globale}
                    </p>
                  )}
                  {bulletin.validation.remarques_techniques && (
                    <p className="text-slate-600 text-[11px] italic border-t border-emerald-100 pt-1">
                      Remarque technique : {bulletin.validation.remarques_techniques}
                    </p>
                  )}
                </div>
              )}

              {/* Historique des amendements si présent */}
              {bulletin.amendements && bulletin.amendements.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 mb-6 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <History className="w-3.5 h-3.5 text-amber-700" />
                    <span>AVIS DE RECTIFICATION / AMENDEMENT OFFICIEL</span>
                  </div>
                  {bulletin.amendements.map((amd: any, i: number) => (
                    <p key={amd.id || i} className="text-amber-800 text-[11px]">
                      • Rectifié le {formatDate(amd.created_at)} par <span className="font-semibold">{amd.amende_par_nom || 'Laboratoire'}</span> — Motif : « {amd.motif} »
                    </p>
                  ))}
                </div>
              )}

              {/* Signatures et Validations */}
              <div className="border-t border-slate-200 pt-6 mt-6 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <p className="text-slate-500 font-medium">Saisie technique :</p>
                  <p className="font-semibold text-slate-800">{bulletin.validation.result_entered_by_nom || 'Service Laboratoire'}</p>
                  <p className="text-[11px] text-slate-400">{formatDate(bulletin.validation.result_entered_at)}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block text-center border-t-2 border-emerald-700 pt-2 px-6">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 font-bold mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Validé par le Biologiste</span>
                    </div>
                    <p className="font-bold text-slate-900">{bulletin.validation.validated_by_nom || 'Biologiste de garde'}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(bulletin.validation.validated_at)}</p>
                    <p className="text-[10px] text-slate-400 italic mt-1">Signature & Cachet électronique</p>
                  </div>
                </div>
              </div>

              {/* Pied de page */}
              <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
                Document médical confidentiel généré par le Système Intégré Clinique Les Archanges — Tous droits réservés.
              </div>

            </div>
          ) : null}
        </div>

        {/* Barre d'actions basse (Masquée à l'impression) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-t border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold">
              Bulletin {bulletin?.demande?.numero_demande || ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !bulletin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
