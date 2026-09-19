import React, { useState, useMemo } from 'react';
import { Patient } from '../../types/index.js';
import { UserPlus, X, AlertCircle, CheckCircle2, User, Phone, MapPin, Calendar, Heart, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface NewPatientModalProps {
  onClose: () => void;
  onSuccess: (patient: Patient, createVisiteImmediately: boolean) => void;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ onClose, onSuccess }) => {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F'>('M');
  const [telephone, setTelephone] = useState('+243');
  const [adresse, setAdresse] = useState('');
  const [groupeSanguin, setGroupeSanguin] = useState('');
  const [allergies, setAllergies] = useState('');
  const [antecedents, setAntecedents] = useState('');
  const [urgenceNom, setUrgenceNom] = useState('');
  const [urgenceTel, setUrgenceTel] = useState('');
  const [createVisiteImmediately, setCreateVisiteImmediately] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; dossier: string } | null>(null);

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
    setIsSubmitting(true);
    setErrorMessage(null);
    setDuplicateWarning(null);

    try {
      const payload = {
        nom: nom.trim().toUpperCase(),
        prenom: prenom.trim(),
        date_naissance: dateNaissance,
        sexe,
        telephone: telephone.trim(),
        adresse: adresse.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">Nouveau Dossier Patient Permanent</h3>
              <p className="text-xs text-emerald-200">
                Génération automatique du numéro de dossier unique (ARCH-YYYY-XXXXX)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white transition-colors p-1 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs text-amber-800">
              <div className="flex items-center space-x-2 font-bold text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                <span>DOUBLON DÉTECTÉ : Création d'un second dossier interdite</span>
              </div>
              <p>{duplicateWarning.message}</p>
              <p className="text-slate-700">
                Numéro de dossier existant : <span className="font-mono font-bold text-emerald-800">{duplicateWarning.dossier}</span>
              </p>
              <p className="text-[11px] text-amber-700 italic">
                Règle V1 : Réutilisez impérativement le dossier permanent existant et créez une nouvelle visite.
              </p>
            </div>
          )}

          {/* Identité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de famille *
              </label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value.toUpperCase())}
                placeholder="Ex: TSHISEKEDI"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom(s) *
              </label>
              <input
                type="text"
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ex: Jean-Luc"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date de naissance *
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              {ageApercu !== null && (
                <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                  Âge calculé : {ageApercu} an(s)
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sexe biologique *
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setSexe('M')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md border transition-all ${
                    sexe === 'M' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Masculin (M)
                </button>
                <button
                  type="button"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+243..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse physique
            </label>
            <input
              type="text"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Commune, Quartier, Avenue, N° (ex: Gombe, Av. De la Justice N°14)"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Données médicales de base (accessibles accueil) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Groupe Sanguin
              </label>
              <select
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allergies signalées par le patient
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex: Pénicilline, AINS, Sulfamides (sinon RAS)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Contact d'urgence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact d'urgence (Nom & Lien)
              </label>
              <input
                type="text"
                value={urgenceNom}
                onChange={(e) => setUrgenceNom(e.target.value)}
                placeholder="Ex: Marie (Épouse)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone d'urgence
              </label>
              <input
                type="tel"
                value={urgenceTel}
                onChange={(e) => setUrgenceTel(e.target.value)}
                placeholder="+243..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Option ouvrir une visite */}
          <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 flex items-center justify-between">
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

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
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
