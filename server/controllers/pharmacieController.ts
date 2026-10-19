import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryAll, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { AuthenticatedRequest, isPharmacistRole } from '../middleware/auth.js';
import { createLinkedFactureCore, getFactureFinancialDetails } from './billingController.js';

/**
 * GET /api/pharmacie/catalogue
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function getCatalogueMedicaments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { actif, search, classe } = req.query;
  try {
    let sql = `
      SELECT id, code, nom_commercial, nom_generique, classe_therapeutique, categorie,
             forme, dosage_unit, actif, prix_autorise_usd, created_at, updated_at
      FROM catalogue_medicaments WHERE 1=1
    `;
    const params: any[] = [];

    if (actif !== undefined && actif !== 'ALL') {
      sql += ' AND actif = ?';
      params.push(actif === '1' || actif === 'true' ? 1 : 0);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      sql += ' AND (nom_commercial LIKE ? OR nom_generique LIKE ? OR code LIKE ?)';
      params.push(s, s, s);
    }
    if (classe && typeof classe === 'string' && classe.trim()) {
      sql += ' AND classe_therapeutique = ?';
      params.push(classe.trim());
    }

    sql += ' ORDER BY classe_therapeutique ASC, nom_commercial ASC';

    const items = await queryAll(sql, params);

    // Enrichir avec le stock disponible (lots non expirés)
    const enriched = await Promise.all(
      items.map(async (med: any) => {
        const stock = await queryOne<any>(
          `SELECT COALESCE(SUM(quantite_en_cours), 0) as disponible
           FROM lots_medicaments
           WHERE catalogue_id = ? AND date_peremption > date('now')`,
          [med.id]
        );
        const ok = stock && Number(stock.disponible) <= 10;
        return { ...med, stock_disponible: Number(stock?.disponible ?? 0), alerte: ok ? 'FAIBLE' : null };
      })
    );

    res.json({ medicaments: enriched });
  } catch (err: any) {
    console.error('Erreur getCatalogueMedicaments:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du catalogue.' });
  }
}

/**
 * POST /api/pharmacie/catalogue
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function createMedicament(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user || (!isPharmacistRole(user) && user.role !== 'ADMINISTRATEUR')) {
    res.status(403).json({ error: 'Accès réservé au Pharmacien ou à l\'Administrateur.' });
    return;
  }

  const { code, nom_commercial, nom_generique, classe_therapeutique, categorie, forme, dosage_unit, prix_autorise_usd } = req.body;

  if (!code || !nom_commercial) {
    res.status(400).json({ error: 'Le code et le nom commercial sont obligatoires.' });
    return;
  }

  try {
    const id = `med-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();
    const prix = Math.round((parseFloat(prix_autorise_usd) || 0) * 100) / 100;

    await execute(
      `INSERT INTO catalogue_medicaments (id, code, nom_commercial, nom_generique, classe_therapeutique, categorie, forme, dosage_unit, actif, prix_autorise_usd, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [id, code.trim(), nom_commercial.trim(), nom_generique?.trim() || null, classe_therapeutique?.trim() || null, categorie?.trim() || null, forme?.trim() || null, dosage_unit?.trim() || null, prix, now, now]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PHARMACIE_CATALOGUE_CREATE',
      ressourceType: 'CATALOGUE_MEDICAMENT',
      ressourceId: id,
      details: `Création médicament : ${nom_commercial.trim()} (${code.trim()}) — prix: ${prix} USD`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const created = await queryOne<any>('SELECT * FROM catalogue_medicaments WHERE id = ?', [id]);
    res.status(201).json({ success: true, medicament: created });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Ce code de médicament existe déjà.' });
      return;
    }
    console.error('Erreur createMedicament:', err);
    res.status(500).json({ error: 'Erreur lors de la création du médicament.' });
  }
}

/**
 * PUT /api/pharmacie/catalogue/:id
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function updateMedicament(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user || (!isPharmacistRole(user) && user.role !== 'ADMINISTRATEUR')) {
    res.status(403).json({ error: 'Accès réservé au Pharmacien ou à l\'Administrateur.' });
    return;
  }

  const { id } = req.params;
  const { nom_commercial, nom_generique, classe_therapeutique, categorie, forme, dosage_unit, prix_autorise_usd } = req.body;

  try {
    const existing = await queryOne<any>('SELECT * FROM catalogue_medicaments WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Médicament introuvable.' });
      return;
    }

    const now = new Date().toISOString();
    const prix = Math.round((parseFloat(prix_autorise_usd) ?? existing.prix_autorise_usd) * 100) / 100;

    await execute(
      `UPDATE catalogue_medicaments SET
         nom_commercial = ?, nom_generique = ?, classe_therapeutique = ?, categorie = ?,
         forme = ?, dosage_unit = ?, prix_autorise_usd = ?, updated_at = ?
       WHERE id = ?`,
      [
        nom_commercial?.trim() || existing.nom_commercial,
        nom_generique?.trim() || null,
        classe_therapeutique?.trim() || existing.classe_therapeutique,
        categorie?.trim() || existing.categorie,
        forme?.trim() || existing.forme,
        dosage_unit?.trim() || existing.dosage_unit,
        prix,
        now,
        id
      ]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PHARMACIE_CATALOGUE_UPDATE',
      ressourceType: 'CATALOGUE_MEDICAMENT',
      ressourceId: id,
      details: `Modification du médicament ${existing.nom_commercial} — nouveau prix: ${prix} USD`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne<any>('SELECT * FROM catalogue_medicaments WHERE id = ?', [id]);
    res.json({ success: true, medicament: updated });
  } catch (err: any) {
    console.error('Erreur updateMedicament:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du médicament.' });
  }
}

/**
 * PATCH /api/pharmacie/catalogue/:id/toggle-active
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function toggleMedicamentActif(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user || (!isPharmacistRole(user) && user.role !== 'ADMINISTRATEUR')) {
    res.status(403).json({ error: 'Accès réservé au Pharmacien ou à l\'Administrateur.' });
    return;
  }

  const { id } = req.params;

  try {
    const existing = await queryOne<any>('SELECT * FROM catalogue_medicaments WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Médicament introuvable.' });
      return;
    }

    const newActif = existing.actif === 1 ? 0 : 1;
    const now = new Date().toISOString();

    await execute('UPDATE catalogue_medicaments SET actif = ?, updated_at = ? WHERE id = ?', [newActif, now, id]);

    await auditLogger.log({
      userId: user.id,
      action: 'PHARMACIE_CATALOGUE_TOGGLE',
      ressourceType: 'CATALOGUE_MEDICAMENT',
      ressourceId: id,
      details: `Médicament ${existing.nom_commercial} passé à ${newActif === 1 ? 'ACTIF' : 'INACTIF'}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ success: true, id, actif: newActif });
  } catch (err: any) {
    console.error('Erreur toggleMedicamentActif:', err);
    res.status(500).json({ error: 'Erreur lors du basculement du statut.' });
  }
}

// ============================================================================
// LOTS MEDICAMENTS
// ============================================================================

/**
 * GET /api/pharmacie/lots
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function getLots(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { catalogue_id, near_expiry_days } = req.query;
  try {
    let sql = `
      SELECT l.id, l.catalogue_id, c.nom_commercial, c.code, l.numero_lot,
             l.date_peremption, l.quantite_recue, l.quantite_en_cours, l.fournisseur,
             l.created_at, l.updated_at
      FROM lots_medicaments l
      JOIN catalogue_medicaments c ON l.catalogue_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (catalogue_id) {
      sql += ' AND l.catalogue_id = ?';
      params.push(catalogue_id);
    }
    if (near_expiry_days && typeof near_expiry_days === 'string') {
      const days = parseInt(near_expiry_days, 10);
      if (!isNaN(days) && days > 0) {
        sql += ' AND l.date_peremption <= date(\'now\', ?) AND l.date_peremption > date(\'now\')';
        params.push(`+${days} days`);
      }
    }

    sql += ' ORDER BY l.date_peremption ASC, l.created_at DESC';

    const lots = await queryAll(sql, params);
    res.json({ lots });
  } catch (err: any) {
    console.error('Erreur getLots:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des lots.' });
  }
}

/**
 * POST /api/pharmacie/lots
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function createLot(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user || (!isPharmacistRole(user) && user.role !== 'ADMINISTRATEUR')) {
    res.status(403).json({ error: 'Accès réservé au Pharmacien ou à l\'Administrateur.' });
    return;
  }

  const { catalogue_id, numero_lot, date_peremption, quantite_recue, fournisseur } = req.body;

  if (!catalogue_id || !numero_lot || !date_peremption) {
    res.status(400).json({ error: 'catalogue_id, numero_lot et date_peremption sont obligatoires.' });
    return;
  }

  const qty = parseInt(String(quantite_recue || 0), 10);
  if (isNaN(qty) || qty < 0) {
    res.status(400).json({ error: 'quantite_recue doit être un nombre positif.' });
    return;
  }

  try {
    const id = `lot-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO lots_medicaments (id, catalogue_id, numero_lot, date_peremption, quantite_recue, quantite_en_cours, fournisseur, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, catalogue_id, numero_lot.trim(), date_peremption, qty, qty, fournisseur?.trim() || null, now, now]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PHARMACIE_LOT_CREATE',
      ressourceType: 'LOT_MEDICAMENT',
      ressourceId: id,
      details: `Création lot ${numero_lot.trim()} — qté: ${qty}, péremption: ${date_peremption}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const created = await queryOne<any>('SELECT * FROM lots_medicaments WHERE id = ?', [id]);
    res.status(201).json({ success: true, lot: created });
  } catch (err: any) {
    console.error('Erreur createLot:', err);
    res.status(500).json({ error: 'Erreur lors de la création du lot.' });
  }
}

// ============================================================================
// MOUVEMENTS DE STOCK
// ============================================================================

/**
 * GET /api/pharmacie/mouvements
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function getMouvements(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { lot_id, catalogue_id, type, limit } = req.query;
  try {
    let sql = `
      SELECT m.id, m.lot_id, l.numero_lot, l.date_peremption,
             m.catalogue_id, c.nom_commercial, c.code,
             m.type, m.quantite, m.reference_id, m.commentaire,
             m.utilisateur_id, u.nom_complet as utilisateur_nom,
             m.created_at
      FROM mouvements_stock m
      JOIN lots_medicaments l ON m.lot_id = l.id
      JOIN catalogue_medicaments c ON m.catalogue_id = c.id
      LEFT JOIN users u ON m.utilisateur_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (lot_id) {
      sql += ' AND m.lot_id = ?';
      params.push(lot_id);
    }
    if (catalogue_id) {
      sql += ' AND m.catalogue_id = ?';
      params.push(catalogue_id);
    }
    if (type) {
      sql += ' AND m.type = ?';
      params.push(type);
    }
    sql += ' ORDER BY m.created_at DESC';
    if (limit && typeof limit === 'string') {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) sql += ` LIMIT ${n}`;
    }

    const mouvements = await queryAll(sql, params);
    res.json({ mouvements });
  } catch (err: any) {
    console.error('Erreur getMouvements:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des mouvements.' });
  }
}

/**
 * POST /api/pharmacie/mouvements
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 * Types: ENTREE, SORTIE, AJUSTEMENT, PEREMPTION, RETOUR
 */
