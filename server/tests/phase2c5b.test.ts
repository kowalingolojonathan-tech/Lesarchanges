/**
 * Suite de Tests Automatisés — PHASE 5.8 : BULLETIN DE RÉSULTATS ET TRANSMISSION AU MÉDECIN
 * Clinique Les Archanges
 *
 * Couvre :
 * A. Bulletin refusé/non définitif avant validation
 * B. Bulletin disponible après validation
 * C. GLOBAL affiche tous les résultats concernés
 * D. PERSONNALISÉ affiche uniquement les éléments sélectionnés
 * E. Médecin prescripteur peut consulter le résultat
 * F. Transmission/audit conservé
 * G. Résultats non modifiables depuis le bulletin
 * H. Données patient/dossier correctes
 * I. Page Laboratoire stable
 */

import { query, queryOne, execute, transaction } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { validateLabResults, saveLabResults, getLabBulletin, markLabOrderViewed } from '../controllers/medicalController.js';

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

export async function runPhase58Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DE LA SUITE DE TESTS — PHASE 5.8');
  console.log('  Bulletin de Résultats et Transmission au Médecin');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);

  const lab1_id = `usr-lab-c58-${testSuffix}`;
  const med1_id = `usr-med-c58-${testSuffix}`;
  const med2_id = `usr-med-c58-2-${testSuffix}`;
  const pat1_id = `pat-c58-${testSuffix}`;
  const vis1_id = `vis-c58-${testSuffix}`;
  const csl1_id = `csl-c58-${testSuffix}`;
  const csl2_id = `csl-c58-2-${testSuffix}`;
  const orderGlobalId = `lab-ord-c58-glob-${testSuffix}`;
  const orderPersoId = `lab-ord-c58-pers-${testSuffix}`;
  const orderNonValidId = `lab-ord-c58-nv-${testSuffix}`;
  const echId = `ech-c58-${testSuffix}`;
  const now = () => new Date().toISOString();

  // Setup users
  await execute(
    `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
     VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Dr. Test Médecin 2', 'MÉDECIN', 1, datetime('now'), datetime('now'))`,
    [med2_id, `testmed2.${testSuffix}`]
  );

  // Patients
  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'MUKENGE', 'Thérèse', '1988-09-20', 'F', '+243 83 00 00 01', 'Limete', 'B+', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-C58-${testSuffix}`]
  );

  // Visites
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Suivi biologique', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-C58-${testSuffix}`, pat1_id, med1_id]
  );

  // Consultations
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, examen_physique, diagnostic_principal, notes_confidentielles, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Suivi', 'Normal', 'Bilan de contrôle', '', datetime('now'), datetime('now'))`,
    [csl1_id, vis1_id, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, examen_physique, diagnostic_principal, notes_confidentielles, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Contrôle', 'Normal', 'Suivi', '', datetime('now'), datetime('now'))`,
    [csl2_id, vis1_id, pat1_id, med2_id]
  );

  // Échantillon conforme
  await execute(
    `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
     VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
    [echId, orderGlobalId, `LAB-C58-${testSuffix}`, lab1_id]
  );

  // ===== Commande GLOBAL avec 2 analyses, validées =====
  await transaction(async () => {
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, date_prelevement, preleve_par_id, result_entered_by, validated_by, validated_at, result_entered_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_VALIDES', 'NORMALE', 'Bilan NFS', datetime('now'), ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [orderGlobalId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-GLOB-${testSuffix}`, lab1_id, lab1_id, lab1_id, now(), lab1_id, now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, valeur_mesuree, unite, valeurs_reference, interpretation, observation, valide_par_id, date_validation, created_at, updated_at)
       VALUES (?, ?, 'NFS — Globules Blancs', 'SANG', 'RESULTATS_VALIDES', 0, ?, 'exam-nfs', 'GLOBAL', 'param-gb', '5.8', '10³/µL', '4.0 - 10.0', 'NORMAL', 'Sérum limpide', ?, ?, ?, ?)`,
      [`ana-c58-g1-${testSuffix}`, orderGlobalId, echId, lab1_id, now(), now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, valeur_mesuree, unite, valeurs_reference, interpretation, observation, valide_par_id, date_validation, created_at, updated_at)
       VALUES (?, ?, 'NFS — Hémoglobine', 'SANG', 'RESULTATS_VALIDES', 1, ?, 'exam-nfs', 'GLOBAL', 'param-hb', '13.5', 'g/dL', '12.0 - 16.5', 'NORMAL', '', ?, ?, ?, ?)`,
      [`ana-c58-g2-${testSuffix}`, orderGlobalId, echId, lab1_id, now(), now(), now()]
    );
  });

  // ===== Commande PERSONNALISÉ avec 1 analyse, validée =====
  await transaction(async () => {
    const echPersoId = `ech-c58-pers-${testSuffix}`;
    await execute(
      `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
       VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
      [echPersoId, orderPersoId, `LAB-PERS-${testSuffix}`, lab1_id]
    );
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, date_prelevement, preleve_par_id, result_entered_by, validated_by, validated_at, result_entered_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_VALIDES', 'NORMALE', 'Glycémie', datetime('now'), ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [orderPersoId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-PERS-${testSuffix}`, lab1_id, lab1_id, lab1_id, now(), lab1_id, now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, sous_parametre_id, selection_details, valeur_mesuree, unite, valeurs_reference, interpretation, valide_par_id, date_validation, created_at, updated_at)
       VALUES (?, ?, 'Glycémie à jeun', 'SANG', 'RESULTATS_VALIDES', 0, ?, 'exam-gly', 'PERSONNALISE', 'param-gly-val', NULL, '[{"parametre_id":"param-gly-val","sous_parametre_id":null}]', '0.95', 'g/L', '0.70 - 1.10', 'NORMAL', ?, ?, ?, ?)`,
      [`ana-c58-p1-${testSuffix}`, orderPersoId, echPersoId, lab1_id, now(), now(), now()]
    );
  });

  // ===== Commande NON VALIDÉE (RESULTATS_SAISIS) =====
  await transaction(async () => {
    const echNvId = `ech-c58-nv-${testSuffix}`;
    await execute(
      `INSERT INTO echantillons_laboratoire (id, demande_id, code_barre, nature_prelevement, statut, preleve_par_id, date_prelevement, date_reception)
       VALUES (?, ?, ?, 'SANG', 'ECHANTILLON_RECU', ?, datetime('now'), datetime('now'))`,
      [echNvId, orderNonValidId, `LAB-NV-${testSuffix}`, lab1_id]
    );
    await execute(
      `INSERT INTO demandes_laboratoire (
        id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id,
        numero_demande, date_demande, statut, urgence, indication_clinique, date_prelevement, preleve_par_id, result_entered_by, result_entered_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'RESULTATS_SAISIS', 'NORMALE', 'Test non validé', datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))`,
      [orderNonValidId, csl1_id, vis1_id, pat1_id, med1_id, lab1_id, `LAB-NV-${testSuffix}`, lab1_id, lab1_id, now(), now(), now()]
    );
    await execute(
      `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, echantillon_id, examen_id, mode, parametre_id, valeur_mesuree, unite, interpretation, created_at, updated_at)
       VALUES (?, ?, 'Analyse B', 'SANG', 'RESULTAT_A_VALIDER', 0, ?, 'exam-nfs', 'GLOBAL', 'param-b', '3.2', 'UI/L', 'NORMAL', ?, ?)`,
      [`ana-c58-nv1-${testSuffix}`, orderNonValidId, echNvId, now(), now()]
    );
  });

  // Helpers
  function makeReq(user: any, orderId: string): any {
    return { user, params: { id: orderId }, body: {} } as any;
  }

  function callGetBulletin(orderId: string, userId: string, userRole: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: userRole, nom_complet: 'Dr. Test' }, orderId);
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getLabBulletin(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callMarkViewed(orderId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, orderId);
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      markLabOrderViewed(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  // ---- Test A : Bulletin refusé avant validation ----
  try {
    const res = await callGetBulletin(orderNonValidId, lab1_id, 'LABORATOIRE');
    if (res.error && res.error.includes('validés')) {
      record(1, "Bulletin refusé/non définitif avant validation", true,
        `Erreur reçue : "${res.error}".`);
    } else {
      record(1, "Bulletin refusé/non définitif avant validation", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(1, "Bulletin refusé/non définitif avant validation", false, err.message);
  }

  // ---- Test B : Bulletin disponible après validation ----
  try {
    const res = await callGetBulletin(orderGlobalId, lab1_id, 'LABORATOIRE');
    if (res && !res.error && res.bulletin && res.bulletin.patient) {
      record(2, "Bulletin disponible après validation", true,
        `Bulletin récupéré. Patient: ${res.bulletin.patient.nom} ${res.bulletin.patient.prenom}.`);
    } else {
      record(2, "Bulletin disponible après validation", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(2, "Bulletin disponible après validation", false, err.message);
  }

  // ---- Test C : GLOBAL affiche tous les résultats concernés ----
  try {
    const res = await callGetBulletin(orderGlobalId, lab1_id, 'LABORATOIRE');
    if (res && res.bulletin && res.bulletin.analyses) {
      const anas = res.bulletin.analyses;
      const allHaveResults = anas.every((a: any) => a.valeur_mesuree && a.valeur_mesuree.trim().length > 0);
      if (anas.length === 2 && allHaveResults) {
        record(3, "GLOBAL affiche tous les résultats concernés", true,
          `2 analyses affichées avec résultats (${anas.map((a: any) => a.valeur_mesuree).join(', ')}).`);
      } else {
        record(3, "GLOBAL affiche tous les résultats concernés", false,
          `Nombre ou valeurs incohérents: ${JSON.stringify(anas.map((a: any) => ({ v: a.valeur_mesuree })))}`);
      }
    } else {
      record(3, "GLOBAL affiche tous les résultats concernés", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(3, "GLOBAL affiche tous les résultats concernés", false, err.message);
  }

  // ---- Test D : PERSONNALISÉ affiche uniquement les paramètres sélectionnés ----
  try {
    const res = await callGetBulletin(orderPersoId, lab1_id, 'LABORATOIRE');
    if (res && res.bulletin && res.bulletin.analyses) {
      const anas = res.bulletin.analyses;
      if (anas.length === 1 && anas[0].valeur_mesuree === '0.95') {
        record(4, "PERSONNALISÉ affiche uniquement les paramètres sélectionnés", true,
          `1 analyse affichée (glycémie: 0.95 g/L).`);
      } else {
        record(4, "PERSONNALISÉ affiche uniquement les paramètres sélectionnés", false,
          `Résultat incohérent: ${JSON.stringify(anas.map((a: any) => ({ v: a.valeur_mesuree, n: a.nom_analyse })))}`);
      }
    } else {
      record(4, "PERSONNALISÉ affiche uniquement les paramètres sélectionnés", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(4, "PERSONNALISÉ affiche uniquement les paramètres sélectionnés", false, err.message);
  }

  // ---- Test E : Médecin prescripteur peut consulter le résultat ----
  try {
    const res = await callGetBulletin(orderGlobalId, med1_id, 'MÉDECIN');
    if (res && !res.error && res.bulletin && res.bulletin.patient) {
      // Vérifier que c'est bien son patient
      if (res.bulletin.patient.numero_dossier && res.bulletin.prescripteur.nom) {
        record(5, "Médecin prescripteur peut consulter le résultat", true,
          `Dr. ${res.bulletin.prescripteur.nom} accède au bulletin. Patient: ${res.bulletin.patient.nom}.`);
      } else {
        record(5, "Médecin prescripteur peut consulter le résultat", false,
          `Données manquantes dans le bulletin.`);
      }
    } else {
      record(5, "Médecin prescripteur peut consulter le résultat", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(5, "Médecin prescripteur peut consulter le résultat", false, err.message);
  }

  // ---- Test F : Transmission/audit conservé ----
  try {
    // Vérifier que la notification existe
    const notif = await queryOne<any>(
      `SELECT id FROM notifications WHERE lab_order_id = ? AND type = 'LAB_RESULTS_READY'`,
      [orderGlobalId]
    );
    if (notif) {
      // Vérifier l'audit log
      const audit = await queryOne<any>(
        `SELECT id FROM audit_logs WHERE ressource_id = ? AND action = 'LAB_RESULT_VALIDATED'`,
        [orderGlobalId]
      );
      if (audit) {
        record(6, "Transmission/audit conservé", true,
          `Notification LAB_RESULTS_READY existante et audit LAB_RESULT_VALIDATED présent.`);
      } else {
        record(6, "Transmission/audit conservé", false,
          `Audit log LAB_RESULT_VALIDATED introuvable.`);
      }
    } else {
      record(6, "Transmission/audit conservé", false,
        `Notification LAB_RESULTS_READY introuvable.`);
    }
  } catch (err: any) {
    record(6, "Transmission/audit conservé", false, err.message);
  }

  // ---- Test G : Résultats non modifiables depuis le bulletin ----
  try {
    // Le bulletin est en lecture seule — on vérifie que l'API de modification (saveLabResults) refuse
    const saveRes = await new Promise<any>((resolve) => {
      const req = {
        user: { id: lab1_id, role: 'LABORATOIRE', nom_complet: 'Joseph Somé' },
        params: { id: orderGlobalId },
        body: { results: [{ id: `ana-c58-g1-${testSuffix}`, valeur_mesuree: '999' }] }
      } as any;
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      saveLabResults(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
    if (saveRes.error && saveRes.error.includes('déjà été validée')) {
      record(7, "Résultats non modifiables depuis le bulletin", true,
        `Sauvegarde bloquée : "${saveRes.error}".`);
    } else {
      record(7, "Résultats non modifiables depuis le bulletin", false,
        `Résultat inattendu: ${JSON.stringify(saveRes)}`);
    }
  } catch (err: any) {
    record(7, "Résultats non modifiables depuis le bulletin", false, err.message);
  }

  // ---- Test H : Données patient/dossier correctes ----
  try {
    const res = await callGetBulletin(orderGlobalId, lab1_id, 'LABORATOIRE');
    if (res && res.bulletin) {
      const b = res.bulletin;
      const docCorrect = b.patient.numero_dossier === `DOS-C58-${testSuffix}`;
      const nomCorrect = b.patient.nom === 'MUKENGE';
      const prenomCorrect = b.patient.prenom === 'Thérèse';
      const ageNonNull = b.patient.age !== null && b.patient.age >= 0;
      if (docCorrect && nomCorrect && prenomCorrect && ageNonNull) {
        record(8, "Données patient/dossier correctes", true,
          `Patient: ${b.patient.nom} ${b.patient.prenom}, Dossier: ${b.patient.numero_dossier}, Âge: ${b.patient.age} ans.`);
      } else {
        record(8, "Données patient/dossier correctes", false,
          `Incohérences: nom=${nomCorrect}, prenom=${prenomCorrect}, dossier=${docCorrect}, age=${ageNonNull}`);
      }
    } else {
      record(8, "Données patient/dossier correctes", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(8, "Données patient/dossier correctes", false, err.message);
  }

  // ---- Test I : Page Laboratoire stable — ordonnance statuts cohérente ----
  try {
    const orders = await query<any>(
      `SELECT id, statut FROM demandes_laboratoire WHERE id IN (?, ?, ?)`,
      [orderGlobalId, orderPersoId, orderNonValidId]
    );
    const globalStatut = orders.find((o: any) => o.id === orderGlobalId)?.statut;
    const persoStatut = orders.find((o: any) => o.id === orderPersoId)?.statut;
    const nvStatut = orders.find((o: any) => o.id === orderNonValidId)?.statut;

    if (globalStatut === 'RESULTATS_VALIDES' && persoStatut === 'RESULTATS_VALIDES' && nvStatut === 'RESULTATS_SAISIS') {
      record(9, "Page Laboratoire stable — ordonnance statuts cohérente", true,
        `GLOBAL=RESULTATS_VALIDES, PERSO=RESULTATS_VALIDES, NON_VALIDÉ=RESULTATS_SAISIS.`);
    } else {
      record(9, "Page Laboratoire stable — ordonnance statuts cohérente", false,
        `Stats: GLOBAL=${globalStatut}, PERSO=${persoStatut}, NV=${nvStatut}`);
    }
  } catch (err: any) {
    record(9, "Page Laboratoire stable — ordonnance statuts cohérente", false, err.message);
  }

  // ---- Test J : Médecin non prescripteur ne peut pas consulter le bulletin ----
  try {
    const res = await callGetBulletin(orderGlobalId, med2_id, 'MÉDECIN');
    if (res.error && res.error.includes('confrère')) {
      record(10, "Médecin non prescripteur refusé", true,
        `Erreur reçue : "${res.error}".`);
    } else {
      record(10, "Médecin non prescripteur refusé", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(10, "Médecin non prescripteur refusé", false, err.message);
  }

  // ---- Test K : Code-barres présent dans le bulletin ----
  try {
    const res = await callGetBulletin(orderGlobalId, lab1_id, 'LABORATOIRE');
    if (res && res.bulletin && res.bulletin.analyses && res.bulletin.analyses[0]?.code_barre) {
      record(11, "Code-barres présent dans le bulletin", true,
        `Code-barres trouvé : ${res.bulletin.analyses[0].code_barre}.`);
    } else {
      record(11, "Code-barres présent dans le bulletin", false,
        `Code-barres absent ou incohérent dans le bulletin.`);
    }
  } catch (err: any) {
    record(11, "Code-barres présent dans le bulletin", false, err.message);
  }

  // ---- Test L : Marquage comme vu par le médecin ----
  try {
    const res = await callMarkViewed(orderGlobalId, med1_id);
    if (res && res.success) {
      const viewed = await queryOne<any>(
        `SELECT vu_par_medecin_le FROM demandes_laboratoire WHERE id = ?`,
        [orderGlobalId]
      );
      if (viewed && viewed.vu_par_medecin_le) {
        record(12, "Marquage comme vu par le médecin", true,
          `Demande marquée comme vue. vu_par_medecin_le = ${viewed.vu_par_medecin_le}.`);
      } else {
        record(12, "Marquage comme vu par le médecin", false,
          `Champ vu_par_medecin_le non renseigné.`);
      }
    } else {
      record(12, "Marquage comme vu par le médecin", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(12, "Marquage comme vu par le médecin", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 5.8 — BULLETIN SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase2c5b.test.ts') || process.argv[1]?.endsWith('phase2c5b.test.js')) {
  runPhase58Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
