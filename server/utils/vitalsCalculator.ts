/**
 * Clinique Les Archanges — Utilitaires de Calculs Physiologiques & Validation des Signes Vitaux
 *
 * RÈGLE FONDAMENTALE :
 * L'IMC et la Catégorie IMC sont des indicateurs biométriques calculés et ne constituent pas des diagnostics médicaux.
 * Toutes les valeurs physiologiques sont rigoureusement validées côté serveur pour rejeter les anomalies manifestes.
 */

export interface VitalsInput {
  temperature?: number | null;
  tension_systolique?: number | null;
  tension_diastolique?: number | null;
  pouls?: number | null;
  frequence_respiratoire?: number | null;
  spo2?: number | null;
  poids?: number | null;
  taille?: number | null; // en cm ou en m
  glycemie_mesuree?: number | null;
  douleur?: number | null;
}

export interface VitalAlert {
  type: 'TEMPERATURE' | 'SPO2' | 'POULS' | 'TENSION' | 'FREQUENCE_RESPIRATOIRE';
  niveau: 'INFO' | 'ATTENTION' | 'CRITIQUE';
  message: string;
}

export interface CalculatedVitals {
  age_calcule?: number;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  pam_interpretation?: string | null;
  surface_corporelle?: number | null;
  pression_pulsee?: number | null;
  taille_normalisee_cm?: number | null;
  alertes?: VitalAlert[];
}

export interface VitalsValidationResult {
  isValid: boolean;
  errors: string[];
  calculated: CalculatedVitals;
}

/**
 * Calcule l'âge exact en années révolues au moment de la visite
 */
