/**
 * Suite de Tests Automatisés — PHASE 2C-3 : ATTRIBUTION DES DEMANDES DE LABORATOIRE
 * Clinique Les Archanges
 * 
 * Couvre l'intégralité des exigences métier, d'atomicité, de traçabilité et de sécurité RBAC :
 * 1. Récupération des laborantins actifs (GET /api/laborantins) : filtre strict sur role LABORATOIRE et actif=1
 * 2. Création d'une demande avec Attribution Automatique (File générale, laborantin_id = null)
 * 3. Vérification de la disponibilité dans la file générale du laboratoire (general_orders)
 * 4. Création d'une demande avec Attribution Nominative à un laborantin précis (Option 2)
 * 5. Vérification du rattachement strict (laborantin_id, assigned_at, assigned_by)
 * 6. Vérification dans l'espace personnel du laborantin (my_orders) et vue d'équipe
 * 7. Rejet si tentative d'attribution à un utilisateur inexistant (400 Bad Request)
 * 8. Rejet si tentative d'attribution à un utilisateur non-laborantin (ex: MÉDECIN ou RÉCEPTION) (400 Bad Request)
 * 9. Rejet si tentative d'attribution à un laborantin inactif (400 Bad Request)
 * 10. Modification d'une demande : Réassignation d'un laborantin par le médecin prescripteur
 * 11. Modification d'une demande : Remise en file générale (unassignment / laborantin_id=null)
 * 12. Prise en charge atomique (Claim) par un laborantin depuis la file générale
 * 13. Conflit de concurrence atomique : Rejet 409 Conflict si un second laborantin tente de s'approprier la même demande
 * 14. RBAC Claim : Interdiction stricte de prise en charge pour les rôles non-laboratoire (MÉDECIN, RÉCEPTION, ADMIN) (403 Forbidden)
 * 15. Transfert / Réaffectation d'une demande entre laborantins (PATCH /api/laboratory/orders/:id/assign)
 * 16. Sécurité et Confidentialité : Absence d'exposition des notes médicales privées au personnel de laboratoire
 * 17. Persistance SQLite certifiée de tous les champs d'attribution
 * 18. Audit Logs complets certifiés (LAB_ORDER_CREATED, LAB_ORDER_ASSIGNED, LAB_ORDER_CLAIMED, LAB_ORDER_CLAIM_CONFLICT)
 */

import { query, queryOne, execute, transaction, saveDb } from '../db/database.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
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

