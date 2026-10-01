import { Request, Response } from 'express';
import { queryAll, queryOne, execute, getDb, saveDb } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export interface PrestationInput {
  tarif_id?: string;
  description: string;
  categorie?: string;
  quantite: number;
  prix_unitaire: number; // en USD
}

/**
 * Récupère le taux de change actuel 1 USD = X FC
 */
export async function getExchangeRate(req: Request, res: Response): Promise<void> {
  try {
    const setting = await queryOne(
      "SELECT value, updated_at FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' ORDER BY (CASE WHEN key = 'EXCHANGE_RATE_USD_FC' THEN 1 ELSE 2 END) LIMIT 1"
    );
    const rate = setting && setting.value ? parseFloat(setting.value) : 2850;
    res.json({
      rate,
      currency_from: 'USD',
      currency_to: 'FC',
      updated_at: setting?.updated_at || new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Erreur getExchangeRate:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du taux de change.' });
  }
}

/**
 * Définit le taux officiel 1 USD = X FC (Réservé ADMINISTRATEUR)
 */
export async function updateExchangeRate(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { rate } = req.body;

  const parsedRate = parseFloat(rate);
  if (isNaN(parsedRate) || parsedRate <= 0) {
    res.status(400).json({ error: 'Le taux de change doit être un nombre strictement supérieur à 0.' });
    return;
  }

  try {
    const now = new Date().toISOString();
    await execute(
      "INSERT OR REPLACE INTO clinic_settings (key, value, description, updated_at) VALUES ('EXCHANGE_RATE_USD_FC', ?, 'Taux officiel de conversion 1 USD en FC', ?)",
      [String(parsedRate), now]
    );
    await execute(
      "INSERT OR REPLACE INTO clinic_settings (key, value, description, updated_at) VALUES ('EXCHANGE_RATE_USD_CDF', ?, 'Taux de conversion 1 USD en CDF (compatibilité)', ?)",
      [String(parsedRate), now]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'UPDATE_EXCHANGE_RATE', 'CLINIC_SETTINGS', 'EXCHANGE_RATE_USD_FC', ?, ?, ?)`,
      [
        `aud-rate-${Date.now()}`,
        authReq.user?.id || 'system',
        `Mise à jour du taux officiel : 1 USD = ${parsedRate} FC`,
        req.ip || '127.0.0.1',
        now
      ]
    );

    saveDb();
    res.json({
      success: true,
      rate: parsedRate,
      currency_from: 'USD',
      currency_to: 'FC',
      updated_at: now
    });
  } catch (err: any) {
    console.error('Erreur updateExchangeRate:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du taux de change.' });
  }
}

/**
 * Récupère la liste des tarifs / prestations (ADMIN, RÉCEPTION, MÉDECIN, LABO)
 */
export async function getTarifs(req: Request, res: Response): Promise<void> {
  try {
    const { categorie, actif, search } = req.query;
    let sql = 'SELECT * FROM tarifs WHERE 1=1';
    const params: any[] = [];

    if (categorie && categorie !== 'ALL') {
      sql += ' AND categorie = ?';
      params.push(categorie);
    }

    if (actif !== undefined && actif !== 'ALL') {
      const isActif = String(actif) === 'true' || String(actif) === '1' ? 1 : 0;
      sql += ' AND actif = ?';
      params.push(isActif);
    }

    if (search && typeof search === 'string' && search.trim()) {
      sql += ' AND (nom LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY categorie ASC, nom ASC';

    const tarifs = await queryAll(sql, params);
    res.json({ tarifs });
  } catch (err: any) {
    console.error('Erreur getTarifs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tarifs.' });
  }
}

/**
 * Crée un nouveau tarif / prestation (ADMINISTRATEUR)
 */
export async function createTarif(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { nom, categorie, prix_usd, actif, description } = req.body;

  if (!nom || typeof nom !== 'string' || !nom.trim()) {
    res.status(400).json({ error: 'Le nom de la prestation est obligatoire.' });
    return;
  }

  const validCategories = ['TYPE_VISITE', 'CONSULTATION', 'EXAMEN_LABORATOIRE', 'IMAGERIE', 'ACTE_SERVICE'];
  if (!validCategories.includes(categorie)) {
    res.status(400).json({ error: `Catégorie invalide. Choix possibles : ${validCategories.join(', ')}` });
    return;
  }

  const prix = parseFloat(prix_usd);
  if (isNaN(prix) || prix < 0) {
    res.status(400).json({ error: 'Le prix en USD doit être un nombre positif ou nul.' });
    return;
  }

  try {
    const id = `tar-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const isActif = actif === 0 || actif === false ? 0 : 1;

    await execute(
      `INSERT INTO tarifs (id, nom, categorie, prix_usd, actif, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nom.trim(), categorie, Math.round(prix * 100) / 100, isActif, description?.trim() || null, now, now]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'CREATE_TARIF', 'TARIF', ?, ?, ?, ?)`,
      [
        `aud-tar-${Date.now()}`,
        authReq.user?.id || 'system',
        id,
        `Création prestation [${categorie}] : ${nom.trim()} (${prix} USD)`,
        req.ip || '127.0.0.1',
        now
      ]
    );

    saveDb();
    const created = await queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
    res.status(201).json({ success: true, tarif: created });
  } catch (err: any) {
    console.error('Erreur createTarif:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la prestation.' });
  }
}

/**
 * Modifie un tarif existant (ADMINISTRATEUR)
 */
export async function updateTarif(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  const { nom, categorie, prix_usd, actif, description } = req.body;

  try {
    const existing = await queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Prestation introuvable.' });
      return;
    }

    const validCategories = ['TYPE_VISITE', 'CONSULTATION', 'EXAMEN_LABORATOIRE', 'IMAGERIE', 'ACTE_SERVICE'];
    if (categorie && !validCategories.includes(categorie)) {
      res.status(400).json({ error: `Catégorie invalide. Choix possibles : ${validCategories.join(', ')}` });
      return;
    }

    const now = new Date().toISOString();
    const updatedNom = nom !== undefined ? nom.trim() : existing.nom;
    const updatedCat = categorie || existing.categorie;
    const updatedPrix = prix_usd !== undefined ? Math.round(parseFloat(prix_usd) * 100) / 100 : existing.prix_usd;
    const updatedActif = actif !== undefined ? (actif ? 1 : 0) : existing.actif;
    const updatedDesc = description !== undefined ? description?.trim() : existing.description;

    if (isNaN(updatedPrix) || updatedPrix < 0) {
      res.status(400).json({ error: 'Le prix en USD doit être un nombre positif ou nul.' });
      return;
    }

    await execute(
      `UPDATE tarifs 
       SET nom = ?, categorie = ?, prix_usd = ?, actif = ?, description = ?, updated_at = ?
       WHERE id = ?`,
      [updatedNom, updatedCat, updatedPrix, updatedActif, updatedDesc, now, id]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'UPDATE_TARIF', 'TARIF', ?, ?, ?, ?)`,
      [
        `aud-tar-${Date.now()}`,
        authReq.user?.id || 'system',
        id,
        `Modification prestation ${updatedNom} : ${updatedPrix} USD, Actif: ${updatedActif}`,
        req.ip || '127.0.0.1',
        now
      ]
    );

    saveDb();
    const updated = await queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
    res.json({ success: true, tarif: updated });
  } catch (err: any) {
    console.error('Erreur updateTarif:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la prestation.' });
  }
}

/**
 * Bascule actif/inactif (ADMINISTRATEUR)
 */
export async function toggleTarifActif(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;

  try {
    const existing = await queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Prestation introuvable.' });
      return;
    }

    const newActif = existing.actif === 1 ? 0 : 1;
    const now = new Date().toISOString();

    await execute('UPDATE tarifs SET actif = ?, updated_at = ? WHERE id = ?', [newActif, now, id]);

    // Audit log
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'TOGGLE_TARIF_ACTIF', 'TARIF', ?, ?, ?, ?)`,
      [
        `aud-tar-${Date.now()}`,
        authReq.user?.id || 'system',
        id,
        `Prestation ${existing.nom} passée à ${newActif === 1 ? 'ACTIF' : 'INACTIF'}`,
        req.ip || '127.0.0.1',
        now
      ]
    );

    saveDb();
    res.json({ success: true, id, actif: newActif });
  } catch (err: any) {
    console.error('Erreur toggleTarifActif:', err);
    res.status(500).json({ error: 'Erreur lors de l\'activation/désactivation de la prestation.' });
  }
}

