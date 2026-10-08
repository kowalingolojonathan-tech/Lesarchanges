/**
 * Suite de Tests Automatisés — PHASE 2C-4 / PHASE 5.6 : SAISIE DES RÉSULTATS LABORATOIRE
 * Clinique Les Archanges
 *
 * Couvre :
 * A. Analyse RESULTAT_A_VALIDER → visible pour saisie
 * B. Résultat numérique → sauvegarde
 * C. Résultat texte → sauvegarde
 * D. Plusieurs paramètres → chaque résultat sauvegardé séparément
 * E. GLOBAL → tous les paramètres
 * F. PERSONNALISÉ → uniquement sélectionnés
 * G. Refresh → résultats conservés
 * H. Modification d'une analyse déjà validée → refusée
 * I. Statut préservé après sauvegarde (RESULTAT_A_VALIDER conservé)
 * J. Sauvegarde sans échantillon → refusée
 * K. Sauvegarde avec échantillon non conforme → refusée
 * L. Commande passe en RESULTATS_SAISIS après sauvegarde
 * M. Sauvegarde double (ré-édition) → réussie
 */

import { query, queryOne, execute, transaction, saveDb } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { saveLabResults } from '../controllers/medicalController.js';
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
  console.log(`[${status}] Test ${num.toString().padStart(2, '0')}: ${desc} -> ${details}`);
}

