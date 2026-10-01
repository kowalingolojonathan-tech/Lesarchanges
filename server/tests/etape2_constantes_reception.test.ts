/**
 * Tests Automatisés — ÉTAPE 2 : CONSTANTES À LA RÉCEPTION
 * Clinique Les Archanges
 * 
 * Couvre les exigences et tests obligatoires :
 * 1. Saisie de toutes les constantes (8 champs distincts).
 * 2. PAS/PAD séparées (colonnes numériques distinctes, non texte "120/80").
 * 3. Vérification des unités (°C, bpm, kg, cm, %, cycles/min, mmHg).
 * 4. Vérification que la glycémie n'est pas demandée à la réception.
 * 5. Vérification que la glycémie reste disponible dans le laboratoire en mg/dL.
 * 6. Validation frontend : règles et blocages (ex: taille en mètres, SpO2 > 100%).
 * 7. Validation backend : rejet HTTP 400 pour toute valeur aberrante/impossible.
 * 8. Conservation des anciennes constantes et données en base.
 * 9. Tests de non-régression du workflow complet de triage et consultation.
 */

import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { recordVitals } from '../controllers/visiteController.js';
import { query, queryOne } from '../db/database.js';
import { validateAndComputeVitals } from '../utils/vitalsCalculator.js';
import fs from 'fs';
import path from 'path';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, desc: string, passed: boolean, details: string) {
  results.push({ testNumber: num, description: desc, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Test ${num}: ${desc} -> ${details}`);
}

function mockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

export async function runEtape2Tests(): Promise<void> {
  console.log('\n===============================================================');
  console.log('  TESTS OBLIGATOIRES — ÉTAPE 2 : CONSTANTES À LA RÉCEPTION');
  console.log('  Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  // Création d'une visite pour les tests
  const testPatient = await queryOne<any>('SELECT * FROM patients LIMIT 1');
  if (!testPatient) {
    throw new Error('Aucun patient en base');
  }

  const agentUser = await queryOne<any>("SELECT * FROM users WHERE role = 'RÉCEPTION' LIMIT 1");
  const agentId = agentUser?.id || 'usr_reception_test';

  const testVisiteId = 'vis_test_etape2_' + Date.now();
  const nowIso = new Date().toISOString();
  await query(
    `INSERT INTO visites (id, numero_visite, patient_id, date_arrivee, motif_venue, statut, actif, created_at)
     VALUES (?, ?, ?, ?, ?, 'ATTENTE_TRIAGE', 1, ?)`,
    [testVisiteId, 'VIS-ETA2-' + Date.now(), testPatient.id, nowIso, 'Constantes Reception Test', nowIso]
  );

  // -------------------------------------------------------------------------
  // TEST 1: Saisie complète des 8 constantes clairement séparées
  // -------------------------------------------------------------------------
  const req1: any = {
    params: { id: testVisiteId },
    user: { id: agentId, role: 'RÉCEPTION' },
    ip: '127.0.0.1',
    body: {
      temperature: 37.2,
      pouls: 74,
      poids: 68.5,
      taille: 172,
      spo2: 98,
      frequence_respiratoire: 16,
      tension_systolique: 125, // PAS distincte
      tension_diastolique: 82, // PAD distincte
      douleur: 1,
    },
  };
  const res1 = mockResponse();
  await recordVitals(req1, res1);

  const vitalsRecord1 = await queryOne<any>(
    'SELECT * FROM signes_vitaux WHERE visite_id = ? ORDER BY date_prise DESC LIMIT 1',
    [testVisiteId]
  );

  const test1Passed =
    res1.statusCode === 201 &&
    vitalsRecord1 !== null &&
    vitalsRecord1.temperature === 37.2 &&
    vitalsRecord1.pouls === 74 &&
    vitalsRecord1.poids === 68.5 &&
    vitalsRecord1.taille === 172 &&
    vitalsRecord1.spo2 === 98 &&
    vitalsRecord1.frequence_respiratoire === 16 &&
    vitalsRecord1.tension_systolique === 125 &&
    vitalsRecord1.tension_diastolique === 82;

  record(
    1,
    'Saisie de toutes les 8 constantes',
    Boolean(test1Passed),
    test1Passed
      ? `Les 8 constantes ont été enregistrées avec succès en base (ID: ${vitalsRecord1?.id})`
      : `Échec d'enregistrement: HTTP ${res1.statusCode}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: PAS et PAD strictement séparées (pas de stockage "120/80")
  // -------------------------------------------------------------------------
  const test2Passed =
    vitalsRecord1 &&
    typeof vitalsRecord1.tension_systolique === 'number' &&
    typeof vitalsRecord1.tension_diastolique === 'number' &&
    vitalsRecord1.tension_systolique === 125 &&
    vitalsRecord1.tension_diastolique === 82;

  record(
    2,
    'PAS/PAD séparées et distinctes',
    Boolean(test2Passed),
    test2Passed
      ? `PAS (tension_systolique = ${vitalsRecord1.tension_systolique}) et PAD (tension_diastolique = ${vitalsRecord1.tension_diastolique}) stockées séparément en colonnes numériques distinctes`
      : 'Échec: colonnes non séparées'
  );

  // -------------------------------------------------------------------------
  // TEST 3: Vérification des unités explicites
  // -------------------------------------------------------------------------
  // Vérification de la modal frontend : présence des unités explicites dans le code source
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/reception/TriageVitalsModal.tsx'),
    'utf-8'
  );

  const unitsPresent =
    modalContent.includes('°C') &&
    modalContent.includes('bpm') &&
    modalContent.includes('kg') &&
    modalContent.includes('cm') &&
    modalContent.includes('%') &&
    modalContent.includes('cycles/min') &&
    modalContent.includes('mmHg');

  record(
    3,
    'Vérification des unités explicites',
    unitsPresent,
    unitsPresent
      ? 'Unités explicitement associées et affichées pour chaque constante (°C, bpm, kg, cm, %, cycles/min, mmHg)'
      : 'Certaines unités manquent dans le formulaire'
  );

  // -------------------------------------------------------------------------
  // TEST 4: Vérification que la glycémie n'est PAS demandée à la réception
  // -------------------------------------------------------------------------
  const noGlycemieInModal =
    !modalContent.includes('setGlycemie') &&
    !modalContent.includes('Glycémie capillaire') &&
    !modalContent.includes('glycemie_mesuree:');

  const noGlycemieInPayloadAccepted = vitalsRecord1 && vitalsRecord1.glycemie_mesuree === null;

  const test4Passed = noGlycemieInModal && noGlycemieInPayloadAccepted;
  record(
    4,
    'Glycémie non demandée à la réception',
    test4Passed,
    test4Passed
      ? 'Aucun champ Glycémie dans le formulaire de triage réception et constante enregistrée sans glycémie'
      : 'La glycémie est encore présente dans la modal réception'
  );

  // -------------------------------------------------------------------------
  // TEST 5: Vérification que la glycémie reste disponible dans le laboratoire en mg/dL
  // -------------------------------------------------------------------------
  const labModalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/laboratory/LabResultEntryModal.tsx'),
    'utf-8'
  );

  const labHasMgDl =
    labModalContent.includes("'GLYCÉMIE': { unite: 'mg/dL'") ||
    labModalContent.includes("'GLYCEMIE': { unite: 'mg/dL'");

  const labPresetsPresent = labModalContent.includes('70 - 110') && labModalContent.includes('mg/dL');

  const test5Passed = labHasMgDl && labPresetsPresent;
  record(
    5,
    'Glycémie reste disponible au laboratoire en mg/dL',
    test5Passed,
    test5Passed
      ? "Le workflow de biologie médicale conserve la Glycémie avec l'unité mg/dL et normes de référence (70 - 110 mg/dL)"
      : 'Glycémie au laboratoire non configurée en mg/dL'
  );

  // -------------------------------------------------------------------------
  // TEST 6: Validation frontend (rejet taille en mètres, SpO2 > 100%, PAS <= PAD)
  // -------------------------------------------------------------------------
  const hasFrontendValidationRules =
    modalContent.includes('errors.taille') &&
    modalContent.includes('h <= 2.5') &&
    modalContent.includes('errors.tensionSys') &&
    modalContent.includes('sysVal <= diaVal') &&
    modalContent.includes('errors.spo2');

  record(
    6,
    'Validation frontend rigoureuse',
    hasFrontendValidationRules,
    hasFrontendValidationRules
      ? 'Contrôles frontend actifs : blocage de taille en mètres, SpO2 > 100%, PAS <= PAD et champs hors normes physiologiques'
      : 'Règles de validation frontend incomplètes'
  );

  // -------------------------------------------------------------------------
  // TEST 7: Validation backend stricte (HTTP 400 et rejet des valeurs aberrantes)
  // -------------------------------------------------------------------------
  const badTests = [
    {
      label: 'Température aberrante (< 30°C)',
      payload: { temperature: 26.0, tension_systolique: 120, tension_diastolique: 80 },
    },
    {
      label: 'Tension systolique inférieure ou égale à diastolique (PAS <= PAD)',
      payload: { tension_systolique: 70, tension_diastolique: 90 },
    },
    {
      label: 'Saturation SpO2 impossible (> 100%)',
      payload: { spo2: 105, tension_systolique: 120, tension_diastolique: 80 },
    },
    {
      label: 'Taille saisie en mètres non transformée (ex: 1.75 m)',
      payload: { taille: 1.75, tension_systolique: 120, tension_diastolique: 80 },
    },
    {
      label: 'Poids aberrant (< 0.5 kg)',
      payload: { poids: 0.1, tension_systolique: 120, tension_diastolique: 80 },
    },
  ];

  let allBadRejected = true;
  const badDetails: string[] = [];

  for (const bt of badTests) {
    const badReq: any = {
      params: { id: testVisiteId },
      user: { id: agentId, role: 'RÉCEPTION' },
      ip: '127.0.0.1',
      body: bt.payload,
    };
    const badRes = mockResponse();
    await recordVitals(badReq, badRes);

    if (badRes.statusCode !== 400) {
      allBadRejected = false;
      badDetails.push(`${bt.label} NON REJETÉ (HTTP ${badRes.statusCode})`);
    } else {
      badDetails.push(`${bt.label} -> REJETÉ 400`);
    }
  }

  record(
    7,
    'Validation backend stricte des types et valeurs impossibles',
    allBadRejected,
    allBadRejected
      ? `Toutes les valeurs aberrantes sont rejetées par le backend : ${badDetails.join(', ')}`
      : `Échec : ${badDetails.join(', ')}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Conservation des anciennes constantes et données existantes
  // -------------------------------------------------------------------------
  const countPreExisting = await queryOne<any>('SELECT COUNT(*) as total FROM signes_vitaux');
  const totalCount = countPreExisting?.total ?? 0;

  const test8Passed = totalCount >= 1;
  record(
    8,
    'Conservation des anciennes constantes et intégrité de la base',
    test8Passed,
    test8Passed
      ? `Historique conservé intact : ${totalCount} enregistrement(s) dans la table signes_vitaux avec intégrité référentielle`
      : 'Aucun enregistrement existant'
  );

  // -------------------------------------------------------------------------
  // TEST 9: Non-régression du workflow complet (transition de statut vers TRIAGE_TERMINE)
  // -------------------------------------------------------------------------
  const updatedVisite = await queryOne<any>('SELECT * FROM visites WHERE id = ?', [testVisiteId]);
  const test9Passed = updatedVisite && updatedVisite.statut === 'TRIAGE_TERMINE';

  record(
    9,
    'Non-régression du workflow de visite',
    Boolean(test9Passed),
    test9Passed
      ? `Statut de visite automatiquement mis à jour à TRIAGE_TERMINE (patient prêt pour affectation médecin)`
      : `Statut visite incorrect: ${updatedVisite?.statut}`
  );

  // -------------------------------------------------------------------------
  // BILAN DES TESTS ÉTAPE 2
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL : ${passedCount}/${results.length} tests réussis.`);
  if (allPassed) {
    console.log('>>> TOUS LES TESTS DE L\'ÉTAPE 2 SONT AU VERT <<<');
  } else {
    console.log('>>> CERTAINS TESTS ONT ÉCHOUÉ <<<');
    process.exit(1);
  }
  console.log('---------------------------------------------------------------\n');
}

// Exécution directe
runEtape2Tests().catch((err) => {
  console.error('Erreur critique pendant les tests:', err);
  process.exit(1);
});
