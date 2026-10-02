import React, { useState, useEffect, useRef } from 'react';
import { Visite } from '../../types/index.js';
import { Activity, AlertCircle, CheckCircle2, Heart, Thermometer, Wind, Scale, X, Ruler } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface TriageVitalsModalProps {
  visite: Visite;
  onClose: () => void;
  onSuccess: (updatedVisite: Visite) => void;
}

export const TriageVitalsModal: React.FC<TriageVitalsModalProps> = ({ visite, onClose, onSuccess }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, []);
  // 8 champs de constantes séparés avec leurs valeurs respectives
  const [temperature, setTemperature] = useState<string>('37.0');
  const [pouls, setPouls] = useState<string>('75');
  const [poids, setPoids] = useState<string>('70');
  const [taille, setTaille] = useState<string>('170');
  const [spo2, setSpo2] = useState<string>('98');
  const [freqResp, setFreqResp] = useState<string>('16');
  const [tensionSys, setTensionSys] = useState<string>('120'); // PAS
  const [tensionDia, setTensionDia] = useState<string>('80');  // PAD

  // Évaluation complémentaire de la douleur
  const [douleur, setDouleur] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  // Validation frontend stricte des 8 constantes (types numériques et valeurs impossibles)
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const details: string[] = [];

    // 1. Température (°C)
    if (!temperature || temperature.trim() === '') {
      errors.temperature = 'La température est requise.';
      details.push('Température obligatoire (°C).');
    } else {
      const t = parseFloat(temperature);
      if (isNaN(t) || t < 30.0 || t > 45.0) {
        errors.temperature = 'Température invalide (plage autorisée : 30.0 à 45.0 °C).';
        details.push('Température invalide : doit être comprise entre 30.0 et 45.0 °C.');
      }
    }

    // 2. Pouls / Fréquence cardiaque (bpm)
    if (!pouls || pouls.trim() === '') {
      errors.pouls = 'Le pouls est requis.';
      details.push('Pouls obligatoire (bpm).');
    } else {
      const p = Number(pouls);
      if (isNaN(p) || !Number.isInteger(p) || p < 30 || p > 250) {
        errors.pouls = 'Pouls invalide (plage autorisée : 30 à 250 bpm, nombre entier).';
        details.push('Pouls invalide : entier compris entre 30 et 250 bpm.');
      }
    }

    // 3. Poids (kg)
    if (!poids || poids.trim() === '') {
      errors.poids = 'Le poids est requis.';
      details.push('Poids obligatoire (kg).');
    } else {
      const w = parseFloat(poids);
      if (isNaN(w) || w < 0.5 || w > 400) {
        errors.poids = 'Poids invalide (plage autorisée : 0.5 à 400 kg).';
        details.push('Poids invalide : doit être compris entre 0.5 et 400 kg.');
      }
    }

    // 4. Taille (cm) — Pas de conversion automatique en mètres
    if (!taille || taille.trim() === '') {
      errors.taille = 'La taille est requise.';
      details.push('Taille obligatoire (cm).');
    } else {
      const h = parseFloat(taille);
      if (isNaN(h)) {
        errors.taille = 'Taille invalide (doit être un nombre).';
        details.push('Taille invalide : valeur numérique requise.');
      } else if (h <= 2.5) {
        errors.taille = 'Taille invalide : saisir en centimètres (ex: 170), ne pas saisir en mètres.';
        details.push('Taille invalide : la valeur doit être saisie en centimètres (30 à 250 cm), et non en mètres.');
      } else if (h < 30 || h > 250) {
        errors.taille = 'Taille invalide (plage autorisée : 30 à 250 cm).';
        details.push('Taille invalide : doit être comprise entre 30 et 250 cm.');
      }
    }

    // 5. SpO₂ (%)
    if (!spo2 || spo2.trim() === '') {
      errors.spo2 = 'La SpO₂ est requise.';
      details.push('Saturation SpO₂ obligatoire (%).');
    } else {
      const s = Number(spo2);
      if (isNaN(s) || !Number.isInteger(s) || s < 50 || s > 100) {
        errors.spo2 = 'SpO₂ invalide (plage autorisée : 50 à 100 %, nombre entier).';
        details.push('SpO₂ invalide : entier compris entre 50 et 100 %.');
      }
    }

    // 6. Fréquence respiratoire (cycles/min)
    if (!freqResp || freqResp.trim() === '') {
      errors.freqResp = 'La fréquence respiratoire est requise.';
      details.push('Fréquence respiratoire obligatoire (cycles/min).');
    } else {
      const fr = Number(freqResp);
      if (isNaN(fr) || !Number.isInteger(fr) || fr < 6 || fr > 80) {
        errors.freqResp = 'Fréquence respiratoire invalide (plage autorisée : 6 à 80 cycles/min).';
        details.push('Fréquence respiratoire invalide : entier compris entre 6 et 80 cycles/min.');
      }
    }

    // 7. Pression artérielle systolique (PAS) (mmHg)
    let sysVal: number | null = null;
    if (!tensionSys || tensionSys.trim() === '') {
      errors.tensionSys = 'La PAS est requise.';
      details.push('Pression artérielle systolique (PAS) obligatoire.');
    } else {
      const sys = Number(tensionSys);
      if (isNaN(sys) || !Number.isInteger(sys) || sys < 50 || sys > 300) {
        errors.tensionSys = 'PAS invalide (plage autorisée : 50 à 300 mmHg, nombre entier).';
        details.push('PAS invalide : entier compris entre 50 et 300 mmHg.');
      } else {
        sysVal = sys;
      }
    }

    // 8. Pression artérielle diastolique (PAD) (mmHg)
    let diaVal: number | null = null;
    if (!tensionDia || tensionDia.trim() === '') {
      errors.tensionDia = 'La PAD est requise.';
      details.push('Pression artérielle diastolique (PAD) obligatoire.');
    } else {
      const dia = Number(tensionDia);
      if (isNaN(dia) || !Number.isInteger(dia) || dia < 30 || dia > 200) {
        errors.tensionDia = 'PAD invalide (plage autorisée : 30 à 200 mmHg, nombre entier).';
        details.push('PAD invalide : entier compris entre 30 et 200 mmHg.');
      } else {
        diaVal = dia;
      }
    }

    // Cohérence PAS > PAD
    if (sysVal !== null && diaVal !== null && sysVal <= diaVal) {
      errors.tensionSys = 'La PAS doit être strictement supérieure à la PAD.';
      errors.tensionDia = 'La PAD doit être strictement inférieure à la PAS.';
      details.push('Incohérence tensionnelle : la pression systolique (PAS) doit être strictement supérieure à la diastolique (PAD).');
    }

    setFieldErrors(errors);
    setErrorDetails(details);

    if (details.length > 0) {
      setErrorMessage('Veuillez corriger les valeurs physiologiques erronées ci-dessous.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorDetails([]);

    // Validation frontend
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 8 constantes clairement séparées avec conservation des types numériques
      // NOTE IMPORTANTE : PAS DE CHAMP GLYCÉMIE À LA RÉCEPTION (Workflow réservé au laboratoire)
      const payload = {
        temperature: parseFloat(temperature),
        tension_systolique: parseInt(tensionSys, 10),
        tension_diastolique: parseInt(tensionDia, 10),
        pouls: parseInt(pouls, 10),
        frequence_respiratoire: parseInt(freqResp, 10),
        spo2: parseInt(spo2, 10),
        poids: parseFloat(poids),
        taille: parseFloat(taille),
        douleur: douleur !== null ? Number(douleur) : 0,
      };

      const res = await apiFetch(`/api/visites/${visite.id}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || data.error || 'Erreur lors de l\'enregistrement des constantes.');
        if (Array.isArray(data.details)) {
          setErrorDetails(data.details);
        }
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.visite);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de communication avec le serveur.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden" id="modal_triage_overlay">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden" id="modal_triage_container">
        {/* Header modal */}
        <div className="shrink-0 bg-slate-800 text-white px-5 sm:px-6 py-4 flex items-center justify-between" id="modal_triage_header">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Poste de Triage — Saisie des Constantes Réception</h3>
              <p className="text-xs text-slate-300">
                Patient : <span className="font-semibold text-white">{visite.patient_nom} {visite.patient_prenom}</span> — Dossier permanent : <span className="font-mono text-emerald-300">{visite.numero_dossier}</span>
              </p>
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_triage">
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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

          {/* Grille des 8 constantes clairement séparées */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Température (°C) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.temperature ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Thermometer className="w-4 h-4 mr-1 text-red-500 shrink-0" />
                <span>1. Température corporelle</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="45"
                  required
                  value={temperature}
                  onChange={(e) => {
                    setTemperature(e.target.value);
                    if (fieldErrors.temperature) setFieldErrors(prev => ({ ...prev, temperature: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.temperature ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="37.0"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">°C</span>
              </div>
              {fieldErrors.temperature ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.temperature}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme : 36.5 - 37.5 °C</span>
              )}
            </div>

            {/* 2. Pouls / Fréquence cardiaque (bpm) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.pouls ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Activity className="w-4 h-4 mr-1 text-emerald-600 shrink-0" />
                <span>2. Pouls / Fréq. cardiaque</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="30"
                  max="250"
                  required
                  value={pouls}
                  onChange={(e) => {
                    setPouls(e.target.value);
                    if (fieldErrors.pouls) setFieldErrors(prev => ({ ...prev, pouls: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-12 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.pouls ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="75"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">bpm</span>
              </div>
              {fieldErrors.pouls ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.pouls}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme : 60 - 100 bpm</span>
              )}
            </div>

            {/* 3. Poids (kg) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.poids ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Scale className="w-4 h-4 mr-1 text-slate-700 shrink-0" />
                <span>3. Poids</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="400"
                  required
                  value={poids}
                  onChange={(e) => {
                    setPoids(e.target.value);
                    if (fieldErrors.poids) setFieldErrors(prev => ({ ...prev, poids: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.poids ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="70.0"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">kg</span>
              </div>
              {fieldErrors.poids ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.poids}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Unité : kg (ex: 70.5)</span>
              )}
            </div>

            {/* 4. Taille (cm) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.taille ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Ruler className="w-4 h-4 mr-1 text-indigo-600 shrink-0" />
                <span>4. Taille</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="250"
                  required
                  value={taille}
                  onChange={(e) => {
                    setTaille(e.target.value);
                    if (fieldErrors.taille) setFieldErrors(prev => ({ ...prev, taille: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.taille ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="170"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">cm</span>
              </div>
              {fieldErrors.taille ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.taille}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Unité : cm (ex: 170)</span>
              )}
            </div>

            {/* 5. SpO₂ (%) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.spo2 ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Activity className="w-4 h-4 mr-1 text-cyan-600 shrink-0" />
                <span>5. Saturation O₂ (SpO₂)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="50"
                  max="100"
                  required
                  value={spo2}
                  onChange={(e) => {
                    setSpo2(e.target.value);
                    if (fieldErrors.spo2) setFieldErrors(prev => ({ ...prev, spo2: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.spo2 ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="98"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">%</span>
              </div>
              {fieldErrors.spo2 ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.spo2}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme : ≥ 95%</span>
              )}
            </div>

            {/* 6. Fréquence respiratoire (cycles/min) */}
            <div className={`p-4 rounded-lg border ${fieldErrors.freqResp ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Wind className="w-4 h-4 mr-1 text-blue-500 shrink-0" />
                <span>6. Fréq. respiratoire</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="6"
                  max="80"
                  required
                  value={freqResp}
                  onChange={(e) => {
                    setFreqResp(e.target.value);
                    if (fieldErrors.freqResp) setFieldErrors(prev => ({ ...prev, freqResp: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-20 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.freqResp ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="16"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">cycles/min</span>
              </div>
              {fieldErrors.freqResp ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.freqResp}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme adulte : 12 - 20</span>
              )}
            </div>

            {/* 7. Pression artérielle systolique (PAS) (mmHg) — Champ distinct */}
            <div className={`p-4 rounded-lg border ${fieldErrors.tensionSys ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Heart className="w-4 h-4 mr-1 text-rose-500 shrink-0" />
                <span>7. PA Systolique (PAS)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="50"
                  max="300"
                  required
                  value={tensionSys}
                  onChange={(e) => {
                    setTensionSys(e.target.value);
                    if (fieldErrors.tensionSys) setFieldErrors(prev => ({ ...prev, tensionSys: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-14 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.tensionSys ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="120"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">mmHg</span>
              </div>
              {fieldErrors.tensionSys ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.tensionSys}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme : 90 - 139 mmHg</span>
              )}
            </div>

            {/* 8. Pression artérielle diastolique (PAD) (mmHg) — Champ distinct */}
            <div className={`p-4 rounded-lg border ${fieldErrors.tensionDia ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                <Heart className="w-4 h-4 mr-1 text-rose-400 shrink-0" />
                <span>8. PA Diastolique (PAD)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="30"
                  max="200"
                  required
                  value={tensionDia}
                  onChange={(e) => {
                    setTensionDia(e.target.value);
                    if (fieldErrors.tensionDia) setFieldErrors(prev => ({ ...prev, tensionDia: '' }));
                  }}
                  className={`w-full px-3 py-2 pr-14 text-sm bg-white border rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono ${fieldErrors.tensionDia ? 'border-red-400 text-red-900' : 'border-slate-300'}`}
                  placeholder="80"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-500">mmHg</span>
              </div>
              {fieldErrors.tensionDia ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.tensionDia}</p>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">Norme : 60 - 89 mmHg</span>
              )}
            </div>
          </div>

          {/* Échelle de la douleur complémentaire */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Évaluation de la douleur : {douleur}/10</label>
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
              <span>0 (Aucune douleur)</span>
              <span>5 (Douleur modérée)</span>
              <span>10 (Douleur maximale inimaginable)</span>
            </div>
          </div>

          {/* Note sur la traçabilité */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <strong>Traçabilité clinique :</strong> Les 8 constantes saisies (Température en °C, Pouls en bpm, Poids en kg, Taille en cm, SpO₂ en %, Fréquence respiratoire en cycles/min, PAS et PAD distinctes en mmHg) sont archivées de manière permanente avec la visite en cours. La glycémie est réservée au workflow d'analyses de laboratoire.
          </div>
        </div>

        {/* Boutons d'action tactiles fixés en bas */}
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
              <span>Validation en cours...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                <span>Enregistrer les constantes & Affecter un médecin</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
);
};
