import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryAll, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { AuthenticatedRequest, isPharmacistRole } from '../middleware/auth.js';

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
    // Récupérer la prescription avec ses items
    const prescription = await queryOne<any>(
      `SELECT pi.id, pi.nom_medicament, pi.dosage, pi.forme, pi.voie_administration, pi.frequence, pi.duree, pi.quantite,
              pi.ordre, c.code, c.nom_commercial, c.nom_generique, c.classe_therapeutique, c.forme as forme_catalogue, c.dosage_unit,
              c.prix_autorise_usd, c.actif, l.id as lot_id, l.numero_lot, l.date_peremption, l.quantite_en_cours, l.quantite_recue, l.fournisseur
       FROM prescription_items pi
       LEFT JOIN catalogue_medicaments c ON pi.catalogue_id = c.id
       LEFT JOIN lots_medicaments l ON c.id = l.catalogue_id AND l.date_peremption > date('now')
       WHERE pi.prescription_id = ?
       ORDER BY pi.ordre, l.date_peremption ASC`,
      [prescription_id]
    );

    if (!prescription) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // Récupérer les infos patient et visite
    const patient = await queryOne<any>('SELECT id, numero_dossier, nom, prenom, telephone FROM patients WHERE id = ?', [prescription.patient_id]);
    const visite = await queryOne<any>('SELECT id, numero_visite, patient_id, medecin_id, statut FROM visites WHERE id = ?', [prescription.visite_id]);

    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable.' });
      return;
    }

    // Organiser les médicaments par lot
    const medicaments = prescription.items.map((it: any) => {
      const lotDisponible = prescription.items.filter((item: any) => item.lot_id !== null);
      const lotInfo = lotDisponible.length > 0 ? {
        lot_id: lotDisponible[0].lot_id,
        numero_lot: lotDisponible[0].numero_lot,
        date_peremption: lotDisponible[0].date_peremption,
        quantite_en_cours: lotDisponible[0].quantite_en_cours,
        fournisseur: lotDisponible[0].fournisseur
      } : null;

      // Quantité disponible dans les lots non expirés pour ce médicament
      const quantiteDisponible = prescription.items
        .filter((item: any) => item.lot_id !== null && item.lot_id === lotInfo?.lot_id)
        .reduce((sum: number, item: any) => sum + (item.quantite_en_cours || 0), 0);

      return {
        item_id: it.id,
        nom_medicament: it.nom_medicament,
        dosage: it.dosage,
        forme: it.forme,
        frequence: it.frequence,
        duree: it.duree,
        quantite_prescrite: it.quantite || 1,
        quantite_selectionnee: 0, // Sera définie par l'utilisateur en POS
        prix_unitaire: it.prix_autorise_usd || 0,
        actif: it.actif,
        catalogue_id: it.catalogue_id,
        lot_info: lotInfo,
        quantite_disponible: quantiteDisponible,
        code: it.code
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
      visite_id: prescription.visite_id,
      medicaments: medicaments,
      total_prescrit: prescription.items.length
    });
  } catch (err: any) {
    console.error('Erreur createPharmaciePos:', err);
    res.status(500).json({ error: 'Erreur ouverture POS pharmacie: ' + err.message });
  }
}