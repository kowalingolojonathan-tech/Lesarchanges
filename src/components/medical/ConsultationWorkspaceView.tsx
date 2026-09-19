import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, CheckCircle2, Lock, Unlock, AlertCircle, 
  HeartPulse, User, ShieldAlert, History, Plus, X, Stethoscope, 
  FileText, Activity, AlertTriangle, Clock, Pill, FlaskConical, ExternalLink
} from 'lucide-react';
import { Consultation, Patient, SignesVitaux, Visite } from '../../types';
import { PatientHistoryModal } from './PatientHistoryModal';

interface ConsultationWorkspaceViewProps {
  consultationId: string;
  onBack: () => void;
  onConsultationFinalized?: () => void;
}

export const ConsultationWorkspaceView: React.FC<ConsultationWorkspaceViewProps> = ({
  consultationId,
  onBack,
  onConsultationFinalized,
}) => {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Champs du formulaire
  const [motif, setMotif] = useState<string>('');
  const [histoire, setHistoire] = useState<string>('');
  const [examen, setExamen] = useState<string>('');
  const [diagnosticPrincipal, setDiagnosticPrincipal] = useState<string>('');
  const [diagnosticsAssocies, setDiagnosticsAssocies] = useState<string[]>([]);
  const [newDiagInput, setNewDiagInput] = useState<string>('');
  const [conduiteATenir, setConduiteATenir] = useState<string>('');
  const [notesConfidentielles, setNotesConfidentielles] = useState<string>('');

  // Mode amendement pour consultation finalisée
  const [isAmendmentMode, setIsAmendmentMode] = useState<boolean>(false);
  const [amendementMotif, setAmendementMotif] = useState<string>('');

  // Modale historique
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Modale confirmation finalisation
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fetchConsultation = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('archanges_auth_token');
      const res = await fetch(`/api/medical/consultations/${consultationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors du chargement de la consultation');
      }

      const data = await res.json();
      const c: Consultation = data.consultation;
      setConsultation(c);

      // Initialiser le formulaire
      setMotif(c.motif_consultation || '');
      setHistoire(c.histoire_maladie || '');
      setExamen(c.examen_physique || '');
      setDiagnosticPrincipal(c.diagnostic_principal || '');
      setConduiteATenir(c.conduite_a_tenir || '');
      setNotesConfidentielles(c.notes_confidentielles || '');

      if (c.diagnostics_associes) {
        try {
          const parsed = JSON.parse(c.diagnostics_associes);
          if (Array.isArray(parsed)) {
            setDiagnosticsAssocies(parsed);
          } else {
            setDiagnosticsAssocies([c.diagnostics_associes]);
          }
        } catch (e) {
          setDiagnosticsAssocies([c.diagnostics_associes]);
        }
      } else {
        setDiagnosticsAssocies([]);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de charger la consultation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultation();
  }, [consultationId]);

  // Ajouter un diagnostic associé
  const handleAddDiagnosticAssocie = () => {
    const trimmed = newDiagInput.trim();
    if (trimmed && !diagnosticsAssocies.includes(trimmed)) {
      setDiagnosticsAssocies([...diagnosticsAssocies, trimmed]);
      setNewDiagInput('');
    }
  };

  // Retirer un diagnostic associé
  const handleRemoveDiagnosticAssocie = (index: number) => {
    setDiagnosticsAssocies(diagnosticsAssocies.filter((_, idx) => idx !== index));
  };

  // Sauvegarder la consultation (brouillon ou en cours)
  const handleSave = async (targetStatus: 'BROUILLON' | 'EN_COURS') => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('archanges_auth_token');
      const payload: any = {
        motif_consultation: motif,
        histoire_maladie: histoire,
        examen_physique: examen,
        diagnostic_principal: diagnosticPrincipal,
        diagnostics_associes: diagnosticsAssocies,
        conduite_a_tenir: conduiteATenir,
        notes_confidentielles: notesConfidentielles,
        statut: targetStatus,
      };

      if (consultation?.statut === 'FINALISEE') {
        payload.is_amendment = true;
        payload.amendement_motif = amendementMotif;
      }

      const res = await fetch(`/api/medical/consultations/${consultationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      setConsultation(data.consultation);
      setSuccessMessage(`Consultation enregistrée avec succès (${targetStatus === 'BROUILLON' ? 'Brouillon' : 'En cours'}).`);
      setIsAmendmentMode(false);
      setAmendementMotif('');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Validation avant finalisation
  const handleOpenFinalizeModal = () => {
    const errors: string[] = [];
    if (!motif.trim() || motif.trim().length < 2) {
      errors.push('Le motif de consultation est obligatoire.');
    }
    if (!diagnosticPrincipal.trim() || diagnosticPrincipal.trim().length < 2) {
      errors.push('Le diagnostic principal retenu est obligatoire.');
    }
    if (!conduiteATenir.trim() || conduiteATenir.trim().length < 2) {
      errors.push('La conduite à tenir / plan de prise en charge est obligatoire.');
    }
    if ((!histoire.trim() || histoire.trim().length < 2) && (!examen.trim() || examen.trim().length < 2)) {
      errors.push('Veuillez renseigner au moins l’histoire de la maladie ou l’examen physique.');
    }

    setValidationErrors(errors);
    setShowFinalizeConfirm(true);
  };

  // Confirmer la finalisation de la consultation
  const handleConfirmFinalize = async () => {
    setFinalizing(true);
    setError(null);
    try {
      const token = localStorage.getItem('archanges_auth_token');
      const res = await fetch(`/api/medical/consultations/${consultationId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motif_consultation: motif,
          histoire_maladie: histoire,
          examen_physique: examen,
          diagnostic_principal: diagnosticPrincipal,
          diagnostics_associes: diagnosticsAssocies,
          conduite_a_tenir: conduiteATenir,
          notes_confidentielles: notesConfidentielles,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la finalisation');
      }

      setConsultation(data.consultation);
      setShowFinalizeConfirm(false);
      setSuccessMessage('Consultation finalisée avec succès ! Le dossier médical est verrouillé.');
      if (onConsultationFinalized) {
        onConsultationFinalized();
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de finaliser la consultation.');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Activity className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Ouverture sécurisée du dossier médical...</p>
      </div>
    );
  }

  if (error && !consultation) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Accès Refusé ou Dossier Introuvable</h2>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à la file d'attente
        </button>
      </div>
    );
  }

  if (!consultation) return null;

  const isFinalized = consultation.statut === 'FINALISEE';
  const isReadOnly = isFinalized && !isAmendmentMode;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Barre de navigation haute & Actions rapides */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Retour à la file"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900">Poste de Consultation Clinique</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                consultation.statut === 'FINALISEE' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : consultation.statut === 'BROUILLON'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {consultation.statut}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Visite N° <strong className="font-mono text-slate-700">{consultation.numero_visite}</strong> • Praticien : <strong className="text-slate-700">{consultation.medecin_nom}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <History className="w-4 h-4 mr-1.5 text-slate-500" />
            Historique Patient
          </button>

          {!isFinalized && (
            <>
              <button
                onClick={() => handleSave('BROUILLON')}
                disabled={saving || finalizing}
                className="inline-flex items-center px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Brouillon
              </button>

              <button
                onClick={() => handleSave('EN_COURS')}
                disabled={saving || finalizing}
                className="inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Enregistrer
              </button>

              <button
                onClick={handleOpenFinalizeModal}
                disabled={saving || finalizing}
                className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Finaliser
              </button>
            </>
          )}

          {isFinalized && !isAmendmentMode && (
            <button
              onClick={() => setIsAmendmentMode(true)}
              className="inline-flex items-center px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-lg transition-colors"
            >
              <Unlock className="w-3.5 h-3.5 mr-1" />
              Modifier (Amendement tracé)
            </button>
          )}

          {isFinalized && isAmendmentMode && (
            <button
              onClick={() => {
                setIsAmendmentMode(false);
                setAmendementMotif('');
              }}
              className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Annuler amendement
            </button>
          )}
        </div>
      </div>

      {/* Messages d'alerte ou succès */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bandeau d'amendement si consultation finalisée déverrouillée */}
      {isFinalized && isAmendmentMode && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
          <div className="flex items-center text-xs font-bold text-purple-900">
            <Lock className="w-4 h-4 mr-1.5 text-purple-700" />
            Mode Amendement Contrôlé (Consultation Finalisée)
          </div>
          <p className="text-xs text-purple-800 leading-relaxed">
            Cette consultation a été clôturée le <strong>{new Date(consultation.finalisee_le || '').toLocaleString('fr-FR')}</strong>.
            Toute modification doit impérativement comporter une justification médicale explicite enregistrée dans le journal d'audit.
          </p>
          <div>
            <label className="block text-xs font-bold text-purple-900 mb-1">
              Motif obligatoire de l'amendement * :
            </label>
            <input
              type="text"
              value={amendementMotif}
              onChange={(e) => setAmendementMotif(e.target.value)}
              placeholder="Ex: Correction posologie suite à confirmation téléphonique, ajout diagnostic différentiel..."
              className="w-full text-xs p-2.5 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => handleSave('EN_COURS')}
              disabled={!amendementMotif.trim() || amendementMotif.trim().length < 5 || saving}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              Enregistrer l'amendement
            </button>
          </div>
        </div>
      )}

      {/* CARTOUCHE PATIENT PERMANENT & CONTEXTE VISITE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-lg">
              {consultation.patient_sexe === 'F' ? 'F' : 'M'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">
                  {consultation.patient_nom} {consultation.patient_prenom}
                </h2>
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-md font-bold">
                  {consultation.numero_dossier}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                <span>Âge : <strong className="text-slate-800">{consultation.patient_age !== undefined && consultation.patient_age !== null ? `${consultation.patient_age} ans` : 'N/A'}</strong></span>
                <span>Sexe : <strong className="text-slate-800">{consultation.patient_sexe === 'F' ? 'Féminin' : 'Masculin'}</strong></span>
                <span>Tél : <strong className="text-slate-800">{consultation.patient_telephone || 'Non renseigné'}</strong></span>
                <span>Groupe : <strong className="text-slate-800">{consultation.groupe_sanguin || 'N/A'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <div className="text-slate-400">Type de Visite</div>
              <div className="font-bold text-slate-800">{consultation.type_visite || 'STANDARD'}</div>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <div>
              <div className="text-slate-400">Arrivée</div>
              <div className="font-bold text-slate-800">
                {consultation.date_arrivee ? new Date(consultation.date_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
              </div>
            </div>
          </div>

        </div>

        {/* Antécédents & Allergies (Alerte Visuelle) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-xs">
          <div className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
            consultation.allergies && consultation.allergies.toLowerCase() !== 'néant' && consultation.allergies.toLowerCase() !== 'aucune'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              consultation.allergies && consultation.allergies.toLowerCase() !== 'néant' && consultation.allergies.toLowerCase() !== 'aucune'
                ? 'text-rose-600'
                : 'text-slate-400'
            }`} />
            <div>
              <strong>Allergies connues : </strong>
              <span>{consultation.allergies || 'Aucune allergie signalée.'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-start space-x-2">
            <FileText className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5" />
            <div>
              <strong>Antécédents du dossier : </strong>
              <span>{consultation.antecedents || 'Aucun antécédent particulier renseigné.'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VOLET DES SIGNES VITAUX RELEVÉS LORS DU TRIAGE DE CETTE VISITE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Signes Vitaux & Constantes de la Visite</h3>
              <p className="text-[11px] text-slate-400">
                Pris au triage par {consultation.triage_agent_nom || 'l’infirmier de triage'}
                {consultation.triage_date_prise ? ` le ${new Date(consultation.triage_date_prise).toLocaleDateString('fr-FR')} à ${new Date(consultation.triage_date_prise).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-md">
            Données Réelles du Triage
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">Température</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.temperature !== undefined && consultation.temperature !== null ? `${consultation.temperature} °C` : '-'}
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">Tension Artérielle</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.tension_systolique && consultation.tension_diastolique
                ? `${consultation.tension_systolique}/${consultation.tension_diastolique}`
                : '-'}
              <span className="text-[11px] font-normal text-slate-400 ml-1">mmHg</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">Pouls / PAM</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.pouls ? `${consultation.pouls} bpm` : '-'}
            </div>
            {consultation.pam && (
              <div className="text-[10px] text-slate-500">PAM : {consultation.pam} mmHg</div>
            )}
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">SpO2 / FR</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.spo2 ? `${consultation.spo2} %` : '-'}
            </div>
            {consultation.frequence_respiratoire && (
              <div className="text-[10px] text-slate-500">FR : {consultation.frequence_respiratoire}/min</div>
            )}
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">Poids / Taille / IMC</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.imc ? `${consultation.imc}` : '-'}
              <span className="text-[10px] font-normal text-slate-400 ml-1">kg/m²</span>
            </div>
            {consultation.categorie_imc && (
              <div className="text-[10px] text-slate-500 truncate">{consultation.categorie_imc}</div>
            )}
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-slate-400 text-[11px]">Glycémie / Douleur</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {consultation.glycemie_mesuree ? `${consultation.glycemie_mesuree} mg/dL` : '-'}
            </div>
            {consultation.douleur !== undefined && consultation.douleur !== null && (
              <div className="text-[10px] text-rose-600 font-semibold">Douleur : {consultation.douleur}/10</div>
            )}
          </div>

        </div>
      </div>

      {/* FORMULAIRE CLINIQUE DU MÉDECIN */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        
        {/* Motif de la consultation */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              1. Motif de Consultation *
            </label>
            <span className="text-[11px] text-slate-400">Raison médicale de la venue</span>
          </div>
          <input
            type="text"
            disabled={isReadOnly}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex: Fièvre persistante depuis 3 jours, céphalées intenses, altération de l'état général..."
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900"
          />
        </div>

        {/* Histoire de la maladie / Anamnèse */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              2. Histoire de la Maladie / Anamnèse
            </label>
            <span className="text-[11px] text-slate-400">Chronologie des symptômes, prise médicamenteuse préalable</span>
          </div>
          <textarea
            rows={4}
            disabled={isReadOnly}
            value={histoire}
            onChange={(e) => setHistoire(e.target.value)}
            placeholder="Description détaillée de l'épisode actuel : mode de début (brutal/progressif), évolution des symptômes, traitements déjà pris (automédication), facteurs déclenchants..."
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-sans"
          />
        </div>

        {/* Examen physique */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              3. Examen Physique Structuré
            </label>
            <span className="text-[11px] text-slate-400">Signes cliniques objectifs par appareil</span>
          </div>
          <textarea
            rows={5}
            disabled={isReadOnly}
            value={examen}
            onChange={(e) => setExamen(e.target.value)}
            placeholder={`- État général : Patient conscient, orienté, état d'hydratation, muqueuses...
- Cardio-vasculaire : Bruits du cœur réguliers, absence de souffle, pouls périphériques perçus.
- Pleuro-pulmonaire : Murmure vésiculaire présent bilatéralement, pas de râles.
- Abdomen : Souple, dépressible, indolore, pas d'hépato-splénomégalie.
- ORL / Neuro / Cutané : Pharynx calme, pupilles isochores, absence de purpura.`}
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-mono text-xs"
          />
        </div>

        {/* Diagnostic principal & Diagnostics associés */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center">
                4. Diagnostic Principal Retenu *
              </label>
              <span className="text-[11px] text-emerald-700 font-semibold">Obligatoire pour finaliser</span>
            </div>
            <input
              type="text"
              disabled={isReadOnly}
              value={diagnosticPrincipal}
              onChange={(e) => setDiagnosticPrincipal(e.target.value)}
              placeholder="Ex: Accès palustre simple à Plasmodium falciparum / Infection des voies respiratoires supérieures / HTA stade 2..."
              className="w-full text-sm p-3 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden disabled:bg-slate-100 text-slate-900 font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 block mb-1.5">
              Diagnostics Associés / Comorbidités
            </label>
            
            {/* Liste des tags de diagnostics secondaires */}
            <div className="flex flex-wrap gap-2 mb-2.5">
              {diagnosticsAssocies.map((diag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center bg-white border border-emerald-300 text-emerald-900 text-xs px-2.5 py-1 rounded-full font-medium shadow-2xs"
                >
                  {diag}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDiagnosticAssocie(idx)}
                      className="ml-1.5 text-emerald-600 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {diagnosticsAssocies.length === 0 && (
                <span className="text-xs text-slate-400 italic">Aucun diagnostic secondaire ajouté.</span>
              )}
            </div>

            {!isReadOnly && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newDiagInput}
                  onChange={(e) => setNewDiagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDiagnosticAssocie();
                    }
                  }}
                  placeholder="Ajouter un diagnostic secondaire (appuyer sur Entrée ou Ajouter)"
                  className="flex-1 text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddDiagnosticAssocie}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conduite à tenir */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              5. Conduite à Tenir & Plan Thérapeutique *
            </label>
            <span className="text-[11px] text-slate-400">Consignes de soins, posologies, surveillance, retour</span>
          </div>
          <textarea
            rows={4}
            disabled={isReadOnly}
            value={conduiteATenir}
            onChange={(e) => setConduiteATenir(e.target.value)}
            placeholder={`1. Mesures thérapeutiques préconisées : antipyrétiques, réhydratation orale...
2. Surveillance clinique de la température et de l'état d'hydratation à domicile.
3. Signes d'alerte nécessitant une consultation urgente : convulsions, léthargie, vomissements incoercibles.
4. Rendez-vous de contrôle suggéré sous 48 à 72 heures si pas d'amélioration.`}
            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 text-slate-900 leading-relaxed font-sans"
          />
        </div>

        {/* Notes confidentielles (Secret Médical Absolu) */}
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
              <Lock className="w-4 h-4 mr-1.5 text-amber-400" />
              6. Notes Confidentielles du Praticien (Strictement Réservées au Médecin)
            </label>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
              Non divulgué à Réception / Caisse / Labo / Admin
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Ces annotations cliniques privées ne sont visibles que par vous et vos confrères médecins autorisés. Elles ne figurent sur aucun document de facturation ou administratif.
          </p>
          <textarea
            rows={3}
            disabled={isReadOnly}
            value={notesConfidentielles}
            onChange={(e) => setNotesConfidentielles(e.target.value)}
            placeholder="Impressions cliniques personnelles, doutes diagnostiques, éléments psycho-sociaux confidentiels..."
            className="w-full text-xs p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-hidden text-slate-100 disabled:bg-slate-950 font-sans"
          />
        </div>

      </div>

      {/* BOUTONS EXTENSIONS DISPONIBLES DANS PHASES SUIVANTES */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-slate-500 font-medium">
          Modules complémentaires du workflow clinique :
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Sera développé dans la Phase 2C"
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-400 rounded-lg cursor-not-allowed flex items-center"
          >
            <Pill className="w-3.5 h-3.5 mr-1.5" />
            Ordonnance Thérapeutique (Phase 2C)
          </button>
          <button
            type="button"
            disabled
            title="Sera développé dans la Phase 3"
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-400 rounded-lg cursor-not-allowed flex items-center"
          >
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
            Demande Analyses Laboratoire (Phase 3)
          </button>
          <button
            type="button"
            disabled
            title="Sera développé dans la Phase 4"
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-400 rounded-lg cursor-not-allowed flex items-center"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Orientation Spécialiste Externe (Phase 4)
          </button>
        </div>
      </div>

      {/* MODALE HISTORIQUE PATIENT */}
      {showHistoryModal && (
        <PatientHistoryModal
          patientId={consultation.patient_id}
          patientName={`${consultation.patient_nom} ${consultation.patient_prenom}`}
          patientDossier={consultation.numero_dossier || 'Dossier'}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* MODALE DE CONFIRMATION DE FINALISATION */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center space-x-3 text-emerald-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Finalisation de la Consultation</h3>
                <p className="text-xs text-slate-500">Clôture clinique et verrouillage du dossier</p>
              </div>
            </div>

            {validationErrors.length > 0 ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-rose-800 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1 text-rose-600" />
                  Champs obligatoires manquants avant finalisation :
                </div>
                <ul className="list-disc list-inside text-xs text-rose-700 space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-rose-600 mt-2">
                  Veuillez compléter ces rubriques médicales pour pouvoir finaliser la consultation.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div><strong>Patient : </strong>{consultation.patient_nom} {consultation.patient_prenom}</div>
                  <div><strong>Diagnostic Principal : </strong><span className="text-emerald-800 font-semibold">{diagnosticPrincipal}</span></div>
                  <div><strong>Diagnostics Associés : </strong>{diagnosticsAssocies.length > 0 ? diagnosticsAssocies.join(', ') : 'Aucun'}</div>
                </div>
                <p>
                  En validant cette finalisation :
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Le statut de la consultation passera définitivement à <strong>FINALISÉE</strong>.</li>
                  <li>La visite médicale sera marquée comme <strong>CLÔTURÉE</strong>.</li>
                  <li>Le dossier sera verrouillé pour protéger les conclusions médicales.</li>
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowFinalizeConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                {validationErrors.length > 0 ? 'Fermer et corriger' : 'Annuler'}
              </button>

              {validationErrors.length === 0 && (
                <button
                  onClick={handleConfirmFinalize}
                  disabled={finalizing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center disabled:opacity-50"
                >
                  {finalizing ? (
                    <>
                      <Activity className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Finalisation en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Confirmer la finalisation
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
