import React, { useState, useMemo } from 'react';
import { Visite } from '../../types/index.js';
import { Activity, AlertCircle, CheckCircle2, Heart, Thermometer, Wind, Scale, User, X, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface TriageVitalsModalProps {
  visite: Visite;
  onClose: () => void;
  onSuccess: (updatedVisite: Visite) => void;
}

export const TriageVitalsModal: React.FC<TriageVitalsModalProps> = ({ visite, onClose, onSuccess }) => {
  const [temperature, setTemperature] = useState<string>('37.0');
  const [tensionSys, setTensionSys] = useState<string>('120');
  const [tensionDia, setTensionDia] = useState<string>('80');
  const [pouls, setPouls] = useState<string>('75');
  const [freqResp, setFreqResp] = useState<string>('16');
  const [spo2, setSpo2] = useState<string>('98');
  const [poids, setPoids] = useState<string>('70');
  const [taille, setTaille] = useState<string>('170');
  const [glycemie, setGlycemie] = useState<string>('1.00');
  const [douleur, setDouleur] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  // Calculs physiologiques instantanés
  const ageCalcule = useMemo(() => {
    if (!visite.patient_date_naissance) return null;
    const birth = new Date(visite.patient_date_naissance);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }, [visite.patient_date_naissance]);

  const pamCalculee = useMemo(() => {
    const sys = Number(tensionSys);
    const dia = Number(tensionDia);
    if (!isNaN(sys) && !isNaN(dia) && sys > dia && sys > 0 && dia > 0) {
      const pam = (sys + 2 * dia) / 3;
      return Math.round(pam * 10) / 10;
    }
    return null;
  }, [tensionSys, tensionDia]);

  const imcCalcule = useMemo(() => {
    const p = Number(poids);
    let t = Number(taille);
    if (!isNaN(p) && !isNaN(t) && p > 0 && t > 0) {
      if (t <= 2.5) t = t * 100; // Si entré en mètres
      const tailleM = t / 100;
      const imc = p / (tailleM * tailleM);
      const imcRound = Math.round(imc * 10) / 10;

      let categorie = 'Poids normal';
      let couleur = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      if (imcRound < 18.5) {
        categorie = 'Insuffisance pondérale';
        couleur = 'text-amber-700 bg-amber-50 border-amber-200';
      } else if (imcRound < 25.0) {
        categorie = 'Poids normal';
        couleur = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (imcRound < 30.0) {
        categorie = 'Surpoids';
        couleur = 'text-amber-700 bg-amber-50 border-amber-200';
      } else if (imcRound < 35.0) {
        categorie = 'Obésité modérée (Classe I)';
        couleur = 'text-orange-700 bg-orange-50 border-orange-200';
      } else if (imcRound < 40.0) {
        categorie = 'Obésité sévère (Classe II)';
        couleur = 'text-red-700 bg-red-50 border-red-200';
      } else {
        categorie = 'Obésité morbide (Classe III)';
        couleur = 'text-red-800 bg-red-100 border-red-300';
      }

      return { imc: imcRound, categorie, couleur };
    }
    return null;
  }, [poids, taille]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails([]);

    try {
      const payload = {
        temperature: temperature ? parseFloat(temperature) : null,
        tension_systolique: tensionSys ? parseInt(tensionSys, 10) : null,
        tension_diastolique: tensionDia ? parseInt(tensionDia, 10) : null,
        pouls: pouls ? parseInt(pouls, 10) : null,
        frequence_respiratoire: freqResp ? parseInt(freqResp, 10) : null,
        spo2: spo2 ? parseInt(spo2, 10) : null,
        poids: poids ? parseFloat(poids) : null,
        taille: taille ? parseFloat(taille) : null,
        glycemie_mesuree: glycemie ? parseFloat(glycemie) : null,
        douleur: douleur !== null ? Number(douleur) : null,
      };

      const res = await apiFetch(`/api/visites/${visite.id}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || data.error || 'Erreur lors de l\'enregistrement des signes vitaux.');
        if (Array.isArray(data.details)) {
          setErrorDetails(data.details);
        }
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion au serveur.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
        {/* Header modal */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Poste de Triage & Signes Vitaux</h3>
              <p className="text-xs text-slate-300">
                Patient : <span className="font-semibold text-white">{visite.patient_nom} {visite.patient_prenom}</span> — Dossier permanent : <span className="font-mono text-emerald-300">{visite.numero_dossier}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2 text-red-800 text-sm font-semibold">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {errorDetails.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-xs text-red-700 space-y-1">
                  {errorDetails.map((det, idx) => (
                    <li key={idx}>{det}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Grille des mesures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Température */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Thermometer className="w-4 h-4 mr-1 text-red-500" />
                Température (°C)
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="45"
                required
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                placeholder="Ex: 37.2"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Norme : 36.5 - 37.5 °C</span>
            </div>

            {/* Pression Artérielle */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Heart className="w-4 h-4 mr-1 text-rose-500" />
                Pression Artérielle (mmHg)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="50"
                  max="300"
                  required
                  value={tensionSys}
                  onChange={(e) => setTensionSys(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono text-center"
                  placeholder="Sys (120)"
                />
                <input
                  type="number"
                  min="30"
                  max="200"
                  required
                  value={tensionDia}
                  onChange={(e) => setTensionDia(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono text-center"
                  placeholder="Dia (80)"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Systolique / Diastolique</span>
            </div>

            {/* Pouls */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Activity className="w-4 h-4 mr-1 text-emerald-600" />
                Pouls (bpm)
              </label>
              <input
                type="number"
                min="30"
                max="250"
                required
                value={pouls}
                onChange={(e) => setPouls(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                placeholder="Ex: 75"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Norme repos : 60 - 100 bpm</span>
            </div>

            {/* Fréquence respiratoire */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Wind className="w-4 h-4 mr-1 text-blue-500" />
                Fréquence Respiratoire (cpm)
              </label>
              <input
                type="number"
                min="6"
                max="80"
                value={freqResp}
                onChange={(e) => setFreqResp(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                placeholder="Ex: 16"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Norme adulte : 12 - 20 cpm</span>
            </div>

            {/* Saturation SpO2 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Activity className="w-4 h-4 mr-1 text-cyan-600" />
                Saturation en O₂ (SpO₂)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  placeholder="Ex: 98"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">%</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Norme : ≥ 95%</span>
            </div>

            {/* Glycémie */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Activity className="w-4 h-4 mr-1 text-purple-600" />
                Glycémie capillaire (g/L)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.2"
                max="40"
                value={glycemie}
                onChange={(e) => setGlycemie(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                placeholder="Ex: 1.05"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Norme à jeun : 0.70 - 1.10 g/L</span>
            </div>

            {/* Poids & Taille */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 md:col-span-2">
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Scale className="w-4 h-4 mr-1 text-slate-700" />
                Biométrie : Poids & Taille
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="350"
                    required
                    value={poids}
                    onChange={(e) => setPoids(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                    placeholder="Poids"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">kg</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    required
                    value={taille}
                    onChange={(e) => setTaille(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                    placeholder="Taille"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">cm</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Poids en kilogrammes et taille en centimètres (ex: 170 cm)</span>
            </div>

            {/* Échelle de la douleur */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Échelle douleur : {douleur}/10</label>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-sm ${
                  douleur === 0 ? 'bg-emerald-100 text-emerald-800' :
                  douleur <= 3 ? 'bg-blue-100 text-blue-800' :
                  douleur <= 6 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {douleur === 0 ? 'Absente' : douleur <= 3 ? 'Légère' : douleur <= 6 ? 'Modérée' : 'Sévère'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={douleur}
                onChange={(e) => setDouleur(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 px-0.5 mt-1">
                <span>0 (Nulle)</span>
                <span>5 (Moyenne)</span>
                <span>10 (Maximale)</span>
              </div>
            </div>
          </div>

          {/* BANDEAU DES CALCULS AUTOMATIQUES DU SERVEUR */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
              Calculs physiologiques automatiques (archivés avec la visite)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Âge calculé */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-xs text-slate-500 block">Âge au jour de la visite</span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                  {ageCalcule !== null ? `${ageCalcule} ans` : 'N/D'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Calculé depuis la date de naissance</span>
              </div>

              {/* PAM */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-xs text-slate-500 block">Pression Artérielle Moyenne (PAM)</span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                  {pamCalculee !== null ? `${pamCalculee} mmHg` : '—'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Formule : (Sys + 2×Dia)/3</span>
              </div>

              {/* IMC */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-xs text-slate-500 block">Indice de Masse Corporelle (IMC)</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-lg font-bold text-slate-800 font-mono">
                    {imcCalcule ? `${imcCalcule.imc} kg/m²` : '—'}
                  </span>
                </div>
                {imcCalcule && (
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1 ${imcCalcule.couleur}`}>
                    {imcCalcule.categorie}
                  </span>
                )}
              </div>
            </div>

            {/* Avertissement de conformité médicale */}
            <div className="mt-3 flex items-center space-x-2 text-[11px] text-emerald-800 bg-emerald-100/50 p-2.5 rounded-lg border border-emerald-200/60">
              <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Règle de conformité clinique :</strong> L'IMC et sa catégorie OMS constituent un indicateur biométrique calculé d'aide au suivi et <strong>ne constituent pas un diagnostic médical</strong>.
              </span>
            </div>
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
                <>
                  <span>Validation serveur...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Enregistrer le triage & Passer à l'affectation médecin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
