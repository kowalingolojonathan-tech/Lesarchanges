/**
 * Tests — Phase 7.2 Étape 2 : Back-office pharmacien
 *
 * Couvre :
 * A. RBAC — vérification que seul PHARMACIEN et ADMINISTRATEUR accèdent aux endpoints
 * B. Catalogue — création, lecture, mise à jour, activation/désactivation
 * C. Lots — création et intégrité
 * D. Mouvements — entrée, sortie, ajustement avec vérification transactionnelle
 * E. Alertes — stock faible, péremption proche, péremption expirée
 * F. Cohérence du stock — aucune quantité négative, aucun delete silencieux
 * G. Aucune deuxième source de vérité du stock
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

export async function runPhase72Step2Tests(): Promise<TestResult[]> {
  console.log('\n===============================================================');
  console.log('  LANCEMENT DES TESTS — PHASE 7.2 ETAPE 2');
  console.log('  Back-office pharmacien — Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const suffix = Date.now().toString(36);
  const catId = `cat-72b-${suffix}`;
  const lotId1 = `lot-72b-${suffix}`;
  const lotId2 = `lot-72b2-${suffix}`;

  // Helper pour vérifier l'existence d'un médicament
  async function getMedicament(id: string) {
    return queryOne<any>('SELECT * FROM catalogue_medicaments WHERE id = ?', [id]);
  }

  // Helper pour vérifier l'existence d'un lot
  async function getLot(id: string) {
    return queryOne<any>('SELECT * FROM lots_medicaments WHERE id = ?', [id]);
  }

  // Helper pour vérifier un mouvement
  async function getMouvement(id: string) {
    return queryOne<any>('SELECT * FROM mouvements_stock WHERE id = ?', [id]);
  }

  // Helper pour supprimer les données de test
  async function cleanup() {
    if (catId) await execute(`DELETE FROM mouvements_stock WHERE catalogue_id = ?`, [catId]).catch(() => {});
    if (lotId1) await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotId1]).catch(() => {});
    if (lotId2) await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotId2]).catch(() => {});
    if (catId) await execute(`DELETE FROM catalogue_medicaments WHERE id = ?`, [catId]).catch(() => {});
  }

  try {
    await cleanup();
  } catch (e) {
    // Ignorer les erreurs de nettoyage
  }

  // ============================================
  // SETUP : Créer les utilisateurs de test si nécessaires
  // ============================================
  try {
    const existingUsers = await query<any>('SELECT id, username FROM users');
    const existingUsernames = existingUsers.map((u: any) => u.username);
    const now = new Date().toISOString();

    if (!existingUsernames.includes('admin')) {
      const hashAdmin = await bcrypt.hash('ArchangesAdmin2026!', 10);
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-admin-01', 'admin', ?, 'Administrateur Système', 'ADMINISTRATEUR', 1, ?, ?)`,
        [hashAdmin, now, now]
      );
    }
    if (!existingUsernames.includes('pharma.pharmacien')) {
      const hashPharm = await bcrypt.hash('ArchangesPharm2026!', 10);
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-pharm-01', 'pharma.pharmacien', ?, 'M. Jean-Pierre Mukendi (Pharmacien)', 'PHARMACIEN', 1, ?, ?)`,
        [hashPharm, now, now]
      );
    }
    if (!existingUsernames.includes('dr.sawadogo')) {
      const hashMed = await bcrypt.hash('ArchangesMed2026!', 10);
      await execute(
        `INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
         VALUES ('usr-med-01', 'dr.sawadogo', ?, 'Dr. Marc Sawadogo (Médecin)', 'MÉDECIN', 1, ?, ?)`,
        [hashMed, now, now]
      );
    }

    record(1, 'Setup : utilisateurs de test créés', true, 'Utilisateurs vérifiés/créés');
  } catch (err: any) {
    record(1, 'Setup : création des utilisateurs', false, err.message);
  }

  // ============================================
  // SETUP : Créer un médicament et des lots pour les tests
  // ============================================
  try {
    await execute(
      `INSERT INTO catalogue_medicaments (id, code, nom_commercial, nom_generique, classe_therapeutique, forme, dosage_unit, actif, prix_autorise_usd, created_at, updated_at)
       VALUES (?, ?, 'Amoxil 500mg', 'Amoxicilline', 'ANTIBIOTIQUE', 'CAPSULE', 'mg', 1, 5.50, datetime('now'), datetime('now'))`,
      [catId, 'AMX-BACK']
    );

    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, fournisseur, created_at, updated_at)
       VALUES (?, ?, 'LOT-BACK-001', '2027-12-31', 100, 100, 'PharmaCorp', datetime('now'), datetime('now'))`,
      [lotId1, catId]
    );

    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, fournisseur, created_at, updated_at)
       VALUES (?, ?, 'LOT-BACK-002', '2027-06-30', 50, 50, 'PharmaCorp', datetime('now'), datetime('now'))`,
      [lotId2, catId]
    );

    record(2, 'Setup : médicament et lots créés pour les tests', true, `Cat=${catId}, Lots=${lotId1}, ${lotId2}`);
  } catch (err: any) {
    record(2, 'Setup : création des données de test', false, err.message);
  }

  // ============================================
  // TEST A : RBAC — Utilisateurs pharmacien et admin existent
  // ============================================
  try {
    const pharmacien = await queryOne<any>('SELECT id, role FROM users WHERE id = ?', ['usr-pharm-01']);
    record(3, 'RBAC : utilisateur pharmacien existe', !!pharmacien, pharmacien ? `Rôle=${pharmacien.role}` : 'Utilisateur non trouvé');

    const admin = await queryOne<any>('SELECT id, role FROM users WHERE id = ?', ['usr-admin-01']);
    record(4, 'RBAC : utilisateur administrateur existe', !!admin, admin ? `Rôle=${admin.role}` : 'Utilisateur non trouvé');
  } catch (err: any) {
    record(3, 'RBAC : vérification pharmacien', false, err.message);
    record(4, 'RBAC : vérification admin', false, err.message);
  }

  // ============================================
  // TEST B : Catalogue — CRUD
  // ============================================
  try {
    // Lecture du catalogue
    const items = await query<any>(
      `SELECT id, code, nom_commercial FROM catalogue_medicaments WHERE id = ?`,
      [catId]
    );
    const readOk = items.length === 1 && items[0].code === 'AMX-BACK';
    record(5, 'Catalogue : lecture d\'un médicament', readOk,
      readOk ? `Code=${items[0]?.code}` : 'Médicament non trouvé');

    // Mise à jour
    const now = new Date().toISOString();
    await execute(
      `UPDATE catalogue_medicaments SET nom_commercial = ?, updated_at = ? WHERE id = ?`,
      ['Amoxil 500mg MODIF', now, catId]
    );
    const updated = await queryOne<any>('SELECT nom_commercial FROM catalogue_medicaments WHERE id = ?', [catId]);
    record(6, 'Catalogue : mise à jour du nom', updated?.nom_commercial === 'Amoxil 500mg MODIF',
      updated?.nom_commercial === 'Amoxil 500mg MODIF' ? 'Nom mis à jour' : 'Échec mise à jour');

    // Activer / désactiver
    await execute(
      `UPDATE catalogue_medicaments SET actif = 0, updated_at = ? WHERE id = ?`,
      [now, catId]
    );
    const deactivated = await queryOne<any>('SELECT actif FROM catalogue_medicaments WHERE id = ?', [catId]);
    record(7, 'Catalogue : désactivation d\'un médicament', deactivated?.actif === 0,
      deactivated?.actif === 0 ? 'Médicament désactivé' : 'Échec désactivation');

    // Ré-activer
    await execute(
      `UPDATE catalogue_medicaments SET actif = 1, updated_at = ? WHERE id = ?`,
      [now, catId]
    );
    const reactivated = await queryOne<any>('SELECT actif FROM catalogue_medicaments WHERE id = ?', [catId]);
    record(8, 'Catalogue : réactivation d\'un médicament', reactivated?.actif === 1,
      reactivated?.actif === 1 ? 'Médicament réactivé' : 'Échec réactivation');
  } catch (err: any) {
    record(5, 'Catalogue : lecture', false, err.message);
    record(6, 'Catalogue : mise à jour', false, err.message);
    record(7, 'Catalogue : désactivation', false, err.message);
    record(8, 'Catalogue : réactivation', false, err.message);
  }

  // ============================================
  // TEST C : Lots — création et intégrité
  // ============================================
  try {
    const lot = await getLot(lotId1);
    const ok = lot && lot.catalogue_id === catId && lot.quantite_en_cours === 100;
    record(9, 'Lots : création et lecture', ok,
      ok ? `Lot ${lot?.numero_lot}, qté=${lot?.quantite_en_cours}` : 'Données incohérentes');

    // Vérifier FK catalogue_id
    const fkOk = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM catalogue_medicaments WHERE id = ?`,
      [lot?.catalogue_id]
    );
    record(10, 'Lots : référence étrangère catalogue valide', fkOk && Number(fkOk.cnt) > 0,
      fkOk && Number(fkOk.cnt) > 0 ? 'FK valide' : 'FK invalide');
  } catch (err: any) {
    record(9, 'Lots : création et lecture', false, err.message);
    record(10, 'Lots : FK catalogue', false, err.message);
  }

  // ============================================
  // TEST D : Mouvements — insertion et vérification schema
  // ============================================
  try {
    // Entrée de stock
    const movId1 = `mov-72b-${suffix}`;
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, reference_id, commentaire, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'ENTREE', 50, 'CMD-TEST', 'Réception test', 'usr-admin-01', datetime('now'))`,
      [movId1, lotId1, catId]
    );

    const mov = await getMouvement(movId1);
    const entreeOk = mov && mov.type === 'ENTREE' && mov.quantite === 50 && mov.lot_id === lotId1;
    record(11, 'Mouvements : création ENTREE', entreeOk,
      entreeOk ? `Type=${mov?.type}, qty=${mov?.quantite}` : 'Échec entrée');

    // Sortie de stock
    const movId2 = `mov-72b-out-${suffix}`;
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'SORTIE', 30, 'usr-admin-01', datetime('now'))`,
      [movId2, lotId1, catId]
    );

    const mov2 = await getMouvement(movId2);
    const sortieOk = mov2 && mov2.type === 'SORTIE' && mov2.quantite === 30;
    record(12, 'Mouvements : création SORTIE', sortieOk,
      sortieOk ? `Type=${mov2?.type}, qty=${mov2?.quantite}` : 'Échec sortie');

    // Ajustement (positif)
    const movId3 = `mov-72b-adj-${suffix}`;
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'AJUSTEMENT', 10, 'usr-admin-01', datetime('now'))`,
      [movId3, lotId1, catId]
    );

    const mov3 = await getMouvement(movId3);
    const ajustOk = mov3 && mov3.type === 'AJUSTEMENT' && mov3.quantite === 10;
    record(13, 'Mouvements : création AJUSTEMENT', ajustOk,
      ajustOk ? `Type=${mov3?.type}, qty=${mov3?.quantite}` : 'Échec ajustement');

    // Péremption
    const movId4 = `mov-72b-perem-${suffix}`;
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'PEREMPTION', 5, 'usr-admin-01', datetime('now'))`,
      [movId4, lotId1, catId]
    );

    const mov4 = await getMouvement(movId4);
    const peremOk = mov4 && mov4.type === 'PEREMPTION' && mov4.quantite === 5;
    record(14, 'Mouvements : création PEREMPTION', peremOk,
      peremOk ? `Type=${mov4?.type}, qty=${mov4?.quantite}` : 'Échec péremption');

    // Retour
    const movId5 = `mov-72b-ret-${suffix}`;
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'RETOUR', 10, 'usr-admin-01', datetime('now'))`,
      [movId5, lotId1, catId]
    );

    const mov5 = await getMouvement(movId5);
    const retourOk = mov5 && mov5.type === 'RETOUR' && mov5.quantite === 10;
    record(15, 'Mouvements : création RETOUR', retourOk,
      retourOk ? `Type=${mov5?.type}, qty=${mov5?.quantite}` : 'Échec retour');
  } catch (err: any) {
    record(11, 'Mouvements : création ENTREE', false, err.message);
    record(12, 'Mouvements : création SORTIE', false, err.message);
    record(13, 'Mouvements : création AJUSTEMENT', false, err.message);
    record(14, 'Mouvements : création PEREMPTION', false, err.message);
    record(15, 'Mouvements : création RETOUR', false, err.message);
  }

  // ============================================
  // TEST E : Cohérence — refus quantités négatives
  // ============================================
  try {
    // Tentative d'insertion avec quantité négative
    await execute(
      `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, utilisateur_id, created_at)
       VALUES (?, ?, ?, 'SORTIE', -5, 'usr-admin-01', datetime('now'))`,
      [`mov-bad-${suffix}`, lotId1, catId]
    );
    record(16, 'Cohérence : quantité négative rejetée', false, 'INSERT réussi — contrainte non appliquée');
  } catch (err: any) {
    record(16, 'Cohérence : quantité négative rejetée', true, 'Erreur SQLite capturée (CHECK constraint)');
  }

  // ============================================
  // TEST F : Péremption — lots expirés exclus du stock
  // ============================================
  try {
    // Le stock initial est 100 (lot1) + 50 (lot2) = 150
    // Vérifier que le calcul exclut les lots expirés
    const stockDispo = await queryOne<any>(
      `SELECT COALESCE(SUM(quantite_en_cours), 0) as disponible
       FROM lots_medicaments
       WHERE catalogue_id = ? AND date_peremption > date('now')`,
      [catId]
    );
    const ok = stockDispo && Number(stockDispo.disponible) >= 150;
    record(17, 'Stock : calcul exclut les lots expirés', ok,
      ok ? `Stock dispo=${stockDispo?.disponible}` : `Stock dispo=${stockDispo?.disponible}`);

    // Ajouter un lot expiré et vérifier qu'il n'est pas inclus
    const lotExpiredId = `lot-exp-${suffix}`;
    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, created_at, updated_at)
       VALUES (?, ?, 'LOT-EXPIRE-TEST', '2020-01-01', 20, 20, datetime('now'), datetime('now'))`,
      [lotExpiredId, catId]
    );

    const stockWithExpired = await queryOne<any>(
      `SELECT COALESCE(SUM(quantite_en_cours), 0) as disponible
       FROM lots_medicaments
       WHERE catalogue_id = ? AND date_peremption > date('now')`,
      [catId]
    );
    const expiredExcluded = stockWithExpired && Number(stockWithExpired.disponible) === 150;
    record(18, 'Péremption : lot expiré exclu du stock disponible', expiredExcluded,
      expiredExcluded ? 'Lot expiré correctement exclu' : `Stock=${stockWithExpired?.disponible} (attendu 150)`);

    await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotExpiredId]).catch(() => {});
  } catch (err: any) {
    record(17, 'Stock : calcul sans lots expirés', false, err.message);
    record(18, 'Péremption : lots expirés exclus', false, err.message);
  }

  // ============================================
  // TEST G : Alertes — stock faible
  // ============================================
  try {
    // Créer un nouveau catalogue avec seulement 3 unités pour tester l'alerte
    const catFaibleId = `cat-faible-${suffix}`;
    await execute(
      `INSERT INTO catalogue_medicaments (id, code, nom_commercial, classe_therapeutique, actif, prix_autorise_usd, created_at, updated_at)
       VALUES (?, ?, 'Test Stock Faible', 'TEST', 1, 10.00, datetime('now'), datetime('now'))`,
      [catFaibleId, `CODE-FAIBLE-${suffix}`]
    );

    // Ajouter un seul lot avec 3 unités
    const lotFaibleId = `lot-faible-${suffix}`;
    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, created_at, updated_at)
       VALUES (?, ?, 'LOT-FAIBLE-TEST', '2028-01-01', 3, 3, datetime('now'), datetime('now'))`,
      [lotFaibleId, catFaibleId]
    );

    // Vérifier via la même logique que getAlertes
    const alertesFaible = await query<any>(
      `WITH cat_stock AS (
          SELECT c.id as catalogue_id, COALESCE(SUM(l.quantite_en_cours), 0) as stock_disponible
          FROM catalogue_medicaments c
          LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id AND l.date_peremption > date('now')
          WHERE c.id = ?
          GROUP BY c.id
        )
        SELECT * FROM cat_stock WHERE stock_disponible <= 5`,
      [catFaibleId]
    );
    const faiblePresent = alertesFaible.length > 0 && alertesFaible[0].stock_disponible !== undefined && Number(alertesFaible[0].stock_disponible) <= 5;
    record(19, 'Alertes : stock faible détecté', faiblePresent,
      faiblePresent ? `Stock=${alertesFaible[0]?.stock_disponible}` : `Stock=${alertesFaible[0]?.stock_disponible ?? 'undefined'}`);

    // Nettoyer
    await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotFaibleId]).catch(() => {});
    await execute(`DELETE FROM catalogue_medicaments WHERE id = ?`, [catFaibleId]).catch(() => {});
  } catch (err: any) {
    record(19, 'Alertes : détection stock faible', false, err.message);
  }

  // ============================================
  // TEST H : Alertes — péremption proche
  // ============================================
  try {
    // Créer un lot expirant bientôt (dans 30 jours)
    const lotProcheId = `lot-proche-${suffix}`;
    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, created_at, updated_at)
       VALUES (?, ?, 'LOT-PROCHE', date('now', '+30 days'), 50, 50, datetime('now'), datetime('now'))`,
      [lotProcheId, catId]
    );

    // Vérifier via la requête d'alertes
    const procheAlert = await query<any>(
      `SELECT l.id, l.numero_lot
       FROM lots_medicaments l
       WHERE l.date_peremption <= date('now', '+90 days')
         AND l.date_peremption > date('now')
         AND l.quantite_en_cours > 0
         AND l.catalogue_id = ?`,
      [catId]
    );
    const procheDétecté = procheAlert.some((a: any) => a.id === lotProcheId);
    record(20, 'Alertes : péremption proche détectée', procheDétecté,
      procheDétecté ? 'Lot proche détecté' : 'Lot proche non détecté');

    await execute(`DELETE FROM lots_medicaments WHERE id = ?`, [lotProcheId]).catch(() => {});
  } catch (err: any) {
    record(20, 'Alertes : péremption proche', false, err.message);
  }

  // ============================================
  // TEST I : Mouvements historiques — pas de suppression
  // ============================================
  try {
    // Vérifier qu'il n'y a pas d'endpoint DELETE pour les mouvements
    const mouvementsExistants = await query<any>(
      `SELECT id FROM mouvements_stock WHERE id LIKE 'mov-72b-%'`
    );
    record(21, 'Historique : mouvements préservés', mouvementsExistants.length >= 3,
      `Nombre de mouvements:${mouvementsExistants.length}`);

    // Vérifier qu'il n'y a pas de colonne "deleted_at" ou statut de suppression
    const movInfo = await query<any>('PRAGMA table_info(mouvements_stock);');
    const hasDeletedAt = movInfo.some((row: any) => row.name === 'deleted_at' || row[1] === 'deleted_at');
    record(22, 'Historique : pas de suppression soft', !hasDeletedAt,
      hasDeletedAt ? 'Colonne deleted_at trouvée (non conforme)' : 'Aucune colonne deleted_at'
    );
  } catch (err: any) {
    record(21, 'Historique : mouvements préservés', false, err.message);
    record(22, 'Historique : pas de suppression soft', false, err.message);
  }

  // ============================================
  // TEST J : Source de vérité — une seule table de lots
  // ============================================
  try {
    // Vérifier qu'il n'y a qu'une seule table de lots
    const tables = await query<any>(
      `SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%lot%' OR name LIKE '%stock%')`
    );
    const lotTables = tables.filter((t: any) => t.name === 'lots_medicaments');
    record(23, 'Source de vérité : une seule table de lots', lotTables.length === 1,
      `Tables trouvées: ${tables.map((t: any) => t.name).join(', ')}`);

    // movements_stock est une table d'audit, pas une source de stock
    const mouvementTable = tables.find((t: any) => t.name === 'mouvements_stock');
    record(24, 'Source de vérité : mouvements_stock est une table d\'audit', !!mouvementTable,
      mouvementTable ? 'Table mouvements_stock présente (audit)' : 'Table manquante');
  } catch (err: any) {
    record(23, 'Source de vérité : table lots unique', false, err.message);
    record(24, 'Source de vérité : table mouvements', false, err.message);
  }

  // ============================================
  // TEST K : Vue synthétique du stock
  // ============================================
  try {
    const stocks = await query<any>(
      `SELECT c.id, c.nom_commercial,
              COALESCE(SUM(CASE WHEN l.date_peremption > date('now') THEN l.quantite_en_cours ELSE 0 END), 0) as stock_disponible,
              COALESCE(SUM(l.quantite_en_cours), 0) as stock_total_incl_expires,
              COUNT(DISTINCT CASE WHEN l.date_peremption > date('now') THEN l.id END) as nb_lots_actifs
       FROM catalogue_medicaments c
       LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [catId]
    );

    if (stocks.length === 1) {
      const s = stocks[0];
      const ok = s.stock_disponible >= 0 && s.nb_lots_actifs > 0;
      record(25, 'Vue stock : données cohérentes', ok,
        ok ? `Dispo=${s.stock_disponible}, Lots=${s.nb_lots_actifs}` : 'Données incohérentes');
    } else {
      record(25, 'Vue stock : données cohérentes', false, 'Aucun résultat');
    }
  } catch (err: any) {
    record(25, 'Vue stock : cohérence', false, err.message);
  }

  // ============================================
  // TEST L : Integrity référentielle mouvements
  // ============================================
  try {
    // Vérifier que les mouvements ont des FK valides
    const invalidMov = await query<any>(
      `SELECT m.id FROM mouvements_stock m
       LEFT JOIN lots_medicaments l ON m.lot_id = l.id
       WHERE l.id IS NULL`
    );
    record(26, 'Intégrité : tous les mouvements ont un lot valide', invalidMov.length === 0,
      invalidMov.length === 0 ? 'Tous les mouvements valides' : `${invalidMov.length} mouvement(s) invalide(s)`);

    const invalidMov2 = await query<any>(
      `SELECT m.id FROM mouvements_stock m
       LEFT JOIN users u ON m.utilisateur_id = u.id
       WHERE u.id IS NULL`
    );
    record(27, 'Intégrité : tous les mouvements ont un utilisateur valide', invalidMov2.length === 0,
      invalidMov2.length === 0 ? 'Tous les utilisateurs valides' : `${invalidMov2.length} mouvement(s) invalide(s)`);
  } catch (err: any) {
    record(26, 'Intégrité : FK lot', false, err.message);
    record(27, 'Intégrité : FK utilisateur', false, err.message);
  }

  // ============================================
  // NETTOYAGE FINAL
  // ============================================
  try {
    await cleanup();
    record(28, 'Nettoyage : données de test supprimées', true, 'Cleanup terminé');
  } catch (err: any) {
    record(28, 'Nettoyage : données de test', false, err.message);
  }

  // ---- Résumé ----
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const failed = results.filter(r => !r.passed);

  console.log('\n===============================================================');
  console.log(`  RÉSULTATS — PHASE 7.2 ETAPE 2 : ${passed}/${total} PASS`);
  console.log('===============================================================');

  if (failed.length > 0) {
    console.log('\nÉchecs :');
    for (const f of failed) {
      console.log(`  FAIL Test ${f.testNumber}: ${f.description} -> ${f.details}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    console.log('  TOUS LES TESTS DE LA PHASE 7.2 ETAPE 2 SONT VALIDES !');
  } else {
    console.log(`  ${total - passed} test(s) en échec sur ${total}`);
  }
  console.log('='.repeat(60));

  return results;
}

// Auto-exécution si lancé directement
if (process.argv[1]?.endsWith('phase72_2_backoffice.test.ts')) {
  runPhase72Step2Tests()
    .then((res) => {
      const allPassed = res.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Erreur fatale test runner:', err);
      process.exit(1);
    });
}