export async function createMouvement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user || (!isPharmacistRole(user) && user.role !== 'ADMINISTRATEUR')) {
    res.status(403).json({ error: 'Accès réservé au Pharmacien ou à l\'Administrateur.' });
    return;
  }

  const { lot_id, catalogue_id, type, quantite, reference_id, commentaire } = req.body;

  if (!lot_id || !catalogue_id || !type || !quantite) {
    res.status(400).json({ error: 'lot_id, catalogue_id, type et quantite sont obligatoires.' });
    return;
  }

  const validTypes = ['ENTREE', 'SORTIE', 'AJUSTEMENT', 'PEREMPTION', 'RETOUR'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Type invalide. Choix possibles : ${validTypes.join(', ')}` });
    return;
  }

  const qty = parseInt(String(quantite), 10);
  if (isNaN(qty) || qty <= 0) {
    res.status(400).json({ error: 'quantite doit être un nombre strictement positif.' });
    return;
  }

  try {
    const mouvementId = `mov-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();

    await transaction(async () => {
      // Vérifier le lot existe et est actif
      const lot = await queryOne<any>('SELECT * FROM lots_medicaments WHERE id = ?', [lot_id]);
      if (!lot) {
        throw new Error('Lot introuvable.');
      }
      if (lot.catalogue_id !== catalogue_id) {
        throw new Error('Le lot ne correspond pas au catalogue sélectionné.');
      }

// Pour SORTIE, PEREMPTION et RETOUR, vérifier la quantité disponible
      if ((type === 'SORTIE' || type === 'PEREMPTION' || type === 'RETOUR') && lot.quantite_en_cours < qty) {
        throw new Error(`Stock insuffisant : ${lot.quantite_en_cours} disponible, ${qty} demandé.`);
      }

      await execute(
        `INSERT INTO mouvements_stock (id, lot_id, catalogue_id, type, quantite, reference_id, commentaire, utilisateur_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mouvementId, lot_id, catalogue_id, type, qty, reference_id?.trim() || null, commentaire?.trim() || null, user.id, now]
      );

      // Mettre à jour quantite_en_cours du lot
      if (type === 'ENTREE') {
        await execute('UPDATE lots_medicaments SET quantite_en_cours = quantite_en_cours + ?, updated_at = ? WHERE id = ?', [qty, now, lot_id]);
      } else if (type === 'SORTIE' || type === 'PEREMPTION' || type === 'RETOUR') {
        await execute('UPDATE lots_medicaments SET quantite_en_cours = quantite_en_cours - ?, updated_at = ? WHERE id = ?', [qty, now, lot_id]);
      } else if (type === 'AJUSTEMENT') {
        await execute('UPDATE lots_medicaments SET quantite_en_cours = quantite_en_cours + ?, updated_at = ? WHERE id = ?', [qty, now, lot_id]);
      }
    });

    await auditLogger.log({
      userId: user.id,
      action: 'PHARMACIE_MOUVEMENT_CREATE',
      ressourceType: 'MOUVEMENT_STOCK',
      ressourceId: mouvementId,
      details: `Mouvement ${type} de ${qty} unité(s) — lot ${lot_id}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const mouvement = await queryOne<any>('SELECT * FROM mouvements_stock WHERE id = ?', [mouvementId]);
    res.status(201).json({ success: true, mouvement });
  } catch (err: any) {
    console.error('Erreur createMouvement:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'enregistrement du mouvement.' });
  }
}

// ============================================================================
// ALERTES
// ============================================================================

/**
 * GET /api/pharmacie/alertes
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 */
export async function getAlertes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { stock_seuil, peremption_jours } = req.query;
  const seuil = parseInt(String(stock_seuil || 10), 10);
  const peremptionDays = parseInt(String(peremption_jours || 90), 10);

  try {
    // Stock faible
    const faibleSql = `
      SELECT c.id, c.code, c.nom_commercial, c.nom_generique,
             COALESCE(SUM(l.quantite_en_cours), 0) as stock_disponible
      FROM catalogue_medicaments c
      LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id AND l.date_peremption > date('now')
      GROUP BY c.id
      HAVING stock_disponible <= ?
      ORDER BY stock_disponible ASC
    `;
    const stockFaible = await queryAll(faibleSql, [seuil]);

    // Péremption proche
    const peremptionSql = `
      SELECT l.id, l.numero_lot, c.nom_commercial, c.code,
             l.date_peremption, l.quantite_en_cours, l.fournisseur
      FROM lots_medicaments l
      JOIN catalogue_medicaments c ON l.catalogue_id = c.id
      WHERE l.date_peremption <= date('now', ?)
        AND l.date_peremption > date('now')
        AND l.quantite_en_cours > 0
      ORDER BY l.date_peremption ASC
    `;
    const peremptionProche = await queryAll(peremptionSql, [`+${peremptionDays} days`]);

    // Péremption expirée (à retirer du stock)
    const expireSql = `
      SELECT l.id, l.numero_lot, c.nom_commercial, c.code,
             l.date_peremption, l.quantite_en_cours
      FROM lots_medicaments l
      JOIN catalogue_medicaments c ON l.catalogue_id = c.id
      WHERE l.date_peremption <= date('now')
        AND l.quantite_en_cours > 0
      ORDER BY l.date_peremption ASC
    `;
    const expirees = await queryAll(expireSql);

    res.json({
      stock_faible: stockFaible.map((m: any) => ({
        catalogue_id: m.id,
        code: m.code,
        nom_commercial: m.nom_commercial,
        nom_generique: m.nom_generique,
        stock_disponible: Number(m.stock_disponible),
      })),
      peremption_proche: peremptionProche.map((l: any) => ({
        lot_id: l.id,
        numero_lot: l.numero_lot,
        nom_commercial: l.nom_commercial,
        code: l.code,
        date_peremption: l.date_peremption,
        quantite_en_cours: l.quantite_en_cours,
      })),
      peremption_expiree: expirees.map((l: any) => ({
        lot_id: l.id,
        numero_lot: l.numero_lot,
        nom_commercial: l.nom_commercial,
        code: l.code,
        date_peremption: l.date_peremption,
        quantite_en_cours: l.quantite_en_cours,
      })),
    });
  } catch (err: any) {
    console.error('Erreur getAlertes:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des alertes.' });
  }
}

/**
 * GET /api/pharmacie/stocks
 * Rôles : PHARMACIEN, ADMINISTRATEUR
 * Vue d'ensemble du stock par médicament
 */
export async function getStockVue(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { actif } = req.query;
  try {
let sql = `
      SELECT c.id, c.code, c.nom_commercial, c.nom_generique, c.classe_therapeutique, c.categorie,
             c.forme, c.dosage_unit, c.actif, c.prix_autorise_usd,
             COALESCE(SUM(CASE WHEN l.date_peremption > date('now') THEN l.quantite_en_cours ELSE 0 END), 0) as stock_disponible,
             COALESCE(SUM(l.quantite_en_cours), 0) as stock_total_incl_expires,
             COUNT(DISTINCT CASE WHEN l.date_peremption > date('now') THEN l.id END) as nb_lots_actifs
       FROM catalogue_medicaments c
       LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (actif !== undefined && actif !== 'ALL') {
      sql += ' AND c.actif = ?';
      params.push(actif === '1' || actif === 'true' ? 1 : 0);
    }
    sql += ' GROUP BY c.id ORDER BY c.classe_therapeutique ASC, c.nom_commercial ASC';

    const stocks = await queryAll(sql, params);
    res.json({ stocks });
  } catch (err: any) {
    console.error('Erreur getStockVue:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du stock.' });
  }
}

/**
 * POS pharmacie : création d'une vente liée à une prescription
 * - Affiche les médicaments prescrits avec quantités disponibles et sélectionnées
 * - Le patient sélectionne les médicaments et quantités à acheter
 * - Création de la facture avec seulement les médicaments achetés (via createLinkedFactureCore)
 * - Enregistrement du paiement
 * - Mise à jour atomique du stock (lots_medicaments.quantite_en_cours)
 */
export async function createPharmaciePos(req: AuthenticatedRequest, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { prescription_id } = req.body;

  if (!prescription_id) {
    res.status(400).json({ error: 'ID de prescription requis.' });
    return;
  }

  try {
    // Récupérer la prescription
    const prescription = await queryOne<any>(
      `SELECT id, consultation_id, patient_id, visite_id, medecin_id, statut, date_prescription
       FROM prescriptions WHERE id = ?`,
      [prescription_id]
    );

    if (!prescription) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // Récupérer les items de prescription avec catalogue et lots non expirés
    const items = await queryAll<any>(
      `SELECT pi.id, pi.nom_medicament, pi.dosage, pi.forme, pi.voie_administration, pi.frequence, pi.duree, pi.quantite,
              pi.ordre, pi.catalogue_id,
              c.code, c.nom_commercial, c.nom_generique, c.classe_therapeutique, c.forme as forme_catalogue, c.dosage_unit,
              c.prix_autorise_usd, c.actif,
              l.id as lot_id, l.numero_lot, l.date_peremption, l.quantite_en_cours, l.quantite_recue, l.fournisseur
       FROM prescription_items pi
       LEFT JOIN catalogue_medicaments c ON pi.catalogue_id = c.id
       LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id AND l.date_peremption > date('now')
       WHERE pi.prescription_id = ?
       ORDER BY pi.ordre, l.date_peremption ASC`,
      [prescription_id]
    );

    if (items.length === 0) {
      res.status(404).json({ error: 'Aucun médicament trouvé pour cette prescription.' });
      return;
    }

    // Récupérer les infos patient
    const patient = await queryOne<any>('SELECT id, numero_dossier, nom, prenom, telephone FROM patients WHERE id = ?', [prescription.patient_id]);
    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable.' });
      return;
    }

    // Récupérer le nom du médecin
    const medecin = await queryOne<any>('SELECT nom_complet FROM users WHERE id = ?', [prescription.medecin_id]);

    // Récupérer la visite
    const visite = await queryOne<any>('SELECT id, numero_visite, statut FROM visites WHERE id = ?', [prescription.visite_id]);

    // Organiser les médicaments avec les lots disponibles
    const medicaments = items.map((it: any) => {
      // Trouver le lot le plus proche de péremption disponible
      const lotsDisponibles = items.filter((item: any) => item.lot_id !== null);
      const lotInfo = lotsDisponibles.length > 0 ? {
        id: lotsDisponibles[0].lot_id,
        lot_id: lotsDisponibles[0].lot_id,
        numero_lot: lotsDisponibles[0].numero_lot,
        date_peremption: lotsDisponibles[0].date_peremption,
        quantite_recue: lotsDisponibles[0].quantite_recue,
        quantite_en_cours: lotsDisponibles[0].quantite_en_cours,
        fournisseur: lotsDisponibles[0].fournisseur
      } : null;

      const quantiteDisponible = items
        .filter((item: any) => item.lot_id !== null && item.lot_id === lotInfo?.lot_id)
        .reduce((sum: number, item: any) => sum + (item.quantite_en_cours || 0), 0);

      return {
        id: it.id,
        item_id: it.id,
        code: it.code,
        nom_commercial: it.nom_commercial || it.nom_medicament,
        nom_generique: it.nom_generique,
        classe_therapeutique: it.classe_therapeutique,
        forme: it.forme || it.forme_catalogue,
        dosage_unit: it.dosage_unit,
        actif: it.actif ?? 1,
        prix_autorise_usd: it.prix_autorise_usd || 0,
        stock_disponible: quantiteDisponible,
        alerte: null,
        quantite_prescrite: it.quantite || 1,
        dosage: it.dosage,
        forme_item: it.forme,
        frequence: it.frequence,
        duree: it.duree,
        lot_info: lotInfo,
        catalogue_id: it.catalogue_id
      };
    });

    res.json({
      success: true,
      patient: {
        id: patient.id,
        numero_dossier: patient.numero_dossier,
        nom: patient.nom,
        prenom: patient.prenom,
        telephone: patient.telephone
      },
      prescription_id: prescription_id,
      visite_id: visite?.id || prescription.visite_id,
      medecin_nom: medecin?.nom_complet || 'N/A',
      statut: prescription.statut || 'EN_COURS',
      medicaments: medicaments,
      total_prescrit: items.length
    });
  } catch (err: any) {
    console.error('Erreur createPharmaciePos:', err);
    res.status(500).json({ error: 'Erreur ouverture POS pharmacie: ' + err.message });
  }
}

/**
 * POST /api/pharmacie/pos/facture
 * Crée une facture liée via createLinkedFactureCore avec protection anti-doublon
 */
export async function createPosFacture(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await createLinkedFactureCore({
      ...req.body,
      emise_par_id: req.user?.id || 'usr-recep-01',
      ip_address: req.ip || '127.0.0.1'
    });

    if (result.isDuplicate) {
      res.status(200).json({
        success: true,
        isDuplicate: true,
        message: 'Une facture existe déjà pour cette prestation (doublon évité).',
        facture: result.facture
      });
      return;
    }

    res.status(201).json({ success: true, facture: result.facture });
  } catch (err: any) {
    console.error('Erreur createPosFacture:', err);
    res.status(400).json({ error: err.message || 'Erreur création facture.' });
  }
}

/**
 * POST /api/pharmacie/pos/paiement
 * Enregistre un paiement pour une facture POS
 */
export async function recordPosPaiement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: 'Facture ID requis.' });
    return;
  }
  try {
    const details = await getFactureFinancialDetails(id);
    if (!details) {
      res.status(404).json({ error: 'Facture introuvable.' });
      return;
    }
    if (details.solde_usd <= 0.005) {
      res.status(400).json({ error: 'Cette facture est déjà intégralement payée.' });
      return;
    }

    const { montant_paye, devise, mode_paiement, reference_transaction, notes } = req.body;
    const verser = parseFloat(String(montant_paye));
    if (isNaN(verser) || verser <= 0) {
      res.status(400).json({ error: 'Le montant payé doit être un nombre strictement positif.' });
      return;
    }

    const devisePaiement = devise === 'CDF' ? 'FC' : devise;
    if (devisePaiement !== 'USD' && devisePaiement !== 'FC') {
      res.status(400).json({ error: 'Devise non autorisée. Choisissez USD ou FC.' });
      return;
    }

    // Protection anti-doublon (double-clic ou requête répétée dans les 5 secondes)
    const recentPayment = await queryOne<any>(
      `SELECT * FROM paiements WHERE facture_id = ? AND montant_paye = ? AND devise = ? ORDER BY date_paiement DESC LIMIT 1`,
      [id, verser, devisePaiement]
    );
    if (recentPayment) {
      const diffMs = Date.now() - new Date(recentPayment.date_paiement).getTime();
      if (diffMs < 5000) {
        res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Paiement déjà validé (protection double-clic appliquée).',
          recu: recentPayment.numero_recu,
          paiement: recentPayment,
          facture: details
        });
        return;
      }
    }

    // Taux actuel
    const settingRate = await queryOne("SELECT value FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' LIMIT 1");
    const tauxActuel = settingRate && settingRate.value ? parseFloat(settingRate.value) : 2850;

    let equivalentUsd = 0;
    let equivalentFc = 0;

    if (devisePaiement === 'USD') {
      equivalentUsd = Math.round(verser * 100) / 100;
      equivalentFc = Math.round(verser * tauxActuel);
    } else {
      equivalentFc = Math.round(verser);
      equivalentUsd = Math.round((verser / tauxActuel) * 100) / 100;
    }

    if (equivalentUsd > details.solde_usd + 0.05) {
      const maxFc = Math.round(details.solde_usd * tauxActuel);
      res.status(400).json({
        error: `Le montant versé (${verser} ${devisePaiement}) excède le solde restant dû (${details.solde_usd} USD ou ~${maxFc} FC).`
      });
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRecuRes = await queryOne("SELECT count(*) as count FROM paiements WHERE numero_recu LIKE ?", [`REC-${dateStr}-%`]);
    const countRecu = countRecuRes ? Number(countRecuRes.count) + 1 : 1;
    const numeroRecu = `REC-${dateStr}-${String(countRecu).padStart(4, '0')}`;

    const paiementId = `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const mode = ['ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE'].includes(mode_paiement) ? mode_paiement : 'ESPECES';

    await execute(
      `INSERT INTO paiements (id, numero_recu, facture_id, montant_paye, devise, taux_usd_fc, equivalent_usd, equivalent_fc, mode_paiement, reference_transaction, notes, date_paiement, encaisse_par_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paiementId, numeroRecu, id, verser, devisePaiement, tauxActuel,
        equivalentUsd, equivalentFc, mode,
        reference_transaction?.trim() || null, notes?.trim() || null, now,
        req.user?.id || 'usr-recep-01'
      ]
    );

    const updatedDetails = await getFactureFinancialDetails(id);
    const newStatus = updatedDetails!.statut;
    await execute('UPDATE factures SET statut = ?, updated_at = ? WHERE id = ?', [newStatus, now, id]);

    res.json({
      success: true,
      recu: numeroRecu,
      paiement: {
        id: paiementId,
        numero_recu: numeroRecu,
        montant_paye: verser,
        devise: devisePaiement,
        taux_usd_fc: tauxActuel,
        equivalent_usd: equivalentUsd,
        equivalent_fc: equivalentFc,
        mode_paiement: mode,
        date_paiement: now
      },
      facture: updatedDetails
    });
  } catch (err: any) {
    console.error('Erreur recordPosPaiement:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement.' });
  }
}