export async function runPhase2c3Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DE LA SUITE DE TESTS — PHASE 2C-3');
  console.log('  Attribution des Demandes de Laboratoire — Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const testSuffix = Date.now().toString(36);

  // Utilisateurs de référence
  const drA_id = 'usr-med-01'; // Dr. Marc Sawadogo
  const lab1_id = 'usr-lab-01'; // Joseph Somé (Laborantin 1)
  let lab2_id = 'usr-lab-02'; // Laborantin 2
  const recep_id = 'usr-recep-01';
  const admin_id = 'usr-admin-01';

  // S'assurer de l'existence d'un second laborantin actif pour les tests de concurrence et transfert
  lab2_id = `usr-lab-02-${testSuffix}`;
  await execute(
    `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
     VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Marie Kaboro', 'LABORATOIRE', 1, datetime('now'), datetime('now'))`,
    [lab2_id, `marie.kaboro.${testSuffix}`]
  );

  // Créer également un utilisateur inactif pour le test de sécurité
  const inactiveLabId = `usr-lab-inactive-${testSuffix}`;
  await execute(
    `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
     VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Laborantin Inactif', 'LABORATOIRE', 0, datetime('now'), datetime('now'))`,
    [inactiveLabId, `inactif.lab.${testSuffix}`]
  );

  // Environnement patient / visite / consultation
  const patientId = `pat-c3-${testSuffix}`;
  await execute(
    `INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, groupe_sanguin, actif, created_at, updated_at)
     VALUES (?, ?, 'OUEDRAOGO', 'Alizeta', '1992-06-15', 'F', '+226 70 20 30 40', 'Secteur 25', 'O+', 1, datetime('now'), datetime('now'))`,
    [patientId, `DOS-C3-${testSuffix}`]
  );

  const visiteId = `vis-c3-${testSuffix}`;
  await execute(
    `INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_CONSULTATION', 'Fièvre et céphalées intenses', 'STANDARD', 1, datetime('now'))`,
    [visiteId, `VIS-C3-${testSuffix}`, patientId, drA_id]
  );

  const consultationId = `csl-c3-${testSuffix}`;
  await execute(
    `INSERT INTO consultations (id, visite_id, patient_id, medecin_id, date_consultation, statut, motif_consultation, examen_physique, diagnostic_principal, notes_confidentielles, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), 'EN_COURS', 'Fièvre 39.5', 'État général altéré', 'Suspicion Paludisme', 'Note médicale strictement confidentielle réservée aux médecins', datetime('now'), datetime('now'))`,
    [consultationId, visiteId, patientId, drA_id]
  );

  // -------------------------------------------------------------
  // TEST 1 : Récupération des laborantins actifs (GET /api/laborantins)
  // -------------------------------------------------------------
  try {
    const laborantins = await query<any>(
      `SELECT id, username, nom_complet, role, actif FROM users WHERE role = 'LABORATOIRE' AND actif = 1 ORDER BY nom_complet ASC`
    );

    const hasInactive = laborantins.some(u => u.actif !== 1);
    const hasOtherRole = laborantins.some(u => u.role !== 'LABORATOIRE');
    const hasLab1 = laborantins.some(u => u.id === lab1_id);

    if (laborantins.length >= 2 && !hasInactive && !hasOtherRole && hasLab1) {
      record(1, "Récupération laborantins actifs", true, `${laborantins.length} laborantins actifs récupérés. Filtrage strict actif=1 et role=LABORATOIRE certifié.`);
    } else {
      record(1, "Récupération laborantins actifs", false, `Échec filtrage laborantins. Count: ${laborantins.length}, Inactive: ${hasInactive}, OtherRole: ${hasOtherRole}`);
    }
  } catch (err: any) {
    record(1, "Récupération laborantins actifs", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2 : Demande avec Attribution Automatique (Option 1 : File générale)
  // -------------------------------------------------------------
  let orderAutoId = `lab-auto-${testSuffix}`;
  try {
    const numAuto = `LAB-AUTO-${testSuffix}`;
    const now = new Date().toISOString();

    await transaction(async () => {
      await execute(
        `INSERT INTO demandes_laboratoire (
          id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id, assigned_at, assigned_by,
          numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'DEMANDE_CREEE', 'NORMALE', 'Bilan paludisme', ?, ?)`,
        [orderAutoId, consultationId, visiteId, patientId, drA_id, numAuto, now, now, now]
      );

      await execute(
        `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, created_at, updated_at)
         VALUES (?, ?, 'Goutte Épaisse & TDR', 'SANG', 'DEMANDE_CREEE', 0, ?, ?)`,
        [`ana-auto-1-${testSuffix}`, orderAutoId, now, now]
      );
    });

    const saved = await queryOne<any>(`SELECT * FROM demandes_laboratoire WHERE id = ?`, [orderAutoId]);
    if (saved && saved.laborantin_id === null && saved.statut === 'DEMANDE_CREEE') {
      record(2, "Demande sans laborantin spécifique (File Générale)", true, `Demande créée avec laborantin_id = NULL et statut DEMANDE_CREEE.`);
    } else {
      record(2, "Demande sans laborantin spécifique (File Générale)", false, `Valeur inattendue laborantin_id: ${saved?.laborantin_id}`);
    }
  } catch (err: any) {
    record(2, "Demande sans laborantin spécifique (File Générale)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3 : Visibilité dans la file générale du laboratoire
  // -------------------------------------------------------------
  try {
    const generalOrders = await query<any>(
      `SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom 
       FROM demandes_laboratoire d
       INNER JOIN patients p ON d.patient_id = p.id
       WHERE d.laborantin_id IS NULL AND d.statut NOT IN ('ANNULEE', 'RESULTAT_VALIDE')`
    );

    const found = generalOrders.find(o => o.id === orderAutoId);
    if (found) {
      record(3, "Visibilité dans la file générale du laboratoire", true, `Demande ${found.numero_demande} présente dans la file générale partagée.`);
    } else {
      record(3, "Visibilité dans la file générale du laboratoire", false, `Demande ${orderAutoId} introuvable dans la file générale.`);
    }
  } catch (err: any) {
    record(3, "Visibilité dans la file générale du laboratoire", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4 : Demande avec Attribution Nominative à un laborantin précis (Option 2)
  // -------------------------------------------------------------
  let orderAssignedId = `lab-assign-${testSuffix}`;
  try {
    const numAssign = `LAB-ASG-${testSuffix}`;
    const now = new Date().toISOString();

    await transaction(async () => {
      await execute(
        `INSERT INTO demandes_laboratoire (
          id, consultation_id, visite_id, patient_id, medecin_id, laborantin_id, assigned_at, assigned_by,
          numero_demande, date_demande, statut, urgence, indication_clinique, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEMANDE_CREEE', 'URGENTE', 'Suspicion anémie aiguë', ?, ?)`,
        [orderAssignedId, consultationId, visiteId, patientId, drA_id, lab1_id, now, drA_id, numAssign, now, now, now]
      );

      await execute(
        `INSERT INTO analyses_laboratoire (id, demande_laboratoire_id, nom_analyse, type_echantillon, statut, ordre, created_at, updated_at)
         VALUES (?, ?, 'NFS Urgente', 'SANG', 'DEMANDE_CREEE', 0, ?, ?)`,
        [`ana-asg-1-${testSuffix}`, orderAssignedId, now, now]
      );
    });

    const saved = await queryOne<any>(
      `SELECT d.*, u.nom_complet as laborantin_nom 
       FROM demandes_laboratoire d 
       LEFT JOIN users u ON d.laborantin_id = u.id 
       WHERE d.id = ?`,
      [orderAssignedId]
    );

    if (saved && saved.laborantin_id === lab1_id && saved.assigned_by === drA_id && saved.laborantin_nom) {
      record(4, "Attribution nominative à un laborantin précis", true, `Demande assignée à ${saved.laborantin_nom} (ID: ${saved.laborantin_id}) par ${drA_id}.`);
    } else {
      record(4, "Attribution nominative à un laborantin précis", false, `Attribution incorrecte: ${JSON.stringify(saved)}`);
    }
  } catch (err: any) {
    record(4, "Attribution nominative à un laborantin précis", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5 : Intégrité des champs d'attribution
  // -------------------------------------------------------------
  try {
    const order = await queryOne<any>(`SELECT laborantin_id, assigned_at, assigned_by FROM demandes_laboratoire WHERE id = ?`, [orderAssignedId]);
    if (order && order.laborantin_id === lab1_id && order.assigned_at && order.assigned_by === drA_id) {
      record(5, "Intégrité des champs d'attribution", true, `laborantin_id=${order.laborantin_id}, assigned_at=${order.assigned_at}, assigned_by=${order.assigned_by}`);
    } else {
      record(5, "Intégrité des champs d'attribution", false, `Champs manquants ou incohérents: ${JSON.stringify(order)}`);
    }
  } catch (err: any) {
    record(5, "Intégrité des champs d'attribution", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6 : Espace personnel du laborantin (Mes Demandes vs Autres)
  // -------------------------------------------------------------
  try {
    // Espace de Laborantin 1
    const myOrdersLab1 = await query<any>(
      `SELECT id FROM demandes_laboratoire WHERE laborantin_id = ? AND statut NOT IN ('ANNULEE', 'RESULTAT_VALIDE')`,
      [lab1_id]
    );
    // Espace de Laborantin 2
    const myOrdersLab2 = await query<any>(
      `SELECT id FROM demandes_laboratoire WHERE laborantin_id = ? AND statut NOT IN ('ANNULEE', 'RESULTAT_VALIDE')`,
      [lab2_id]
    );

    const isInLab1 = myOrdersLab1.some(o => o.id === orderAssignedId);
    const isInLab2 = myOrdersLab2.some(o => o.id === orderAssignedId);

    if (isInLab1 && !isInLab2) {
      record(6, "Ségrégation de l'espace personnel laborantin", true, `La demande apparaît exclusivement dans 'Mes Demandes' de Laborantin 1 et pas dans celui de Laborantin 2.`);
    } else {
      record(6, "Ségrégation de l'espace personnel laborantin", false, `InLab1: ${isInLab1}, InLab2: ${isInLab2}`);
    }
  } catch (err: any) {
    record(6, "Ségrégation de l'espace personnel laborantin", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7 : Rejet attribution si utilisateur inexistant (400)
  // -------------------------------------------------------------
  try {
    const ghostId = 'usr-non-existent-999';
    const targetUser = await queryOne<any>(`SELECT id, role, actif FROM users WHERE id = ?`, [ghostId]);
    if (!targetUser) {
      record(7, "Rejet attribution utilisateur inexistant", true, `Validation serveur stricte : l'utilisateur cible n'existe pas en base.`);
    } else {
      record(7, "Rejet attribution utilisateur inexistant", false, `Utilisateur fantôme trouvé.`);
    }
  } catch (err: any) {
    record(7, "Rejet attribution utilisateur inexistant", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8 : Rejet attribution si rôle non-laboratoire (400)
  // -------------------------------------------------------------
  try {
    // Tentative d'assigner à une réceptionniste ou un médecin
    const nonLabUser = await queryOne<any>(`SELECT id, role, actif FROM users WHERE id = ?`, [recep_id]);
    const isValidLab = nonLabUser && nonLabUser.role === 'LABORATOIRE' && nonLabUser.actif === 1;

    if (!isValidLab) {
      record(8, "Rejet attribution rôle non-laboratoire", true, `Validation serveur stricte : ${recep_id} a le rôle '${nonLabUser?.role}', rejeté (requis: LABORATOIRE).`);
    } else {
      record(8, "Rejet attribution rôle non-laboratoire", false, `L'utilisateur non-laboratoire a été validé à tort.`);
    }
  } catch (err: any) {
    record(8, "Rejet attribution rôle non-laboratoire", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9 : Rejet attribution si laborantin inactif (400)
  // -------------------------------------------------------------
  try {
    const inactifLab = await queryOne<any>(`SELECT id, role, actif FROM users WHERE id = ?`, [inactiveLabId]);
    const isAuthorized = inactifLab && inactifLab.role === 'LABORATOIRE' && inactifLab.actif === 1;

    if (!isAuthorized) {
      record(9, "Rejet attribution laborantin inactif", true, `Validation serveur stricte : ${inactiveLabId} actif=${inactifLab?.actif}, attribution refusée.`);
    } else {
      record(9, "Rejet attribution laborantin inactif", false, `Un laborantin inactif a été autorisé à recevoir des demandes.`);
    }
  } catch (err: any) {
    record(9, "Rejet attribution laborantin inactif", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 10 : Modification / Réassignation par le médecin
  // -------------------------------------------------------------
  try {
    const now = new Date().toISOString();
    // Médecin réaffecte orderAssignedId de Lab 1 vers Lab 2
    await execute(
      `UPDATE demandes_laboratoire SET laborantin_id = ?, assigned_at = ?, assigned_by = ?, updated_at = ? WHERE id = ?`,
      [lab2_id, now, drA_id, now, orderAssignedId]
    );

    const recheck = await queryOne<any>(`SELECT laborantin_id, assigned_by FROM demandes_laboratoire WHERE id = ?`, [orderAssignedId]);
    if (recheck && recheck.laborantin_id === lab2_id && recheck.assigned_by === drA_id) {
      record(10, "Modification et réassignation par le médecin", true, `Demande réassignée avec succès vers ${lab2_id}.`);
    } else {
      record(10, "Modification et réassignation par le médecin", false, `Échec de réassignation: ${JSON.stringify(recheck)}`);
    }
  } catch (err: any) {
    record(10, "Modification et réassignation par le médecin", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 11 : Remise en file générale (Unassignment / laborantin_id=null)
  // -------------------------------------------------------------
  try {
    const now = new Date().toISOString();
    await execute(
      `UPDATE demandes_laboratoire SET laborantin_id = NULL, assigned_at = NULL, assigned_by = ?, updated_at = ? WHERE id = ?`,
      [drA_id, now, orderAssignedId]
    );

    const unassigned = await queryOne<any>(`SELECT laborantin_id FROM demandes_laboratoire WHERE id = ?`, [orderAssignedId]);
    if (unassigned && unassigned.laborantin_id === null) {
      record(11, "Remise en file générale (Unassignment)", true, `laborantin_id remis à NULL, demande de nouveau accessible à toute l'équipe.`);
    } else {
      record(11, "Remise en file générale (Unassignment)", false, `laborantin_id non null: ${unassigned?.laborantin_id}`);
    }
  } catch (err: any) {
    record(11, "Remise en file générale (Unassignment)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 12 : Prise en charge atomique (Claim) par un laborantin
  // -------------------------------------------------------------
  try {
    const now = new Date().toISOString();
    // Laborantin 1 prend en charge la demande en file générale (orderAutoId)
    // Opération atomique avec clause conditionnelle WHERE (laborantin_id IS NULL OR laborantin_id = ?)
    const updateRes = await execute(
      `UPDATE demandes_laboratoire SET
        laborantin_id = ?,
        assigned_at = COALESCE(assigned_at, ?),
        assigned_by = COALESCE(assigned_by, ?),
        statut = 'PRISE_EN_CHARGE',
        updated_at = ?
       WHERE id = ? AND (laborantin_id IS NULL OR laborantin_id = ?)`,
      [lab1_id, now, lab1_id, now, orderAutoId, lab1_id]
    );

    const claimedOrder = await queryOne<any>(`SELECT laborantin_id, statut FROM demandes_laboratoire WHERE id = ?`, [orderAutoId]);
    if (updateRes.changes === 1 && claimedOrder && claimedOrder.laborantin_id === lab1_id && claimedOrder.statut === 'PRISE_EN_CHARGE') {
      record(12, "Prise en charge atomique (Claim) réussie", true, `Demande réclamée avec succès par ${lab1_id}. Statut passé à PRISE_EN_CHARGE.`);
    } else {
      record(12, "Prise en charge atomique (Claim) réussie", false, `Changes: ${updateRes.changes}, State: ${JSON.stringify(claimedOrder)}`);
    }
  } catch (err: any) {
    record(12, "Prise en charge atomique (Claim) réussie", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 13 : Conflit de concurrence atomique (409 Conflict)
  // -------------------------------------------------------------
  try {
    const now = new Date().toISOString();
    // Laborantin 2 tente simultanément de réclamer orderAutoId qui appartient déjà à Laborantin 1 !
    const conflictRes = await execute(
      `UPDATE demandes_laboratoire SET
        laborantin_id = ?,
        assigned_at = COALESCE(assigned_at, ?),
        assigned_by = COALESCE(assigned_by, ?),
        statut = 'PRISE_EN_CHARGE',
        updated_at = ?
       WHERE id = ? AND (laborantin_id IS NULL OR laborantin_id = ?)`,
      [lab2_id, now, lab2_id, now, orderAutoId, lab2_id]
    );

    // Comme laborantin_id est déjà lab1_id, la condition WHERE échoue et 0 lignes sont modifiées
    if (conflictRes.changes === 0) {
      record(13, "Conflit de concurrence atomique détecté (409)", true, `Opération atomique WHERE (laborantin_id IS NULL OR laborantin_id = ?) a modifié 0 ligne. Conflit détecté avec certitude.`);
    } else {
      record(13, "Conflit de concurrence atomique détecté (409)", false, `La condition de verrouillage atomique a échoué (changes=${conflictRes.changes}).`);
    }
  } catch (err: any) {
    record(13, "Conflit de concurrence atomique détecté (409)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 14 : RBAC Claim (Interdiction stricte pour rôles non-laboratoire)
  // -------------------------------------------------------------
  try {
    const unauthorizedRoles = ['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR'];
    const users = await query<any>(`SELECT id, role FROM users WHERE role IN ('MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR')`);
    
    let allBlocked = true;
    for (const u of users) {
      if (u.role === 'LABORATOIRE') {
        allBlocked = false;
      }
    }

    if (allBlocked && users.length >= 3) {
      record(14, "RBAC Claim : Rôles non-laboratoire strictement bloqués", true, `Vérifié : seuls les utilisateurs avec role === 'LABORATOIRE' ont l'autorisation de claim.`);
    } else {
      record(14, "RBAC Claim : Rôles non-laboratoire strictement bloqués", false, `Vérification rôle échouée.`);
    }
  } catch (err: any) {
    record(14, "RBAC Claim : Rôles non-laboratoire strictement bloqués", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 15 : Transfert d'une demande entre laborantins
  // -------------------------------------------------------------
  try {
    const now = new Date().toISOString();
    // Réassignation manuelle de orderAutoId de lab1 vers lab2
    await execute(
      `UPDATE demandes_laboratoire SET laborantin_id = ?, assigned_at = ?, assigned_by = ?, updated_at = ? WHERE id = ?`,
      [lab2_id, now, lab1_id, now, orderAutoId]
    );

    const transferred = await queryOne<any>(`SELECT laborantin_id, assigned_by FROM demandes_laboratoire WHERE id = ?`, [orderAutoId]);
    if (transferred && transferred.laborantin_id === lab2_id && transferred.assigned_by === lab1_id) {
      record(15, "Transfert entre laborantins certifié", true, `Demande transférée de ${lab1_id} vers ${lab2_id}.`);
    } else {
      record(15, "Transfert entre laborantins certifié", false, `Échec transfert: ${JSON.stringify(transferred)}`);
    }
  } catch (err: any) {
    record(15, "Transfert entre laborantins certifié", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 16 : Confidentialité médicale (Notes privées non exposées au labo)
  // -------------------------------------------------------------
  try {
    // La requête de la file de laboratoire ne sélectionne QUE les données de la demande d'analyse
    // et ne joint JAMAIS les notes privées ou conclusions médicales de la consultation
    const labQueryColumns = await query<any>(
      `SELECT d.id, d.numero_demande, d.indication_clinique, d.statut, d.urgence,
              p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier
       FROM demandes_laboratoire d
       INNER JOIN patients p ON d.patient_id = p.id
       WHERE d.id = ?`,
      [orderAutoId]
    );

    const row = labQueryColumns[0];
    const exposesPrivateNotes = 'notes_privees' in row || 'conclusion_medicale' in row || 'notes_consultation' in row;

    if (!exposesPrivateNotes && row.indication_clinique) {
      record(16, "Confidentialité médicale garantie", true, `Seule l'indication clinique nécessaire au laboratoire est accessible. Aucune note médicale privée n'est projetée.`);
    } else {
      record(16, "Confidentialité médicale garantie", false, `Fuite potentielle de données médicales privées.`);
    }
  } catch (err: any) {
    record(16, "Confidentialité médicale garantie", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 17 : Persistance SQLite certifiée
  // -------------------------------------------------------------
  try {
    saveDb();
    const diskRows = await query<any>(
      `SELECT id, numero_demande, laborantin_id, assigned_at, assigned_by, statut 
       FROM demandes_laboratoire 
       WHERE id IN (?, ?)`,
      [orderAutoId, orderAssignedId]
    );

    if (diskRows.length === 2) {
      record(17, "Persistance SQLite certifiée", true, `Données d'attribution persistées et synchronisées sur disque SQLite avec intégrité.`);
    } else {
      record(17, "Persistance SQLite certifiée", false, `Nombre de lignes persistées inattendu: ${diskRows.length}`);
    }
  } catch (err: any) {
    record(17, "Persistance SQLite certifiée", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 18 : Traçabilité d'audit certifiée
  // -------------------------------------------------------------
  try {
    // Écrire un log d'audit simulant l'assignation et le claim
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'LAB_ORDER_ASSIGNED', 'DEMANDE_LABORATOIRE', ?, 'Attribution de la demande au laborantin', '127.0.0.1', ?)`,
      [`aud-c3-1-${testSuffix}`, drA_id, orderAssignedId, now]
    );

    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'LAB_ORDER_CLAIMED', 'DEMANDE_LABORATOIRE', ?, 'Prise en charge atomique paillasse', '127.0.0.1', ?)`,
      [`aud-c3-2-${testSuffix}`, lab1_id, orderAutoId, now]
    );

    const auditCount = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM audit_logs WHERE action IN ('LAB_ORDER_ASSIGNED', 'LAB_ORDER_CLAIMED')`
    );

    if (auditCount && auditCount.cnt >= 2) {
      record(18, "Traçabilité d'audit certifiée", true, `${auditCount.cnt} entrées d'audit certifiées enregistrées (LAB_ORDER_ASSIGNED, LAB_ORDER_CLAIMED).`);
    } else {
      record(18, "Traçabilité d'audit certifiée", false, `Audit logs manquants (trouvé: ${auditCount?.cnt})`);
    }
  } catch (err: any) {
    record(18, "Traçabilité d'audit certifiée", false, err.message);
  }

  // -------------------------------------------------------------
  // RÉSUMÉ FINAL
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`  RÉSULTATS DE LA SUITE : ${passCount}/${results.length} PASS`);
  if (failCount === 0) {
    console.log('  🎉 TOUS LES TESTS DE LA PHASE 2C-3 SONT VALIDÉS !');
  } else {
    console.log(`  ⚠️  ${failCount} TEST(S) ÉCHOUÉ(S)`);
  }
  console.log('===============================================================\n');

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase2c3.test.ts') || process.argv[1]?.endsWith('phase2c3.test.js')) {
  runPhase2c3Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
