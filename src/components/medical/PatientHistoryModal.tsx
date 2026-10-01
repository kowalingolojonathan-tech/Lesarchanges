import React, { useState, useEffect } from 'react';
import { 
  X, History, Calendar, User, Stethoscope, HeartPulse, 
  FileText, AlertTriangle, ChevronRight, Activity, CheckCircle2, Pill, FlaskConical,
  Eye, CheckCheck, Thermometer, Wind, Scale, Ruler, ShieldCheck, Sparkles, Heart,
  Lightbulb, Check, Clock
} from 'lucide-react';
import { MedicalHistoryItem, Patient, HypotheseDiagnostique, DiagnosticRetenu } from '../../types';
import { apiFetch } from '../../lib/api';
import { LabReportModal } from './LabReportModal';

interface PatientHistoryModalProps {
  patientId: string;
  patientName: string;
  patientDossier: string;
  onClose: () => void;
}

export const PatientHistoryModal: React.FC<PatientHistoryModalProps> = ({
  patientId,
  patientName,
  patientDossier,
  onClose,
}) => {
  const [history, setHistory] = useState<MedicalHistoryItem[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<MedicalHistoryItem | null>(null);
  const [selectedBulletinOrderId, setSelectedBulletinOrderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/medical/patients/${patientId}/history`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erreur lors du chargement de l’historique');
        }

        const data = await res.json();
        setHistory(data.history || []);
        setPatient(data.patient || null);
        if (data.history && data.history.length > 0) {
          setSelectedConsultation(data.history[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Impossible de récupérer l’historique médical.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patientId]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">Historique Médical Antérieur</h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Secret Médical
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Patient : <strong className="text-slate-800">{patientName}</strong> • Dossier Permanent : <strong className="text-slate-800">{patientDossier}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Colonne latérale gauche : Liste chronologique des consultations */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/50 p-4 overflow-y-auto space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Consultations ({history.length})
            </div>

            {loading && (
              <div className="py-12 text-center text-sm text-slate-500">
                <Activity className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                Chargement de l'historique...
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            {!loading && !error && history.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-400">
                Aucune consultation médicale antérieure pour ce patient.
              </div>
            )}

            {!loading && history.map((item) => {
              const isSelected = selectedConsultation?.id === item.id;
              const dateStr = new Date(item.date_consultation).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedConsultation(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs' 
                      : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="flex items-center font-medium">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {dateStr}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      item.statut === 'FINALISEE' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.statut}
                    </span>
                  </div>

                  <div className="font-semibold text-sm text-slate-900 truncate">
                    {item.motif_consultation || 'Consultation générale'}
                  </div>

                  <div className="text-xs text-slate-600 mt-1 flex items-center">
                    <User className="w-3 h-3 mr-1 text-slate-400" />
                    <span className="truncate">{item.medecin_nom}</span>
                  </div>

                  {item.diagnostic_principal && (
                    <div className="mt-2 text-xs bg-slate-100 text-slate-700 p-1.5 rounded-md truncate font-medium">
                      Diag : {item.diagnostic_principal}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panneau central droit : Détail de la consultation sélectionnée */}
          <div className="flex-1 p-6 overflow-y-auto bg-white space-y-6">
            {selectedConsultation ? (
              <div className="space-y-6">
                
                {/* Métadonnées de la visite d'origine */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Visite d'origine : </span>
                    <strong className="text-slate-800 font-mono text-sm">{selectedConsultation.numero_visite}</strong>
                    <span className="ml-2 text-slate-500">
                      ({new Date(selectedConsultation.date_arrivee).toLocaleDateString('fr-FR')} - {selectedConsultation.type_visite})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Praticien : </span>
                    <strong className="text-slate-800">{selectedConsultation.medecin_nom}</strong>
                  </div>
                  {selectedConsultation.finalisee_le && (
                    <div className="flex items-center text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Finalisée le {new Date(selectedConsultation.finalisee_le).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>

                {/* Traçabilité des horaires : Temps d'attente & Durée de consultation */}
                {(selectedConsultation.heure_orientation || selectedConsultation.heure_prise_en_charge) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs">
                    {/* Temps d'attente */}
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Temps d'attente patient (Orientation → Prise en charge)
                        </div>
                        <div className="font-semibold text-slate-800">
                          {selectedConsultation.heure_orientation && selectedConsultation.heure_prise_en_charge ? (
                            <>
                              <strong className="text-amber-700">
                                {Math.max(0, Math.round((new Date(selectedConsultation.heure_prise_en_charge).getTime() - new Date(selectedConsultation.heure_orientation).getTime()) / 60000))} min
                              </strong>
                              <span className="text-slate-500 text-[11px] ml-1">
                                ({new Date(selectedConsultation.heure_orientation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(selectedConsultation.heure_prise_en_charge).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </>
                          ) : selectedConsultation.heure_orientation ? (
                            <span className="text-slate-500">
                              Orienté à {new Date(selectedConsultation.heure_orientation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-slate-400">Non renseigné</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Durée de consultation */}
                    <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Durée de consultation (Début → Fin)
                        </div>
                        <div className="font-semibold text-slate-800">
                          {(() => {
                            const finConsultation = selectedConsultation.heure_fin_consultation || selectedConsultation.finalisee_le;
                            if (selectedConsultation.heure_debut_consultation && finConsultation) {
                              const debutMs = new Date(selectedConsultation.heure_debut_consultation).getTime();
                              const finMs = new Date(finConsultation).getTime();
                              return (
                                <>
                                  <strong className="text-blue-700">
                                    {Math.max(0, Math.round((finMs - debutMs) / 60000))} min
                                  </strong>
                                  <span className="text-slate-500 text-[11px] ml-1">
                                    ({new Date(selectedConsultation.heure_debut_consultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(finConsultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                                  </span>
                                </>
                              );
                            }
                            if (selectedConsultation.heure_debut_consultation) {
                              return (
                                <span className="text-slate-500">
                                  Débutée à {new Date(selectedConsultation.heure_debut_consultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              );
                            }
                            return <span className="text-slate-400">Non renseignée</span>;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Constantes de triage associées à cette visite - vues au complet chacune séparément */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center">
                      <HeartPulse className="w-4 h-4 mr-1.5 text-rose-500" />
                      Signes Vitaux & Données Physiques du Triage
                    </div>
                    {selectedConsultation.triage_agent_nom && (
                      <span className="text-[11px] text-slate-500">
                        Pris par : <strong>{selectedConsultation.triage_agent_nom}</strong>
                      </span>
                    )}
                  </div>

                  {/* 1. Les 8 constantes vitales mesurées saisies */}
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                      Données Vitales Saisies au Triage Réception
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      {/* Température */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Thermometer className="w-3 h-3 text-amber-500" />
                          <span>Température</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.temperature !== undefined && selectedConsultation.temperature !== null
                            ? `${selectedConsultation.temperature} °C`
                            : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">36.5 – 37.5 °C</div>
                      </div>

                      {/* PAS */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-rose-500" />
                          <span>PAS (Systole)</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.tension_systolique ? `${selectedConsultation.tension_systolique} mmHg` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">100 – 139 mmHg</div>
                      </div>

                      {/* PAD */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-indigo-500" />
                          <span>PAD (Diastole)</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.tension_diastolique ? `${selectedConsultation.tension_diastolique} mmHg` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">60 – 89 mmHg</div>
                      </div>

                      {/* Pouls */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Heart className="w-3 h-3 text-rose-500" />
                          <span>Pouls</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.pouls ? `${selectedConsultation.pouls} bpm` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">60 – 100 bpm</div>
                      </div>

                      {/* SpO2 */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-blue-500" />
                          <span>SpO₂</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.spo2 ? `${selectedConsultation.spo2} %` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">95 – 100 %</div>
                      </div>

                      {/* FR */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Wind className="w-3 h-3 text-sky-500" />
                          <span>Fréq. Respiratoire</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.frequence_respiratoire ? `${selectedConsultation.frequence_respiratoire} /min` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">12 – 20 /min</div>
                      </div>

                      {/* Poids */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Scale className="w-3 h-3 text-emerald-600" />
                          <span>Poids</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.poids ? `${selectedConsultation.poids} kg` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">Pesée réelle</div>
                      </div>

                      {/* Taille */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <Ruler className="w-3 h-3 text-teal-600" />
                          <span>Taille</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.taille ? `${selectedConsultation.taille} cm` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {selectedConsultation.taille ? `${(selectedConsultation.taille / 100).toFixed(2)} m` : 'Toise'}
                        </div>
                      </div>

                      {/* Douleur */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                          <HeartPulse className="w-3 h-3 text-rose-500" />
                          <span>Douleur (EVA)</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.douleur !== undefined && selectedConsultation.douleur !== null
                            ? `${selectedConsultation.douleur}/10`
                            : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">Échelle 0 à 10</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Paramètres calculés */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>Paramètres & Indices Calculés</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      {/* PAM */}
                      <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                        <div className="text-indigo-900 text-[10px] font-semibold">PAM (Pression Moyenne)</div>
                        <div className="text-sm font-bold text-indigo-950 mt-0.5">
                          {selectedConsultation.pam ? `${selectedConsultation.pam} mmHg` : '-'}
                        </div>
                        <div className="text-[9px] text-indigo-600/70">Norme : 70 – 105 mmHg</div>
                      </div>

                      {/* Pression Différentielle */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px] font-semibold">Différentielle (PAS - PAD)</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedConsultation.pression_pulsee
                            ? `${selectedConsultation.pression_pulsee} mmHg`
                            : selectedConsultation.tension_systolique && selectedConsultation.tension_diastolique
                            ? `${selectedConsultation.tension_systolique - selectedConsultation.tension_diastolique} mmHg`
                            : '-'}
                        </div>
                        <div className="text-[9px] text-slate-400">Norme : 30 – 50 mmHg</div>
                      </div>

                      {/* IMC */}
                      <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                        <div className="text-emerald-900 text-[10px] font-semibold">IMC</div>
                        <div className="text-sm font-bold text-emerald-950 mt-0.5">
                          {selectedConsultation.imc ? `${selectedConsultation.imc} kg/m²` : '-'}
                        </div>
                        <div className="text-[9px] text-emerald-700 truncate">
                          {selectedConsultation.categorie_imc || 'Poids / Taille²'}
                        </div>
                      </div>

                      {/* Surface Corporelle */}
                      <div className="bg-teal-50/50 p-2.5 rounded-lg border border-teal-100">
                        <div className="text-teal-900 text-[10px] font-semibold">Surface Corporelle</div>
                        <div className="text-sm font-bold text-teal-950 mt-0.5">
                          {selectedConsultation.surface_corporelle ? `${selectedConsultation.surface_corporelle} m²` : '-'}
                        </div>
                        <div className="text-[9px] text-teal-700">Formule Mosteller</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulaire clinique enregistré */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Motif de la consultation
                    </label>
                    <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                      {selectedConsultation.motif_consultation || 'Non renseigné'}
                    </div>
                  </div>

                  {selectedConsultation.histoire_maladie && (
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        Histoire de la maladie / Anamnèse
                      </label>
                      <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {selectedConsultation.histoire_maladie}
                      </div>
                    </div>
                  )}

                  {selectedConsultation.examen_physique && (
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        Examen physique clinique
                      </label>
                      <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {selectedConsultation.examen_physique}
                      </div>
                    </div>
                  )}

                  {/* Hypothèses Diagnostiques de l'Épisode (si renseignées) */}
                  {(() => {
                    let parsedHypo: HypotheseDiagnostique[] = [];
                    if (selectedConsultation.hypotheses_diagnostiques) {
                      try {
                        const parsed = typeof selectedConsultation.hypotheses_diagnostiques === 'string'
                          ? JSON.parse(selectedConsultation.hypotheses_diagnostiques)
                          : selectedConsultation.hypotheses_diagnostiques;
                        if (Array.isArray(parsed)) {
                          parsedHypo = parsed;
                        }
                      } catch {
                        // ignore
                      }
                    }

                    if (parsedHypo.length === 0) return null;

                    return (
                      <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center space-x-2 text-xs font-bold uppercase text-amber-900 tracking-wider">
                          <Lightbulb className="w-4 h-4 text-amber-600" />
                          <span>Hypothèses Diagnostiques ({parsedHypo.length})</span>
                        </div>
                        <div className="space-y-2">
                          {parsedHypo.map((h, i) => (
                            <div key={h.id || i} className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">{h.libelle}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {h.statut === 'EN_ATTENTE_LABO'
                                    ? 'En attente Labo'
                                    : h.statut === 'EN_ATTENTE_IMAGERIE'
                                    ? 'En attente Imagerie'
                                    : h.statut === 'EN_ATTENTE_EXAMENS'
                                    ? 'En attente Examens'
                                    : 'Suspicion'}
                                </span>
                              </div>
                              {h.attente_details && (
                                <div className="text-[11px] text-amber-900">
                                  <strong>Examens attendus : </strong>{h.attente_details}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Diagnostics Retenus */}
                  {(() => {
                    let parsedRetenus: DiagnosticRetenu[] = [];
                    if (selectedConsultation.diagnostics_retenus) {
                      try {
                        const parsed = typeof selectedConsultation.diagnostics_retenus === 'string'
                          ? JSON.parse(selectedConsultation.diagnostics_retenus)
                          : selectedConsultation.diagnostics_retenus;
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          parsedRetenus = parsed;
                        }
                      } catch {
                        // ignore
                      }
                    }

                    // Si format structuré présent
                    if (parsedRetenus.length > 0) {
                      return (
                        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center space-x-2 text-xs font-bold uppercase text-emerald-900 tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Diagnostics Retenus ({parsedRetenus.length})</span>
                          </div>
                          <div className="space-y-2">
                            {parsedRetenus.map((item, idx) => {
                              const isMain = item.is_principal || idx === 0;
                              return (
                                <div
                                  key={item.id || idx}
                                  className="p-3 bg-white border border-emerald-200 rounded-lg text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      {isMain && (
                                        <span className="bg-emerald-700 text-white font-black px-1.5 py-0.5 rounded text-[10px] uppercase">
                                          Principal
                                        </span>
                                      )}
                                      <span className="font-bold text-slate-900 text-sm">{item.libelle}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      item.statut === 'CONFIRME'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                                    }`}>
                                      {item.statut === 'CONFIRME' ? 'CONFIRMÉ' : 'RETENU (CLINIQUE)'}
                                    </span>
                                  </div>
                                  {item.precision && (
                                    <div className="text-[11px] text-slate-600">
                                      <strong>Précision : </strong>{item.precision}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Fallback rétrocompatible pour les consultations historiques
                    return (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <div>
                          <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                            Diagnostic Principal Retenu
                          </div>
                          <div className="mt-1 text-base font-bold text-emerald-950">
                            {selectedConsultation.diagnostic_principal || 'Non renseigné'}
                          </div>
                        </div>

                        {selectedConsultation.diagnostics_associes && (
                          <div>
                            <div className="text-xs font-semibold text-emerald-800 mb-1">
                              Diagnostics Associés :
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(selectedConsultation.diagnostics_associes);
                                  if (Array.isArray(parsed)) {
                                    return parsed.map((diag, idx) => (
                                      <span key={idx} className="bg-white border border-emerald-300 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                        {diag}
                                      </span>
                                    ));
                                  }
                                } catch (e) {
                                  // non JSON string
                                }
                                return (
                                  <span className="bg-white border border-emerald-300 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                    {selectedConsultation.diagnostics_associes}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Conduite à tenir */}
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Conduite à tenir & Plan de soins
                    </label>
                    <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedConsultation.conduite_a_tenir || 'Non renseigné'}
                    </div>
                  </div>

                  {/* Prescriptions délivrées */}
                  {selectedConsultation.prescriptions && selectedConsultation.prescriptions.length > 0 && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                        <Pill className="w-4 h-4 text-emerald-700" />
                        <span>Prescriptions Thérapeutiques ({selectedConsultation.prescriptions.length})</span>
                      </div>
                      <div className="space-y-2">
                        {selectedConsultation.prescriptions.map((p) => (
                          <div key={p.id} className="p-3 bg-white border border-emerald-200 rounded-lg text-xs space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span>Prescription du {new Date(p.date_prescription).toLocaleDateString('fr-FR')}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {p.statut}
                              </span>
                            </div>
                            {p.items && p.items.length > 0 ? (
                              <ul className="list-disc pl-4 space-y-1 text-slate-700 font-medium">
                                {p.items.map((item) => (
                                  <li key={item.id}>
                                    <span className="font-bold text-slate-900">{item.nom_medicament}</span>
                                    {item.dosage ? ` (${item.dosage})` : ''} : {item.frequence || 'Selon posologie'}
                                    {item.duree ? ` — ${item.duree}` : ''}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-slate-400 italic">Aucun détail de médicament.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Demandes et Résultats de laboratoire associés (Phase 2C-4) */}
                  {selectedConsultation.lab_orders && selectedConsultation.lab_orders.length > 0 && (
                    <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-900">
                        <div className="flex items-center space-x-2">
                          <FlaskConical className="w-4 h-4 text-indigo-700" />
                          <span>Analyses & Résultats de Laboratoire ({selectedConsultation.lab_orders.length})</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedConsultation.lab_orders.map((d) => {
                          const isCompleted = ['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(d.statut);

                          return (
                            <div key={d.id} className="p-3 bg-white border border-indigo-200 rounded-lg text-xs space-y-2 shadow-2xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-800">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-900">{d.numero_demande || 'Demande sans numéro'}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    d.urgence === 'URGENTE' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {d.urgence}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isCompleted 
                                      ? 'bg-emerald-600 text-white' 
                                      : d.statut === 'RESULTATS_SAISIS'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {isCompleted ? '✓ RÉSULTATS VALIDÉS' : d.statut}
                                  </span>
                                </div>

                                {/* Bouton voir bulletin officiel */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedBulletinOrderId(d.id)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                                  title="Consulter le bulletin officiel d'analyses"
                                >
                                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                  Bulletin Officiel
                                </button>
                              </div>

                              {d.indication_clinique && (
                                <p className="text-slate-600 text-[11px]">
                                  <span className="font-semibold text-slate-700">Indication :</span> {d.indication_clinique}
                                </p>
                              )}

                              {d.conclusion_generale && (
                                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-md text-[11px] text-emerald-950">
                                  <strong>Conclusion laboratoire : </strong>
                                  <span className="italic">{d.conclusion_generale}</span>
                                </div>
                              )}

                              {d.analyses && d.analyses.length > 0 ? (
                                <div className="space-y-1.5 pt-1">
                                  {d.analyses.map((a) => {
                                    const hasValue = a.valeur_resultat !== undefined && a.valeur_resultat !== null && a.valeur_resultat !== '';
                                    return (
                                      <div 
                                        key={a.id} 
                                        className={`p-2 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                                          a.flag_anomalie === 'CRITIQUE'
                                            ? 'bg-rose-50 border-rose-300 font-bold text-rose-900'
                                            : a.flag_anomalie && a.flag_anomalie !== 'NORMAL'
                                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                                              : 'bg-slate-50 border-slate-200 text-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold">{a.nom_analyse}</span>
                                          <span className="text-[10px] text-slate-500">({a.type_echantillon})</span>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                          {hasValue ? (
                                            <span className="font-bold text-slate-900">
                                              {a.valeur_resultat} {a.unite_mesure}
                                              {a.normes_reference && (
                                                <span className="font-normal text-slate-500 text-[10px] ml-1">
                                                  [Norme: {a.normes_reference}]
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 italic text-[10px]">En cours d'analyse</span>
                                          )}

                                          {a.flag_anomalie && (
                                            <span className={`px-1.5 py-0.2 rounded-sm text-[9px] font-bold uppercase ${
                                              a.flag_anomalie === 'CRITIQUE'
                                                ? 'bg-rose-600 text-white'
                                                : a.flag_anomalie !== 'NORMAL'
                                                  ? 'bg-amber-500 text-white'
                                                  : 'bg-emerald-100 text-emerald-800'
                                            }`}>
                                              {a.flag_anomalie}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-slate-400 italic text-[11px]">Aucun examen détaillé.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 text-sm">
                Sélectionnez une consultation dans la liste à gauche pour examiner son dossier clinique.
              </div>
            )}
          </div>
        </div>

        {/* Pied de page */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Clinique Les Archanges — Traçabilité Médicale Sécurisée
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors"
          >
            Fermer l'historique
          </button>
        </div>

      </div>

      {/* MODALE DU BULLETIN OFFICIEL DE LABORATOIRE (Phase 2C-4) */}
      {selectedBulletinOrderId && (
        <LabReportModal
          orderId={selectedBulletinOrderId}
          onClose={() => setSelectedBulletinOrderId(null)}
        />
      )}
    </div>
  );
};