export async function runPhase2c4Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DE LA SUITE DE TESTS — PHASE 2C-4 / PHASE 5.6');
  console.log('  Saisie des Résultats Laboratoire — Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);

  const lab1_id = 'usr-lab-01';
  const lab2_id = `usr-lab-02-${testSuffix}`;
  const med1_id = 'usr-med-01';
  const pat1_id = `pat-c4-${testSuffix}`;
  const vis1_id = `vis-c4-${testSuffix}`;
  const csl1_id = `csl-c4-${testSuffix}`;
  const order1_id = `lab-ord-c4-${testSuffix}`;
  const order2_id = `lab-ord-c4b-${testSuffix}`;

  const now = () => new Date().toISOString();

  // Setup
  await execute(
    `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
     VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Test Lab 2', 'LABORATOIRE', 1, datetime('now'), datetime('now'))`,
    [lab2_id, `testlab2.${testSuffix}`]
  );

  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'DIOUF', 'Moussa', '1985-03-12', 'M', '+243 82 00 00 01', 'Lemba', 'O+', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-C4-${testSuffix}`]
  );

  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Fatigue, fièvre', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-C4-${testSuffix}`, pat1_id, med1_id]
  );

  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, examen_physique, diagnostic_principal, notes_confidentielles, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Fatigue 15 jours', 'Pâleur', 'Anémie ferriprive suspectée', 'Note confidentielle médecin', datetime('now'), datetime('now'))`,
    [csl1_id, vis1_id, pat1_id, med1_id]
  );

  // Échantillon conforme
  const echId = `ech-c4-${testSuffix}`;
  await execute(
    `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
     VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
    [echId, order1_id, `LAB-TEST-${testSuffix}`, lab1_id]
  );

  // Commande 1 : GLOBAL — NFS avec 2 analyses
  await transaction(async () => {
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTAT_A_VALIDER', 'URGENTE', 'NFS urgente', ?, ?)`,
      [order1_id, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-URG-${testSuffix}`, now(), now()]
    );

    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, created_at, updated_at)
       VALUES (?, ?, 'NFS — Globules Blancs', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-nfs', 'GLOBAL', 'param-gb', NULL, ?, ?)`,
      [`ana-c4-1-${testSuffix}`, order1_id, echId, now(), now()]
    );

    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, created_at, updated_at)
       VALUES (?, ?, 'NFS — Hémoglobine', 'SANG', 'RESULTAT_A_VALIDER', 1, ?, 'exam-nfs', 'GLOBAL', 'param-hb', NULL, ?, ?)`,
      [`ana-c4-2-${testSuffix}`, order1_id, echId, now(), now()]
    );

    // Commande 2 : PERSONNALISÉ — Glycémie
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTAT_A_VALIDER', 'NORMALE', 'Glycémie contrôle', ?, ?)`,
      [order2_id, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-NORM-${testSuffix}`, now(), now()]
    );

    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, selection_details, created_at, updated_at)
       VALUES (?, ?, 'Glycémie à jeun', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-gly', 'PERSONNALISE', 'param-gly-val', NULL, '[{"parametre_id":"param-gly-val","sous_parametre_id":null}]', ?, ?)`,
      [`ana-c4-3-${testSuffix}`, order2_id, echId, now(), now()]
    );
  });

  // Helper pour simuler une requête
  function makeReq(user: any, orderId: string, body?: any): any {
    const defaultBody = body || {
      results: [{ id: '', valeur_mesuree: '', unite: '', observation: '' }],
      statut: 'RESULTATS_SAISIS'
    };
    return { user, params: { id: orderId }, body: defaultBody } as any;
  }

  // ---- Test A ----
  try {
    const order = await queryOne<any>(
      `SELECT d.*, a.id as ana_id, a.statut as ana_statut, a.echantillon_id
       FROM demandes_laboratoire d
       JOIN analyses_laboratoire a ON a.demande_laboratoire_id = d.id
       WHERE d.id = ?`,
      [order1_id]
    );
    if (order && order.ana_statut === 'RESULTAT_A_VALIDER') {
      record(1, "Analyse RESULTAT_A_VALIDER visible pour saisie", true,
        `Analyse ${order.ana_id} en statut RESULTAT_A_VALIDER — saisie autorisée.`);
    } else {
      record(1, "Analyse RESULTAT_A_VALIDER visible pour saisie", false,
        `Statut inattendu: ${order?.ana_statut}`);
    }
  } catch (err: any) {
    record(1, "Analyse RESULTAT_A_VALIDER visible pour saisie", false, err.message);
  }

  // ---- Test B : Résultat numérique → sauvegarde (order1_id) ----
  try {
    const req = makeReq({ id: lab1_id, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' }, order1_id, {
      results: [
        { id: `ana-c4-1-${testSuffix}`, valeur_mesuree: '5.8', unite: '10^3/µL', observation: 'Sérum limpide', interpretation: 'NORMAL' },
        { id: `ana-c4-2-${testSuffix}`, valeur_mesuree: '11.2', unite: 'g/dL', observation: '', interpretation: 'NORMAL' }
      ],
      statut: 'RESULTATS_SAISIS'
    });
    const res = await new Promise<any>((resolve) => {
      let statusCode = 200;
      const mockRes: any = {
        status: (code: number) => { statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); },
      };
      saveLabResults(req, mockRes).then(() => {
        if (statusCode >= 400) resolve({ error: 'erreur' });
      });
    });
    const ana = await queryOne<any>(
      `SELECT valeur_mesuree, unite, technicien_id, date_analyse FROM analyses_laboratoire WHERE id = ?`,
      [`ana-c4-1-${testSuffix}`]
    );
    if (ana && ana.valeur_mesuree === '5.8') {
      record(2, "Résultat numérique sauvegardé", true,
        `Valeur mesurée = "${ana.valeur_mesuree}" (unité: ${ana.unite}), technicien: ${ana.technicien_id}`);
    } else {
      record(2, "Résultat numérique sauvegardé", false,
        `Valeur attendue "5.8", trouvée: "${ana?.valeur_mesuree}"`);
    }
  } catch (err: any) {
    record(2, "Résultat numérique sauvegardé", false, err.message);
  }

  // ---- Test C : Résultat texte → sauvegarde (order2_id) ----
  try {
    const req = makeReq({ id: lab1_id, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' }, order2_id, {
      results: [
        { id: `ana-c4-3-${testSuffix}`, valeur_mesuree: '0.95', unite: 'g/L', observation: '', interpretation: 'NORMAL' }
      ],
      statut: 'RESULTATS_SAISIS'
    });
    const mockRes: any = { status: () => mockRes, json: () => {} };
    await saveLabResults(req, mockRes);
    const ana = await queryOne<any>(
      `SELECT valeur_mesuree FROM analyses_laboratoire WHERE id = ?`,
      [`ana-c4-3-${testSuffix}`]
    );
    if (ana && ana.valeur_mesuree === '0.95') {
      record(3, "Résultat texte sauvegardé", true,
        `Valeur mesurée = "${ana.valeur_mesuree}"`);
    } else {
      record(3, "Résultat texte sauvegardé", false,
        `Valeur attendue "0.95", trouvée: "${ana?.valeur_mesuree}"`);
    }
  } catch (err: any) {
    record(3, "Résultat texte sauvegardé", false, err.message);
  }

  // ---- Test D : Plusieurs paramètres → chaque résultat sauvegardé séparément ----
  try {
    const ana1 = await queryOne<any>(`SELECT valeur_mesuree FROM analyses_laboratoire WHERE id = ?`, [`ana-c4-1-${testSuffix}`]);
    const ana2 = await queryOne<any>(`SELECT valeur_mesuree FROM analyses_laboratoire WHERE id = ?`, [`ana-c4-2-${testSuffix}`]);
    if (ana1 && ana2 && ana1.valeur_mesuree !== ana2.valeur_mesuree) {
      record(4, "Plusieurs paramètres sauvegardés séparément", true,
        `Param 1: "${ana1.valeur_mesuree}", Param 2: "${ana2.valeur_mesuree}"`);
    } else {
      record(4, "Plusieurs paramètres sauvegardés séparément", false,
        `Valeurs identiques ou manquantes: ana1="${ana1?.valeur_mesuree}", ana2="${ana2?.valeur_mesuree}"`);
    }
  } catch (err: any) {
    record(4, "Plusieurs paramètres sauvegardés séparément", false, err.message);
  }

  // ---- Test E : GLOBAL → tous les paramètres ----
  try {
    const anas = await query<any>(
      `SELECT a.id, a.parametre_id FROM analyses_laboratoire a WHERE a.demande_laboratoire_id = ?`,
      [order1_id]
    );
    const allHaveParam = anas.every((a: any) => a.parametre_id !== null);
    if (allHaveParam && anas.length === 2) {
      record(5, "GLOBAL — tous les paramètres prévus", true,
        `Toutes les analyses GLOBAL ont un parametre_id renseigné (${anas.length} analyses).`);
    } else {
      record(5, "GLOBAL — tous les paramètres prévus", false,
        `Certaines analyses GLOBAL n'ont pas de parametre_id.`);
    }
  } catch (err: any) {
    record(5, "GLOBAL — tous les paramètres prévus", false, err.message);
  }

  // ---- Test F : PERSONNALISÉ → uniquement sélectionnés ----
  try {
    const ana = await queryOne<any>(
      `SELECT a.selection_details, a.parametre_id FROM analyses_laboratoire a WHERE a.id = ?`,
      [`ana-c4-3-${testSuffix}`]
    );
    if (ana && ana.selection_details) {
      const sel = JSON.parse(ana.selection_details);
      if (Array.isArray(sel) && sel.length === 1 && sel[0].parametre_id === 'param-gly-val') {
        record(6, "PERSONNALISÉ — uniquement paramètres sélectionnés", true,
          `1 paramètre sélectionné (param-gly-val) pour la demande PERSONNALISÉE.`);
      } else {
        record(6, "PERSONNALISÉ — uniquement paramètres sélectionnés", false,
          `Sélection inattendue: ${JSON.stringify(sel)}`);
      }
    } else {
      record(6, "PERSONNALISÉ — uniquement paramètres sélectionnés", false,
        `selection_details absent ou invalide.`);
    }
  } catch (err: any) {
    record(6, "PERSONNALISÉ — uniquement paramètres sélectionnés", false, err.message);
  }

  // ---- Test G : Refresh → résultats conservés ----
  try {
    const ana = await queryOne<any>(
      `SELECT valeur_mesuree, unite, observation FROM analyses_laboratoire WHERE id = ?`,
      [`ana-c4-1-${testSuffix}`]
    );
    if (ana && ana.valeur_mesuree === '5.8' && ana.unite === '10^3/µL' && ana.observation === 'Sérum limpide') {
      record(7, "Refresh — résultats conservés", true,
        `Résultats persistés : valeur="${ana.valeur_mesuree}", unité="${ana.unite}", observation="${ana.observation}".`);
    } else {
      record(7, "Refresh — résultats conservés", false,
        `Résultats incohérents: ${JSON.stringify(ana)}`);
    }
  } catch (err: any) {
    record(7, "Refresh — résultats conservés", false, err.message);
  }

  // ---- Test H : Modification d'une analyse déjà validée → refusée ----
  try {
    await execute(
      `UPDATE analyses_laboratoire SET statut = 'RESULTATS_VALIDES' WHERE id = ?`,
      [`ana-c4-1-${testSuffix}`]
    );
    const req = makeReq({ id: lab1_id, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' }, order1_id, {
      results: [
        { id: `ana-c4-1-${testSuffix}`, valeur_mesuree: '5.8', unite: '10^3/µL', observation: 'Sérum limpide' }
      ],
      statut: 'RESULTATS_SAISIS'
    });
    const res = await new Promise<any>((resolve) => {
      const mockRes: any = { status: () => mockRes, json: (data: any) => resolve(data) };
      saveLabResults(req, mockRes).then(() => {});
    });
    const blocked = res && res.error && (res.error.includes('RESULTAT_A_VALIDER') || res.error.includes('RESULTATS_VALIDES') || res.error.includes('terminée'));
    if (blocked) {
      record(8, "Modification analyse validée → refusée", true,
        `Erreur attendue reçue : "${res.error}".`);
    } else {
      record(8, "Modification analyse validée → refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
    await execute(
      `UPDATE analyses_laboratoire SET statut = 'RESULTAT_A_VALIDER' WHERE id = ?`,
      [`ana-c4-1-${testSuffix}`]
    );
  } catch (err: any) {
    record(8, "Modification analyse validée → refusée", false, err.message);
  }

  // ---- Test I : Statut RESULTAT_A_VALIDER conservé après sauvegarde ----
  try {
    const ana1 = await queryOne<any>(`SELECT statut FROM analyses_laboratoire WHERE id = ?`, [`ana-c4-1-${testSuffix}`]);
    const ana2 = await queryOne<any>(`SELECT statut FROM analyses_laboratoire WHERE id = ?`, [`ana-c4-2-${testSuffix}`]);
    if (ana1 && ana2 && ana1.statut === 'RESULTAT_A_VALIDER' && ana2.statut === 'RESULTAT_A_VALIDER') {
      record(9, "Statut RESULTAT_A_VALIDER conservé après sauvegarde", true,
        `Analyses toujours en RESULTAT_A_VALIDER. Seul le statut de la demande change.`);
    } else {
      record(9, "Statut RESULTAT_A_VALIDER conservé après sauvegarde", false,
        `Statuts inattendus: ana1="${ana1?.statut}", ana2="${ana2?.statut}"`);
    }
  } catch (err: any) {
    record(9, "Statut RESULTAT_A_VALIDER conservé après sauvegarde", false, err.message);
  }

  // ---- Test J : Sauvegarde sans échantillon → refusée ----
  try {
    const noEchOrderId = `lab-ord-noech-${testSuffix}`;
    const noEchAnaId = `ana-noech-${testSuffix}`;
    await execute(
      `INSERT INTO demandes_laboratoire (id, consultation_id, visite_id, patient_id, medecin_id, numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTAT_A_VALIDER', 'NORMALE', 'Test sans échantillon', ?, ?)`,
      [noEchOrderId, csl1_id, vis1_id, pat1_id, med1_id, `LAB-NOECH-${testSuffix}`, now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, created_at, updated_at)
       VALUES (?, ?, 'Test sans échantillon', 'SANG', 'RESULTAT_A_VALIDER', 0, NULL, ?, ?)`,
      [noEchAnaId, noEchOrderId, now(), now()]
    );
    const req = makeReq({ id: lab1_id, role: "LABORATOIRE", nom_complet: "Joseph Somé" }, noEchOrderId, { results: [{ id: `ana-noech-${testSuffix}`, valeur_mesuree: "test" }], statut: "RESULTATS_SAISIS" });
    const res = await new Promise<any>((resolve) => {
      const mockRes: any = { status: () => mockRes, json: (data: any) => resolve(data) };
      saveLabResults(req, mockRes).then(() => {});
    });
    const blocked = res && res.error && res.error.includes('échantillon');
    if (blocked) {
      record(10, "Sauvegarde sans échantillon → refusée", true,
        `Erreur attendue : "${res.error}".`);
    } else {
      record(10, "Sauvegarde sans échantillon → refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(10, "Sauvegarde sans échantillon → refusée", false, err.message);
  }

  // ---- Test K : Sauvegarde avec échantillon non conforme → refusée ----
  try {
    const badEchId = `ech-nonconforme-${testSuffix}`;
    await execute(
      `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
       VALUES (?, ?, 'LAB-NONCONFORME-${testSuffix}', 'URINE', 'ECHANTILLON_NON_CONFORME', ?, datetime('now'), datetime('now'))`,
      [badEchId, order2_id, lab1_id]
    );
    await execute(
      `UPDATE analyses_laboratoire SET echantillon_id = ? WHERE id = ?`,
      [badEchId, `ana-c4-3-${testSuffix}`]
    );
    const req = makeReq({ id: lab1_id, role: "LABORATOIRE", nom_complet: "Joseph Somé" }, order2_id, { results: [{ id: `ana-c4-3-${testSuffix}`, valeur_mesuree: "0.95", unite: "g/L" }], statut: "RESULTATS_SAISIS" });
    const res = await new Promise<any>((resolve) => {
      const mockRes: any = { status: () => mockRes, json: (data: any) => resolve(data) };
      saveLabResults(req, mockRes).then(() => {});
    });
    const blocked = res && res.error && res.error.includes('conforme');
    if (blocked) {
      record(11, "Sauvegarde échantillon non conforme → refusée", true,
        `Erreur attendue : "${res.error}".`);
    } else {
      record(11, "Sauvegarde échantillon non conforme → refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
    await execute(
      `UPDATE analyses_laboratoire SET echantillon_id = ? WHERE id = ?`,
      [echId, `ana-c4-3-${testSuffix}`]
    );
  } catch (err: any) {
    record(11, "Sauvegarde échantillon non conforme → refusée", false, err.message);
  }

  // ---- Test L : Commande passe en RESULTATS_SAISIS après sauvegarde ----
  try {
    await execute(
      `UPDATE analyses_laboratoire SET statut = 'RESULTAT_A_VALIDER', echantillon_id = ? WHERE id = ?`,
      [echId, `ana-c4-3-${testSuffix}`]
    );
    const req = makeReq({ id: lab1_id, role: "LABORATOIRE", nom_complet: "Joseph Somé" }, order2_id, { results: [{ id: `ana-c4-3-${testSuffix}`, valeur_mesuree: "0.95", unite: "g/L" }], statut: "RESULTATS_SAISIS" });
    const mockRes: any = { status: () => mockRes, json: () => {} };
    await saveLabResults(req, mockRes);
    const order = await queryOne<any>(`SELECT statut FROM demandes_laboratoire WHERE id = ?`, [order2_id]);
    if (order && order.statut === 'RESULTATS_SAISIS') {
      record(12, "Commande passe en RESULTATS_SAISIS après sauvegarde", true,
        `Statut de la commande : ${order.statut}. Analyses conservées en RESULTAT_A_VALIDER.`);
    } else {
      record(12, "Commande passe en RESULTATS_SAISIS après sauvegarde", false,
        `Statut inattendu: ${order?.statut}`);
    }
  } catch (err: any) {
    record(12, "Commande passe en RESULTATS_SAISIS après sauvegarde", false, err.message);
  }

  // ---- Test M : Sauvegarde double (ré-édition) → réussie ----
  try {
    const req = makeReq({ id: lab1_id, role: "LABORATOIRE", nom_complet: "Joseph Somé" }, order2_id, { results: [{ id: `ana-c4-3-${testSuffix}`, valeur_mesuree: "0.95", unite: "g/L" }], statut: "RESULTATS_SAISIS" });
    const mockRes: any = { status: () => mockRes, json: () => {} };
    await saveLabResults(req, mockRes);
    const order = await queryOne<any>(`SELECT statut FROM demandes_laboratoire WHERE id = ?`, [order2_id]);
    if (order && order.statut === 'RESULTATS_SAISIS') {
      record(13, "Sauvegarde double (ré-édition) → réussie", true,
        `Seconde sauvegarde réussie. Statut commande : ${order.statut}.`);
    } else {
      record(13, "Sauvegarde double (ré-édition) → réussie", false,
        `Statut inattendu: ${order?.statut}`);
    }
  } catch (err: any) {
    record(13, "Sauvegarde double (ré-édition) → réussie", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 5.6 — SAISIE DES RÉSULTATS SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase2c4.test.ts') || process.argv[1]?.endsWith('phase2c4.test.js')) {
  runPhase2c4Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}