/**
 * Helper : calcul du total payé et du solde d'une facture
 */
export async function getFactureFinancialDetails(factureId: string) {
  const facture = await queryOne('SELECT * FROM factures WHERE id = ?', [factureId]);
  if (!facture) return null;

  const paiements = await queryAll('SELECT * FROM paiements WHERE facture_id = ? ORDER BY date_paiement ASC', [factureId]);
  const items = await queryAll('SELECT * FROM facture_items WHERE facture_id = ?', [factureId]);

  let totalPayeUsd = 0;
  let totalPayeFc = 0;

  for (const p of paiements) {
    const montant = parseFloat(p.montant_paye);
    const devise = p.devise;
    const taux = parseFloat(p.taux_usd_fc) || 2850;

    if (devise === 'USD') {
      totalPayeUsd += montant;
    } else {
      // FC ou CDF : converti en USD au taux scellé de ce paiement
      totalPayeFc += montant;
      const equivUsd = p.equivalent_usd !== undefined && p.equivalent_usd !== null 
        ? parseFloat(p.equivalent_usd) 
        : Math.round((montant / taux) * 100) / 100;
      totalPayeUsd += equivUsd;
    }
  }

  totalPayeUsd = Math.round(totalPayeUsd * 100) / 100;
  const montantTotalFacture = parseFloat(facture.montant_total);
  const soldeUsd = Math.max(0, Math.round((montantTotalFacture - totalPayeUsd) * 100) / 100);
  const tauxFacture = parseFloat(facture.taux_usd_fc) || 2850;
  const soldeFc = Math.round(soldeUsd * tauxFacture);

  let statut: 'NON PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'PAYÉ' = 'NON PAYÉ';
  if (soldeUsd <= 0.005) {
    statut = 'PAYÉ';
  } else if (totalPayeUsd > 0.005) {
    statut = 'PARTIELLEMENT PAYÉ';
  } else {
    statut = 'NON PAYÉ';
  }

  return {
    ...facture,
    statut,
    montant_total_usd: montantTotalFacture,
    montant_total_fc: Math.round(montantTotalFacture * tauxFacture),
    total_paye_usd: totalPayeUsd,
    total_paye_fc: totalPayeFc,
    solde_usd: soldeUsd,
    solde_fc: soldeFc,
    items,
    paiements
  };
}

