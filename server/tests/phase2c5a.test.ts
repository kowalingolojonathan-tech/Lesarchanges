/**
 * Suite de Tests Automatisés — PHASE 5.7 : VALIDATION BIOLOGIQUE DES RÉSULTATS
 * Clinique Les Archanges
 *
 * Couvre :
 * A. Résultats incomplets → validation refusée
 * B. Résultats complets → validation réussie
 * C. "valide_par_id" et "date_validation" correctement enregistrés
 * D. Double validation → refus propre
 * E. Résultats validés → disparaissent de la file à valider
 * F. Résultats toujours consultables après validation
 * G. Modification après validation → refusée
 * H. GLOBAL → tous les paramètres validés
 * I. PERSONNALISÉ → uniquement les paramètres sélectionnés
 * J. Page Laboratoire reste stable (ordonnance statuts cohérente)
 */

import { query, queryOne, execute, transaction } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { validateLabResults, saveLabResults } from '../controllers/medicalController.js';

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
  console.log(`[${status}] Test ${num.toString().padStart(2, '0')}: ${desc} -> ${details}`);
}

export async function runPhase57Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DE LA SUITE DE TESTS — PHASE 5.7');
  console.log('  Validation Biologique des Résultats — Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);

  const lab1_id = 'usr-lab-01';
  const lab2_id = `usr-lab-02-${testSuffix}`;
  const med1_id = 'usr-med-01';
  const pat1_id = `pat-c57-${testSuffix}`;
  const vis1_id = `vis-c57-${testSuffix}`;
  const csl1_id = `csl-c57-${testSuffix}`;
  const orderGlobalId = `lab-ord-c57-global-${testSuffix}`;
  const orderPersoId = `lab-ord-c57-perso-${testSuffix}`;
  const orderIncompleteId = `lab-ord-c57-inc-${testSuffix}`;
  const echId = `ech-c57-${testSuffix}`;
  const echBadId = `ech-c57-bad-${testSuffix}`;
  const now = () => new Date().toISOString();

  // Setup shared entities
  await execute(
    `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
     VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Test Lab 2', 'LABORATOIRE', 1, datetime('now'), datetime('now'))`,
    [lab2_id, `testlab2.${testSuffix}`]
  );

  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'KAMBA', 'Jean', '1990-06-15', 'M', '+243 81 00 00 01', 'Gombe', 'A+', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-C57-${testSuffix}`]
  );

  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Suivi biologique', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-C57-${testSuffix}`, pat1_id, med1_id]
  );

  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, examen_physique, diagnostic_principal, notes_confidentielles, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Suivi', 'Normal', 'Contrôle biologique', '', datetime('now'), datetime('now'))`,
    [csl1_id, vis1_id, pat1_id, med1_id]
  );

  // Échantillon conforme
  await execute(
    `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
     VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
    [echId, orderGlobalId, `LAB-C57-${testSuffix}`, lab1_id]
  );

  // Échantillon non conforme (pour test G)
  await execute(
    `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
     VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_NON_CONFORME', ?, datetime('now'), datetime('now'))`,
    [echBadId, orderIncompleteId, `LAB-BAD-${testSuffix}`, lab1_id]
  );

  // ===== Commande GLOBAL avec 2 analyses =====
  await transaction(async () => {
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_SAISIS', 'NORMALE', 'NFS bilan', ?, ?)`,
      [orderGlobalId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-GLOB-${testSuffix}`, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, valeur_mesuree, unite, valeurs_reference, interpretation, created_at, updated_at)
       VALUES (?, ?, 'NFS — Globules Blancs', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-nfs', 'GLOBAL', 'param-gb', NULL, '5.8', '10³/µL', '4.0 - 10.0', 'NORMAL', ?, ?)`,
      [`ana-c57-g1-${testSuffix}`, orderGlobalId, echId, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, valeur_mesuree, unite, valeurs_reference, interpretation, created_at, updated_at)
       VALUES (?, ?, 'NFS — Hémoglobine', 'SANG', 'RESULTAT_A_VALIDER', 1, ?, 'exam-nfs', 'GLOBAL', 'param-hb', NULL, '13.5', 'g/dL', '12.0 - 16.5', 'NORMAL', ?, ?)`,
      [`ana-c57-g2-${testSuffix}`, orderGlobalId, echId, now(), now()]
    );
  });

  // ===== Commande PERSONNALISÉ avec 1 analyse =====
  await transaction(async () => {
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_SAISIS', 'NORMALE', 'Glycémie', ?, ?)`,
      [orderPersoId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-PERS-${testSuffix}`, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, selection_details, valeur_mesuree, unite, valeurs_reference, interpretation, created_at, updated_at)
       VALUES (?, ?, 'Glycémie à jeun', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-gly', 'PERSONNALISE', 'param-gly-val', NULL, '[{"parametre_id":"param-gly-val","sous_parametre_id":null}]', '0.95', 'g/L', '0.70 - 1.10', 'NORMAL', ?, ?)`,
      [`ana-c57-p1-${testSuffix}`, orderPersoId, echId, now(), now()]
    );
  });

  // ===== Commande INCOMPLÈTE (un résultat vide, échantillon conforme) =====
  await transaction(async () => {
    const echIncompleteId = `ech-c57-inc-${testSuffix}`;
    await execute(
      `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
       VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
      [echIncompleteId, orderIncompleteId, `LAB-INCO-${testSuffix}`, lab1_id]
    );
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_SAISIS', 'NORMALE', 'Test incomplet', ?, ?)`,
      [orderIncompleteId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-INCO-${testSuffix}`, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, valeur_mesuree, unite, created_at, updated_at)
       VALUES (?, ?, 'Analyse A', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-nfs', 'GLOBAL', 'param-gb', '5.0', '10³/µL', ?, ?)`,
      [`ana-c57-i1-${testSuffix}`, orderIncompleteId, echIncompleteId, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, valeur_mesuree, unite, created_at, updated_at)
       VALUES (?, ?, 'Analyse B', 'SANG', 'RESULTAT_A_VALIDER', 1, ?, 'exam-nfs', 'GLOBAL', 'param-hb', '', '', ?, ?)`,
      [`ana-c57-i2-${testSuffix}`, orderIncompleteId, echIncompleteId, now(), now()]
    );
  });

  // Helper
  function makeReq(user: any, orderId: string): any {
    return { user, params: { id: orderId }, body: {} } as any;
  }

  function callValidate(orderId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' }, orderId);
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      validateLabResults(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callSave(orderId: string, userId: string, results: any[]): Promise<any> {
    return new Promise((resolve) => {
      const req = {
        user: { id: userId, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' },
        params: { id: orderId },
        body: { results, statut: 'RESULTATS_SAISIS' }
      } as any;
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      saveLabResults(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  // ---- Test A : Résultats incomplets → validation refusée ----
  try {
    const res = await callValidate(orderIncompleteId, lab1_id);
    if (res.error && res.error.includes('aucun résultat saisi')) {
      record(1, "Résultats incomplets → validation refusée", true,
        `Erreur reçue : "${res.error}".`);
    } else {
      record(1, "Résultats incomplets → validation refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(1, "Résultats incomplets → validation refusée", false, err.message);
  }

  // ---- Test B : Résultats complets GLOBAL → validation réussie ----
  try {
    const res = await callValidate(orderGlobalId, lab1_id);
    if (res && !res.error && res.lab_order && res.lab_order.statut === 'RESULTATS_VALIDES') {
      record(2, "Résultats complets GLOBAL → validation réussie", true,
        `Demande validée. Statut: ${res.lab_order.statut}.`);
    } else {
      record(2, "Résultats complets GLOBAL → validation réussie", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(2, "Résultats complets GLOBAL → validation réussie", false, err.message);
  }

  // ---- Test C : valide_par_id et date_validation correctement enregistrés ----
  try {
    const ana = await queryOne<any>(
      `SELECT valide_par_id, date_validation FROM analyses_laboratoire WHERE id = ?`,
      [`ana-c57-g1-${testSuffix}`]
    );
    const ord = await queryOne<any>(
      `SELECT validated_by, validated_at FROM demandes_laboratoire WHERE id = ?`,
      [orderGlobalId]
    );
    if (ana && ord && ana.valide_par_id === lab1_id && ord.validated_by === lab1_id
        && ana.date_validation && ord.validated_at) {
      record(3, "valide_par_id et date_validation correctement enregistrés", true,
        `valide_par_id="${ana.valide_par_id}", date_validation="${ana.date_validation}", validated_at="${ord.validated_at}".`);
    } else {
      record(3, "valide_par_id et date_validation correctement enregistrés", false,
        `ana.valide_par_id="${ana?.valide_par_id}", ord.validated_by="${ord?.validated_by}"`);
    }
  } catch (err: any) {
    record(3, "valide_par_id et date_validation correctement enregistrés", false, err.message);
  }

  // ---- Test D : Double validation → refus propre ----
  try {
    const res = await callValidate(orderGlobalId, lab1_id);
    if (res.error && res.error.includes('déjà été validée')) {
      record(4, "Double validation → refus propre", true,
        `Erreur reçue : "${res.error}".`);
    } else {
      record(4, "Double validation → refus propre", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(4, "Double validation → refus propre", false, err.message);
  }

  // ---- Test E : Résultats validés → disparaissent de la file à valider ----
  try {
    const order = await queryOne<any>(
      `SELECT statut FROM demandes_laboratoire WHERE id = ?`,
      [orderGlobalId]
    );
    if (order && order.statut === 'RESULTATS_VALIDES') {
      // Vérifier qu'elle n'apparaît pas dans les commandes "à valider" (RESULTATS_SAISIS)
      const stillSaisis = await queryOne<any>(
        `SELECT id FROM demandes_laboratoire WHERE id = ? AND statut = 'RESULTATS_SAISIS'`,
        [orderGlobalId]
      );
      if (!stillSaisis) {
        record(5, "Résultats validés → disparaissent de la file à valider", true,
          `Statut = RESULTATS_VALIDES. Plus en RESULTATS_SAISIS.`);
      } else {
        record(5, "Résultats validés → disparaissent de la file à valider", false,
          `La commande est encore en RESULTATS_SAISIS.`);
      }
    } else {
      record(5, "Résultats validés → disparaissent de la file à valider", false,
        `Statut inattendu: ${order?.statut}`);
    }
  } catch (err: any) {
    record(5, "Résultats validés → disparaissent de la file à valider", false, err.message);
  }

  // ---- Test F : Résultats toujours consultables après validation ----
  try {
    const anas = await query<any>(
      `SELECT id, nom_analyse, valeur_mesuree, unite, interpretation, observation, statut, valide_par_id
       FROM analyses_laboratoire
       WHERE demande_laboratoire_id = ?
       ORDER BY ordre ASC`,
      [orderGlobalId]
    );
    if (anas.length === 2 && anas[0].valeur_mesuree === '5.8' && anas[1].valeur_mesuree === '13.5'
        && anas.every((a: any) => a.statut === 'RESULTATS_VALIDES')) {
      record(6, "Résultats toujours consultables après validation", true,
        `2 analyses consultables, valeurs conservées (5.8, 13.5), toutes en RESULTATS_VALIDES.`);
    } else {
      record(6, "Résultats toujours consultables après validation", false,
        `Anomalie: ${JSON.stringify(anas.map((a: any) => ({ id: a.id, valeur: a.valeur_mesuree, statut: a.statut })))}`);
    }
  } catch (err: any) {
    record(6, "Résultats toujours consultables après validation", false, err.message);
  }

  // ---- Test G : Modification après validation → refusée ----
  try {
    const res = await callSave(orderGlobalId, lab1_id, [
      { id: `ana-c57-g1-${testSuffix}`, valeur_mesuree: '99.9', unite: 'test', interpretation: 'CRITIQUE' }
    ]);
    if (res.error && res.error.includes('déjà été validée')) {
      record(7, "Modification après validation → refusée", true,
        `Erreur reçue : "${res.error}".`);
    } else {
      record(7, "Modification après validation → refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(7, "Modification après validation → refusée", false, err.message);
  }

  // ---- Test H : GLOBAL → tous les paramètres validés ----
  try {
    const anas = await query<any>(
      `SELECT id, nom_analyse, statut FROM analyses_laboratoire WHERE demande_laboratoire_id = ?`,
      [orderGlobalId]
    );
    const allValidated = anas.length === 2 && anas.every((a: any) => a.statut === 'RESULTATS_VALIDES');
    if (allValidated) {
      record(8, "GLOBAL → tous les paramètres validés", true,
        `Toutes les ${anas.length} analyses GLOBAL sont en RESULTATS_VALIDES.`);
    } else {
      record(8, "GLOBAL → tous les paramètres validés", false,
        `Certaines analyses ne sont pas validées: ${JSON.stringify(anas.map((a: any) => a.statut))}`);
    }
  } catch (err: any) {
    record(8, "GLOBAL → tous les paramètres validés", false, err.message);
  }

  // ---- Test I : PERSONNALISÉ → uniquement les paramètres sélectionnés ----
  try {
    const res = await callValidate(orderPersoId, lab1_id);
    if (res && !res.error && res.lab_order && res.lab_order.statut === 'RESULTATS_VALIDES') {
      const ana = await queryOne<any>(
        `SELECT statut, valeur_mesuree, unite FROM analyses_laboratoire WHERE id = ?`,
        [`ana-c57-p1-${testSuffix}`]
      );
      if (ana && ana.statut === 'RESULTATS_VALIDES' && ana.valeur_mesuree === '0.95') {
        record(9, "PERSONNALISÉ → uniquement paramètres sélectionnés", true,
          `Analyse PERSONNALISÉE validée. Valeur conservée: "${ana.valeur_mesuree}".`);
      } else {
        record(9, "PERSONNALISÉ → uniquement paramètres sélectionnés", false,
          `Statut ou valeur incohérents: ${JSON.stringify(ana)}`);
      }
    } else {
      record(9, "PERSONNALISÉ → uniquement paramètres sélectionnés", false,
        `Échec validation: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(9, "PERSONNALISÉ → uniquement paramètres sélectionnés", false, err.message);
  }

  // ---- Test J : Page Laboratoire stable — ordonnance des statuts cohérente ----
  try {
    // Vérifier que les statuts sont dans l'ordre logique attendu
    const orders = await query<any>(
      `SELECT id, statut FROM demandes_laboratoire WHERE id IN (?, ?, ?)`,
      [orderGlobalId, orderPersoId, orderIncompleteId]
    );
    const globalStatus = orders.find((o: any) => o.id === orderGlobalId)?.statut;
    const persoStatus = orders.find((o: any) => o.id === orderPersoId)?.statut;
    const incompleteStatus = orders.find((o: any) => o.id === orderIncompleteId)?.statut;

    // orderGlobalId doit être RESULTATS_VALIDES
    // orderPersoId doit être RESULTATS_VALIDES
    // orderIncompleteId doit rester RESULTATS_SAISIS (validation refusée)
    if (globalStatus === 'RESULTATS_VALIDES' && persoStatus === 'RESULTATS_VALIDES' && incompleteStatus === 'RESULTATS_SAISIS') {
      record(10, "Page Laboratoire stable — ordonnance statuts cohérente", true,
        `GLOBAL=RESULTATS_VALIDES, PERSONNALISÉ=RESULTATS_VALIDES, INCOMPLET=RESULTATS_SAISIS.`);
    } else {
      record(10, "Page Laboratoire stable — ordonnance statuts cohérente", false,
        `Stats: GLOBAL=${globalStatus}, PERSO=${persoStatus}, INCOMPLET=${incompleteStatus}`);
    }
  } catch (err: any) {
    record(10, "Page Laboratoire stable — ordonnance statuts cohérente", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 5.7 — VALIDATION BIOLOGIQUE SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase2c5a.test.ts') || process.argv[1]?.endsWith('phase2c5a.test.js')) {
  runPhase57Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
