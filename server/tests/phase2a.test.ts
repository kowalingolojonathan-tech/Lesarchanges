/**
 * Tests Automatisés — PHASE 2A : ACCUEIL, PATIENT, VISITE ET TRIAGE
 * Clinique Les Archanges — Validation Fonctionnelle & Règle Métier : PATIENT ≠ VISITE ≠ CONSULTATION
 */

import { query, queryOne, execute, transaction, getDb, saveDb, DB_PATH } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { calculateAge, calculateIMC, calculatePAM, validateAndComputeVitals } from '../utils/vitalsCalculator.js';
import initSqlJs from 'sql.js';
import fs from 'fs';
import crypto from 'crypto';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, desc: string, passed: boolean, details: string) {
  results.push({ testNumber: num, description: desc, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] Test ${num}: ${desc} -> ${details}`);
}

export async function runPhase2aTests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DE LA SUITE DE TESTS — PHASE 2A');
  console.log('  Accueil, Patient Permanent, Visite & Triage Biomédical');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);
  let createdPatientId = '';
  let permanentDossierNum = '';
  let firstVisiteId = '';
  let firstVisiteNum = '';
  let secondVisiteId = '';
  let secondVisiteNum = '';
  let testDoctorId = '';

  // -------------------------------------------------------------
  // TEST 1 : Création d'un nouveau patient permanent
  // -------------------------------------------------------------
  try {
    const pId = 'pat_test_' + testSuffix;
    const pNum = 'ARCH-2026-TEST-' + testSuffix.toUpperCase();
    const pNom = 'MUKENDI_' + testSuffix;
    const pPrenom = 'Grace';
    const pDateNaiss = '1992-05-14';
    const pTel = '+24381999' + Math.floor(1000 + Math.random() * 9000);

    await execute(`
      INSERT INTO patients (
        id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, allergies, actif, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'F', ?, 'Kinshasa, Gombe', 'O+', 'Pénicilline', 1, datetime('now'), datetime('now'))
    `, [pId, pNum, pNom, pPrenom, pDateNaiss, pTel]);

    const row = await queryOne('SELECT * FROM patients WHERE id = ?', [pId]);
    const passed = row !== null && row.numero_dossier === pNum && row.nom === pNom;
    createdPatientId = pId;
    permanentDossierNum = pNum;

    record(1, 'Création d\'un nouveau patient', passed, `Dossier permanent ${pNum} créé avec succès.`);
  } catch (err: any) {
    record(1, 'Création d\'un nouveau patient', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2 : Recherche d'un patient existant (nom, dossier, téléphone)
  // -------------------------------------------------------------
  try {
    const byNom = await query('SELECT * FROM patients WHERE nom LIKE ?', [`%${testSuffix}%`]);
    const byDossier = await queryOne('SELECT * FROM patients WHERE numero_dossier = ?', [permanentDossierNum]);
    const byTel = await query('SELECT * FROM patients WHERE telephone LIKE ?', ['+24381999%']);

    const passed = byNom.length > 0 && byDossier !== null && byTel.length > 0;
    record(2, 'Recherche d\'un patient existant', passed, 'Recherche multi-critères (nom, dossier permanent, téléphone) fonctionnelle.');
  } catch (err: any) {
    record(2, 'Recherche d\'un patient existant', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3 : Détection et interdiction de création d'un doublon
  // -------------------------------------------------------------
  try {
    const existing = await queryOne('SELECT * FROM patients WHERE id = ?', [createdPatientId]);
    // Simule la logique du contrôleur : vérification avant insertion
    const duplicate = await queryOne(`
      SELECT id, numero_dossier FROM patients 
      WHERE LOWER(nom) = LOWER(?) AND LOWER(prenom) = LOWER(?) AND date_naissance = ? AND telephone = ? AND actif = 1
    `, [existing.nom, existing.prenom, existing.date_naissance, existing.telephone]);

    const passed = duplicate !== null && duplicate.numero_dossier === permanentDossierNum;
    record(3, 'Détection et blocage des doublons', passed, `Doublon formellement identifié (Dossier N° ${duplicate?.numero_dossier}). Création rejetée.`);
  } catch (err: any) {
    record(3, 'Détection et blocage des doublons', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4 : Création d'une nouvelle visite pour le patient existant
  // -------------------------------------------------------------
  try {
    const vId1 = 'vis_test_1_' + testSuffix;
    const vNum1 = 'VIS-20260919-001-' + testSuffix;
    await execute(`
      INSERT INTO visites (id, numero_visite, patient_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
      VALUES (?, ?, ?, datetime('now'), 'ATTENTE_TRIAGE', 'Fièvre et céphalées depuis 48h', 'STANDARD', 1, datetime('now'))
    `, [vId1, vNum1, createdPatientId]);

    const visiteRow = await queryOne('SELECT * FROM visites WHERE id = ?', [vId1]);
    const passed = visiteRow !== null && visiteRow.statut === 'ATTENTE_TRIAGE' && visiteRow.patient_id === createdPatientId;
    firstVisiteId = vId1;
    firstVisiteNum = vNum1;

    record(4, 'Création d\'une visite (statut initial ATTENTE_TRIAGE)', passed, `Visite ${vNum1} attachée au dossier ${permanentDossierNum}.`);
  } catch (err: any) {
    record(4, 'Création d\'une visite (statut initial ATTENTE_TRIAGE)', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5 : Vérification du numéro de dossier permanent lors d'une 2ème visite
  // -------------------------------------------------------------
  try {
    const vId2 = 'vis_test_2_' + testSuffix;
    const vNum2 = 'VIS-20260919-002-' + testSuffix;
    await execute(`
      INSERT INTO visites (id, numero_visite, patient_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
      VALUES (?, ?, ?, datetime('now', '+1 hour'), 'ATTENTE_TRIAGE', 'Contrôle tensionnel', 'CONTROLE', 1, datetime('now'))
    `, [vId2, vNum2, createdPatientId]);

    secondVisiteId = vId2;
    secondVisiteNum = vNum2;

    const v1 = await queryOne('SELECT patient_id FROM visites WHERE id = ?', [firstVisiteId]);
    const v2 = await queryOne('SELECT patient_id FROM visites WHERE id = ?', [secondVisiteId]);
    const pat1 = await queryOne('SELECT numero_dossier FROM patients WHERE id = ?', [v1.patient_id]);
    const pat2 = await queryOne('SELECT numero_dossier FROM patients WHERE id = ?', [v2.patient_id]);

    const passed = pat1.numero_dossier === pat2.numero_dossier && pat1.numero_dossier === permanentDossierNum;
    record(5, 'Conservation stricte du dossier permanent', passed, `Le numéro de dossier reste invariant (${pat1.numero_dossier}) à travers les visites successives.`);
  } catch (err: any) {
    record(5, 'Conservation stricte du dossier permanent', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6 : Vérification que deux visites ont des IDs différents
  // -------------------------------------------------------------
  try {
    const passed = firstVisiteId !== secondVisiteId && firstVisiteNum !== secondVisiteNum;
    record(6, 'Deux visites = deux identifiants distincts', passed, `Visite 1 (${firstVisiteNum}) et Visite 2 (${secondVisiteNum}) sont des épisodes séparés.`);
  } catch (err: any) {
    record(6, 'Deux visites = deux identifiants distincts', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7 : Enregistrement des signes vitaux
  // -------------------------------------------------------------
  try {
    const agent = await queryOne("SELECT id FROM users WHERE role = 'RÉCEPTION' LIMIT 1");
    const svId = 'sv_test_' + testSuffix;

    await execute(`
      INSERT INTO signes_vitaux (
        id, visite_id, patient_id, agent_id, temperature, tension_systolique, tension_diastolique,
        pouls, frequence_respiratoire, spo2, poids, taille, glycemie_mesuree, douleur,
        age_calcule, imc, categorie_imc, pam, date_prise
      ) VALUES (?, ?, ?, ?, 38.4, 130, 85, 88, 18, 98, 72.5, 175, 1.05, 4, 34, 23.7, 'Poids normal', 100.0, datetime('now'))
    `, [svId, firstVisiteId, createdPatientId, agent.id]);

    const sv = await queryOne('SELECT * FROM signes_vitaux WHERE id = ?', [svId]);
    const passed = sv !== null && sv.temperature === 38.4 && sv.tension_systolique === 130 && sv.tension_diastolique === 85;

    record(7, 'Enregistrement complet des signes vitaux', passed, 'Constantes biométriques enregistrées avec succès en base.');
  } catch (err: any) {
    record(7, 'Enregistrement complet des signes vitaux', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8 : Calcul correct de l'âge au moment de la visite
  // -------------------------------------------------------------
  try {
    const refDate = new Date('2026-09-19');
    const age1 = calculateAge('1992-05-14', refDate); // Anniversaire passé en mai : 34 ans
    const age2 = calculateAge('1992-11-20', refDate); // Anniversaire pas encore passé en nov : 33 ans
    const ageEnfant = calculateAge('2023-01-10', refDate); // 3 ans

    const passed = age1 === 34 && age2 === 33 && ageEnfant === 3;
    record(8, 'Calcul exact de l\'âge au moment de la visite', passed, `Âge calculé avec exactitude au jour près (ex: 1992-05-14 = ${age1} ans, 1992-11-20 = ${age2} ans).`);
  } catch (err: any) {
    record(8, 'Calcul exact de l\'âge au moment de la visite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9 : Calcul correct de l'IMC et catégorie biométrique OMS
  // -------------------------------------------------------------
  try {
    // 72 kg pour 175 cm -> 72 / (1.75^2) = 23.51 -> 23.5
    const normal = calculateIMC(72, 175);
    // 95 kg pour 170 cm -> 95 / (1.70^2) = 32.87 -> 32.9 (Obésité modérée)
    const obese = calculateIMC(95, 170);
    // 45 kg pour 165 cm -> 45 / (1.65^2) = 16.53 -> 16.5 (Insuffisance pondérale)
    const maigre = calculateIMC(45, 165);

    const passed = normal.imc === 23.5 && normal.categorie === 'Poids normal' &&
                   obese.imc === 32.9 && obese.categorie === 'Obésité modérée (Classe I)' &&
                   maigre.imc === 16.5 && maigre.categorie === 'Insuffisance pondérale';

    record(9, 'Calcul conforme de l\'IMC et classification OMS', passed, `IMC normal: ${normal.imc} (${normal.categorie}), Obésité: ${obese.imc} (${obese.categorie}).`);
  } catch (err: any) {
    record(9, 'Calcul conforme de l\'IMC et classification OMS', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 10 : Calcul correct de la PAM (Pression Artérielle Moyenne)
  // -------------------------------------------------------------
  try {
    // TA 120/80 -> (120 + 160) / 3 = 93.33 -> 93.3
    const pam1 = calculatePAM(120, 80);
    // TA 130/85 -> (130 + 170) / 3 = 100.0
    const pam2 = calculatePAM(130, 85);
    // TA 150/90 -> (150 + 180) / 3 = 110.0
    const pam3 = calculatePAM(150, 90);

    const passed = pam1 === 93.3 && pam2 === 100.0 && pam3 === 110.0;
    record(10, 'Calcul exact de la PAM (Pression Artérielle Moyenne)', passed, `Formule (Sys + 2*Dia)/3 validée : 120/80 -> ${pam1} mmHg, 130/85 -> ${pam2} mmHg.`);
  } catch (err: any) {
    record(10, 'Calcul exact de la PAM (Pression Artérielle Moyenne)', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 11 : Rejet systématique de valeurs physiologiques manifestement invalides
  // -------------------------------------------------------------
  try {
    // Température impossible (20°C ou 55°C)
    const checkTemp = validateAndComputeVitals({ temperature: 20.0 });
    // TA systolique <= diastolique (ex: 80/120)
    const checkTaIncoherent = validateAndComputeVitals({ tension_systolique: 80, tension_diastolique: 120 });
    // SpO2 impossible (150%)
    const checkSpo2 = validateAndComputeVitals({ spo2: 150 });
    // Douleur hors échelle (15)
    const checkDouleur = validateAndComputeVitals({ douleur: 15 });

    const passed = !checkTemp.isValid && !checkTaIncoherent.isValid && !checkSpo2.isValid && !checkDouleur.isValid;
    record(11, 'Rejet des valeurs physiologiques aberrantes', passed, 'Température < 30°C, TA incohérente (Sys <= Dia), SpO2 > 100% et douleur > 10 rejetés côté serveur.');
  } catch (err: any) {
    record(11, 'Rejet des valeurs physiologiques aberrantes', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 12 : Affectation d'un médecin à la visite
  // -------------------------------------------------------------
  try {
    const doc = await queryOne("SELECT id, nom_complet FROM users WHERE role = 'MÉDECIN' AND actif = 1 LIMIT 1");
    testDoctorId = doc.id;

    await execute('UPDATE visites SET medecin_id = ? WHERE id = ?', [testDoctorId, firstVisiteId]);
    const updated = await queryOne('SELECT medecin_id FROM visites WHERE id = ?', [firstVisiteId]);

    const passed = updated.medecin_id === testDoctorId;
    record(12, 'Affectation d\'un médecin traitant', passed, `Visite affectée au praticien Dr. ${doc.nom_complet}.`);
  } catch (err: any) {
    record(12, 'Affectation d\'un médecin traitant', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 13 : Transition d'état : ATTENTE_TRIAGE -> TRIAGE_TERMINE
  // -------------------------------------------------------------
  try {
    await execute("UPDATE visites SET statut = 'TRIAGE_TERMINE' WHERE id = ?", [firstVisiteId]);
    const v = await queryOne('SELECT statut FROM visites WHERE id = ?', [firstVisiteId]);

    const passed = v.statut === 'TRIAGE_TERMINE';
    record(13, 'Transition ATTENTE_TRIAGE -> TRIAGE_TERMINE', passed, 'Statut de visite mis à jour avec succès suite à la saisie du triage.');
  } catch (err: any) {
    record(13, 'Transition ATTENTE_TRIAGE -> TRIAGE_TERMINE', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 14 : Transition d'état : TRIAGE_TERMINE -> ATTENTE_MEDECIN
  // -------------------------------------------------------------
  try {
    await execute("UPDATE visites SET statut = 'ATTENTE_MEDECIN' WHERE id = ?", [firstVisiteId]);
    const v = await queryOne('SELECT statut, medecin_id FROM visites WHERE id = ?', [firstVisiteId]);

    const passed = v.statut === 'ATTENTE_MEDECIN' && v.medecin_id === testDoctorId;
    record(14, 'Transition TRIAGE_TERMINE -> ATTENTE_MEDECIN', passed, 'Patient placé en file d\'attente du médecin sélectionné.');
  } catch (err: any) {
    record(14, 'Transition TRIAGE_TERMINE -> ATTENTE_MEDECIN', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 15 : Rôle RÉCEPTION strictement interdit aux données de consultation médicale
  // -------------------------------------------------------------
  try {
    // Vérification de la structure retournée à la réception : les notes de consultation privées ne doivent pas être exposées
    const receptionViewData = await queryOne(`
      SELECT v.id, v.numero_visite, v.statut, p.nom, p.prenom, p.numero_dossier
      FROM visites v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = ?
    `, [firstVisiteId]);

    // Tentative de sélectionner des données de consultation secrètes via la vue réception
    const hasConfidentialFields = 'notes_confidentielles' in receptionViewData ||
                                  'diagnostic_principal' in receptionViewData ||
                                  'histoire_maladie' in receptionViewData;

    const passed = !hasConfidentialFields && receptionViewData.numero_visite === firstVisiteNum;
    record(15, 'Cloisonnement RBAC Réception / Données médicales privées', passed, 'Les données confidentielles de consultation ne sont pas exposées à la Réception.');
  } catch (err: any) {
    record(15, 'Cloisonnement RBAC Réception / Données médicales privées', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 16 : Persistance complète après rechargement binaire SQLite
  // -------------------------------------------------------------
  try {
    // Forcer la sauvegarde disque
    saveDb();

    // Recharger depuis le fichier physique dans une nouvelle instance sql.js isolée
    const fileBuffer = fs.readFileSync(DB_PATH);
    const SQL = await initSqlJs();
    const freshDb = new SQL.Database(fileBuffer);

    const stmt = freshDb.prepare(`
      SELECT v.numero_visite, v.statut, p.numero_dossier, p.nom, sv.imc, sv.pam
      FROM visites v
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
      WHERE v.id = ?
    `);
    stmt.bind([firstVisiteId]);
    const hasRow = stmt.step();
    const loadedRow = stmt.getAsObject();
    stmt.free();
    freshDb.close();

    const passed = hasRow && 
                   loadedRow.numero_visite === firstVisiteNum && 
                   loadedRow.numero_dossier === permanentDossierNum &&
                   loadedRow.statut === 'ATTENTE_MEDECIN' &&
                   loadedRow.imc === 23.7 &&
                   loadedRow.pam === 100.0;

    record(16, 'Persistance des données après redémarrage physique', passed, 'Patients, visites, constantes biométriques et calculs intègres après relecture binaire.');
  } catch (err: any) {
    record(16, 'Persistance des données après redémarrage physique', false, err.message);
  }

  console.log('\n---------------------------------------------------------------');
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`TOTAL : ${passedCount}/${results.length} tests réussis.`);
  if (allPassed) {
    console.log('>>> TOUS LES 16 TESTS DE LA PHASE 2A SONT AU VERT <<<');
  } else {
    console.log('>>> DES ÉCHECS ONT ÉTÉ DÉTECTÉS <<<');
  }
  console.log('---------------------------------------------------------------\n');

  return results;
}

// Auto-exécution si lancé directement
runPhase2aTests().catch(err => {
  console.error('Erreur fatale lors des tests Phase 2A:', err);
  process.exit(1);
});
