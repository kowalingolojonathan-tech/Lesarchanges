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

export interface CalculatedVitals {
  age_calcule?: number;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  taille_normalisee_cm?: number | null;
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
 * Formule médicale standard : PAM = (Systolique + 2 * Diastolique) / 3
 */
export function calculatePAM(systolique: number, diastolique: number): number {
  const pam = (systolique + 2 * diastolique) / 3;
  return Math.round(pam * 10) / 10;
}

/**
 * Calcule l'IMC (Indice de Masse Corporelle) en kg/m² et sa catégorie descriptive (OMS)
 * Mention obligatoire : Indicateur calculé informatif, non diagnostique.
 */
export function calculateIMC(poidsKg: number, tailleCm: number): { imc: number; categorie: string } {
  if (tailleCm <= 0 || poidsKg <= 0) {
    throw new Error('Poids et taille doivent être supérieurs à zéro pour le calcul de l\'IMC');
  }

  const tailleM = tailleCm / 100;
  const imcRaw = poidsKg / (tailleM * tailleM);
  const imc = Math.round(imcRaw * 10) / 10;

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
 * Validation physiologique rigoureuse côté serveur des constantes biométriques
 */
export function validateAndComputeVitals(
  input: VitalsInput,
  dateNaissanceStr?: string
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
    let h = Number(input.taille);
    if (isNaN(h) || h <= 0) {
      errors.push('Taille invalide.');
    } else {
      // Normaliser si saisie en mètres (ex: 1.75 -> 175 cm)
      if (h <= 2.5) {
        h = h * 100;
      }
      if (h < 30 || h > 250) {
        errors.push('Taille invalide (plage autorisée : 30 cm à 250 cm).');
      } else {
        tailleCmVal = Math.round(h * 10) / 10;
        calculated.taille_normalisee_cm = tailleCmVal;
      }
    }
  }

  // Calcul automatique de l'IMC si poids et taille présents
  if (poidsVal !== null && tailleCmVal !== null && tailleCmVal > 0) {
    try {
      const imcResult = calculateIMC(poidsVal, tailleCmVal);
      calculated.imc = imcResult.imc;
      calculated.categorie_imc = imcResult.categorie;
    } catch {
      errors.push('Impossible de calculer l\'IMC avec les mesures fournies.');
    }
  }

  // 8. Glycémie (g/L) : 0.2 à 40.0 g/L (ou mg/dL si > 40 converti)
  if (input.glycemie_mesuree !== undefined && input.glycemie_mesuree !== null) {
    let gly = Number(input.glycemie_mesuree);
    if (isNaN(gly) || gly <= 0) {
      errors.push('Valeur de glycémie invalide.');
    } else {
      // Si la glycémie a été saisie en mg/dL (ex: 110 mg/dL -> 1.10 g/L)
      if (gly > 40) {
        gly = Math.round((gly / 100) * 100) / 100;
      }
      if (gly < 0.2 || gly > 40.0) {
        errors.push('Glycémie manifestement invalide (plage autorisée : 0.20 g/L à 40.0 g/L).');
      }
    }
  }

  // 9. Échelle de la douleur (0 à 10)
  if (input.douleur !== undefined && input.douleur !== null) {
    const d = Number(input.douleur);
    if (isNaN(d) || !Number.isInteger(d) || d < 0 || d > 10) {
      errors.push('Échelle de douleur invalide (doit être un entier compris entre 0 et 10).');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    calculated,
  };
}
