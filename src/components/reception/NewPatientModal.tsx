import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Patient } from '../../types/index.js';
import { UserPlus, X, AlertCircle, CheckCircle2, User, Phone, MapPin, Calendar, Heart, ShieldAlert, Globe, Briefcase } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface NewPatientModalProps {
  onClose: () => void;
  onSuccess: (patient: Patient, createVisiteImmediately: boolean) => void;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ onClose, onSuccess }) => {
  // 5 champs d'identité obligatoires
  const [nom, setNom] = useState('');
  const [postNom, setPostNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  const [paysNaissance, setPaysNaissance] = useState('RD Congo');

  // Autres informations obligatoires et complémentaires
  const [dateNaissance, setDateNaissance] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F'>('M');
  const [telephone, setTelephone] = useState('+243');
  const [adresse, setAdresse] = useState('');
  const [profession, setProfession] = useState('');
  const [etatCivil, setEtatCivil] = useState('');
  const [groupeSanguin, setGroupeSanguin] = useState('');
  const [allergies, setAllergies] = useState('');
  const [antecedents, setAntecedents] = useState('');
  const [urgenceNom, setUrgenceNom] = useState('');
  const [urgenceTel, setUrgenceTel] = useState('');
  const [createVisiteImmediately, setCreateVisiteImmediately] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; dossier: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    nom?: string;
    postNom?: string;
    prenom?: string;
    lieuNaissance?: string;
    paysNaissance?: string;
    dateNaissance?: string;
    telephone?: string;
  }>({});

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, []);

  // Âge calculé en direct
  const ageApercu = useMemo(() => {
    if (!dateNaissance) return null;
    const birth = new Date(dateNaissance);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }, [dateNaissance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDuplicateWarning(null);

    // Validation frontend stricte des 5 champs obligatoires
    const errors: typeof fieldErrors = {};
    if (!nom.trim()) {
      errors.nom = 'Le nom de famille est obligatoire.';
    }
    if (!postNom.trim()) {
      errors.postNom = 'Le post-nom est obligatoire.';
    }
    if (!prenom.trim()) {
      errors.prenom = 'Le prénom est obligatoire.';
    }
    if (!lieuNaissance.trim()) {
      errors.lieuNaissance = 'Le lieu de naissance est obligatoire.';
    }
    if (!paysNaissance.trim()) {
      errors.paysNaissance = 'Le pays de naissance est obligatoire.';
    }
    if (!dateNaissance) {
      errors.dateNaissance = 'La date de naissance est obligatoire.';
    }
    if (!telephone.trim() || telephone.trim().length < 6) {
      errors.telephone = 'Le numéro de téléphone est obligatoire.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Veuillez renseigner tous les champs obligatoires d’identité (Nom, Post-nom, Prénom, Lieu et Pays de naissance).');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        nom: nom.trim().toUpperCase(),
        post_nom: postNom.trim().toUpperCase(),
        prenom: prenom.trim(),
        lieu_naissance: lieuNaissance.trim(),
        pays_naissance: paysNaissance.trim(),
        date_naissance: dateNaissance,
        sexe,
        telephone: telephone.trim(),
        adresse: adresse.trim() || null,
        profession: profession.trim() || null,
        etat_civil: etatCivil.trim() || null,
        groupe_sanguin: groupeSanguin || null,
        allergies: allergies.trim() || null,
        antecedents: antecedents.trim() || null,
        contact_urgence_nom: urgenceNom.trim() || null,
        contact_urgence_telephone: urgenceTel.trim() || null,
      };

      const res = await apiFetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        setDuplicateWarning({
          message: data.message || 'Un patient avec les mêmes informations existe déjà.',
          dossier: data.existingDossier || '',
        });
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors de la création du patient.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.patient, createVisiteImmediately);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden" id="modal_new_patient_overlay">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden" id="modal_new_patient_container">
        {/* Header */}
        <div className="shrink-0 bg-emerald-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between" id="modal_new_patient_header">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">Nouveau Dossier Patient Permanent</h3>
              <p className="text-xs text-emerald-200">
                Identification complète d’état civil & génération du dossier permanent (ARCH-YYYY-XXXXX)
              </p>
            </div>
          </div>
          <button 
            id="btn_close_new_patient_modal"
            onClick={onClose} 
            className="text-emerald-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_new_patient" noValidate>
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700" id="alert_error_message">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

          {duplicateWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs text-amber-800" id="alert_duplicate_warning">
              <div className="flex items-center space-x-2 font-bold text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                <span>DOUBLON DÉTECTÉ : Création d'un second dossier interdite</span>
              </div>
              <p>{duplicateWarning.message}</p>
              <p className="text-slate-700">
                Numéro de dossier existant : <span className="font-mono font-bold text-emerald-800">{duplicateWarning.dossier}</span>
              </p>
              <p className="text-[11px] text-amber-700 italic">
                Règle clinique : Réutilisez impérativement le dossier permanent existant et créez une nouvelle visite.
              </p>
            </div>
          )}

          {/* Section 1 : Identité & État Civil (5 champs obligatoires) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <User className="w-4 h-4 text-emerald-700" />
                <span>État Civil & Identité — Informations Obligatoires</span>
              </h4>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                5 champs d'identité requis
              </span>
            </div>

            {/* Ligne 1 : Nom, Post-nom, Prénom */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="input_patient_nom" className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Nom de famille <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_nom"
                  type="text"
                  value={nom}
                  onChange={(e) => {
                    setNom(e.target.value.toUpperCase());
                    if (fieldErrors.nom) setFieldErrors((prev) => ({ ...prev, nom: undefined }));
                  }}
                  placeholder="Ex: KABANGE"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium uppercase ${
                    fieldErrors.nom ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.nom && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.nom}</p>
                )}
              </div>

              <div>
                <label htmlFor="input_patient_post_nom" className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Post-nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_post_nom"
                  type="text"
                  value={postNom}
                  onChange={(e) => {
                    setPostNom(e.target.value.toUpperCase());
                    if (fieldErrors.postNom) setFieldErrors((prev) => ({ ...prev, postNom: undefined }));
                  }}
                  placeholder="Ex: MWANZA"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium uppercase ${
                    fieldErrors.postNom ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.postNom && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.postNom}</p>
                )}
              </div>

              <div>
                <label htmlFor="input_patient_prenom" className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Prénom(s) <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_prenom"
                  type="text"
                  value={prenom}
                  onChange={(e) => {
                    setPrenom(e.target.value);
                    if (fieldErrors.prenom) setFieldErrors((prev) => ({ ...prev, prenom: undefined }));
                  }}
                  placeholder="Ex: Jean-Luc"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium ${
                    fieldErrors.prenom ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.prenom && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.prenom}</p>
                )}
              </div>
            </div>

            {/* Ligne 2 : Lieu de naissance, Pays de naissance, Date de naissance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="input_patient_lieu_naissance" className="block text-xs font-semibold text-slate-700 mb-1">
                  4. Lieu de naissance <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_lieu_naissance"
                  type="text"
                  value={lieuNaissance}
                  onChange={(e) => {
                    setLieuNaissance(e.target.value);
                    if (fieldErrors.lieuNaissance) setFieldErrors((prev) => ({ ...prev, lieuNaissance: undefined }));
                  }}
                  placeholder="Ex: Lubumbashi"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium ${
                    fieldErrors.lieuNaissance ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Ville/territoire d'origine (distinct de la résidence)</p>
                {fieldErrors.lieuNaissance && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.lieuNaissance}</p>
                )}
              </div>

              <div>
                <label htmlFor="input_patient_pays_naissance" className="block text-xs font-semibold text-slate-700 mb-1">
                  5. Pays de naissance <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_pays_naissance"
                  type="text"
                  value={paysNaissance}
                  onChange={(e) => {
                    setPaysNaissance(e.target.value);
                    if (fieldErrors.paysNaissance) setFieldErrors((prev) => ({ ...prev, paysNaissance: undefined }));
                  }}
                  placeholder="Ex: RD Congo"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium ${
                    fieldErrors.paysNaissance ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Nationalité / Pays d'origine</p>
                {fieldErrors.paysNaissance && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.paysNaissance}</p>
                )}
              </div>

              <div>
                <label htmlFor="input_patient_date_naissance" className="block text-xs font-semibold text-slate-700 mb-1">
                  Date de naissance <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_date_naissance"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={dateNaissance}
                  onChange={(e) => {
                    setDateNaissance(e.target.value);
                    if (fieldErrors.dateNaissance) setFieldErrors((prev) => ({ ...prev, dateNaissance: undefined }));
                  }}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden ${
                    fieldErrors.dateNaissance ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {ageApercu !== null && (
                  <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                    Âge calculé : {ageApercu} an(s)
                  </span>
                )}
                {fieldErrors.dateNaissance && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.dateNaissance}</p>
                )}
              </div>
            </div>

            {/* Ligne 3 : Sexe & Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sexe biologique <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    id="btn_sexe_m"
                    onClick={() => setSexe('M')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md border transition-all ${
                      sexe === 'M' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Masculin (M)
                  </button>
                  <button
                    type="button"
                    id="btn_sexe_f"
                    onClick={() => setSexe('F')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md border transition-all ${
                      sexe === 'F' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Féminin (F)
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="input_patient_telephone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone joignable <span className="text-red-500">*</span>
                </label>
                <input
                  id="input_patient_telephone"
                  type="tel"
                  value={telephone}
                  onChange={(e) => {
                    setTelephone(e.target.value);
                    if (fieldErrors.telephone) setFieldErrors((prev) => ({ ...prev, telephone: undefined }));
                  }}
                  placeholder="+243..."
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${
                    fieldErrors.telephone ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.telephone && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{fieldErrors.telephone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2 : Résidence actuelle & Informations professionnelles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="input_patient_adresse" className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse de résidence actuelle (Kinshasa ou autre)
              </label>
              <input
                id="input_patient_adresse"
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Commune, Quartier, Avenue, N° (ex: Gombe, Av. De la Justice N°14)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="input_patient_profession" className="block text-xs font-semibold text-slate-700 mb-1">
                Profession / Activité
              </label>
              <input
                id="input_patient_profession"
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Ex: Enseignant, Avocat..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 3 : Données médicales de base (accessibles accueil) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label htmlFor="select_groupe_sanguin" className="block text-xs font-semibold text-slate-700 mb-1">
                Groupe Sanguin
              </label>
              <select
                id="select_groupe_sanguin"
                value={groupeSanguin}
                onChange={(e) => setGroupeSanguin(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
              >
                <option value="">Non renseigné</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="input_patient_allergies" className="block text-xs font-semibold text-slate-700 mb-1">
                Allergies signalées par le patient
              </label>
              <input
                id="input_patient_allergies"
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex: Pénicilline, AINS, Sulfamides (sinon RAS)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 4 : Contact d'urgence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label htmlFor="input_urgence_nom" className="block text-xs font-semibold text-slate-700 mb-1">
                Contact d'urgence (Nom & Lien de parenté)
              </label>
              <input
                id="input_urgence_nom"
                type="text"
                value={urgenceNom}
                onChange={(e) => setUrgenceNom(e.target.value)}
                placeholder="Ex: Marie KABANGE (Épouse)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="input_urgence_tel" className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone d'urgence
              </label>
              <input
                id="input_urgence_tel"
                type="tel"
                value={urgenceTel}
                onChange={(e) => setUrgenceTel(e.target.value)}
                placeholder="+243..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Option ouvrir une visite */}
          <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 flex items-center justify-between" id="section_visite_immediate">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create_visite_check"
                checked={createVisiteImmediately}
                onChange={(e) => setCreateVisiteImmediately(e.target.checked)}
                className="w-4 h-4 accent-emerald-700 rounded-xs"
              />
              <label htmlFor="create_visite_check" className="text-xs font-medium text-emerald-900 cursor-pointer">
                Ouvrir immédiatement une visite d'accueil et orienter vers le triage
              </label>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold">Statut initial : ATTENTE_TRIAGE</span>
          </div>
        </div>

        {/* Boutons d'action tactiles fixés en bas */}
        <div className="shrink-0 bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              id="btn_cancel_patient"
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[44px] flex items-center justify-center"
            >
              Annuler
            </button>
            <button
              id="btn_submit_patient"
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Création du dossier permanent...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Créer le dossier permanent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
