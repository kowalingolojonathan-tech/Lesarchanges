import React, { useState, useEffect } from 'react';
import { 
  X, History, Calendar, User, Stethoscope, HeartPulse, 
  FileText, AlertTriangle, ChevronRight, Activity, CheckCircle2
} from 'lucide-react';
import { MedicalHistoryItem, Patient } from '../../types';
import { apiFetch } from '../../lib/api';

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

                {/* Constantes de triage associées à cette visite */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center mb-3">
                    <HeartPulse className="w-4 h-4 mr-1.5 text-rose-500" />
                    Signes Vitaux enregistrés lors de cette visite
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Température</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedConsultation.temperature ? `${selectedConsultation.temperature} °C` : 'Non mesurée'}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Tension Artérielle</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedConsultation.tension_systolique && selectedConsultation.tension_diastolique
                          ? `${selectedConsultation.tension_systolique}/${selectedConsultation.tension_diastolique} mmHg`
                          : 'Non mesurée'}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Pouls / PAM</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedConsultation.pouls ? `${selectedConsultation.pouls} bpm` : '-'}
                        {selectedConsultation.pam ? ` • PAM: ${selectedConsultation.pam}` : ''}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">IMC</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedConsultation.imc ? `${selectedConsultation.imc} kg/m²` : '-'}
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

                  {/* Diagnostic */}
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

                  {/* Conduite à tenir */}
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Conduite à tenir & Plan de soins
                    </label>
                    <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedConsultation.conduite_a_tenir || 'Non renseigné'}
                    </div>
                  </div>
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
    </div>
  );
};
