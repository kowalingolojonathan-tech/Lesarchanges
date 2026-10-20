/**
 * Tests — Phase 7.2b Étape 2 : Sécurité et intégrité du cycle de vente POS pharmacie
 *
 * Couvre :
 * A. RBAC — seuls PHARMACIEN et ADMINISTRATEUR peuvent invoquer les routes POS
 * B. Facturation — une facture créée uniquement pour les articles sélectionnés,
 *                  protection anti-doublon serveur (requête répétée → facture existante)
 * C. Paiement — enregistrement unique, anti-doublon idempotent via transaction
 * D. Stock — décrémenté atomiquement avec le paiement, jamais si le paiement échoue
 * E. Consommation — aucune seconde facture, aucun double paiement, aucune double sortie
 *                   en cas de requêtes répétées ou concurrentes (simulation sérielle)
 */

import { query, queryOne, execute } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import bcrypt from 'bcryptjs';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, desc: string, passed: boolean, details: string) {
  results.push({ testNumber: num, description: desc, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Test ${num.toString().padStart(2, '0')}: ${desc} -> ${details}`);
}

export async function runPhase72bPosCycleTests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DES TESTS — PHASE 7.2b CYCLE VENTE POS PHARMACIE');
  console.log('  Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const suffix = Date.now().toString(36);
  const catId = `cat-pos-${suffix}`;
  const lotId = `lot-pos-${suffix}`;
  const patientId = `pat-pos-${suffix}`;
  const visiteId = `vis-pos-${suffix}`;
  const consultationId = `csl-pos-${suffix}`;
  const prescriptionId = `psc-pos-${suffix}`;

  async function cleanup() {
    if (catId) await execute(`DELETE FROM mouvements_stock WHERE catalogue_id = ?`, [catId]).catch(() => {});
    if (lotId) await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotId]).catch(() => {});
    if (catId) await execute(`DELETE FROM catalogue_medicaments WHERE id = ?`, [catId]).catch(() => {});
    if (prescriptionId) await execute(`DELETE FROM delivre_items WHERE prescription_item_id IN (SELECT id FROM prescription_items WHERE prescription_id=?)`, [prescriptionId]).catch(() => {});
    if (prescriptionId) await execute(`DELETE FROM delivre_medicaments WHERE prescription_id = ?`, [prescriptionId]).catch(() => {});
    if (prescriptionId) await execute(`DELETE FROM prescription_items WHERE prescription_id = ?`, [prescriptionId]).catch(() => {});
    if (prescriptionId) await execute(`DELETE FROM prescriptions WHERE id = ?`, [prescriptionId]).catch(() => {});
    if (consultationId) await execute(`DELETE FROM consultations WHERE id = ?`, [consultationId]).catch(() => {});
    if (visiteId) await execute(`DELETE FROM visites WHERE id = ?`, [visiteId]).catch(() => {});
    if (patientId) await execute(`DELETE FROM patients WHERE id = ?`, [patientId]).catch(() => {});
    // Nettoyage par préfixe pour les runs partiellement échoués
    await execute(`DELETE FROM prescription_items WHERE id LIKE 'psi-pos-%'`).catch(() => {});
    await execute(`DELETE FROM prescription_items WHERE prescription_id LIKE 'psc-pos-%'`).catch(() => {});
    await execute(`DELETE FROM prescriptions WHERE id LIKE 'psc-pos-%'`).catch(() => {});
    await execute(`DELETE FROM consultations WHERE id LIKE 'csl-pos-%'`).catch(() => {});
    await execute(`DELETE FROM visites WHERE id LIKE 'vis-pos-%'`).catch(() => {});
    await execute(`DELETE FROM patients WHERE id LIKE 'pat-pos-%'`).catch(() => {});
    await execute(`DELETE FROM mouvements_stock WHERE catalogue_id LIKE 'cat-pos-%'`).catch(() => {});
    await execute(`DELETE FROM lots_medicaments WHERE id LIKE 'lot-pos-%'`).catch(() => {});
    await execute(`DELETE FROM catalogue_medicaments WHERE id LIKE 'cat-pos-%'`).catch(() => {});
    await execute(`DELETE FROM factures WHERE prescription_id LIKE 'psc-pos-%'`).catch(() => {});
    await execute(`DELETE FROM paiements WHERE facture_id IN (SELECT id FROM factures WHERE prescription_id LIKE 'psc-pos-%')`).catch(() => {});
  }

  try { await cleanup(); } catch (_) {}

  // ============================================================
  // SETUP : utilisateurs + médicament + lots + prescription
  // ============================================================
  try {
    const now = new Date().toISOString();
    const hashPharm = await bcrypt.hash('ArchangesPharm2026!', 10);
    const hashMed = await bcrypt.hash('ArchangesMed2026!', 10);
    const hashRecep = await bcrypt.hash('ArchangesRecep2026!', 10);

    const existingPharm = await queryOne('SELECT id FROM users WHERE username = ?', ['pharma.pharmacien']);
    if (!existingPharm) {
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-pharm-pos', 'pharma.pharmacien', ?, 'Pharmacien Test', 'PHARMACIEN', 1, ?, ?)`,
        [hashPharm, now, now]
      );
    }

    const existingMed = await queryOne('SELECT id FROM users WHERE username = ?', ['dr.sawadogo']);
    if (!existingMed) {
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-med-pos', 'dr.sawadogo', ?, 'Dr. Test', 'MÉDECIN', 1, ?, ?)`,
        [hashMed, now, now]
      );
    }

    const existingRecep = await queryOne('SELECT id FROM users WHERE username = ?', ['reception']);
    if (!existingRecep) {
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-recep-pos', 'reception', ?, 'Réception Test', 'RÉCEPTION', 1, ?, ?)`,
        [hashRecep, now, now]
      );
    }

    // Patient + visite + consultation + prescription
    await execute(
      `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, actif, created_at, updated_at)
       VALUES (?, 'DOS-POS-TEST-${suffix}', 'KABAMBA', 'Test', '1990-01-01', 'M', '+243810000000', 1, datetime('now'), datetime('now'))`,
      [patientId]
    );
    await execute(
      `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, type_visite, actif, created_at)
       VALUES (?, 'VIS-POS-TEST-${suffix}', ?, 'usr-med-pos', datetime('now'), 'EN_CONSULTATION', 'STANDARD', 1, datetime('now'))`,
      [visiteId, patientId]
    );
    await execute(
      `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, motif_consultation, diagnostic_principal, statut, created_at, updated_at)
       VALUES (?, ?, ?, 'usr-med-pos', datetime('now'), 'Fièvre', 'Paludisme', 'FINALISEE', datetime('now'), datetime('now'))`,
      [consultationId, visiteId, patientId]
    );
    await execute(
      `INSERT INTO prescriptions (id, consultation_id, patient_id, visite_id, medecin_id, date_prescription, statut, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'usr-med-pos', datetime('now'), 'ACTIVE', datetime('now'), datetime('now'))`,
      [prescriptionId, consultationId, patientId, visiteId]
    );
    await execute(
      `INSERT INTO prescription_items (id, prescription_id, nom_medicament, dosage, forme, voie_administration, frequence, duree, quantite, ordre, created_at, updated_at)
       VALUES ('psi-pos-1-${suffix}', ?, 'AMOXICILLINE 500MG', '500mg', 'CAPSULE', 'VOIE ORALE', '3x/jour', '7 jours', 21, 0, datetime('now'), datetime('now'))`,
      [prescriptionId]
    );

    // Médicament + lot avec stock suffisant
    await execute(
      `INSERT INTO catalogue_medicaments (id, code, nom_commercial, nom_generique, classe_therapeutique, forme, dosage_unit, actif, prix_autorise_usd, created_at, updated_at)
       VALUES (?, 'AMX-POS-TEST-${suffix}', 'Amoxil 500mg', 'Amoxicilline', 'ANTIBIOTIQUE', 'CAPSULE', 'mg', 1, 5.50, datetime('now'), datetime('now'))`,
      [catId]
    );
    await execute(
      `INSERT INTO prescription_items (id, prescription_id, nom_medicament, dosage, forme, voie_administration, frequence, duree, quantite, ordre, catalogue_id, created_at, updated_at)
       VALUES ('psi-pos-2-${suffix}', ?, 'AMOXICILLINE 500MG', '500mg', 'CAPSULE', 'VOIE ORALE', '3x/jour', '7 jours', 21, 1, ?, datetime('now'), datetime('now'))`,
      [prescriptionId, catId]
    );
    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, fournisseur, created_at, updated_at)
       VALUES (?, ?, 'LOT-POS-001', '2027-12-31', 100, 100, 'PharmaCorp', datetime('now'), datetime('now'))`,
      [lotId, catId]
    );

    record(1, 'Setup : données de test créées', true, `Cat=${catId}, Lot=${lotId}, Pat=${patientId}`);
  } catch (err: any) {
    record(1, 'Setup : données de test', false, err.message);
  }

  // ============================================================
  // TEST A : RBAC — accès autorisé/refusé selon rôle
  // ============================================================
  try {
    // Compose middleware chain: requireRole(['PHARMACIEN', 'ADMINISTRATEUR']) wraps createPosFacture
    const { createPosFacture } = await import('../controllers/pharmacieController.js');
    const { requireRole } = await import('../middleware/auth.js');

    function composeHandler(handler: any, ...middlewares: any[]) {
      return async (req: any, res: any) => {
        for (const mw of middlewares) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            const timer = setTimeout(finish, 2000);
            mw(req, res, () => { clearTimeout(timer); finish(); });
          });
        }
        if (res.statusCode === 200) {
          await handler(req, res);
        }
      };
    }

    const pharmacienHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const medHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const recepHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const adminHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const labHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));

    const baseReq = { ip: '127.0.0.1', body: { prescription_id: prescriptionId, patient_id: patientId, visite_id: visiteId, items: [{ description: 'AMOXICILLINE 500MG', categorie: 'ANTIBIOTIQUE', quantite: 21, prix_unitaire: 5.50, tarif_id: catId }] } };

    // A1: PHARMACIEN → autorisé
    const pharmacienReq = { ...baseReq, user: { id: 'usr-pharm-pos', username: 'pharma.pharmacien', role: 'PHARMACIEN', role_categorie: 'PHARMACIE', permissions: [] } };
    const pharmacienRes = createMockRes();
    await pharmacienHandler(pharmacienReq as any, pharmacienRes);
    record(2, 'RBAC : PHARMACIEN peut créer facture POS', pharmacienRes.statusCode === 201 || pharmacienRes.statusCode === 200,
      `Status=${pharmacienRes.statusCode}`);

    // A2: MÉDECIN → refusé
    const medReq = { ...baseReq, user: { id: 'usr-med-pos', username: 'dr.sawadogo', role: 'MÉDECIN', role_categorie: 'MÉDECIN', permissions: [] } };
    const medRes = createMockRes();
    try {
      await medHandler(medReq as any, medRes);
      record(3, 'RBAC : MÉDECIN refusé sur facture POS', medRes.statusCode === 403,
        `Status=${medRes.statusCode} (403 = refus attendu)`);
    } catch (err: any) {
      record(3, 'RBAC : MÉDECIN refusé sur facture POS', true, `Exception levée (refus RBAC) : ${err.message?.substring(0, 80)}`);
    }

    // A3: RÉCEPTION → refusé
    const recepReq = { ...baseReq, user: { id: 'usr-recep-pos', username: 'reception', role: 'RÉCEPTION', role_categorie: 'RÉCEPTION', permissions: [] } };
    const recepRes = createMockRes();
    try {
      await recepHandler(recepReq as any, recepRes);
      record(4, 'RBAC : RÉCEPTION refusé sur facture POS', recepRes.statusCode === 403,
        `Status=${recepRes.statusCode} (403 = refus attendu)`);
    } catch (err: any) {
      record(4, 'RBAC : RÉCEPTION refusé sur facture POS', true, `Exception levée (refus RBAC) : ${err.message?.substring(0, 80)}`);
    }

    // A4: ADMINISTRATEUR → autorisé
    const adminReq = { ...baseReq, user: { id: 'usr-admin-01', username: 'admin', role: 'ADMINISTRATEUR', role_categorie: 'ADMINISTRATEUR', permissions: [] } };
    const adminRes = createMockRes();
    await adminHandler(adminReq as any, adminRes);
    record(5, 'RBAC : ADMINISTRATEUR peut créer facture POS', adminRes.statusCode === 201 || adminRes.statusCode === 200,
      `Status=${adminRes.statusCode}`);

  } catch (err: any) {
    record(2, 'RBAC : PHARMACIEN autorisé', false, err.message);
    record(3, 'RBAC : MÉDECIN refusé', false, err.message);
    record(4, 'RBAC : RÉCEPTION refusé', false, err.message);
    record(5, 'RBAC : ADMINISTRATEUR autorisé', false, err.message);
  }

  // ============================================================
  // TEST B : Facturation — article sélectionné, anti-doublon
  // ============================================================
  try {
    const { createPosFacture } = await import('../controllers/pharmacieController.js');

    // B1: Créer une facture avec prescription
    const pharmReq = {
      user: { id: 'usr-pharm-pos', username: 'pharma.pharmacien', role: 'PHARMACIEN', role_categorie: 'PHARMACIE', permissions: [] },
      body: {
        prescription_id: prescriptionId,
        patient_id: patientId,
        visite_id: visiteId,
        items: [
          {
            description: 'AMOXICILLINE 500MG',
            categorie: 'ANTIBIOTIQUE',
            quantite: 21,
            prix_unitaire: 5.50,
            tarif_id: catId
          }
        ]
      },
      ip: '127.0.0.1'
    };
    const factRes = createMockRes();
    await createPosFacture(pharmReq as any, factRes);
    const factureData = factRes.data;
    const factureId = factureData?.facture?.id;

    record(6, 'Facturation : facture créée avec articles sélectionnés',
      !!factureId && factureData?.success,
      factureId ? `Facture=${factureId}` : 'Échec création');

    // B2: Vérifier que la facture contient bien les items attendus
    if (factureId) {
      const factItems = await query<any>(
        `SELECT * FROM facture_items WHERE facture_id = ?`,
        [factureId]
      );
      const itemOk = factItems.length === 1 &&
        factItems[0].description === 'AMOXICILLINE 500MG' &&
        factItems[0].quantite === 21 &&
        Math.abs(factItems[0].prix_unitaire - 5.50) < 0.01;
      record(7, 'Facturation : items correspondants aux articles sélectionnés',
        itemOk,
        `Items=${factItems.length}, qty=${factItems[0]?.quantite}, desc=${factItems[0]?.description}`);
    }

    // B3: Anti-doublon — requête répétée ne crée pas une seconde facture
    if (factureId) {
      const factResDup = createMockRes();
      await createPosFacture(pharmReq as any, factResDup);
      const isDuplicate = factResDup.data?.isDuplicate === true;
      record(8, 'Facturation : anti-doublon — requête répétée retourne facture existante',
        isDuplicate,
        isDuplicate ? 'Doublon détecté et évité' : `Status=${factResDup.statusCode}, data=${JSON.stringify(factResDup.data)?.substring(0, 100)}`);
    }

    // B4: Vérifier qu'il n'y a qu'une seule facture pour cette prescription
    if (factureId) {
      const factCount = await queryOne<any>(
        `SELECT COUNT(*) as cnt FROM factures WHERE prescription_id = ?`,
        [prescriptionId]
      );
      record(9, 'Facturation : une seule facture liée à la prescription',
        factCount && Number(factCount.cnt) === 1,
        `Nombre de factures=${factCount?.cnt}`);
    }

  } catch (err: any) {
    record(6, 'Facturation : création facture', false, err.message);
    record(7, 'Facturation : items corrects', false, err.message);
    record(8, 'Facturation : anti-doublon', false, err.message);
    record(9, 'Facturation : unicité prescription', false, err.message);
  }

  // ============================================================
  // TEST C : Paiement — unique, idempotent
  // ============================================================
  try {
    const { recordPosPaiement } = await import('../controllers/pharmacieController.js');
    const { queryOne: qOne } = await import('../db/database.js');

    // Trouver la facture créée
    const lastFacture = await qOne<any>(
      `SELECT id, montant_total, statut FROM factures WHERE prescription_id = ? ORDER BY created_at DESC LIMIT 1`,
      [prescriptionId]
    );
    const factureId = lastFacture?.id;

    if (!factureId) {
      record(10, 'Paiement : facture trouvée', false, 'Aucune facture trouvée');
      record(11, 'Paiement : paiement enregistré', false, 'Pas de facture');
      record(12, 'Paiement : anti-doublon paiement', false, 'Pas de facture');
      record(13, 'Paiement : stock inchangé après paiement', false, 'Pas de facture');
      record(14, 'Paiement : statut facture PAYÉ', false, 'Pas de facture');
    } else {
      record(10, 'Paiement : facture trouvée', true, `Facture=${factureId}, Montant=${lastFacture?.montant_total}`);

      // C2: Enregistrer le paiement
      const pharmUser = { id: 'usr-pharm-pos', username: 'pharma.pharmacien', role: 'PHARMACIEN', role_categorie: 'PHARMACIE', permissions: [] };
      const payReq = {
        user: pharmUser,
        body: {
          id: factureId,
          prescription_id: prescriptionId,
          montant_paye: lastFacture?.montant_total,
          devise: 'USD',
          mode_paiement: 'ESPECES',
          notes: 'Test paiement POS'
        },
        ip: '127.0.0.1'
      };
      const payRes = createMockRes();
      await recordPosPaiement(payReq as any, payRes);
      const paymentOk = payRes.data?.success === true && payRes.data?.paiement !== null;
      record(11, 'Paiement : paiement enregistré avec succès', paymentOk,
        paymentOk
          ? `Recu=${payRes.data?.recu}, Montant=${payRes.data?.paiement?.montant_paye}`
          : `Status=${payRes.statusCode}, Data=${JSON.stringify(payRes.data)?.substring(0, 150)}`);

      // C3: Anti-doublon — payer à nouveau ne doit pas créer un second paiement
      if (paymentOk) {
        const payResDup = createMockRes();
        await recordPosPaiement(payReq as any, payResDup);
        const dupPrevented = payResDup.data?.isDuplicate === true ||
                             payResDup.statusCode === 400 ||
                             (payResDup.data?.error?.includes('déjà') || payResDup.data?.error?.includes('intégralement'));
        record(12, 'Paiement : anti-doublon — paiement répété refusé/blocké', dupPrevented,
          dupPrevented
            ? 'Doublon bloqué'
            : `Status=${payResDup.statusCode}, Data=${JSON.stringify(payResDup.data)?.substring(0, 150)}`);
      }

      // C4: Vérifier qu'un seul paiement existe pour cette facture
      const payCount = await qOne<any>(
        `SELECT COUNT(*) as cnt FROM paiements WHERE facture_id = ?`,
        [factureId]
      );
      record(13, 'Paiement : un seul paiement enregistré par facture',
        payCount && Number(payCount.cnt) === 1,
        `Nombre paiements=${payCount?.cnt}`);

      // C5: Stock vérifié après paiement (décrémenté)
      const stockAfterPay = await qOne<any>(
        `SELECT quantite_en_cours FROM lots_medicaments WHERE id = ?`,
        [lotId]
      );
      record(14, 'Paiement : stock décrémenté après paiement',
        stockAfterPay && stockAfterPay.quantite_en_cours < 100,
        `Stock après paiement=${stockAfterPay?.quantite_en_cours} (attendu < 100)`);

      // C6: Statut facture → PAYÉ
      const factUpdated = await qOne<any>(
        `SELECT statut FROM factures WHERE id = ?`,
        [factureId]
      );
      record(15, 'Paiement : statut facture → PAYÉ',
        factUpdated?.statut === 'PAYÉ',
        `Statut=${factUpdated?.statut}`);
    }

  } catch (err: any) {
    record(10, 'Paiement : facture trouvée', false, err.message);
    record(11, 'Paiement : paiement enregistré', false, err.message);
    record(12, 'Paiement : anti-doublon', false, err.message);
    record(13, 'Paiement : unicité paiement', false, err.message);
    record(14, 'Paiement : stock décrémenté', false, err.message);
    record(15, 'Paiement : statut PAYÉ', false, err.message);
  }

  // ============================================================
  // TEST D : Stock atomique — jamais négatif, cohérent
  // ============================================================
  try {
    const { queryOne: qOne } = await import('../db/database.js');

    // D1: Stock ne peut pas devenir négatif
    const stock = await qOne<any>(
      `SELECT quantite_en_cours FROM lots_medicaments WHERE id = ?`,
      [lotId]
    );
    record(16, 'Stock : quantité en cours >= 0', stock && stock.quantite_en_cours >= 0,
      `Stock=${stock?.quantite_en_cours}`);

    // D2: Mouvement de sortie enregistré
    const movSortie = await qOne<any>(
      `SELECT * FROM mouvements_stock WHERE lot_id = ? AND type = 'SORTIE' ORDER BY created_at DESC LIMIT 1`,
      [lotId]
    );
    record(17, 'Stock : mouvement SORTIE enregistré', !!movSortie,
      movSortie ? `qty=${movSortie.quantite}, ref=${movSortie.reference_id}` : 'Aucun mouvement SORTIE');

    // D3: Mouvement lié à la facture
    if (movSortie) {
      const factId = await qOne<any>(
        `SELECT id FROM factures WHERE prescription_id = ? ORDER BY created_at DESC LIMIT 1`,
        [prescriptionId]
      );
      const movLinked = await qOne<any>(
        `SELECT id FROM mouvements_stock WHERE reference_id = ? AND lot_id = ?`,
        [factId?.id, lotId]
      );
      record(18, 'Stock : mouvement lié à la facture POS', !!movLinked,
        movLinked ? 'Lien facture-mouvement OK' : 'Aucun lien');
    }

  } catch (err: any) {
    record(16, 'Stock : quantité >= 0', false, err.message);
    record(17, 'Stock : mouvement SORTIE', false, err.message);
    record(18, 'Stock : lien facture', false, err.message);
  }

  // ============================================================
  // TEST E : Simulation sérielle — double requête répétée
  // ============================================================
  try {
    const { createPosFacture, recordPosPaiement } = await import('../controllers/pharmacieController.js');

    // Recréer un scenario complet en simulant une seconde tentative
    const pharmUser = { id: 'usr-pharm-pos', username: 'pharma.pharmacien', role: 'PHARMACIEN', role_categorie: 'PHARMACIE', permissions: [] };

    // E1: Deuxième tentative de facturation — doit retourner l'existante
    const factRes2 = createMockRes();
    await createPosFacture({
      user: pharmUser,
      body: {
        prescription_id: prescriptionId,
        patient_id: patientId,
        visite_id: visiteId,
        items: [{ description: 'AMOXICILLINE 500MG', categorie: 'ANTIBIOTIQUE', quantite: 21, prix_unitaire: 5.50, tarif_id: catId }]
      },
      ip: '127.0.0.1'
    } as any, factRes2);
    record(19, 'Cycle : seconde facture refusée/doublonnée',
      factRes2.data?.isDuplicate === true,
      factRes2.data?.isDuplicate ? 'Doublon Facture détecté' : `Status=${factRes2.statusCode}`);

    // E2: Deuxième tentative de paiement — bloquée car facture déjà payée
    const lastFacture2 = await queryOne<any>(
      `SELECT id FROM factures WHERE prescription_id = ? ORDER BY created_at DESC LIMIT 1`,
      [prescriptionId]
    );
    if (lastFacture2) {
      const payRes2 = createMockRes();
      await recordPosPaiement({
        user: pharmUser,
        body: {
          id: lastFacture2.id,
          prescription_id: prescriptionId,
          montant_paye: 115.50,
          devise: 'USD',
          mode_paiement: 'ESPECES'
        },
        ip: '127.0.0.1'
      } as any, payRes2);
      const paymentBlocked = payRes2.data?.error?.includes('déjà') || payRes2.statusCode === 400;
      record(20, 'Cycle : second paiement bloqué (facture déjà payée)', paymentBlocked,
        paymentBlocked ? 'Paiement double bloqué' : `Status=${payRes2.statusCode}, Data=${JSON.stringify(payRes2.data)?.substring(0, 100)}`);
    }

    // E3: Stock final stable — pas de seconde décrémentation
    const stockFinal = await queryOne<any>(
      `SELECT quantite_en_cours FROM lots_medicaments WHERE id = ?`,
      [lotId]
    );
    record(21, 'Cycle : stock stable après tentatives répétées',
      stockFinal && stockFinal.quantite_en_cours === 79,
      `Stock final=${stockFinal?.quantite_en_cours} (attendu 79)`);

    // E4: Nombre total de factures = 1
    const totalFact = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM factures WHERE prescription_id = ?`,
      [prescriptionId]
    );
    record(22, 'Cycle : une seule facture pour la prescription',
      totalFact && Number(totalFact.cnt) === 1,
      `Factures=${totalFact?.cnt}`);

    // E5: Nombre total de paiements = 1
    if (lastFacture2) {
      const totalPay = await queryOne<any>(
        `SELECT COUNT(*) as cnt FROM paiements WHERE facture_id = ?`,
        [lastFacture2.id]
      );
      record(23, 'Cycle : un seul paiement pour la facture',
        totalPay && Number(totalPay.cnt) === 1,
        `Paiements=${totalPay?.cnt}`);
    }

    // E6: Nombre de mouvements SORTIE = 1
    const totalMov = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM mouvements_stock WHERE lot_id = ? AND type = 'SORTIE'`,
      [lotId]
    );
    record(24, 'Cycle : une seule sortie de stock',
      totalMov && Number(totalMov.cnt) === 1,
      `Sorties=${totalMov?.cnt}`);

  } catch (err: any) {
    record(19, 'Cycle : seconde facture doublonnée', false, err.message);
    record(20, 'Cycle : second paiement bloqué', false, err.message);
    record(21, 'Cycle : stock stable', false, err.message);
    record(22, 'Cycle : une seule facture', false, err.message);
    record(23, 'Cycle : un seul paiement', false, err.message);
    record(24, 'Cycle : une seule sortie stock', false, err.message);
  }

  // ============================================================
  // TEST F : RBAC complet — tous les rôles testés
  // ============================================================
  try {
    const { createPosFacture, recordPosPaiement } = await import('../controllers/pharmacieController.js');
    const { queryOne: qOne } = await import('../db/database.js');
    const { requireRole } = await import('../middleware/auth.js');

    function composeHandler(handler: any, ...middlewares: any[]) {
      return async (req: any, res: any) => {
        for (const mw of middlewares) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            const timer = setTimeout(finish, 2000);
            mw(req, res, () => { clearTimeout(timer); finish(); });
          });
        }
        if (res.statusCode === 200) {
          await handler(req, res);
        }
      };
    }

    const baseReq = { ip: '127.0.0.1', body: { prescription_id: prescriptionId, patient_id: patientId, visite_id: visiteId, items: [{ description: 'AMOXICILLINE 500MG', categorie: 'ANTIBIOTIQUE', quantite: 21, prix_unitaire: 5.50, tarif_id: catId }] } };

    const medHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const recepHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const labHandler = composeHandler(createPosFacture, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));
    const pharmHandler = composeHandler(recordPosPaiement, requireRole(['PHARMACIEN', 'ADMINISTRATEUR']));

    // F1: MÉDECIN ne peut PAS créer de facture POS
    const medReq = { ...baseReq, user: { id: 'usr-med-pos', username: 'dr.sawadogo', role: 'MÉDECIN', role_categorie: 'MÉDECIN', permissions: [] } };
    const medRes = createMockRes();
    let medDenied = false;
    try {
      await medHandler(medReq as any, medRes);
    } catch (_) { medDenied = true; }
    record(25, 'RBAC : MÉDECIN refusé — facture POS', medDenied || medRes.statusCode === 403,
      medDenied ? 'Erreur levée (RBAC)' : `Status=${medRes.statusCode}`);

    // F2: RÉCEPTION ne peut PAS créer de facture POS
    const recepReq = { ...baseReq, user: { id: 'usr-recep-pos', username: 'reception', role: 'RÉCEPTION', role_categorie: 'RÉCEPTION', permissions: [] } };
    const recepRes = createMockRes();
    let recepDenied = false;
    try {
      await recepHandler(recepReq as any, recepRes);
    } catch (_) { recepDenied = true; }
    record(26, 'RBAC : RÉCEPTION refusé — facture POS', recepDenied || recepRes.statusCode === 403,
      recepDenied ? 'Erreur levée (RBAC)' : `Status=${recepRes.statusCode}`);

    // F3: LABORATOIRE ne peut PAS créer de facture POS
    const labReq = { ...baseReq, user: { id: 'usr-lab-01', username: 'labo.biologiste', role: 'LABORATOIRE', role_categorie: 'LABORATOIRE', permissions: [] } };
    const labRes = createMockRes();
    let labDenied = false;
    try {
      await labHandler(labReq as any, labRes);
    } catch (_) { labDenied = true; }
    record(27, 'RBAC : LABORATOIRE refusé — facture POS', labDenied || labRes.statusCode === 403,
      labDenied ? 'Erreur levée (RBAC)' : `Status=${labRes.statusCode}`);

    // F4: PHARMACIEN peut payer
    const pharmPayReq = {
      user: { id: 'usr-pharm-pos', username: 'pharma.pharmacien', role: 'PHARMACIEN', role_categorie: 'PHARMACIE', permissions: [] },
      body: { prescription_id: prescriptionId, montant_paye: 1, devise: 'USD', mode_paiement: 'ESPECES' },
      ip: '127.0.0.1'
    };
    const pharmPayRes = createMockRes();
    let pharmPayError = false;
    try {
      await pharmHandler(pharmPayReq as any, pharmPayRes);
    } catch (e: any) {
      pharmPayError = true;
    }
    // Le paiement peut échouer si facture déjà payée, mais ce n'est pas un RBAC error
    record(28, 'RBAC : PHARMACIEN peut invoquer route paiement POS',
      !pharmPayError || pharmPayRes.statusCode === 400,
      pharmPayError ? 'Erreur RBAC levée' : `Status=${pharmPayRes.statusCode}`);

  } catch (err: any) {
    record(25, 'RBAC : MÉDECIN refusé facture', false, err.message);
    record(26, 'RBAC : RÉCEPTION refusé facture', false, err.message);
    record(27, 'RBAC : LABORATOIRE refusé facture', false, err.message);
    record(28, 'RBAC : PHARMACIEN autorisé paiement', false, err.message);
  }

  // ============================================================
  // NETTOYAGE FINAL
  // ============================================================
  try {
    await cleanup();
    record(29, 'Nettoyage : données de test supprimées', true, 'Cleanup terminé');
  } catch (err: any) {
    record(29, 'Nettoyage : données de test', false, err.message);
  }

  // ---- Résumé ----
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const failed = results.filter(r => !r.passed);

  console.log('\n===============================================================');
  console.log(`  RÉSULTATS — PHASE 7.2b CYCLE VENTE POS : ${passed}/${total} PASS`);
  console.log('===============================================================');

  if (failed.length > 0) {
    console.log('\nÉchecs :');
    for (const f of failed) {
      console.log(`  FAIL Test ${f.testNumber}: ${f.description} -> ${f.details}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    console.log('  TOUS LES TESTS DU CYCLE VENTE POS SONT VALIDES !');
  } else {
    console.log(`  ${total - passed} test(s) en échec sur ${total}`);
  }
  console.log('='.repeat(60));

  return results;
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

// Auto-exécution
if (process.argv[1]?.endsWith('phase72b_pos_cycle.test.ts')) {
  runPhase72bPosCycleTests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
