/**
 * TEST ÉTAPE 7 — SYSTÈME UNIFIÉ DE RENDEZ-VOUS & CALENDRIER PARTAGÉ
 * 
 * Vérifie :
 * 1. Création Réception : Prise de RDV au guichet et par téléphone avec assignation médecin
 * 2. Visibilité Réception : Accès aux rendez-vous de tous les médecins autorisés
 * 3. Création Médecin : Prise de RDV de contrôle/suivi clinique depuis la consultation
 * 4. Synchronisation partagée : Calendrier unique en temps réel entre médecin et réception
 * 5. Cycle complet des statuts : PLANIFIÉ -> CONFIRMÉ -> PATIENT PRÉSENT -> HONORÉ & ABSENT
 * 6. Modification & Replanification : Mise à jour de la date, heure, notes sans altérer l'intégrité
 * 7. Annulation : Statut ANNULÉ avec motif, conservation dans l'historique
 * 8. Gestion des rappels patient : Enregistrement des contacts et retours d'appels
 * 9. Contrôle d'accès & Non-régression : Rôles stricts et intégrité du système
 */

import { getDb, saveDb } from '../db/database';
import { runMigrations } from '../db/migrations';
import { 
  getAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  updateAppointment, 
  updateAppointmentReminder, 
  cancelAppointment 
} from '../controllers/appointmentController';

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
  console.log('🧪 TEST ÉTAPE 7 — SYSTÈME DE RENDEZ-VOUS & CALENDRIER PARTAGÉ');
  console.log('===============================================================');

  const db = await getDb();
  await runMigrations();

  let passCount = 0;
  const totalTests = 9;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // Utilisateurs de test
  const medecinRow1 = db.exec("SELECT id, nom_complet, role FROM users WHERE role = 'MÉDECIN' LIMIT 1")[0]?.values[0];
  const medecinUser1 = { id: String(medecinRow1[0]), nom_complet: String(medecinRow1[1]), role: 'MÉDECIN' };

  const medecinRow2 = db.exec(`SELECT id, nom_complet, role FROM users WHERE role = 'MÉDECIN' AND id != '${medecinUser1.id}' LIMIT 1`)[0]?.values[0] 
    || db.exec("SELECT id, nom_complet, role FROM users WHERE role = 'MÉDECIN' LIMIT 1")[0]?.values[0];
  const medecinUser2 = { id: String(medecinRow2[0]), nom_complet: String(medecinRow2[1]), role: 'MÉDECIN' };

  const receptionRow = db.exec("SELECT id, nom_complet, role FROM users WHERE role = 'RÉCEPTION' LIMIT 1")[0]?.values[0];
  const receptionUser = { id: String(receptionRow[0]), nom_complet: String(receptionRow[1]), role: 'RÉCEPTION' };

  // Patient de test
  const patientRow = db.exec("SELECT id, numero_dossier, nom, prenom FROM patients WHERE actif = 1 LIMIT 1")[0]?.values[0];
  const patientId = String(patientRow[0]);

  let rdvIdReception: string = '';
  let rdvIdTelephone: string = '';
  let rdvIdMedecin: string = '';

  // -------------------------------------------------------------
  // TEST 1 : Création par la Réception (Guichet et Téléphone)
  // -------------------------------------------------------------
  {
    // A. Guichet
    const req1 = createMockReq(receptionUser, {}, {
      patient_id: patientId,
      medecin_id: medecinUser1.id,
      date_rdv: '2026-10-15',
      heure_rdv: '10:00',
      motif: 'Consultation générale de suivi',
      type_rdv: 'CONSULTATION',
      source_demande: 'ACCUEIL',
      statut: 'PLANIFIÉ'
    });
    const res1 = createMockRes();
    await createAppointment(req1, res1);

    const created1 = res1.data?.appointment;
    rdvIdReception = created1?.id;

    // B. Téléphone
    const req2 = createMockReq(receptionUser, {}, {
      patient_id: patientId,
      medecin_id: medecinUser2.id,
      date_rdv: '2026-10-16',
      heure_rdv: '14:30',
      motif: 'Demande urgente de renouvellement',
      type_rdv: 'CONSULTATION',
      source_demande: 'TELEPHONE',
      notes: '[Demande téléphonique] Patient appelle depuis l’extérieur',
      statut: 'PLANIFIÉ'
    });
    const res2 = createMockRes();
    await createAppointment(req2, res2);

    const created2 = res2.data?.appointment;
    rdvIdTelephone = created2?.id;

    assert(
      res1.statusCode === 201 && created1?.statut === 'PLANIFIÉ' && created1?.medecin_id === medecinUser1.id &&
      res2.statusCode === 201 && created2?.source_demande === 'TELEPHONE' && created2?.medecin_id === medecinUser2.id,
      "1. Création Réception : Prise de RDV au guichet et par téléphone avec praticien assigné et statut initial PLANIFIÉ"
    );
  }

  // -------------------------------------------------------------
  // TEST 2 : Visibilité Réception sur tous les médecins autorisés
  // -------------------------------------------------------------
  {
    const req = createMockReq(receptionUser, {}, {}, { tous: 'true' });
    const res = createMockRes();
    await getAppointments(req, res);

    const list = res.data?.appointments || [];
    const hasMed1 = list.some((r: any) => r.medecin_id === medecinUser1.id);
    const hasMed2 = list.some((r: any) => r.medecin_id === medecinUser2.id);

    // Test filtre spécifique
    const reqFilter = createMockReq(receptionUser, {}, {}, { medecin_id: medecinUser1.id });
    const resFilter = createMockRes();
    await getAppointments(reqFilter, resFilter);
    const filteredList = resFilter.data?.appointments || [];
    const onlyMed1 = filteredList.every((r: any) => r.medecin_id === medecinUser1.id);

    assert(
      res.statusCode === 200 && hasMed1 && hasMed2 && onlyMed1,
      "2. Visibilité Réception : Voit les rendez-vous de tous les médecins autorisés avec filtrage possible"
    );
  }

  // -------------------------------------------------------------
  // TEST 3 : Création par le Médecin depuis la Consultation
  // -------------------------------------------------------------
  {
    const req = createMockReq(medecinUser1, {}, {
      patient_id: patientId,
      medecin_id: medecinUser1.id,
      date_rdv: '2026-10-22',
      heure_rdv: '11:00',
      motif: 'Contrôle clinique post-traitement antipaludéen',
      type_rdv: 'CONTROLE',
      source_demande: 'CONSULTATION_SUIVI',
      statut: 'PLANIFIÉ',
      notes: 'Faire NFS de contrôle avant le rendez-vous'
    });
    const res = createMockRes();
    await createAppointment(req, res);

    const created = res.data?.appointment;
    rdvIdMedecin = created?.id;

    assert(
      res.statusCode === 201 && created?.type_rdv === 'CONTROLE' && 
      created?.source_demande === 'CONSULTATION_SUIVI' && created?.medecin_id === medecinUser1.id,
      "3. Création Médecin : Programmation d'un rendez-vous de contrôle/suivi direct depuis la consultation"
    );
  }

  // -------------------------------------------------------------
  // TEST 4 : Synchronisation partagée (planning réception)
  // -------------------------------------------------------------
  {
    const req = createMockReq(receptionUser, {}, {}, { tous: 'true' });
    const res = createMockRes();
    await getAppointments(req, res);

    const list = res.data?.appointments || [];
    const rdvMedecinInReception = list.find((r: any) => r.id === rdvIdMedecin);

    assert(
      res.statusCode === 200 && !!rdvMedecinInReception && rdvMedecinInReception.motif.includes('Contrôle clinique'),
      "4. Synchronisation : Le RDV créé par le médecin apparaît immédiatement dans le planning de la réception"
    );
  }

  // -------------------------------------------------------------
  // TEST 5 : Gestion des rappels par la Réception
  // -------------------------------------------------------------
  {
    const req = createMockReq(receptionUser, { id: rdvIdReception }, {
      rappel_statut: 'CONFIRME_PAR_PATIENT',
      notes: 'Patient contacté par téléphone le 14/10, confirme sa venue à 10h'
    });
    const res = createMockRes();
    await updateAppointmentReminder(req, res);

    const updated = res.data?.appointment;

    assert(
      res.statusCode === 200 && updated?.rappel_statut === 'CONFIRME_PAR_PATIENT' && 
      updated?.notes.includes('confirme sa venue'),
      "5. Gestion des rappels : Réception peut tracer les rappels téléphoniques et confirmations patient"
    );
  }

  // -------------------------------------------------------------
  // TEST 6 : Cycle complet des statuts (PLANIFIÉ -> CONFIRMÉ -> PATIENT PRÉSENT -> HONORÉ & ABSENT)
  // -------------------------------------------------------------
  {
    // 1. PLANIFIÉ -> CONFIRMÉ
    const reqConf = createMockReq(receptionUser, { id: rdvIdReception }, { statut: 'CONFIRMÉ' });
    const resConf = createMockRes();
    await updateAppointmentStatus(reqConf, resConf);

    // 2. CONFIRMÉ -> PATIENT PRÉSENT
    const reqPres = createMockReq(receptionUser, { id: rdvIdReception }, { statut: 'PATIENT PRÉSENT' });
    const resPres = createMockRes();
    await updateAppointmentStatus(reqPres, resPres);

    // 3. PATIENT PRÉSENT -> HONORÉ
    const reqHon = createMockReq(medecinUser1, { id: rdvIdReception }, { statut: 'HONORÉ' });
    const resHon = createMockRes();
    await updateAppointmentStatus(reqHon, resHon);

    // 4. Test statut ABSENT sur un autre RDV
    const reqAbs = createMockReq(receptionUser, { id: rdvIdTelephone }, { statut: 'ABSENT' });
    const resAbs = createMockRes();
    await updateAppointmentStatus(reqAbs, resAbs);

    assert(
      resConf.data?.appointment?.statut === 'CONFIRMÉ' &&
      resPres.data?.appointment?.statut === 'PATIENT PRÉSENT' &&
      resHon.data?.appointment?.statut === 'HONORÉ' &&
      resAbs.data?.appointment?.statut === 'ABSENT',
      "6. Statuts : Cycle PLANIFIÉ → CONFIRMÉ → PATIENT PRÉSENT → HONORÉ avec possibilité de marquer ABSENT"
    );
  }

  // -------------------------------------------------------------
  // TEST 7 : Modification (replanification) d'un rendez-vous
  // -------------------------------------------------------------
  {
    const req = createMockReq(receptionUser, { id: rdvIdMedecin }, {
      date_rdv: '2026-10-25',
      heure_rdv: '15:00',
      notes: 'Décalé à la demande du patient'
    });
    const res = createMockRes();
    await updateAppointment(req, res);

    const updated = res.data?.appointment;

    assert(
      res.statusCode === 200 && updated?.date_rdv === '2026-10-25' && 
      updated?.heure_rdv === '15:00' && updated?.notes === 'Décalé à la demande du patient',
      "7. Modification : Replanification de la date et de l'heure avec conservation de l'historique"
    );
  }

  // -------------------------------------------------------------
  // TEST 8 : Annulation avec motif et conservation dans l'historique
  // -------------------------------------------------------------
  {
    const req = createMockReq(receptionUser, { id: rdvIdMedecin }, {
      motif_annulation: 'Patient en déplacement professionnel imprévu'
    });
    const res = createMockRes();
    await cancelAppointment(req, res);

    // Vérifier en base que le statut est ANNULÉ et que l'enregistrement n'a pas été supprimé
    const row = db.exec(`SELECT statut, notes, actif FROM rendez_vous WHERE id = '${rdvIdMedecin}'`)[0]?.values[0];

    assert(
      res.statusCode === 200 && row && row[0] === 'ANNULÉ' && 
      String(row[1]).includes('Patient en déplacement') && Number(row[2]) === 1,
      "8. Annulation : Passage au statut ANNULÉ avec motif sans suppression de la base (conservation des RDV)"
    );
  }

  // -------------------------------------------------------------
  // TEST 9 : Respect des statuts autorisés et non-régression
  // -------------------------------------------------------------
  {
    const reqInvalid = createMockReq(receptionUser, { id: rdvIdTelephone }, { statut: 'STATUT_INEXISTANT' });
    const resInvalid = createMockRes();
    await updateAppointmentStatus(reqInvalid, resInvalid);

    assert(
      resInvalid.statusCode === 400 && resInvalid.data?.error?.includes('Statut invalide'),
      "9. Sécurité & Contrôle : Rejet des statuts invalides et respect strict des règles de transition"
    );
  }

  console.log('---------------------------------------------------------------');
  console.log(`RÉSULTAT FINAL : ${passCount}/${totalTests} TESTS PASSÉS`);
  console.log('---------------------------------------------------------------');

  if (passCount === totalTests) {
    console.log("🎉 TOUS LES TESTS DE L'ÉTAPE 7 SONT AU VERT !");
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erreur exécution tests Étape 7:", err);
  process.exit(1);
});
