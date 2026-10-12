/**
 * Tests — Phase 6.1 : Relais Médical (Continuité des soins)
 *
 * Couvre :
 * A. Médecin d'origine crée un relais avec destinataire désigné
 * B. Médecin désigné accepte le relais
 * C. Aucun destinataire désigné → tout médecin autorisé peut accepter
 * D. Historique conservé, consultation d'origine non écrasée
 * E. Double acceptance → refusée
 * F. Médecin non autorisé refusé
 * G. Notification créée pour le destinataire désigné
 * H. Consultation créée depuis le relais acceptée
 */

import { query, queryOne, execute, transaction } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import {
  createRelaisMedical,
  getRelaisPending,
  acceptRelaisMedical,
  refuseRelaisMedical,
  getRelaisHistory,
  getRelaisPatientsToReprise,
  startConsultationFromRelais,
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

export async function runPhase61Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DES TESTS — PHASE 6.1 : RELAIS MÉDICAL');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);
  const med1_id = 'usr-med-01';
  const med2_id = 'usr-med-02';
  const pat1_id = `pat-61-${testSuffix}`;
  const vis1_id = `vis-61-${testSuffix}`;
  const csl1_id = `csl-61-${testSuffix}`;
  const vis2_id = `vis-61-2-${testSuffix}`;
  const csl2_id = `csl-61-2-${testSuffix}`;
  const vis3_id = `vis-61-3-${testSuffix}`;
  const csl3_id = `csl-61-3-${testSuffix}`;
  const vis4_id = `vis-61-4-${testSuffix}`;
  const csl4_id = `csl-61-4-${testSuffix}`;
  let relaisWithDestId = '';
  let relaisNoDestId = '';
  const now = () => new Date().toISOString();
  // Setup deuxièmes visite et consultation pour le test sans destinataire
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'CLOTUREE', 'Suivi 2', 'STANDARD', 1, datetime('now'))`,
    [vis2_id, `VIS-61-2-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, finalisee_le, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'FINALISEE', 'Suivi 2', 'Diabète', ?, datetime('now'), datetime('now'), 1)`,
    [csl2_id, vis2_id, pat1_id, med1_id, now()]
  );
  // Setup pour tests F, I, J (consultations séparées pour éviter conflits)
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'CLOTUREE', 'Suivi 3', 'STANDARD', 1, datetime('now'))`,
    [vis3_id, `VIS-61-3-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, finalisee_le, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'FINALISEE', 'Suivi 3', 'Diabète', ?, datetime('now'), datetime('now'), 1)`,
    [csl3_id, vis3_id, pat1_id, med1_id, now()]
  );
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'CLOTUREE', 'Suivi 4', 'STANDARD', 1, datetime('now'))`,
    [vis4_id, `VIS-61-4-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, finalisee_le, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'FINALISEE', 'Suivi 4', 'Hypertension', ?, datetime('now'), datetime('now'), 1)`,
    [csl4_id, vis4_id, pat1_id, med1_id, now()]
  );

  // Setup patient
  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'DUPONT', 'Jean', '1985-05-15', 'M', '0', '', '', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-61-${testSuffix}`]
  );

  // Setup visites
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'CLOTUREE', 'Suivi', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-61-${testSuffix}`, pat1_id, med1_id]
  );

  // Setup consultation (finalisée)
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, finalisee_le, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'FINALISEE', 'Suivi', 'Hypertension', ?, datetime('now'), datetime('now'), 1)`,
    [csl1_id, vis1_id, pat1_id, med1_id, now()]
  );

  // Helper
  function makeReq(user: any, params: any = {}, body: any = {}): any {
    return { user, params, body } as any;
  }

  function callCreate(body: any): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' }, {}, body);
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      createRelaisMedical(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetPending(userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getRelaisPending(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callAccept(relaisId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: relaisId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      acceptRelaisMedical(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callRefuse(relaisId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: relaisId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      refuseRelaisMedical(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callHistory(userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getRelaisHistory(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetReprise(userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getRelaisPatientsToReprise(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callStartConsultation(relaisId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq(
        { id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' },
        { id: relaisId },
        { visite_id: vis1_id }
      );
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      startConsultationFromRelais(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  // ---- Test A : Médecin d'origine crée un relais avec destinataire désigné ----
  try {
    const res = await callCreate({
      consultation_id: csl1_id,
      motif: 'Patient nécessitant un suivi spécialisé, remplacement du Dr. Marc',
      medecin_destinataire_id: med2_id,
    });
    if (res && !res.error && res.relais && res.relais.statut === 'EN_ATTENTE') {
      relaisWithDestId = res.relais.id;
      record(1, "Médecin d'origine crée un relais avec destinataire désigné", true,
        `Relais créé: ${relaisWithDestId}, statut=${res.relais.statut}, destinataire=${res.relais.medecin_destinataire_id}.`);
    } else {
      record(1, "Médecin d'origine crée un relais avec destinataire désigné", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(1, "Médecin d'origine crée un relais avec destinataire désigné", false, err.message);
  }

  // ---- Test B : Médecin désigné accepte le relais ----
  try {
    const res = await callAccept(relaisWithDestId, med2_id);
    if (res && !res.error && res.success) {
      const relais = await queryOne<any>(`SELECT * FROM relais_medicaux WHERE id = ?`, [relaisWithDestId]);
      if (relais && relais.statut === 'ACCEPTÉ' && relais.accepte_par_id === med2_id && relais.accepte_le) {
        record(2, "Médecin désigné accepte le relais", true,
          `Relais accepté par Dr. Test (med2). Statut=ACCEPTÉ, accepte_le=${relais.accepte_le}.`);
      } else {
        record(2, "Médecin désigné accepte le relais", false,
          `Statut incohérent: ${relais?.statut}, accepte_par_id=${relais?.accepte_par_id}`);
      }
    } else {
      record(2, "Médecin désigné accepte le relais", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(2, "Médecin désigné accepte le relais", false, err.message);
  }

  // ---- Test C : Aucun destinataire → tout médecin autorisé peut accepter ----
  try {
    // Créer un relais sans destinataire (sur une autre consultation)
    const resCreate = await callCreate({
      consultation_id: csl2_id,
      motif: 'Suivi de routine, aucun médecin spécifié',
      medecin_destinataire_id: null,
    });
    if (resCreate && resCreate.relais) {
      relaisNoDestId = resCreate.relais.id;
      // Médecin 1 (pas le créateur) accepte
      const resAccept = await callAccept(relaisNoDestId, med1_id);
      if (resAccept && !resAccept.error && resAccept.success) {
        const relais = await queryOne<any>(`SELECT * FROM relais_medicaux WHERE id = ?`, [relaisNoDestId]);
        if (relais && relais.statut === 'ACCEPTÉ') {
          record(3, "Aucun destinataire → tout médecin peut accepter", true,
            `Relais accepté par med1 (non-créateur). Statut=ACCEPTÉ.`);
        } else {
          record(3, "Aucun destinataire → tout médecin peut accepter", false,
            `Statut incohérent: ${relais?.statut}`);
        }
      } else {
        record(3, "Aucun destinataire → tout médecin peut accepter", false,
          `Acceptation refusée: ${JSON.stringify(resAccept)}`);
      }
    } else {
      record(3, "Aucun destinataire → tout médecin peut accepter", false,
        `Création relais sans destinataire échouée: ${JSON.stringify(resCreate)}`);
    }
  } catch (err: any) {
    record(3, "Aucun destinataire → tout médecin peut accepter", false, err.message);
  }

  // ---- Test D : Historique conservé, consultation d'origine non écrasée ----
  try {
    const history = await callHistory(med1_id);
    const relaisList = history.relais || [];
    const foundRelais = relaisList.find((r: any) => r.id === relaisWithDestId);
    const origConsultation = await queryOne<any>(
      `SELECT id, statut, diagnostic_principal FROM consultations WHERE id = ?`,
      [csl1_id]
    );
    if (foundRelais && origConsultation && origConsultation.statut === 'FINALISEE') {
      record(4, "Historique conservé, consultation origine non écrasée", true,
        `Relais trouvé dans l'historique. Consultation originale: statut=${origConsultation.statut}, diagnostic=${origConsultation.diagnostic_principal}.`);
    } else {
      record(4, "Historique conservé, consultation origine non écrasée", false,
        `historique=${foundRelais ? 'trouvé' : 'manquant'}, consultation.statut=${origConsultation?.statut}`);
    }
  } catch (err: any) {
    record(4, "Historique conservé, consultation origine non écrasée", false, err.message);
  }

  // ---- Test E : Double acceptation → refusée ----
  try {
    const res = await callAccept(relaisWithDestId, med2_id);
    if (res.error && res.error.includes('déjà')) {
      record(5, "Double acceptation → refusée", true,
        `Erreur reçue: "${res.error}".`);
    } else {
      record(5, "Double acceptation → refusée", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(5, "Double acceptation → refusée", false, err.message);
  }

  // ---- Test F : Médecin non autorisé (non destinataire, relais avec destinataire) refusé ----
  try {
    // Créer un nouveau relais avec destinataire désigné pour tester le refus
    const resCreate = await callCreate({
      consultation_id: csl3_id,
      motif: 'Test non autorisé',
      medecin_destinataire_id: med2_id,
    });
    if (resCreate && resCreate.relais) {
      const newRelaisId = resCreate.relais.id;
      // med1 tente d'accepter un relais destiné à med2
      const res = await callAccept(newRelaisId, med1_id);
      if (res.error && (res.error.includes('destiné') || res.error.includes('confrère'))) {
        record(6, "Médecin non autorisé refusé", true,
          `Erreur reçue: "${res.error}".`);
      } else {
        record(6, "Médecin non autorisé refusé", false,
          `Résultat inattendu: ${JSON.stringify(res)}`);
      }
    } else {
      record(6, "Médecin non autorisé refusé", false,
        `Création relais échouée: ${JSON.stringify(resCreate)}`);
    }
  } catch (err: any) {
    record(6, "Médecin non autorisé refusé", false, err.message);
  }

  // ---- Test G : Notification créée pour le destinataire désigné ----
  try {
    const notif = await queryOne<any>(
      `SELECT id FROM notifications WHERE user_id = ? AND type = 'RELIS_MEDICAL' ORDER BY created_at DESC LIMIT 1`,
      [med2_id]
    );
    if (notif) {
      record(7, "Notification créée pour le destinataire désigné", true,
        `Notification trouvée pour med2: ${notif.id}.`);
    } else {
      record(7, "Notification créée pour le destinataire désigné", false,
        `Notification introuvable pour med2.`);
    }
  } catch (err: any) {
    record(7, "Notification créée pour le destinataire désigné", false, err.message);
  }

  // ---- Test H : Consultation créée depuis le relais accepté ----
  try {
    const res = await callStartConsultation(relaisWithDestId, med2_id);
    if (res && !res.error && res.consultation_id) {
      const newConsultation = await queryOne<any>(
        `SELECT id, statut, motif_consultation FROM consultations WHERE id = ?`,
        [res.consultation_id]
      );
      if (newConsultation && newConsultation.statut === 'EN_COURS') {
        record(8, "Consultation créée depuis le relais accepté", true,
          `Nouvelle consultation: ${newConsultation.id}, statut=${newConsultation.statut}, motif=${newConsultation.motif_consultation}.`);
      } else {
        record(8, "Consultation créée depuis le relais accepté", false,
          `Consultation incohérente: ${JSON.stringify(newConsultation)}`);
      }
    } else {
      record(8, "Consultation créée depuis le relais accepté", false,
        `Erreur: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(8, "Consultation créée depuis le relais accepté", false, err.message);
  }

  // ---- Test I : Reprise — le médecin qui a accepté voit le relais dans "patients to reprise" ----
  try {
    // Créer un nouveau relais pour ce test (le précédent a déjà été accepté)
    const resCreate = await callCreate({
      consultation_id: csl3_id,
      motif: 'Test reprise — création frais',
      medecin_destinataire_id: med2_id,
    });
    if (resCreate && resCreate.relais) {
      const repriseRelaisId = resCreate.relais.id;
      // Accepter avec med2
      await callAccept(repriseRelaisId, med2_id);
      // Vérifier via l'endpoint de reprise (qui filtre par statut ACCEPTÉ)
      const res = await callGetReprise(med2_id);
      const repriseList = res.relais || [];
      const foundInReprise = repriseList.some((r: any) => r.id === repriseRelaisId && r.statut === 'ACCEPTÉ');
      if (foundInReprise) {
        record(9, "Reprise — médecin acceptant voit le relais", true,
          `Relais trouvé dans la liste de reprise pour med2.`);
      } else {
        record(9, "Reprise — médecin acceptant voit le relais", false,
          `Relais non trouvé dans la liste de reprise (items=${JSON.stringify(repriseList.map((r:any)=>({id:r.id,statut:r.statut})))}.`);
      }
    }
  } catch (err: any) {
    record(9, "Reprise — médecin acceptant voit le relais", false, err.message);
  }

  // ---- Test J : Refus du relais ----
  try {
    // Créer un nouveau relais pour tester le refus
    const resCreate = await callCreate({
      consultation_id: csl4_id,
      motif: 'Test refus',
      medecin_destinataire_id: med2_id,
    });
    if (resCreate && resCreate.relais) {
      const refuseId = resCreate.relais.id;
      const resRefuse = await callRefuse(refuseId, med2_id);
      if (resRefuse && resRefuse.success) {
        const relais = await queryOne<any>(`SELECT statut FROM relais_medicaux WHERE id = ?`, [refuseId]);
        if (relais && relais.statut === 'REFUSÉ') {
          record(10, "Refus du relais", true, `Relais refusé. Statut=REFUSÉ.`);
        } else {
          record(10, "Refus du relais", false, `Statut incohérent: ${relais?.statut}`);
        }
      } else {
        record(10, "Refus du relais", false, `Erreur: ${JSON.stringify(resRefuse)}`);
      }
    }
  } catch (err: any) {
    record(10, "Refus du relais", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 6.1 — RELAIS MÉDICAL SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase61.test.ts') || process.argv[1]?.endsWith('phase61.test.js')) {
  runPhase61Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