/**
 * Récupère les factures avec filtres
 */
export async function getFactures(req: Request, res: Response): Promise<void> {
  try {
    const { patient_id, visite_id, statut, search } = req.query;

    let sql = `
      SELECT f.*, p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier, p.telephone as patient_telephone,
             u.nom_complet as emise_par_nom, v.numero_visite
      FROM factures f
      JOIN patients p ON f.patient_id = p.id
      LEFT JOIN users u ON f.emise_par_id = u.id
      LEFT JOIN visites v ON f.visite_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patient_id) {
      sql += ' AND f.patient_id = ?';
      params.push(patient_id);
    }

    if (visite_id) {
      sql += ' AND f.visite_id = ?';
      params.push(visite_id);
    }

    if (search && typeof search === 'string' && search.trim()) {
      sql += ' AND (f.numero_facture LIKE ? OR p.nom LIKE ? OR p.prenom LIKE ? OR p.numero_dossier LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY f.created_at DESC';

    const rawFactures = await queryAll(sql, params);

    // Calcul dynamique de chaque facture
    const facturesWithDetails = [];
    for (const f of rawFactures) {
      const details = await getFactureFinancialDetails(f.id);
      if (details) {
        // Filtre de statut post-calcul
        if (statut && statut !== 'ALL') {
          if (details.statut !== statut) continue;
        }
        facturesWithDetails.push({
          ...f,
          ...details
        });
      }
    }

    res.json({ factures: facturesWithDetails });
  } catch (err: any) {
    console.error('Erreur getFactures:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des factures.' });
  }
}

/**
 * Récupère le détail d'une facture par ID
 */
export async function getFactureById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const details = await getFactureFinancialDetails(id);
    if (!details) {
      res.status(404).json({ error: 'Facture introuvable.' });
      return;
    }

    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [details.patient_id]);
    const emisePar = await queryOne('SELECT id, nom_complet, role FROM users WHERE id = ?', [details.emise_par_id]);

    res.json({
      facture: {
        ...details,
        patient,
        emise_par: emisePar
      }
    });
  } catch (err: any) {
    console.error('Erreur getFactureById:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la facture.' });
  }
}

export interface CreateLinkedFactureParams {
  patient_id?: string | null;
  visite_id?: string | null;
  rendez_vous_id?: string | null;
  patient_nom_temp?: string | null;
  patient_prenom_temp?: string | null;
  patient_telephone_temp?: string | null;
  type_prestation?: string;
  items: Array<{
    tarif_id?: string | null;
    description: string;
    categorie?: string;
    quantite?: number;
    prix_unitaire: number;
  }>;
  emise_par_id?: string;
  notes?: string | null;
  ip_address?: string;
}

/**
 * Fonction centrale d'émission de facture liée avec protection anti-doublon absolue
 */
export async function createLinkedFactureCore(params: CreateLinkedFactureParams): Promise<{ isDuplicate: boolean; facture: any }> {
  const {
    patient_id,
    visite_id,
    rendez_vous_id,
    patient_nom_temp,
    patient_prenom_temp,
    patient_telephone_temp,
    type_prestation = 'MULTI_PRESTATIONS',
    items,
    emise_par_id = 'usr-recep-01',
    notes,
    ip_address = '127.0.0.1'
  } = params;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Une facture doit contenir au moins une prestation.');
  }

  // 1. Protection anti-doublon : Vérifier si une facture existe déjà pour cette visite et ces prestations
  if (visite_id) {
    const firstItem = items[0];
    const existingFacture = await queryOne<any>(
      `SELECT f.id FROM factures f 
       JOIN facture_items fi ON f.id = fi.facture_id
       WHERE f.visite_id = ? AND (fi.tarif_id = ? OR fi.description = ?)
       LIMIT 1`,
      [visite_id, firstItem?.tarif_id || '', firstItem?.description || '']
    );

    if (existingFacture) {
      const details = await getFactureFinancialDetails(existingFacture.id);
      return { isDuplicate: true, facture: details };
    }
  }

  // Protection anti-doublon pour les rendez-vous
  if (rendez_vous_id) {
    const existingRdvFacture = await queryOne<any>(
      `SELECT id FROM factures WHERE rendez_vous_id = ? LIMIT 1`,
      [rendez_vous_id]
    );
    if (existingRdvFacture) {
      const details = await getFactureFinancialDetails(existingRdvFacture.id);
      return { isDuplicate: true, facture: details };
    }
  }

  // Taux officiel actuel 1 USD = X FC
  const settingRate = await queryOne<any>("SELECT value FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' LIMIT 1");
  const tauxActuel = settingRate && settingRate.value ? parseFloat(settingRate.value) : 2850;

  let montantTotalUsd = 0;
  const validatedItems: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qte = parseInt(String(item.quantite || 1), 10);
    const prix = parseFloat(String(item.prix_unitaire));

    if (isNaN(qte) || qte <= 0) {
      throw new Error(`Quantité invalide sur la ligne ${i + 1}.`);
    }
    if (isNaN(prix) || prix < 0) {
      throw new Error(`Prix unitaire invalide sur la ligne ${i + 1}.`);
    }
    if (!item.description || !item.description.trim()) {
      throw new Error(`Description obligatoire sur la ligne ${i + 1}.`);
    }

    const montantLigne = Math.round(qte * prix * 100) / 100;
    montantTotalUsd += montantLigne;

    validatedItems.push({
      id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      tarif_id: item.tarif_id || null,
      code_prestation: item.tarif_id || `PREST-${i + 1}`,
      description: item.description.trim(),
      categorie: item.categorie || 'AUTRE',
      quantite: qte,
      prix_unitaire: prix,
      montant_ligne: montantLigne,
      devise: 'USD'
    });
  }

  montantTotalUsd = Math.round(montantTotalUsd * 100) / 100;

  // Numéro de facture unique : FAC-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countTodayRes = await queryOne<any>(
    "SELECT count(*) as count FROM factures WHERE numero_facture LIKE ?",
    [`FAC-${dateStr}-%`]
  );
  const countToday = countTodayRes ? Number(countTodayRes.count) + 1 : 1;
  const numeroFacture = `FAC-${dateStr}-${String(countToday).padStart(4, '0')}`;

  const factureId = `fac-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO factures (
      id, numero_facture, patient_id, visite_id, rendez_vous_id,
      patient_nom_temp, patient_prenom_temp, patient_telephone_temp,
      type_prestation, montant_total,
      devise, taux_usd_fc, statut, emise_par_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 'NON PAYÉ', ?, ?, ?, ?)`,
    [
      factureId,
      numeroFacture,
      patient_id || null,
      visite_id || null,
      rendez_vous_id || null,
      patient_nom_temp?.trim() || null,
      patient_prenom_temp?.trim() || null,
      patient_telephone_temp?.trim() || null,
      type_prestation,
      montantTotalUsd,
      tauxActuel,
      emise_par_id,
      notes?.trim() || null,
      now,
      now
    ]
  );

  if (rendez_vous_id) {
    await execute('UPDATE rendez_vous SET facture_id = ?, updated_at = ? WHERE id = ?', [factureId, now, rendez_vous_id]);
  }

  for (const item of validatedItems) {
    await execute(
      `INSERT INTO facture_items (
        id, facture_id, tarif_id, code_prestation, description, categorie, quantite, prix_unitaire, montant_ligne, devise
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        factureId,
        item.tarif_id,
        item.code_prestation,
        item.description,
        item.categorie,
        item.quantite,
        item.prix_unitaire,
        item.montant_ligne,
        item.devise
      ]
    );
  }

  await execute(
    `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
     VALUES (?, ?, 'CREATE_FACTURE', 'FACTURE', ?, ?, ?, ?)`,
    [
      `aud-fac-${Date.now()}`,
      emise_par_id,
      factureId,
      `Émission facture ${numeroFacture} : ${montantTotalUsd} USD (${validatedItems.length} prestations, Taux: 1 USD = ${tauxActuel} FC)`,
      ip_address,
      now
    ]
  );

  saveDb();

  const createdFacture = await getFactureFinancialDetails(factureId);
  return { isDuplicate: false, facture: createdFacture };
}

