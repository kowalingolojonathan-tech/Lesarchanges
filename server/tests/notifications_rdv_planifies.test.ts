/**
 * TEST — CLOCHE NOTIFICATIONS & RENDEZ-VOUS PLANIFIÉS
 *
 * Vérifie :
 * 1. Nouveau rendez-vous → notification APPOINTMENT dans la cloche du médecin concerné
 * 2. Nouveau résultat Labo → notification LAB_RESULTS_READY dans la cloche du médecin concerné
 * 3. « Marquer tout comme lu » → badge de la cloche à 0
 * 4. Les Actions rapides ne changent pas lorsqu'une notification est lue
 * 5. Un médecin ne voit pas les notifications d'un autre médecin
 * 6. Rendez-vous futur créé par le médecin → apparaît dans « Rendez-vous planifiés »
 * 7. Ce même rendez-vous apparaît côté Réception
 * 8. La cloche ne contient que des notifications APPOINTMENT et LAB_RESULTS_READY
 */

import { getDb, query, queryOne, execute } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import {
  getUserNotifications,
  markAllNotificationsRead,
  getDoctorQueue,
} from '../controllers/medicalController.js';
import {
  createAppointment,
  getAppointments,
} from '../controllers/appointmentController.js';
import { assignDoctor } from '../controllers/visiteController.js';

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
    },
  };
  return res;
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TEST — CLOCHE NOTIFICATIONS & RENDEZ-VOUS PLANIFIÉS');
  console.log('===============================================================');

  const db = await getDb();
  await runMigrations();
  await seedDatabase();

  let passCount = 0;
  const totalTests = 10;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // --- Utilisateurs de test ---
  const drA = await queryOne<any>(`SELECT id, username, nom_complet, role FROM users WHERE username = 'dr.sawadogo' AND actif = 1`);
  const drB = await queryOne<any>(`SELECT id, username, nom_complet, role FROM users WHERE username = 'dr.mutombo' AND actif = 1`);
  const recep = await queryOne<any>(`SELECT id, username, nom_complet, role FROM users WHERE username = 'reception' AND actif = 1`);

  if (!drA || !drB || !recep) {
    console.error('❌ ERREUR : Utilisateurs de test introuvables dans la base.');
    process.exit(1);
  }

  const drAPatient = await queryOne<any>(`SELECT id, nom, prenom, numero_dossier FROM patients WHERE actif = 1 LIMIT 1`);
  const patientId = drAPatient?.id || '';
  const patientNom = drAPatient?.nom || 'Test';
  const patientPrenom = drAPatient?.prenom || 'Patient';
  const patientDossier = drAPatient?.numero_dossier || 'TEST-001';

  // Nettoyage des notifications existantes pour ces utilisateurs
  await execute(`DELETE FROM notifications WHERE user_id IN (?, ?, ?)`, [drA.id, drB.id, recep.id]);
  // Nettoyage des RDV futurs créés pendant les tests
  await execute(`DELETE FROM rendez_vous WHERE date_rdv > date('now') AND (medecin_id = ? OR cree_par_id = ?)`, [drA.id, drA.id]);

  // -------------------------------------------------------------
  // TEST 1 : Nouveau rendez-vous → notification APPOINTMENT dans la cloche du médecin
  // -------------------------------------------------------------
  {
    const futureDate = '2027-01-15';
    const req = createMockReq(drA, {}, {
      patient_id: patientId,
      medecin_id: drA.id,
      date_rdv: futureDate,
      heure_rdv: '10:00',
      motif: 'Contrôle de suivi post-traitement',
      type_rdv: 'CONTROLE',
      source_demande: 'CONSULTATION_SUIVI',
      statut: 'PLANIFIÉ',
    });
    const res = createMockRes();
    await createAppointment(req, res);

    const createdRdv = res.data?.appointment;
    assert(
      res.statusCode === 201 && createdRdv?.statut === 'PLANIFIÉ' && createdRdv?.medecin_id === drA.id,
      '1. Création RDV futur par médecin Dr A réussi'
    );

    // Vérifier que la notification APPOINTMENT a été créée pour Dr A
    const notifForDrA = await queryOne<any>(
      `SELECT id FROM notifications WHERE user_id = ? AND type = 'APPOINTMENT' AND lu = 0 LIMIT 1`,
      [drA.id]
    );
    assert(
      notifForDrA,
      '1. Notification APPOINTMENT créée pour Dr A après création RDV futur'
    );
  }

  // -------------------------------------------------------------
  // TEST 2 : Nouveau résultat Labo → notification LAB_RESULTS_READY dans la cloche du médecin
  // -------------------------------------------------------------
  {
    // Créer une notification LAB_RESULTS_READY manuellement pour Dr A
    const notifId = `notif-test-lab-${Date.now()}`;
    await execute(
      `INSERT INTO notifications (id, user_id, titre, message, type, patient_id, lu, created_at)
       VALUES (?, ?, 'Résultat labo disponible', 'Nouveau résultat de laboratoire pour le patient', 'LAB_RESULTS_READY', ?, 0, ?)`,
      [notifId, drA.id, patientId, new Date().toISOString()]
    );

    // Vérifier que Dr A peut la voir via getUserNotifications
    const req = createMockReq(drA, {}, {}, {});
    const res = createMockRes();
    await getUserNotifications(req, res);

    const hasLabNotif = (res.data?.notifications || []).some((n: any) => n.type === 'LAB_RESULTS_READY');
    assert(
      res.statusCode === 200 && hasLabNotif,
      '2. Notification LAB_RESULTS_READY visible dans la cloche de Dr A'
    );
  }

  // -------------------------------------------------------------
  // TEST 3 : « Marquer tout comme lu » → badge de la cloche à 0
  // -------------------------------------------------------------
  {
    const req = createMockReq(drA, {}, {}, {});

    // S'assurer qu'il y a des notifications non lues pour Dr A
    const resBefore = createMockRes();
    await getUserNotifications(req, resBefore);
    const beforeCount = resBefore.data?.unread_count || 0;
    assert(beforeCount > 0, '   [Préalable] Dr A a des notifications non lues avant操作');

    // Marquer tout comme lu
    const markAllRes = createMockRes();
    await markAllNotificationsRead(req, markAllRes);
    assert(markAllRes.statusCode === 200, '   [Préalable] Marquer tout comme lu réussit');

    // Vérifier que le badge est maintenant 0
    const resAfter = createMockRes();
    await getUserNotifications(req, resAfter);
    const afterCount = resAfter.data?.unread_count || 0;
    assert(
      afterCount === 0,
      '3. « Marquer tout comme lu » → badge de la cloche à 0'
    );
  }

  // -------------------------------------------------------------
  // TEST 4 : Les Actions rapides ne changent pas lorsqu'une notification est lue
  // -------------------------------------------------------------
  {
    const req = createMockReq(drA, {}, {}, {});

    // Récupérer les compteurs avant
    const resBefore = createMockRes();
    await getDoctorQueue(req, resBefore);
    const beforeRdv = resBefore.data?.quickAccess?.rdv ?? -1;
    const beforeLab = resBefore.data?.quickAccess?.labResults ?? -1;
    const beforeRdvPlanifies = resBefore.data?.quickAccess?.rdvPlanifies ?? -1;

    // Lire toutes les notifications
    await markAllNotificationsRead(req, createMockRes());

    // Récupérer les compteurs après
    const resAfter = createMockRes();
    await getDoctorQueue(req, resAfter);
    const afterRdv = resAfter.data?.quickAccess?.rdv ?? -1;
    const afterLab = resAfter.data?.quickAccess?.labResults ?? -1;
    const afterRdvPlanifies = resAfter.data?.quickAccess?.rdvPlanifies ?? -1;

    assert(
      beforeRdv === afterRdv && beforeLab === afterLab && beforeRdvPlanifies === afterRdvPlanifies,
      '4. Les Actions rapides (rdv, labResults, rdvPlanifies) ne changent pas après lecture notifications'
    );
  }

  // -------------------------------------------------------------
  // TEST 5 : Un médecin ne voit pas les notifications d'un autre médecin
  // -------------------------------------------------------------
  {
    // Dr A doit avoir des notifications (créées plus haut)
    const reqDrA = createMockReq(drA, {}, {}, {});
    const resDrA = createMockRes();
    await getUserNotifications(reqDrA, resDrA);
    const drANotifs = resDrA.data?.notifications || [];

    // Dr B ne doit voir aucune notification
    const reqDrB = createMockReq(drB, {}, {}, {});
    const resDrB = createMockRes();
    await getUserNotifications(reqDrB, resDrB);
    const drBNotifs = resDrB.data?.notifications || [];
    const drBUnread = resDrB.data?.unread_count || 0;

    assert(
      drANotifs.length > 0 && drBNotifs.length === 0 && drBUnread === 0,
      '5. Isolation des notifications : Dr A voit ses notifications, Dr B n\'en voit aucune'
    );
  }

  // -------------------------------------------------------------
  // TEST 6 : Rendez-vous futur créé par le médecin → apparaît dans « Rendez-vous planifiés »
  // -------------------------------------------------------------
  {
    const req = createMockReq(drA, {}, {}, {});

    const res = createMockRes();
    await getDoctorQueue(req, res);

    const rdvPlanifiesCount = res.data?.quickAccess?.rdvPlanifies ?? 0;
    const rdvPlanifiesList = res.data?.quickAccessLists?.rdvPlanifiesFuturs || [];

    assert(
      res.statusCode === 200 && rdvPlanifiesCount > 0 && rdvPlanifiesList.length > 0,
      '6. Rendez-vous planifiés : le compteur et la liste contiennent les RDV futurs de Dr A'
    );

    // Vérifier que le RDV créé plus haut est dans la liste
    const foundRdv = rdvPlanifiesList.find((r: any) => r.date_rdv === '2027-01-15');
    assert(
      foundRdv && foundRdv.medecin_id === drA.id,
      '6b. Le RDV futur créé par Dr A apparaît bien dans la liste des rendez-vous planifiés'
    );
  }

  // -------------------------------------------------------------
  // TEST 7 : Même rendez-vous apparaît côté Réception
  // -------------------------------------------------------------
  {
    const reqReception = createMockReq(recep, {}, {}, { tous: 'true' });
    const res = createMockRes();
    await getAppointments(reqReception, res);

    const list = res.data?.appointments || [];
    const foundRdv = list.find((r: any) => r.date_rdv === '2027-01-15' && r.medecin_id === drA.id);

    assert(
      res.statusCode === 200 && foundRdv,
      '7. Synchronisation : le RDV futur créé par le médecin apparaît dans la vue Réception'
    );
  }

  // -------------------------------------------------------------
  // TEST 8 : La cloche ne contient que APPOINTMENT et LAB_RESULTS_READY
  // -------------------------------------------------------------
  {
    // Insérer une notification de type COMMUNICATION pour Dr A (simulée)
    const commNotifId = `notif-test-comm-${Date.now()}`;
    await execute(
      `INSERT INTO notifications (id, user_id, titre, message, type, lu, created_at)
       VALUES (?, ?, 'Message communication', 'Communication interne', 'COMMUNICATION_MEDECIN_RECEPTION', 0, ?)`,
      [commNotifId, drA.id, new Date().toISOString()]
    );

    const req = createMockReq(drA, {}, {}, {});
    const res = createMockRes();
    await getUserNotifications(req, res);

    const notifs = res.data?.notifications || [];
    const allValidTypes = notifs.every((n: any) =>
      n.type === 'APPOINTMENT' || n.type === 'LAB_RESULTS_READY' || n.type === 'CONSULTATION_WAITING'
    );
    const hasCommNotif = notifs.some((n: any) => n.type === 'COMMUNICATION_MEDECIN_RECEPTION');

    assert(
      res.statusCode === 200 && allValidTypes && !hasCommNotif,
      '8. Filtrage types : la cloche ne contient que APPOINTMENT, LAB_RESULTS_READY et CONSULTATION_WAITING (pas de COMMUNICATION)'
    );
  }

  // -------------------------------------------------------------
  // TEST 9 : Notification RDV créée aussi côté Réception
  // -------------------------------------------------------------
  {
    // Nettoyage préalable des notifications réception
    await execute(`DELETE FROM notifications WHERE user_id = ?`, [recep.id]);

    const reqCreate = createMockReq(drA, {}, {
      patient_id: patientId,
      medecin_id: drA.id,
      date_rdv: '2027-06-20',
      heure_rdv: '14:00',
      motif: 'Test notification réception',
      type_rdv: 'CONTROLE',
      source_demande: 'CONSULTATION_SUIVI',
      statut: 'PLANIFIÉ',
    });
    const resCreate = createMockRes();
    await createAppointment(reqCreate, resCreate);
    assert(resCreate.statusCode === 201, '   [Préalable] Deuxième RDV créé pour test réception');

    // Vérifier que la réception a bien reçu la notification APPOINTMENT
    const reqRecep = createMockReq(recep, {}, {}, {});
    const resRecep = createMockRes();
    await getUserNotifications(reqRecep, resRecep);

    const receptionNotifs = resRecep.data?.notifications || [];
    const hasAppointmentNotif = receptionNotifs.some((n: any) =>
      n.type === 'APPOINTMENT' && n.message?.includes('2027-06-20')
    );

    assert(
      resRecep.statusCode === 200 && hasAppointmentNotif,
      '9. Notification RDV : la réception reçoit une notification APPOINTMENT quand un médecin crée un rendez-vous'
    );
  }

  // -------------------------------------------------------------
  // TEST 10 : Nouvelle consultation en attente → notification CONSULTATION_WAITING pour le médecin
  // -------------------------------------------------------------
  {
    const nowIso = new Date().toISOString();
    const testVisiteId = 'vis-test-att-' + Date.now();
    await execute(
      `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, heure_orientation, created_at, actif)
       VALUES (?, 'VIS-TEST-${Date.now()}', ?, ?, date('now'), 'ATTENTE_MEDECIN', 'Test orientation réception', 'STANDARD', ?, ?, 1)`,
      [testVisiteId, patientId, drA.id, nowIso, nowIso]
    );

    // Marquer comme assignée via assignDoctor
    const reqAssign = createMockReq(recep, { id: testVisiteId }, { medecin_id: drA.id });
    const resAssign = createMockRes();
    await assignDoctor(reqAssign, resAssign);
    assert(resAssign.statusCode === 200, '   [Préalable] Visite assignée à Dr A');

    // Vérifier que Dr A a reçu la notification CONSULTATION_WAITING
    const reqDrA = createMockReq(drA, {}, {}, {});
    const resDrA = createMockRes();
    await getUserNotifications(reqDrA, resDrA);

    const drANotifs = resDrA.data?.notifications || [];
    const hasWaitingNotif = drANotifs.some((n: any) => n.type === 'CONSULTATION_WAITING');

    assert(
      resDrA.statusCode === 200 && hasWaitingNotif,
      '10. Notification CONSULTATION_WAITING : Dr A reçoit une notif quand la réception l\'oriente'
    );
  }

  console.log('---------------------------------------------------------------');
  console.log(`RÉSULTAT FINAL : ${passCount}/${totalTests} TESTS PASSÉS`);
  console.log('---------------------------------------------------------------');

  if (passCount === totalTests) {
    console.log("🎉 TOUS LES TESTS SONT AU VERT !");
  } else {
    process.exit(1);
  }
}

function createMockReq(user: any, params: any = {}, body: any = {}, query: any = {}) {
  return {
    user,
    params,
    body,
    query,
    ip: '127.0.0.1',
  } as any;
}

runTests().catch(err => {
  console.error("Erreur exécution tests notifications & RDV:", err);
  process.exit(1);
});