export function calculateAge(dateNaissanceStr: string, referenceDate: Date = new Date()): number {
  const birthDate = new Date(dateNaissanceStr);
  if (isNaN(birthDate.getTime())) {
    throw new Error('Date de naissance invalide');
  }

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Calcule la Pression Artérielle Moyenne (PAM / MAP) en mmHg
 * Formule médicale standard : PAM = PAD + (PAS - PAD) / 3 = (PAS + 2 * PAD) / 3
 */
export function calculatePAM(systolique: number, diastolique: number): number {
  const pam = (systolique + 2 * diastolique) / 3;
  return Math.round(pam * 10) / 10;
}

/**
 * Interprétation clinique de la Pression Artérielle Moyenne
 */
export function interpretPAM(pam: number): { statut: 'BASSE' | 'NORMALE' | 'ELEVEE'; message: string } {
  if (pam < 70) {
    return { statut: 'BASSE', message: 'PAM basse (< 70 mmHg) : Risque d’hypoperfusion tissulaire' };
  } else if (pam <= 105) {
    return { statut: 'NORMALE', message: 'PAM normale (70 - 105 mmHg)' };
  } else {
    return { statut: 'ELEVEE', message: 'PAM élevée (> 105 mmHg)' };
  }
}

/**
 * Calcule la Pression Pulsée (PP) en mmHg
 * Formule : PP = PAS - PAD
 */
export function calculatePressionPulsee(systolique: number, diastolique: number): number {
  return Math.round(systolique - diastolique);
}

/**
 * Calcule la Surface Corporelle (BSA) en m² selon la formule de Mosteller
 * Formule : RacineCarrée( (Taille en cm * Poids en kg) / 3600 )
 */
export function calculateSurfaceCorporelle(poidsKg: number, tailleCm: number): number {
  if (tailleCm <= 0 || poidsKg <= 0) {
    throw new Error('Poids et taille doivent être supérieurs à zéro pour le calcul de la surface corporelle');
  }
  const bsa = Math.sqrt((tailleCm * poidsKg) / 3600);
  return Math.round(bsa * 100) / 100;
}

/**
 * Calcule l'IMC (Indice de Masse Corporelle) en kg/m² et sa catégorie descriptive (OMS)
 * Règle impérative : distinction stricte Adulte (>= 18 ans) vs Pédiatrie (< 18 ans).
 */
export function calculateIMC(
  poidsKg: number, 
  tailleCm: number, 
  age?: number, 
  sexe?: string
): { imc: number; categorie: string } {
  if (tailleCm <= 0 || poidsKg <= 0) {
    throw new Error('Poids et taille doivent être supérieurs à zéro pour le calcul de l\'IMC');
  }

  const tailleM = tailleCm / 100;
  const imcRaw = poidsKg / (tailleM * tailleM);
  const imc = Math.round(imcRaw * 10) / 10;

  // Cas Pédiatrique (< 18 ans) : Ne jamais appliquer les seuils adultes
  if (age !== undefined && age < 18) {
    let categorie = 'Interprétation pédiatrique requise selon les courbes OMS âge/sexe.';
    if (!sexe || (sexe !== 'M' && sexe !== 'F')) {
      categorie = 'Interprétation pédiatrique requise — sexe manquant pour courbes OMS.';
    }
    return { imc, categorie };
  }

  // Cas Adulte (>= 18 ans ou âge non renseigné)
  let categorie = 'Poids normal';
  if (imc < 18.5) {
    categorie = 'Insuffisance pondérale';
  } else if (imc < 25.0) {
    categorie = 'Poids normal';
  } else if (imc < 30.0) {
    categorie = 'Surpoids';
  } else if (imc < 35.0) {
    categorie = 'Obésité modérée (Classe I)';
  } else if (imc < 40.0) {
    categorie = 'Obésité sévère (Classe II)';
  } else {
    categorie = 'Obésité morbide (Classe III)';
  }

  return { imc, categorie };
}

/**
 * Génère les alertes cliniques sur les constantes physiologiques
 */
export function generateVitalsAlerts(input: VitalsInput, age?: number): VitalAlert[] {
  const alerts: VitalAlert[] = [];

  // Température
  if (input.temperature !== undefined && input.temperature !== null) {
    const t = Number(input.temperature);
    if (t >= 39.5) {
      alerts.push({ type: 'TEMPERATURE', niveau: 'CRITIQUE', message: `Hyperthermie majeure (${t}°C) — Alerte vitale` });
    } else if (t >= 38.0) {
      alerts.push({ type: 'TEMPERATURE', niveau: 'ATTENTION', message: `Fièvre (${t}°C) — Valeur à surveiller` });
    } else if (t < 35.5) {
      alerts.push({ type: 'TEMPERATURE', niveau: 'ATTENTION', message: `Hypothermie (${t}°C) — Valeur à surveiller` });
    }
  }

  // SpO2
  if (input.spo2 !== undefined && input.spo2 !== null) {
    const s = Number(input.spo2);
    if (s < 90) {
      alerts.push({ type: 'SPO2', niveau: 'CRITIQUE', message: `Désaturation critique (${s}%) — Alerte vitale` });
    } else if (s < 95) {
      alerts.push({ type: 'SPO2', niveau: 'ATTENTION', message: `Hypoxie modérée (${s}%) — Valeur à surveiller` });
    }
  }

  // Pouls (FC)
  if (input.pouls !== undefined && input.pouls !== null) {
    const p = Number(input.pouls);
    if (p > 120) {
      alerts.push({ type: 'POULS', niveau: 'ATTENTION', message: `Tachycardie marquée (${p} bpm) — Valeur à surveiller` });
    } else if (p > 100) {
      alerts.push({ type: 'POULS', niveau: 'ATTENTION', message: `Tachycardie (${p} bpm) — Valeur à surveiller` });
    } else if (p < 50) {
      alerts.push({ type: 'POULS', niveau: 'ATTENTION', message: `Bradycardie (${p} bpm) — Valeur à surveiller` });
    }
  }

  // Tension artérielle
  if (input.tension_systolique !== undefined && input.tension_systolique !== null) {
    const sys = Number(input.tension_systolique);
    const dia = input.tension_diastolique ? Number(input.tension_diastolique) : 0;
    if (sys >= 180 || dia >= 110) {
      alerts.push({ type: 'TENSION', niveau: 'CRITIQUE', message: `Crise hypertensive possible (${sys}/${dia} mmHg) — Alerte vitale` });
    } else if (sys >= 140 || dia >= 90) {
      alerts.push({ type: 'TENSION', niveau: 'ATTENTION', message: `Tension artérielle élevée (${sys}/${dia} mmHg) — Valeur à surveiller` });
    } else if (sys < 90) {
      alerts.push({ type: 'TENSION', niveau: 'ATTENTION', message: `Hypotension artérielle (${sys}/${dia} mmHg) — Valeur à surveiller` });
    }
  }

  // Fréquence respiratoire
  if (input.frequence_respiratoire !== undefined && input.frequence_respiratoire !== null) {
    const fr = Number(input.frequence_respiratoire);
    if (fr > 30) {
      alerts.push({ type: 'FREQUENCE_RESPIRATOIRE', niveau: 'CRITIQUE', message: `Tachypnée sévère (${fr} cpm) — Alerte vitale` });
    } else if (fr > 24) {
      alerts.push({ type: 'FREQUENCE_RESPIRATOIRE', niveau: 'ATTENTION', message: `Polypnée (${fr} cpm) — Valeur à surveiller` });
    } else if (fr < 10) {
      alerts.push({ type: 'FREQUENCE_RESPIRATOIRE', niveau: 'ATTENTION', message: `Bradypnée (${fr} cpm) — Valeur à surveiller` });
    }
  }

  return alerts;
}

/**
 * Validation physiologique rigoureuse côté serveur des constantes biométriques
 */
export function validateAndComputeVitals(
  input: VitalsInput,
  dateNaissanceStr?: string,
  sexe?: string
): VitalsValidationResult {
  const errors: string[] = [];
  const calculated: CalculatedVitals = {};

  // 1. Calcul de l'âge si date de naissance fournie
  if (dateNaissanceStr) {
    try {
      calculated.age_calcule = calculateAge(dateNaissanceStr);
    } catch {
      errors.push('Date de naissance du patient invalide pour le calcul de l\'âge.');
    }
  }

  // 2. Température (°C) : plage physiologiquement viable 30.0°C - 45.0°C
  if (input.temperature !== undefined && input.temperature !== null) {
    const t = Number(input.temperature);
    if (isNaN(t) || t < 30.0 || t > 45.0) {
      errors.push('Température manifestement invalide (plage autorisée : 30.0°C à 45.0°C).');
    }
  }

  // 3. Pression artérielle : systolique et diastolique
  let hasSystolique = false;
  let hasDiastolique = false;
  let sys = 0;
  let dia = 0;

  if (input.tension_systolique !== undefined && input.tension_systolique !== null) {
    sys = Number(input.tension_systolique);
    if (isNaN(sys) || !Number.isInteger(sys) || sys < 50 || sys > 300) {
      errors.push('Tension systolique invalide (plage autorisée : 50 à 300 mmHg).');
    } else {
      hasSystolique = true;
    }
  }

  if (input.tension_diastolique !== undefined && input.tension_diastolique !== null) {
    dia = Number(input.tension_diastolique);
    if (isNaN(dia) || !Number.isInteger(dia) || dia < 30 || dia > 200) {
      errors.push('Tension diastolique invalide (plage autorisée : 30 à 200 mmHg).');
    } else {
      hasDiastolique = true;
    }
  }

  if (hasSystolique && hasDiastolique) {
    if (sys <= dia) {
      errors.push('Incohérence tensionnelle : la pression systolique doit être strictement supérieure à la diastolique.');
    } else {
      calculated.pam = calculatePAM(sys, dia);
      calculated.pam_interpretation = interpretPAM(calculated.pam).message;
      calculated.pression_pulsee = calculatePressionPulsee(sys, dia);
    }
  }

  // 4. Pouls (bpm) : 30 à 250 bpm
  if (input.pouls !== undefined && input.pouls !== null) {
    const p = Number(input.pouls);
    if (isNaN(p) || !Number.isInteger(p) || p < 30 || p > 250) {
      errors.push('Pouls cardiaque invalide (plage autorisée : 30 à 250 bpm).');
    }
  }

  // 5. Fréquence respiratoire : 6 à 80 cpm
  if (input.frequence_respiratoire !== undefined && input.frequence_respiratoire !== null) {
    const fr = Number(input.frequence_respiratoire);
    if (isNaN(fr) || !Number.isInteger(fr) || fr < 6 || fr > 80) {
      errors.push('Fréquence respiratoire invalide (plage autorisée : 6 à 80 cycles/min).');
    }
  }

  // 6. Saturation SpO2 (%) : 50% à 100%
  if (input.spo2 !== undefined && input.spo2 !== null) {
    const spo2 = Number(input.spo2);
    if (isNaN(spo2) || !Number.isInteger(spo2) || spo2 < 50 || spo2 > 100) {
      errors.push('Saturation en oxygène (SpO2) invalide (plage autorisée : 50% à 100%).');
    }
  }

  // 7. Poids (kg) et Taille (cm)
  let poidsVal: number | null = null;
  let tailleCmVal: number | null = null;

  if (input.poids !== undefined && input.poids !== null) {
    const w = Number(input.poids);
    if (isNaN(w) || w < 0.5 || w > 400) {
      errors.push('Poids invalide (plage autorisée : 0.5 kg à 400 kg).');
    } else {
      poidsVal = w;
    }
  }

  if (input.taille !== undefined && input.taille !== null) {
    const h = Number(input.taille);
    if (isNaN(h) || h <= 0) {
      errors.push('Taille invalide.');
    } else if (h < 30 || h > 250) {
      errors.push('Taille invalide : la valeur doit être comprise entre 30 et 250 cm (ne pas saisir en mètres).');
    } else {
      tailleCmVal = Math.round(h * 10) / 10;
      calculated.taille_normalisee_cm = tailleCmVal;
    }
  }

  // Calcul automatique de l'IMC et de la Surface Corporelle si poids et taille présents
  if (poidsVal !== null && tailleCmVal !== null && tailleCmVal > 0) {
    try {
      const imcResult = calculateIMC(poidsVal, tailleCmVal, calculated.age_calcule, sexe);
      calculated.imc = imcResult.imc;
      calculated.categorie_imc = imcResult.categorie;
      calculated.surface_corporelle = calculateSurfaceCorporelle(poidsVal, tailleCmVal);
    } catch {
      errors.push('Impossible de calculer l\'IMC ou la surface corporelle avec les mesures fournies.');
    }
  }

  // 8. Glycémie (g/L) : 0.2 à 40.0 g/L
  if (input.glycemie_mesuree !== undefined && input.glycemie_mesuree !== null) {
    const gly = Number(input.glycemie_mesuree);
    if (isNaN(gly) || gly <= 0) {
      errors.push('Valeur de glycémie invalide.');
    } else if (gly < 0.2 || gly > 40.0) {
      errors.push('Glycémie manifestement invalide (plage autorisée : 0.20 g/L à 40.0 g/L).');
    }
  }

  // 9. Échelle de la douleur (0 à 10)
  if (input.douleur !== undefined && input.douleur !== null) {
    const d = Number(input.douleur);
    if (isNaN(d) || !Number.isInteger(d) || d < 0 || d > 10) {
      errors.push('Échelle de douleur invalide (doit être un entier compris entre 0 et 10).');
    }
  }

  // 10. Alertes cliniques
  calculated.alertes = generateVitalsAlerts(input, calculated.age_calcule);

  return {
    isValid: errors.length === 0,
    errors,
    calculated,
  };
}