/**
 * Création d'une facture multi-prestations (RÉCEPTION & ADMINISTRATEUR)
 */
export async function createFacture(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { patient_id, visite_id, rendez_vous_id, patient_nom_temp, patient_prenom_temp, patient_telephone_temp, items, notes, type_prestation } = req.body;

  if (!patient_id && !rendez_vous_id) {
    res.status(400).json({ error: 'L\'identifiant du patient ou un rendez-vous est requis pour émettre une facture.' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Une facture doit contenir au moins une prestation.' });
    return;
  }

  try {
    // Vérification existence patient si patient_id est fourni
    if (patient_id) {
      const patientDossier = await queryOne<any>('SELECT id FROM patients WHERE id = ? AND actif = 1', [patient_id]);
      if (!patientDossier) {
        res.status(404).json({ error: 'Dossier patient introuvable ou inactif.' });
        return;
      }
    }

    const result = await createLinkedFactureCore({
      patient_id,
      visite_id,
      rendez_vous_id,
      patient_nom_temp,
      patient_prenom_temp,
      patient_telephone_temp,
      type_prestation: type_prestation || 'MULTI_PRESTATIONS',
      items,
      emise_par_id: authReq.user?.id || 'usr-recep-01',
      notes,
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

    res.status(201).json({
      success: true,
      facture: result.facture
    });
  } catch (err: any) {
    console.error('Erreur createFacture:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'émission de la facture.' });
  }
}

/**
 * Enregistre un règlement / paiement (USD ou FC, complet ou partiel)
 * IMPORTANT : Conserve toujours le montant réellement payé, sa devise et son taux utilisé.
 */
export async function recordPaiement(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params; // facture_id
  const { montant_paye, devise, mode_paiement, reference_transaction, notes } = req.body;

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

    // Protection anti-doublon (double-clic ou requête répétée dans les 5 secondes avec même montant et même facture)
    const recentPayment = await queryOne<any>(
      `SELECT * FROM paiements 
       WHERE facture_id = ? AND montant_paye = ? AND devise = ? 
       ORDER BY date_paiement DESC LIMIT 1`,
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

    // Taux officiel au moment du paiement
    const settingRate = await queryOne("SELECT value FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' LIMIT 1");
    const tauxActuel = settingRate && settingRate.value ? parseFloat(settingRate.value) : 2850;

    let equivalentUsd = 0;
    let equivalentFc = 0;

    if (devisePaiement === 'USD') {
      equivalentUsd = Math.round(verser * 100) / 100;
      equivalentFc = Math.round(verser * tauxActuel);
    } else {
      // Paiement en FC
      equivalentFc = Math.round(verser);
      equivalentUsd = Math.round((verser / tauxActuel) * 100) / 100;
    }

    // Vérification dépassement solde (avec marge d'arrondi de 0.05 USD pour les conversions de petites devises)
    if (equivalentUsd > details.solde_usd + 0.05) {
      const maxFc = Math.round(details.solde_usd * tauxActuel);
      res.status(400).json({
        error: `Le montant versé (${verser} ${devisePaiement}) excède le solde restant dû (${details.solde_usd} USD ou ~${maxFc} FC).`
      });
      return;
    }

    // Numéro de reçu unique : REC-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRecuRes = await queryOne("SELECT count(*) as count FROM paiements WHERE numero_recu LIKE ?", [`REC-${dateStr}-%`]);
    const countRecu = countRecuRes ? Number(countRecuRes.count) + 1 : 1;
    const numeroRecu = `REC-${dateStr}-${String(countRecu).padStart(4, '0')}`;

    const paiementId = `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const mode = ['ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE'].includes(mode_paiement) ? mode_paiement : 'ESPECES';

    // Conservation scellée de l'encaissement réel
    await execute(
      `INSERT INTO paiements (
        id, numero_recu, facture_id, montant_paye, devise, taux_usd_fc,
        equivalent_usd, equivalent_fc, mode_paiement, reference_transaction, notes,
        date_paiement, encaisse_par_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paiementId,
        numeroRecu,
        id,
        verser,
        devisePaiement,
        tauxActuel,
        equivalentUsd,
        equivalentFc,
        mode,
        reference_transaction?.trim() || null,
        notes?.trim() || null,
        now,
        authReq.user?.id || 'usr-recep-01'
      ]
    );

    // Recalcul du statut après encaissement
    const updatedDetails = await getFactureFinancialDetails(id);
    const newStatus = updatedDetails!.statut;

    await execute('UPDATE factures SET statut = ?, updated_at = ? WHERE id = ?', [newStatus, now, id]);

    // Audit log
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
       VALUES (?, ?, 'ENCAISSEMENT_FACTURE', 'PAIEMENT', ?, ?, ?, ?)`,
      [
        `aud-pmt-${Date.now()}`,
        authReq.user?.id || 'usr-recep-01',
        paiementId,
        `Encaissement reçu ${numeroRecu} sur facture ${details.numero_facture} : ${verser} ${devisePaiement} (Taux: ${tauxActuel} FC/USD). Nouveau statut: ${newStatus}`,
        req.ip || '127.0.0.1',
        now
      ]
    );

    saveDb();

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
    console.error('Erreur recordPaiement:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement.' });
  }
}

/**
 * RAPPORTS COMPTABLES & CAISSE (Étape 8)
 * - Affiche séparément : Total payé en USD & Total payé en FC
 * - Rapport global consultable en : FC (par défaut) ou USD
 * - Utilise le taux enregistré au moment précis de chaque paiement
 * - Conserve toujours le montant réellement payé et sa devise d'origine
 */
export async function getBillingReports(req: Request, res: Response): Promise<void> {
  try {
    const { start_date, end_date, devise_vue } = req.query;

    let sql = `
      SELECT p.*, f.numero_facture, f.montant_total as facture_montant_usd, f.taux_usd_fc as facture_taux,
             pat.nom as patient_nom, pat.prenom as patient_prenom, pat.numero_dossier,
             u.nom_complet as encaisse_par_nom
      FROM paiements p
      JOIN factures f ON p.facture_id = f.id
      JOIN patients pat ON f.patient_id = pat.id
      LEFT JOIN users u ON p.encaisse_par_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      sql += ' AND date(p.date_paiement) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date(p.date_paiement) <= date(?)';
      params.push(end_date);
    }

    sql += ' ORDER BY p.date_paiement DESC';

    const paiements = await queryAll(sql, params);

    let totalPayeUsd = 0;
    let totalPayeFc = 0;
    let nbPaiementsUsd = 0;
    let nbPaiementsFc = 0;

    let totalGlobalFc = 0;
    let totalGlobalUsd = 0;

    const paiementsEnrichis = paiements.map((p: any) => {
      const montant = parseFloat(p.montant_paye);
      const devise = p.devise === 'CDF' ? 'FC' : p.devise;
      const taux = parseFloat(p.taux_usd_fc) || 2850;

      let pmtEquivUsd = 0;
      let pmtEquivFc = 0;

      if (devise === 'USD') {
        totalPayeUsd += montant;
        nbPaiementsUsd++;
        pmtEquivUsd = montant;
        pmtEquivFc = Math.round(montant * taux);
      } else {
        totalPayeFc += montant;
        nbPaiementsFc++;
        pmtEquivFc = montant;
        pmtEquivUsd = Math.round((montant / taux) * 100) / 100;
      }

      // Cumul global en utilisant le taux historique scellé de ce paiement
      totalGlobalFc += pmtEquivFc;
      totalGlobalUsd += pmtEquivUsd;

      return {
        ...p,
        devise,
        taux_usd_fc: taux,
        equivalent_usd: pmtEquivUsd,
        equivalent_fc: pmtEquivFc
      };
    });

    totalPayeUsd = Math.round(totalPayeUsd * 100) / 100;
    totalGlobalUsd = Math.round(totalGlobalUsd * 100) / 100;
    totalGlobalFc = Math.round(totalGlobalFc);

    const deviseAffichee = devise_vue === 'USD' ? 'USD' : 'FC'; // FC par défaut

    res.json({
      devise_vue_par_defaut: 'FC',
      devise_vue_actuelle: deviseAffichee,
      totaux_separes: {
        total_paye_usd: totalPayeUsd,
        total_paye_fc: totalPayeFc,
        nb_paiements_usd: nbPaiementsUsd,
        nb_paiements_fc: nbPaiementsFc,
      },
      total_global: {
        montant_fc: totalGlobalFc,
        montant_usd: totalGlobalUsd,
        valeur_affichee: deviseAffichee === 'FC' ? totalGlobalFc : totalGlobalUsd,
        devise_affichee: deviseAffichee,
      },
      paiements: paiementsEnrichis
    });
  } catch (err: any) {
    console.error('Erreur getBillingReports:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport comptable.' });
  }
}

/**
 * Statut de paiement d'une visite pour Médecin et Laboratoire
 * « Le médecin et le laboratoire voient uniquement le statut PAYÉ / PARTIELLEMENT PAYÉ / NON PAYÉ. »
 */
export async function getVisitePaymentStatus(req: Request, res: Response): Promise<void> {
  const { visite_id } = req.params;

  try {
    const factures = await queryAll('SELECT id FROM factures WHERE visite_id = ?', [visite_id]);

    if (!factures || factures.length === 0) {
      res.json({
        visite_id,
        statut_paiement: 'NON PAYÉ',
        has_factures: false
      });
      return;
    }

    let allPaid = true;
    let anyPaid = false;

    for (const f of factures) {
      const details = await getFactureFinancialDetails(f.id);
      if (details) {
        if (details.statut === 'PAYÉ') {
          anyPaid = true;
        } else if (details.statut === 'PARTIELLEMENT PAYÉ') {
          anyPaid = true;
          allPaid = false;
        } else {
          allPaid = false;
        }
      }
    }

    let statutPaiement: 'PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'NON PAYÉ' = 'NON PAYÉ';
    if (allPaid && factures.length > 0) {
      statutPaiement = 'PAYÉ';
    } else if (anyPaid) {
      statutPaiement = 'PARTIELLEMENT PAYÉ';
    } else {
      statutPaiement = 'NON PAYÉ';
    }

    res.json({
      visite_id,
      statut_paiement: statutPaiement,
      has_factures: true,
      nombre_factures: factures.length
    });
  } catch (err: any) {
    console.error('Erreur getVisitePaymentStatus:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du statut de paiement.' });
  }
}
