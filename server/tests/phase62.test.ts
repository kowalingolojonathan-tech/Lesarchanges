/**
 * Tests — Phase 6.2 : Observation Médicale
 *
 * Couvre :
 * A. Observation créée depuis une consultation
 * B. Visibilité dans le dashboard du médecin responsable uniquement
 * C. Suivi et calcul de durée
 * D. Clôture de l'observation
 * E. Historique conservé après clôture
 * F. Aucun transfert automatique vers d'autres médecins
 * G. Impossible de mettre en observation une consultation finalisée
 */

import { query, queryOne, execute, transaction } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import {
  putPatientInObservation,
  getDoctorObservations,
  getObservationDetails,
  addObservationNote,
  closeObservation,
  getObservationHistory,
} from '../controllers/medicalController.js';

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

export async function runPhase62Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DES TESTS — PHASE 6.2 : OBSERVATION MÉDICALE');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);
  const med1_id = 'usr-med-01';
  const med2_id = 'usr-med-02';
  const pat1_id = `pat-62-${testSuffix}`;
  const vis1_id = `vis-62-${testSuffix}`;
  const csl1_id = `csl-62-${testSuffix}`;
  const vis2_id = `vis-62-2-${testSuffix}`;
  const csl2_id = `csl-62-2-${testSuffix}`;
  const now = () => new Date().toISOString();

  // Setup patient
  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'TSHIBANU', 'Marie', '1990-03-20', 'F', '0', '', '', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-62-${testSuffix}`]
  );

  // Setup visite 1 et consultation (pour test A, B, C, D, E)
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Douleur abdominale', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-62-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, conduite_a_tenir, histoire_maladie, examen_physique, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Douleur abdominale', 'Appendicite suspectée', 'Surveillance + imagerie', 'Patient presentant des douleurs abdominales', 'Abdomen souple, douleur quadrant droit', ?, ?, 1)`,
    [csl1_id, vis1_id, pat1_id, med1_id, now(), now()]
  );

  // Setup visite 2 et consultation finalisée (pour test G)
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'CLOTUREE', 'Suivi post-op', 'STANDARD', 1, datetime('now'))`,
    [vis2_id, `VIS-62-2-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, conduite_a_tenir, histoire_maladie, examen_physique, finalisee_le, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'FINALISEE', 'Suivi post-op', 'Post-appendicectomie', 'Contrôle à J7', 'Post-opératoire', 'Incision cicatrisée', ?, ?, ?, 1)`,
    [csl2_id, vis2_id, pat1_id, med1_id, now(), now(), now()]
  );

  // Helper
  function makeReq(user: any, params: any = {}, body: any = {}): any {
    return { user, params, body } as any;
  }

  function callPutInObs(consultationId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' }, {}, { consultation_id: consultationId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      putPatientInObservation(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetObs(userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getDoctorObservations(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetObsDetail(obsId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: obsId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getObservationDetails(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callAddNote(obsId: string, userId: string, noteText: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: obsId }, { note_texte: noteText });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      addObservationNote(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callCloseObs(obsId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: obsId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      closeObservation(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callHistory(userId: string, patientId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { patient_id: patientId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getObservationHistory(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  // ---- Test A : Observation créée depuis une consultation ----
  try {
    const res = await callPutInObs(csl1_id);
    if (res && !res.error && res.observation && res.observation.statut === 'EN_OBSERVATION') {
      const obs = res.observation;
      // Vérifier que la consultation a changé de statut
      const csl = await queryOne<any>(`SELECT statut FROM consultations WHERE id = ?`, [csl1_id]);
      if (csl && csl.statut === 'SUSPENDUE_EXAMENS') {
        record(1, "Observation créée depuis une consultation", true,
          `Observation ${obs.id} créée, statut=EN_OBSERVATION, consultation=${csl.statut}.`);
      } else {
        record(1, "Observation créée depuis une consultation", false,
          `Consultation statut=${csl?.statut} (attendu SUSPENDUE_EXAMENS)`);
      }
    } else {
      record(1, "Observation créée depuis une consultation", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(1, "Observation créée depuis une consultation", false, err.message);
  }

  // ---- Test B : Visibilité dans le dashboard du médecin responsable uniquement ----
  try {
    const resMed1 = await callGetObs(med1_id);
    const resMed2 = await callGetObs(med2_id);
    const obsCountMed1 = resMed1.observations?.length || 0;
    const obsCountMed2 = resMed2.observations?.length || 0;
    if (obsCountMed1 > 0 && obsCountMed2 === 0) {
      record(2, "Visibilité médecin responsable uniquement", true,
        `Dr1 voit ${obsCountMed1} observation(s), Dr2 en voit ${obsCountMed2}.`);
    } else {
      record(2, "Visibilité médecin responsable uniquement", false,
        `Dr1: ${obsCountMed1}, Dr2: ${obsCountMed2} (attendu Dr1>0, Dr2=0)`);
    }
  } catch (err: any) {
    record(2, "Visibilité médecin responsable uniquement", false, err.message);
  }

  // ---- Test C : Suivi et calcul de durée ----
  try {
    const obs = await queryOne<any>(`SELECT * FROM observations WHERE consultation_id = ?`, [csl1_id]);
    if (obs) {
      const noteRes = await callAddNote(obs.id, med1_id, 'Patient stable, constantes surveillées.');
      if (noteRes && !noteRes.error) {
        const detailRes = await callGetObsDetail(obs.id, med1_id);
        if (detailRes.observation && detailRes.observation.notes && detailRes.observation.notes.length > 0) {
          const dur = detailRes.observation.duree_total_minutes;
          if (dur !== undefined && dur >= 0) {
            record(3, "Suivi et calcul de durée", true,
              `Note ajoutée, durée=${dur} min, ${detailRes.observation.notes.length} note(s) dans l'historique.`);
          } else {
            record(3, "Suivi et calcul de durée", false,
              `Durée incohérente: ${dur}`);
          }
        } else {
          record(3, "Suivi et calcul de durée", false,
            `Aucune note récupérée dans le détail.`);
        }
      } else {
        record(3, "Suivi et calcul de durée", false,
          `Erreur ajout note: ${JSON.stringify(noteRes)}`);
      }
    } else {
      record(3, "Suivi et calcul de durée", false, "Observation introuvable");
    }
  } catch (err: any) {
    record(3, "Suivi et calcul de durée", false, err.message);
  }

  // ---- Test D : Clôture de l'observation ----
  try {
    const obs = await queryOne<any>(`SELECT * FROM observations WHERE consultation_id = ?`, [csl1_id]);
    if (obs) {
      const res = await callCloseObs(obs.id, med1_id);
      if (res && !res.error && res.observation && res.observation.statut === 'CLÔTURÉE') {
        const dur = res.observation.duree_total_minutes;
        record(4, "Clôture de l'observation", true,
          `Observation clôturée, statut=CLÔTURÉE, durée totale=${dur} min.`);
      } else {
        record(4, "Clôture de l'observation", false,
          `Résultat inattendu: ${JSON.stringify(res)}`);
      }
    } else {
      record(4, "Clôture de l'observation", false, "Observation introuvable");
    }
  } catch (err: any) {
    record(4, "Clôture de l'observation", false, err.message);
  }

  // ---- Test E : Historique conservé après clôture ----
  try {
    const hist = await callHistory(med1_id, pat1_id);
    const obsList = hist.observations || [];
    const closedObs = obsList.find((o: any) => o.statut === 'CLÔTURÉE');
    if (closedObs && closedObs.notes && closedObs.notes.length > 0) {
      record(5, "Historique conservé après clôture", true,
        `Observation clôturée conservée avec ${closedObs.notes.length} note(s) dans l'historique.`);
    } else {
      record(5, "Historique conservé après clôture", false,
        `Historique inexistant ou notes absentes: ${JSON.stringify(closedObs)}`);
    }
  } catch (err: any) {
    record(5, "Historique conservé après clôture", false, err.message);
  }

  // ---- Test F : Aucun transfert automatique vers d'autres médecins ----
  try {
    // Vérifier qu'aucune notification n'a été créée pour med2 liée à l'observation
    const notifCount = await queryOne<any>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND type = 'OBSERVATION'`,
      [med2_id]
    );
    if (notifCount && Number(notifCount.count) === 0) {
      record(6, "Aucun transfert automatique vers d'autres médecins", true,
        "Aucune notification créée pour le confrère.");
    } else {
      record(6, "Aucun transfert automatique vers d'autres médecins", false,
        `Notification indésirable trouvée: count=${notifCount?.count}`);
    }
  } catch (err: any) {
    record(6, "Aucun transfert automatique vers d'autres médecins", false, err.message);
  }

  // ---- Test G : Impossible de mettre en observation une consultation finalisée ----
  try {
    const res = await callPutInObs(csl2_id);
    if (res.error && res.error.includes('finalisée')) {
      record(7, "Impossible d'observer une consultation finalisée", true,
        `Erreur attendue reçue: "${res.error}".`);
    } else {
      record(7, "Impossible d'observer une consultation finalisée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(7, "Impossible d'observer une consultation finalisée", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 6.2 — OBSERVATION SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase62.test.ts') || process.argv[1]?.endsWith('phase62.test.js')) {
  runPhase62Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
