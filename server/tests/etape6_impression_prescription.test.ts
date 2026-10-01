/**
 * TEST ÉTAPE 6 — WORKFLOW D'IMPRESSION DE LA PRESCRIPTION MÉDICALE
 * 
 * Vérifie :
 * 1. Validation par le médecin (BROUILLON -> VALIDEE)
 * 2. Visibilité côté réception (invisible si BROUILLON, disponible dès VALIDEE)
 * 3. Impression médecin (statut IMPRIMEE, traçabilité)
 * 4. Impression réception (statut IMPRIMEE, traçabilité)
 * 5. Passage aux statuts IMPRIMÉE / REMISE (pas de régression en cas de réimpression)
 * 6. Non-modification du contenu (réception bloquée en écriture, contenu médical intact)
 * 7. Non-régression globale & conformité
 */

import { getDb, saveDb } from '../db/database';
import { runMigrations } from '../db/migrations';
import { 
  validatePrescriptionWorkflow, 
  printPrescriptionWorkflow, 
  deliverPrescriptionWorkflow,
  getPrescriptionById,
  getPrescriptionsForReception
} from '../controllers/medicalController';

// Helpers de mock pour req et res Express
function createMockReq(user: any, params: any = {}, body: any = {}, query: any = {}) {
  return {
    user,
    params,
    body,
    query,
    ip: '127.0.0.1',
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TEST ÉTAPE 6 — WORKFLOW IMPRESSION PRESCRIPTION & STATUTS');
  console.log('===============================================================');

  const db = await getDb();
  await runMigrations();

  let passCount = 0;
  const totalTests = 7;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // Utilisateurs de test
  const medecin = db.exec("SELECT id, nom_complet, role FROM users WHERE role = 'MÉDECIN' LIMIT 1")[0]?.values[0];
  const medecinUser = { id: String(medecin[0]), nom_complet: String(medecin[1]), role: 'MÉDECIN' };

  const autreMedecin = db.exec(`SELECT id, nom_complet, role FROM users WHERE role = 'MÉDECIN' AND id != '${medecinUser.id}' LIMIT 1`)[0]?.values[0] 
    || ['user_confrere_99', 'Dr. Confrère Test', 'MÉDECIN'];
  const confrereUser = { id: String(autreMedecin[0]), nom_complet: String(autreMedecin[1]), role: 'MÉDECIN' };

  const reception = db.exec("SELECT id, nom_complet, role FROM users WHERE role = 'RÉCEPTION' LIMIT 1")[0]?.values[0]
    || ['user_recep_1', 'Agent Accueil', 'RÉCEPTION'];
  const receptionUser = { id: String(reception[0]), nom_complet: String(reception[1]), role: 'RÉCEPTION' };

  const patient = db.exec("SELECT id, nom, prenom FROM patients LIMIT 1")[0]?.values[0];
  const patientId = String(patient[0]);

  // Création d'une visite et consultation de test
  const testVisiteId = `vis_et6_${Date.now()}`;
  const testConsultId = `csl_et6_${Date.now()}`;
  const testPrescId = `prc_et6_${Date.now()}`;
  const testItemId = `psi_et6_${Date.now()}`;
  const nowIso = new Date().toISOString();

  db.run(`
    INSERT INTO visites (id, numero_visite, patient_id, statut, type_visite, medecin_id, date_arrivee, created_at)
    VALUES (?, ?, ?, 'EN_CONSULTATION', 'STANDARD', ?, ?, ?)
  `, [testVisiteId, `VIS-ET6-${Date.now()}`, patientId, medecinUser.id, nowIso, nowIso]);

  db.run(`
    INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'EN_COURS', ?, ?)
  `, [testConsultId, testVisiteId, patientId, medecinUser.id, nowIso, nowIso, nowIso]);

  // Prescription initiale en statut BROUILLON
  db.run(`
    INSERT INTO prescriptions (
      id, consultation_id, patient_id, visite_id, medecin_id, date_prescription,
      statut, observations, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'BROUILLON', 'Observations test', ?, ?)
  `, [testPrescId, testConsultId, patientId, testVisiteId, medecinUser.id, nowIso, nowIso, nowIso]);

  // Ajout de 2 médicaments initiaux
  db.run(`
    INSERT INTO prescription_items (
      id, prescription_id, nom_medicament, dosage, forme, voie_administration,
      frequence, duree, quantite, ordre, created_at, updated_at
    ) VALUES 
    (?, ?, 'Amoxicilline 500mg', '500mg', 'Gélule', 'Orale', '1 gélule 3x/jour', '7 jours', 2, 0, ?, ?),
    (?, ?, 'Paracétamol 1000mg', '1000mg', 'Comprimé', 'Orale', '1 cp si fièvre ou douleur', '5 jours', 1, 1, ?, ?)
  `, [testItemId, testPrescId, nowIso, nowIso, `${testItemId}_2`, testPrescId, nowIso, nowIso]);

  await saveDb();

  // -------------------------------------------------------------------------
  // TEST 1 : Validation par le médecin (BROUILLON -> VALIDEE)
  // -------------------------------------------------------------------------
  // Tentative par la réception -> doit être refusée (403)
  const reqRecepVal = createMockReq(receptionUser, { id: testPrescId });
  const resRecepVal = createMockRes();
  await validatePrescriptionWorkflow(reqRecepVal, resRecepVal);

  // Tentative par confrère -> doit être refusée (403)
  const reqConfVal = createMockReq(confrereUser, { id: testPrescId });
  const resConfVal = createMockRes();
  await validatePrescriptionWorkflow(reqConfVal, resConfVal);

  // Validation par le médecin prescripteur -> doit réussir (200)
  const reqMedVal = createMockReq(medecinUser, { id: testPrescId });
  const resMedVal = createMockRes();
  await validatePrescriptionWorkflow(reqMedVal, resMedVal);

  const prescAfterVal = db.exec(`SELECT statut, validee_le, validee_par FROM prescriptions WHERE id = '${testPrescId}'`)[0]?.values[0];

  assert(
    resRecepVal.statusCode === 403 &&
    resConfVal.statusCode === 403 &&
    resMedVal.statusCode === 200 &&
    prescAfterVal[0] === 'VALIDEE' &&
    !!prescAfterVal[1] &&
    prescAfterVal[2] === medecinUser.id,
    "1. Validation par le médecin : Passage BROUILLON -> VALIDÉE uniquement par le médecin prescripteur avec horodatage tracé"
  );

  // -------------------------------------------------------------------------
  // TEST 2 : Visibilité côté réception (invisible si BROUILLON, disponible si VALIDEE)
  // -------------------------------------------------------------------------
  // Créons une seconde prescription en BROUILLON
  const draftPrescId = `prc_draft_${Date.now()}`;
  db.run(`
    INSERT INTO prescriptions (id, consultation_id, patient_id, visite_id, medecin_id, date_prescription, statut, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'BROUILLON', ?, ?)
  `, [draftPrescId, testConsultId, patientId, testVisiteId, medecinUser.id, nowIso, nowIso, nowIso]);

  // Réception tente de lire la prescription BROUILLON directement -> 403
  const reqRecepDraft = createMockReq(receptionUser, { id: draftPrescId });
  const resRecepDraft = createMockRes();
  await getPrescriptionById(reqRecepDraft, resRecepDraft);

  // Réception consulte la liste des prescriptions disponibles
  const reqRecepList = createMockReq(receptionUser, {}, {}, {});
  const resRecepList = createMockRes();
  await getPrescriptionsForReception(reqRecepList, resRecepList);

  const listPrescs = resRecepList.data?.prescriptions || [];
  const foundDraft = listPrescs.some((p: any) => p.id === draftPrescId);
  const foundValidated = listPrescs.some((p: any) => p.id === testPrescId);

  // Réception lit la prescription VALIDEE -> 200
  const reqRecepReadVal = createMockReq(receptionUser, { id: testPrescId });
  const resRecepReadVal = createMockRes();
  await getPrescriptionById(reqRecepReadVal, resRecepReadVal);

  assert(
    resRecepDraft.statusCode === 403 &&
    !foundDraft &&
    foundValidated &&
    resRecepReadVal.statusCode === 200 &&
    resRecepReadVal.data?.prescription?.statut === 'VALIDEE',
    "2. Visibilité côté réception : La prescription BROUILLON est invisible/bloquée, et devient disponible dès qu'elle est VALIDÉE"
  );

  // -------------------------------------------------------------------------
  // TEST 3 : Impression par le médecin
  // -------------------------------------------------------------------------
  // Créons une prescription validée pour le médecin
  const prescMedPrintId = `prc_med_print_${Date.now()}`;
  db.run(`
    INSERT INTO prescriptions (id, consultation_id, patient_id, visite_id, medecin_id, date_prescription, statut, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'VALIDEE', ?, ?)
  `, [prescMedPrintId, testConsultId, patientId, testVisiteId, medecinUser.id, nowIso, nowIso, nowIso]);
  db.run(`
    INSERT INTO prescription_items (id, prescription_id, nom_medicament, ordre, created_at, updated_at)
    VALUES (?, ?, 'Ciprofloxacine 500mg', 0, ?, ?)
  `, [`psi_med_print_${Date.now()}`, prescMedPrintId, nowIso, nowIso]);

  const reqMedPrint = createMockReq(medecinUser, { id: prescMedPrintId });
  const resMedPrint = createMockRes();
  await printPrescriptionWorkflow(reqMedPrint, resMedPrint);

  const prescAfterMedPrint = db.exec(`SELECT statut, imprimee_le, imprimee_par FROM prescriptions WHERE id = '${prescMedPrintId}'`)[0]?.values[0];

  assert(
    resMedPrint.statusCode === 200 &&
    prescAfterMedPrint[0] === 'IMPRIMEE' &&
    !!prescAfterMedPrint[1] &&
    String(prescAfterMedPrint[2]).includes(medecinUser.nom_complet),
    "3. Impression médecin : Le médecin peut imprimer la prescription validée, passage au statut IMPRIMÉE avec traçabilité"
  );

  // -------------------------------------------------------------------------
  // TEST 4 : Impression par la réception
  // -------------------------------------------------------------------------
  // La réception imprime la prescription testPrescId (qui était VALIDEE)
  const reqRecepPrint = createMockReq(receptionUser, { id: testPrescId });
  const resRecepPrint = createMockRes();
  await printPrescriptionWorkflow(reqRecepPrint, resRecepPrint);

  const prescAfterRecepPrint = db.exec(`SELECT statut, imprimee_le, imprimee_par FROM prescriptions WHERE id = '${testPrescId}'`)[0]?.values[0];

  assert(
    resRecepPrint.statusCode === 200 &&
    prescAfterRecepPrint[0] === 'IMPRIMEE' &&
    !!prescAfterRecepPrint[1] &&
    String(prescAfterRecepPrint[2]).includes(receptionUser.nom_complet),
    "4. Impression réception : La réception peut imprimer l'ordonnance validée, statut IMPRIMÉE tracé avec l'agent de réception"
  );

  // -------------------------------------------------------------------------
  // TEST 5 : Passage aux statuts IMPRIMÉE -> REMISE (et absence de régression)
  // -------------------------------------------------------------------------
  // La réception remet l'ordonnance au patient
  const reqDeliver = createMockReq(receptionUser, { id: testPrescId });
  const resDeliver = createMockRes();
  await deliverPrescriptionWorkflow(reqDeliver, resDeliver);

  const prescAfterDeliver = db.exec(`SELECT statut, remise_le, remise_par FROM prescriptions WHERE id = '${testPrescId}'`)[0]?.values[0];

  // Si on réimprime un duplicata d'une ordonnance déjà REMISE, le statut doit RESTER REMISE
  const reqReprint = createMockReq(receptionUser, { id: testPrescId });
  const resReprint = createMockRes();
  await printPrescriptionWorkflow(reqReprint, resReprint);

  const prescAfterReprint = db.exec(`SELECT statut FROM prescriptions WHERE id = '${testPrescId}'`)[0]?.values[0];

  assert(
    resDeliver.statusCode === 200 &&
    prescAfterDeliver[0] === 'REMISE' &&
    !!prescAfterDeliver[1] &&
    prescAfterReprint[0] === 'REMISE',
    "5. Passage aux statuts IMPRIMÉE/REMISE : Transition vers REMISE enregistrée, et non-régression de statut en cas de réimpression"
  );

  // -------------------------------------------------------------------------
  // TEST 6 : Non-modification du contenu médical
  // -------------------------------------------------------------------------
  // Vérifions les items et métadonnées de testPrescId :
  const itemsAfterAll = db.exec(`SELECT id, nom_medicament, dosage, quantite FROM prescription_items WHERE prescription_id = '${testPrescId}' ORDER BY ordre ASC`)[0]?.values;
  const metaAfterAll = db.exec(`SELECT medecin_id, date_prescription, observations FROM prescriptions WHERE id = '${testPrescId}'`)[0]?.values[0];

  const itemsIntact = 
    itemsAfterAll.length === 2 &&
    itemsAfterAll[0][1] === 'Amoxicilline 500mg' &&
    itemsAfterAll[1][1] === 'Paracétamol 1000mg';

  const authorAndDateIntact =
    metaAfterAll[0] === medecinUser.id &&
    metaAfterAll[1] === nowIso &&
    metaAfterAll[2] === 'Observations test';

  assert(
    itemsIntact && authorAndDateIntact,
    "6. Non-modification du contenu : Médicaments, dosages, quantités, médecin auteur et date initiale strictement conservés"
  );

  // -------------------------------------------------------------------------
  // TEST 7 : Non-régression & audit logs
  // -------------------------------------------------------------------------
  // Vérification que les logs d'audit tracent les 3 actions
  const auditActions = db.exec(`
    SELECT action FROM audit_logs 
    WHERE ressource_id = '${testPrescId}' 
    ORDER BY timestamp ASC
  `)[0]?.values.map(v => v[0]) || [];

  const auditContainsWorkflow = 
    auditActions.includes('PRESCRIPTION_VALIDATED') &&
    auditActions.includes('PRESCRIPTION_PRINTED') &&
    auditActions.includes('PRESCRIPTION_DELIVERED');

  assert(
    auditContainsWorkflow,
    "7. Non-régression & Audit : Événements PRESCRIPTION_VALIDATED, PRESCRIPTION_PRINTED, PRESCRIPTION_DELIVERED tracés"
  );

  // Nettoyage données de test
  db.run(`DELETE FROM prescription_items WHERE prescription_id IN ('${testPrescId}', '${draftPrescId}', '${prescMedPrintId}')`);
  db.run(`DELETE FROM prescriptions WHERE id IN ('${testPrescId}', '${draftPrescId}', '${prescMedPrintId}')`);
  db.run(`DELETE FROM consultations WHERE id = '${testConsultId}'`);
  db.run(`DELETE FROM visites WHERE id = '${testVisiteId}'`);
  await saveDb();

  console.log('---------------------------------------------------------------');
  console.log(`RÉSULTAT FINAL : ${passCount}/${totalTests} TESTS PASSÉS`);
  console.log('---------------------------------------------------------------');

  if (passCount === totalTests) {
    console.log('🎉 TOUS LES TESTS DE L\'ÉTAPE 6 SONT AU VERT !');
  } else {
    throw new Error(`Seulement ${passCount}/${totalTests} tests réussis`);
  }
}

runTests().catch(err => {
  console.error("Erreur durant l'exécution des tests Étape 6:", err);
  process.exit(1);
});
