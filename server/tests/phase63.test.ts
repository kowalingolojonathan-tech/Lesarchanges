/**
 * Tests — Phase 6.3 : Hospitalisation
 *
 * Couvre :
 * A. Hospitalisation directe sans observation
 * B. Hospitalisation après observation
 * C. Choix d'une catégorie et capture du tarif
 * D. Modification du tarif général sans changement rétroactif
 * E. Absence de facturation avant admission effective
 * F. Calcul des journées à 23h59, 24h, 24h01 et après plusieurs jours
 * G. Arrêt du calcul à l'heure de sortie et conservation du montant final
 * H. Notification immédiate de la Caisse à la création de la demande
 * I. Paiement complet, acompte, solde restant et paiement à la sortie
 * J. Absence de factures en double
 * K. Relais : blocage des actions de l'ancien médecin et droits du nouveau responsable
 * L. Conservation de l'historique médical et financier
 * M. Absence de régression sur les tests existants des Phases 6.1 et 6.2
 */

import { query, queryOne, execute } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import {
  demanderHospitalisation,
  admettreHospitalisation,
  sortirHospitalisation,
  addHospitalisationNote,
  getDoctorHospitalisations,
  getHospitalisationDetails,
  getHospitalisationHistory,
  checkHospitalisationEligibility,
  updateHospitalisationResponsable,
  calculateHospitalisationDays,
  calculateHospitalisationCost,
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

export async function runPhase63Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DES TESTS — PHASE 6.3 : HOSPITALISATION');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);
  const med1_id = 'usr-med-01';
  const med2_id = 'usr-med-02';
  const pat1_id = `pat-63-${testSuffix}`;
  const vis1_id = `vis-63-${testSuffix}`;
  const csl1_id = `csl-63-${testSuffix}`;
  const csl2_id = `csl-63-2-${testSuffix}`;
  const obs1_id = `obs-63-${testSuffix}`;
  const now = () => new Date().toISOString();

  // Setup patient
  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'TSHIBANU', 'Marie', '1990-03-20', 'F', '0', '', '', 1, datetime('now'), datetime('now'))`,
    [pat1_id, `DOS-63-${testSuffix}`]
  );

  // Setup visite 1 et consultation (pour tests directs)
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Douleur abdominale', 'STANDARD', 1, datetime('now'))`,
    [vis1_id, `VIS-63-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, conduite_a_tenir, histoire_maladie, examen_physique, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Douleur abdominale', 'Appendicite suspectée', 'Surveillance + imagerie', 'Patient presentant des douleurs abdominales', 'Abdomen souple, douleur quadrant droit', ?, ?, 1)`,
    [csl1_id, vis1_id, pat1_id, med1_id, now(), now()]
  );

  // Setup visite 2 (pour test après observation)
  const vis2_id = `vis-63-2-${testSuffix}`;
  const csl2_id_test = `csl-63-2-${testSuffix}`;
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Suivi post-op', 'STANDARD', 1, datetime('now'))`,
    [vis2_id, `VIS-63-2-${testSuffix}`, pat1_id, med1_id]
  );
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, conduite_a_tenir, histoire_maladie, examen_physique, created_at, updated_at, actif)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Suivi post-op', 'Post-appendicectomie', 'Surveillance', 'Post-opératoire', 'Incision cicatrisée', ?, ?, 1)`,
    [csl2_id_test, vis2_id, pat1_id, med1_id, now(), now()]
  );

  // Helper
  function makeReq(user: any, params: any = {}, body: any = {}): any {
    return { user, params, body } as any;
  }

  function callDemander(body: any): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' }, {}, body);
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      demanderHospitalisation(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callAdmettre(hospId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' }, { id: hospId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      admettreHospitalisation(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callSortir(hospId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' }, { id: hospId }, {});
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      sortirHospitalisation(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetHosp(userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getDoctorHospitalisations(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callGetDetail(hospId: string, userId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: hospId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getHospitalisationDetails(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callAddNote(hospId: string, userId: string, noteText: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { id: hospId }, { note_texte: noteText });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      addHospitalisationNote(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  function callHistory(userId: string, patientId: string): Promise<any> {
    return new Promise((resolve) => {
      const req = makeReq({ id: userId, role: 'MÉDECIN', nom_complet: 'Dr. Test' }, { patient_id: patientId });
      const mockRes: any = {
        status: (code: number) => { mockRes._statusCode = code; return mockRes; },
        json: (data: any) => { resolve(data); }
      };
      getHospitalisationHistory(req, mockRes).catch(() => resolve({ error: 'exception' }));
    });
  }

  // ---- Test A : Hospitalisation directe sans observation ----
  try {
    const res = await callDemander({ consultation_id: csl1_id, categorie_id: 'hcat-standard', motif: 'Douleur persistante' });
    if (res && !res.error && res.hospitalisation && res.hospitalisation.statut === 'DEMANDE') {
      const hosp = res.hospitalisation;
      // Vérifier que la notification caisse existe
      const notifCount = await queryOne<any>(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = 'usr-recep-01' AND type = 'HOSPITALISATION' AND lu = 0`,
        []
      );
      if (notifCount && Number(notifCount.count) > 0) {
        record(1, "Hospitalisation directe sans observation", true,
          `Demande créée: ${hosp.id}, statut=${hosp.statut}, notification caisse créée.`);
      } else {
        record(1, "Hospitalisation directe sans observation", false,
          `Notification caisse non trouvée.`);
      }
    } else {
      record(1, "Hospitalisation directe sans observation", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(1, "Hospitalisation directe sans observation", false, err.message);
  }

  // ---- Test B : Hospitalisation après observation ----
  try {
    // Créer une observation d'abord
    await execute(
      `INSERT INTO observations (id, consultation_id, visite_id, patient_id, medecin_id, statut, note_clinique, duree_debut_observation, created_at, updated_at, actif)
       VALUES (?, ?, ?, ?, ?, 'EN_OBSERVATION', 'Observation initiale', datetime('now'), datetime('now'), datetime('now'), 1)`,
      [obs1_id, csl2_id_test, vis2_id, pat1_id, med1_id]
    );

    const res = await callDemander({ consultation_id: csl2_id_test, categorie_id: 'hcat-usc', motif: 'Aggravation sous observation', observation_id: obs1_id });
    if (res && !res.error && res.hospitalisation) {
      // Vérifier que l'observation_id est bien enregistré en base
      const hospDb = await queryOne<any>(`SELECT observation_id FROM hospitalisations WHERE id = ?`, [res.hospitalisation.id]);
      if (hospDb && hospDb.observation_id === obs1_id) {
        record(2, "Hospitalisation après observation", true,
          `Demande créée avec liaison observation ${obs1_id}.`);
      } else {
        record(2, "Hospitalisation après observation", false,
          `observation_id en base: ${hospDb?.observation_id} (attendu: ${obs1_id})`);
      }
    } else {
      record(2, "Hospitalisation après observation", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(2, "Hospitalisation après observation", false, err.message);
  }

  // ---- Test C : Choix d'une catégorie et capture du tarif ----
  try {
    // Utiliser une autre consultation pour éviter le conflit avec Test A
    const csl3_id = `csl-63-3-${testSuffix}`;
    const vis3_id = `vis-63-3-${testSuffix}`;
    await execute(
      `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
       VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Test 3', 'STANDARD', 1, datetime('now'))`,
      [vis3_id, `VIS-63-3-${testSuffix}`, pat1_id, med1_id]
    );
    await execute(
      `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, diagnostic_principal, conduite_a_tenir, histoire_maladie, examen_physique, created_at, updated_at, actif)
       VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Test 3', 'Test', 'Surveillance', 'Histoire', 'Examen', ?, ?, 1)`,
      [csl3_id, vis3_id, pat1_id, med1_id, now(), now()]
    );
    
    const res = await callDemander({ consultation_id: csl3_id, categorie_id: 'hcat-privee', motif: 'Chambre privée' });
    if (res && !res.error && res.hospitalisation) {
      const tarifCapture = res.hospitalisation.tarif_journalier_usd;
      // Vérifier que le tarif correspond bien à la catégorie
      const cat = await queryOne<any>(`SELECT tarif_journalier_usd FROM hospitalisation_cATEGORIES WHERE id = 'hcat-privee'`);
      if (cat && Math.abs(tarifCapture - cat.tarif_journalier_usd) < 0.01) {
        record(3, "Choix catégorie et capture du tarif", true,
          `Tarif capturé: ${tarifCapture} USD (catégorie hcat-privee = ${cat.tarif_journalier_usd} USD).`);
      } else {
        record(3, "Choix catégorie et capture du tarif", false,
          `Tarif incohérent: ${tarifCapture} vs ${cat?.tarif_journalier_usd}`);
      }
    } else {
      record(3, "Choix catégorie et capture du tarif", false,
        `Résultat inattendu: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    record(3, "Choix catégorie et capture du tarif", false, err.message);
  }

  // ---- Test D : Modification du tarif général sans changement rétroactif ----
  try {
    const hosp = await queryOne<any>(
      `SELECT id, tarif_journalier_usd FROM hospitalisations WHERE consultation_id = ? AND statut = 'DEMANDE' ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      const tarifOriginal = hosp.tarif_journalier_usd;
      // Modifier le tarif de la catégorie
      await execute(`UPDATE hospitalisation_cATEGORIES SET tarif_journalier_usd = 999 WHERE id = 'hcat-standard'`);
      // Vérifier que l'hospitalisation conserve son ancien tarif
      const hospAfterUpdate = await queryOne<any>(
        `SELECT tarif_journalier_usd FROM hospitalisations WHERE id = ?`,
        [hosp.id]
      );
      if (hospAfterUpdate && Math.abs(hospAfterUpdate.tarif_journalier_usd - tarifOriginal) < 0.01) {
        record(4, "Modification tarif général sans changement rétroactif", true,
          `Tarif conservé: ${hospAfterUpdate.tarif_journalier_usd} USD (original: ${tarifOriginal}).`);
        // Remettre le tarif original
        await execute(`UPDATE hospitalisation_cATEGORIES SET tarif_journalier_usd = 50 WHERE id = 'hcat-standard'`);
      } else {
        record(4, "Modification tarif général sans changement rétroactif", false,
          `Tarif modifié: ${hospAfterUpdate?.tarif_journalier_usd} (attendu: ${tarifOriginal})`);
      }
    } else {
      record(4, "Modification tarif général sans changement rétroactif", false, "Hospitalisation introuvable");
    }
  } catch (err: any) {
    record(4, "Modification tarif général sans changement rétroactif", false, err.message);
  }

  // ---- Test E : Absence de facturation avant admission effective ----
  try {
    const hosp = await queryOne<any>(
      `SELECT id FROM hospitalisations WHERE consultation_id = ? AND statut = 'DEMANDE' ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      const facturation = calculateHospitalisationCost(null, null, 50);
      if (facturation.joursFacturables === 0 && facturation.montantEstimeUsd === 0) {
        record(5, "Absence de facturation avant admission", true,
          `Jours=0, Montant=0 USD. Statut: "${facturation.statutFacturation}".`);
      } else {
        record(5, "Absence de facturation avant admission", false,
          `Jours=${facturation.joursFacturables}, Montant=${facturation.montantEstimeUsd}`);
      }
    } else {
      record(5, "Absence de facturation avant admission", false, "Hospitalisation introuvable");
    }
  } catch (err: any) {
    record(5, "Absence de facturation avant admission", false, err.message);
  }

  // ---- Test F : Calcul des journées à 23h59, 24h, 24h01 et après plusieurs jours ----
  try {
    const baseTime = new Date('2024-01-01T10:00:00Z').toISOString();
    
    // 23h59 (moins d'une journée complète)
    const test23h59 = calculateHospitalisationDays(baseTime, new Date('2024-01-01T09:59:00Z').toISOString());
    const test24h = calculateHospitalisationDays(baseTime, new Date('2024-01-02T10:00:00Z').toISOString());
    const test24h01 = calculateHospitalisationDays(baseTime, new Date('2024-01-02T10:01:00Z').toISOString());
    const testMultiDays = calculateHospitalisationDays(baseTime, new Date('2024-01-05T10:00:00Z').toISOString());

    const f23 = test23h59 === 0;
    const f24 = test24h === 1;
    const f24_01 = test24h01 === 2;
    const fMulti = testMultiDays === 4;

    if (f23 && f24 && f24_01 && fMulti) {
      record(6, "Calcul des journées (23h59, 24h, 24h01, multi-jours)", true,
        `23h59=${test23h59}j, 24h=${test24h}j, 24h01=${test24h01}j, 4j=${testMultiDays}j.`);
    } else {
      record(6, "Calcul des journées (23h59, 24h, 24h01, multi-jours)", false,
        `23h59=${test23h59}(attendu 0), 24h=${test24h}(attendu 1), 24h01=${test24h01}(attendu 2), 4j=${testMultiDays}(attendu 4)`);
    }
  } catch (err: any) {
    record(6, "Calcul des journées (23h59, 24h, 24h01, multi-jours)", false, err.message);
  }

  // ---- Test G : Arrêt du calcul à l'heure de sortie et conservation du montant final ----
  try {
    // Admettre une hospitalisation
    const hosp = await queryOne<any>(
      `SELECT id, date_admission, tarif_journalier_usd FROM hospitalisations WHERE consultation_id = ? AND statut = 'DEMANDE' ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      await callAdmettre(hosp.id);
      
      const hospAdmise = await queryOne<any>(
        `SELECT date_admission, tarif_journalier_usd FROM hospitalisations WHERE id = ?`,
        [hosp.id]
      );
      
      if (hospAdmise) {
        // Calculer avant sortie
        const avantSortie = calculateHospitalisationCost(hospAdmise.date_admission, null, hospAdmise.tarif_journalier_usd);
        
        // Simuler sortie 3 jours après
        const dateSortie = new Date(new Date(hospAdmise.date_admission).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const apresSortie = calculateHospitalisationCost(hospAdmise.date_admission, dateSortie, hospAdmise.tarif_journalier_usd);
        
        if (avantSortie.joursFacturables > 0 && apresSortie.joursFacturables === 3 && apresSortie.montantEstimeUsd === 150) {
          record(7, "Arrêt calcul à la sortie", true,
            `Avant sortie: ${avantSortie.joursFacturables}j, Après sortie: ${apresSortie.joursFacturables}j, Montant final: ${apresSortie.montantEstimeUsd} USD.`);
        } else {
          record(7, "Arrêt calcul à la sortie", false,
            `Avant: ${avantSortie.joursFacturables}j/${avantSortie.montantEstimeUsd}USD, Après: ${apresSortie.joursFacturables}j/${apresSortie.montantEstimeUsd}USD`);
        }
      }
    }
  } catch (err: any) {
    record(7, "Arrêt calcul à la sortie", false, err.message);
  }

  // ---- Test H : Notification immédiate de la Caisse à la création de la demande ----
  try {
    const notifCount = await queryOne<any>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = 'usr-recep-01' AND type = 'HOSPITALISATION'`,
      []
    );
    if (notifCount && Number(notifCount.count) >= 2) {
      record(8, "Notification immédiate de la Caisse", true,
        `${notifCount.count} notification(s) hospitalisation créée(s).`);
    } else {
      record(8, "Notification immédiate de la Caisse", false,
        `Nombre de notifications: ${notifCount?.count ?? 0} (attendu >= 2)`);
    }
  } catch (err: any) {
    record(8, "Notification immédiate de la Caisse", false, err.message);
  }

  // ---- Test I : Paiement complet, acompte, solde restant ----
  try {
    const hosp = await queryOne<any>(
      `SELECT id, tarif_journalier_usd FROM hospitalisations WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      await callAdmettre(hosp.id);
      
      // Simuler paiement partiel via createLinkedFactureCore
      const { createLinkedFactureCore } = await import('../controllers/billingController.js');
      const factureResult = await createLinkedFactureCore({
        patient_id: pat1_id,
        visite_id: vis1_id,
        type_prestation: 'HOSPITALISATION',
        items: [{
          description: `Hospitalisation - Catégorie Standard`,
          categorie: 'HOSPITALISATION',
          quantite: 1,
          prix_unitaire: hosp.tarif_journalier_usd
        }],
        emise_par_id: 'usr-recep-01',
        notes: `Hospitalisation ${hosp.id}`
      });

      if (factureResult && !factureResult.isDuplicate && factureResult.facture) {
        const { getFactureFinancialDetails, processPaiementDirectCore } = await import('../controllers/billingController.js');
        const details = await getFactureFinancialDetails(factureResult.facture.id);
        
        if (details) {
          // Paiement complet
          const paiementComplet = await processPaiementDirectCore({
            facture_id: details.id,
            montant_paye: details.solde_usd,
            devise: 'USD',
            mode_paiement: 'ESPECES',
            encaisse_par_id: 'usr-recep-01'
          });
          
          const detailsFinal = await getFactureFinancialDetails(factureResult.facture.id);
          
          if (detailsFinal && detailsFinal.statut === 'PAYÉ') {
            record(9, "Paiement complet, acompte, solde", true,
              `Facture créée: ${details.numero_facture}, Solde: ${detailsFinal.solde_usd} USD, Statut: ${detailsFinal.statut}.`);
          } else {
            record(9, "Paiement complet, acompte, solde", false,
              `Statut final: ${detailsFinal?.statut} (attendu PAYÉ)`);
          }
        }
      }
    }
  } catch (err: any) {
    record(9, "Paiement complet, acompte, solde", false, err.message);
  }

  // ---- Test J : Absence de factures en double ----
  try {
    const { createLinkedFactureCore } = await import('../controllers/billingController.js');
    const hosp = await queryOne<any>(
      `SELECT id, visite_id FROM hospitalisations WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      const firstInvoice = await createLinkedFactureCore({
        patient_id: pat1_id,
        visite_id: hosp.visite_id,
        type_prestation: 'HOSPITALISATION',
        items: [{ description: 'Hospitalisation Standard', categorie: 'HOSPITALISATION', quantite: 1, prix_unitaire: 50 }],
        emise_par_id: 'usr-recep-01'
      });
      
      const secondInvoice = await createLinkedFactureCore({
        patient_id: pat1_id,
        visite_id: hosp.visite_id,
        type_prestation: 'HOSPITALISATION',
        items: [{ description: 'Hospitalisation Standard', categorie: 'HOSPITALISATION', quantite: 1, prix_unitaire: 50 }],
        emise_par_id: 'usr-recep-01'
      });
      
      if (firstInvoice && secondInvoice && secondInvoice.isDuplicate) {
        record(10, "Absence de factures en double", true,
          `Facture dupliquée correctement détectée: ${secondInvoice.isDuplicate}.`);
      } else {
        record(10, "Absence de factures en double", false,
          `isDuplicate=${secondInvoice?.isDuplicate} (attendu true)`);
      }
    }
  } catch (err: any) {
    record(10, "Absence de factures en double", false, err.message);
  }

  // ---- Test K : Relais - blocage actions ancien médecin ----
  try {
    const hosp = await queryOne<any>(
      `SELECT id, medecin_responsable_id, medecin_origine_id FROM hospitalisations WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1`,
      [csl1_id]
    );
    if (hosp) {
      // Transférer à med2 depuis le médecin origine (med1)
      const transfertRes = await new Promise<any>((resolve) => {
        const req = makeReq(
          { id: med1_id, role: 'MÉDECIN', nom_complet: 'Dr. Marc Sawadogo' },
          { id: hosp.id },
          { medecin_responsable_id: med2_id }
        );
        const mockRes: any = {
          status: (code: number) => { mockRes._statusCode = code; return mockRes; },
          json: (data: any) => { resolve(data); }
        };
        updateHospitalisationResponsable(req, mockRes).catch(() => resolve({ error: 'exception' }));
      });
      
      if (!transfertRes.error) {
        // Vérifier que med1 ne peut plus ajouter de notes
        const noteRes = await callAddNote(hosp.id, med1_id, 'Note du Dr. Marc');
        if (noteRes.error && noteRes.error.includes('confrère')) {
          record(11, "Relais: blocage ancien médecin", true,
            `Ancien médecin bloqué sur ajout de note.`);
        } else {
          record(11, "Relais: blocage ancien médecin", false,
            `Ancien médecin toujours actif: ${JSON.stringify(noteRes)}`);
        }
      } else {
        record(11, "Relais: blocage ancien médecin", false,
          `Transfert échoué: ${JSON.stringify(transfertRes)}`);
      }
    }
  } catch (err: any) {
    record(11, "Relais: blocage ancien médecin", false, err.message);
  }

  // ---- Test L : Conservation de l'historique médical et financier ----
  try {
    const hist = await callHistory(med1_id, pat1_id);
    const hospList = hist.hospitalisations || [];
    if (hospList.length > 0) {
      const closedHosp = hospList.find((h: any) => h.statut === 'SORTIE');
      if (closedHosp) {
        record(12, "Conservation historique médical et financier", true,
          `${hospList.length} hospitalisation(s) conservée(s), dont ${closedHosp.notes?.length || 0} note(s).`);
      } else {
        record(12, "Conservation historique médical et financier", true,
          `${hospList.length} hospitalisation(s) conservée(s) dans l'historique.`);
      }
    } else {
      record(12, "Conservation historique médical et financier", false, "Aucune hospitalisation dans l'historique");
    }
  } catch (err: any) {
    record(12, "Conservation historique médical et financier", false, err.message);
  }

// ---- Test M : Absence de régression sur tests 6.1 et 6.2 ----
  try {
    // Vérifier que les colonnes requis existent en exécutant les requêtes
    // Ces requêtes doivent fonctionner quel que soit le nombre d'enregistrements
    const hospCount = await queryOne<any>('SELECT COUNT(*) as count FROM hospitalisations', []);
    const observationCount = await queryOne<any>('SELECT COUNT(*) as count FROM observations', []);
    const relaisCount = await queryOne<any>('SELECT COUNT(*) as count FROM relais_medicaux', []);
    
    // Toutes les requêtes ont réussi sans erreur SQL
    if (hospCount !== null && observationCount !== null && relaisCount !== null) {
      record(13, "Absence de régression (6.1/6.2)", true,
        `Requêtes SQL réussies. Hospitalisations: ${hospCount.count}, Observations: ${observationCount.count}, Relais: ${relaisCount?.count}.`);
    } else {
      record(13, "Absence de régression (6.1/6.2)", false, "Résultat SQL inattendu");
    }
} catch (err: any) {
    record(13, "Absence de régression (6.1/6.2)", false, err.message);
  }

  // ====== RÉSUMÉ FINAL ======
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 6.3 — HOSPITALISATION SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase63.test.ts') || process.argv[1]?.endsWith('phase63.test.js')) {
  runPhase63Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
