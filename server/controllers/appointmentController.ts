import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { AuthenticatedRequest, isDoctorRole } from '../middleware/auth.js';

export const VALID_RDV_STATUSES = [
  'PLANIFIÉ',
  'CONFIRMÉ',
  'PATIENT PRÉSENT',
  'HONORÉ',
  'ABSENT',
  'ANNULÉ'
] as const;

export function normalizeRdvStatus(statut: string): string {
  if (!statut) return 'PLANIFIÉ';
  const s = statut.trim().toUpperCase();
  if (s === 'PLANIFIE' || s === 'PROGRAMMÉ' || s === 'PROGRAMME') return 'PLANIFIÉ';
  if (s === 'CONFIRME') return 'CONFIRMÉ';
  if (s === 'PATIENT_PRESENT' || s === 'PATIENT PRESENT') return 'PATIENT PRÉSENT';
  if (s === 'HONORE') return 'HONORÉ';
  if (s === 'ANNULE') return 'ANNULÉ';
  if (s === 'ABSENT') return 'ABSENT';
  return s;
}

/**
 * Récupération des rendez-vous partagés
 * GET /api/rendez-vous
 * Rôles : RÉCEPTION (voit tous les médecins), MÉDECIN (son planning ou partagé), ADMINISTRATEUR
 */
export async function getAppointments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { date, date_debut, date_fin, patient_id, medecin_id, statut, search, tous } = req.query;

    let sql = `
      SELECT r.*, 
             COALESCE(p.nom, r.patient_nom_temp, 'Patient sans dossier') as patient_nom, 
             p.post_nom as patient_post_nom, 
             COALESCE(p.prenom, r.patient_prenom_temp, '') as patient_prenom, 
             COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier, 
             COALESCE(p.telephone, r.patient_telephone_temp, '') as patient_telephone,
             u.nom_complet as medecin_nom,
             c.nom_complet as cree_par_nom,
             f.numero_facture,
             f.montant_total as facture_montant_usd,
             f.statut as statut_paiement
      FROM rendez_vous r
      LEFT JOIN patients p ON r.patient_id = p.id
      LEFT JOIN users u ON r.medecin_id = u.id
      LEFT JOIN users c ON r.cree_par_id = c.id
      LEFT JOIN factures f ON r.facture_id = f.id
      WHERE r.actif = 1
    `;
    const params: (string | number)[] = [];

    // Filtrage médecin :
    // - Si rôle médical et pas de filtre tous=true, medecin_id explicite ou patient_id ciblé, on filtre sur son agenda
    if (user && isDoctorRole(user)) {
      if (medecin_id && typeof medecin_id === 'string' && medecin_id !== 'ALL') {
        sql += ` AND r.medecin_id = ?`;
        params.push(medecin_id);
      } else if (tous !== 'true' && !patient_id) {
        sql += ` AND r.medecin_id = ?`;
        params.push(user.id);
      }
    } else if (medecin_id && typeof medecin_id === 'string' && medecin_id !== 'ALL') {
      sql += ` AND r.medecin_id = ?`;
      params.push(medecin_id);
    }

    if (date && typeof date === 'string') {
      sql += ` AND r.date_rdv = ?`;
      params.push(date);
    }

    if (date_debut && typeof date_debut === 'string') {
      sql += ` AND r.date_rdv >= ?`;
      params.push(date_debut);
    }

    if (date_fin && typeof date_fin === 'string') {
      sql += ` AND r.date_rdv <= ?`;
      params.push(date_fin);
    }

    if (patient_id && typeof patient_id === 'string') {
      sql += ` AND r.patient_id = ?`;
      params.push(patient_id);
    }

    if (statut && typeof statut === 'string' && statut !== 'ALL') {
      const normalized = normalizeRdvStatus(statut);
      sql += ` AND (r.statut = ? OR r.statut = ?)`;
      params.push(normalized, statut);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      sql += ` AND (p.nom LIKE ? OR p.prenom LIKE ? OR p.numero_dossier LIKE ? OR p.telephone LIKE ? OR r.patient_nom_temp LIKE ? OR r.patient_telephone_temp LIKE ? OR r.motif LIKE ? OR u.nom_complet LIKE ?)`;
      params.push(q, q, q, q, q, q, q, q);
    }

    sql += ` ORDER BY r.date_rdv ASC, r.heure_rdv ASC`;

    const appointments = await query(sql, params);
    res.json({ appointments });
  } catch (error: any) {
    console.error('Erreur récupération rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des rendez-vous.' });
  }
}

/**
 * Prise d'un nouveau rendez-vous
 * POST /api/rendez-vous
 * Autorisé pour : RÉCEPTION, MÉDECIN, ADMINISTRATEUR
 */
export async function createAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { 
      patient_id, 
      patient_nom,
      patient_prenom,
      patient_telephone,
      medecin_id, 
      date_rdv, 
      heure_rdv, 
      motif, 
      notes, 
      type_rdv, 
      visite_id, 
      source_demande,
      statut,
      facturer_avance,
      prestation_tarif_id,
      paiement_immediat
    } = req.body;

    if (!patient_id && (!patient_nom || !patient_nom.trim())) {
      res.status(400).json({ error: 'Le patient (patient_id ou nom du patient) est obligatoire.' });
      return;
    }

    // Le médecin est obligatoire pour la réception, et par défaut l'utilisateur courant pour un médecin
    let finalMedecinId = (medecin_id && typeof medecin_id === 'string' && medecin_id.trim().length > 0) ? medecin_id.trim() : null;
    if (!finalMedecinId) {
      if (user && isDoctorRole(user)) {
        finalMedecinId = user.id;
      } else {
        // Fallback sécurisé vers le premier médecin actif disponible
        const firstDoc = await queryOne<any>(
          `SELECT u.id FROM users u
           LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.code
           WHERE (u.role IN ('MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR') OR r.categorie IN ('MÉDECIN', 'DIRECTEUR'))
             AND u.actif = 1
           ORDER BY u.nom_complet ASC LIMIT 1`
        );
        finalMedecinId = firstDoc?.id || user?.id || null;
      }
    }
    if (!finalMedecinId) {
      res.status(400).json({ error: 'Le praticien (medecin_id) est obligatoire pour planifier un rendez-vous.' });
      return;
    }

    const cleanDateRdv = typeof date_rdv === 'string' ? date_rdv.trim().split('T')[0] : '';
    if (!cleanDateRdv || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDateRdv)) {
      res.status(400).json({ error: 'Une date de rendez-vous valide (YYYY-MM-DD) est obligatoire.' });
      return;
    }

    let finalHeure = '09:00';
    if (heure_rdv && typeof heure_rdv === 'string') {
      const match = heure_rdv.trim().match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        finalHeure = `${match[1].padStart(2, '0')}:${match[2]}`;
      }
    }

    // Vérifier patient si fourni
    let patient: any = null;
    if (patient_id) {
      patient = await queryOne<any>('SELECT id, numero_dossier, nom, prenom FROM patients WHERE id = ? AND actif = 1', [patient_id]);
      if (!patient) {
        res.status(404).json({ error: 'Patient introuvable.' });
        return;
      }
    }

    const medecin = await queryOne<any>(
      `SELECT u.id, u.nom_complet, u.role, r.categorie as role_categorie 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.code
       WHERE u.id = ? AND u.actif = 1`,
      [finalMedecinId]
    );
    if (!medecin || (!isDoctorRole(medecin) && medecin.role !== 'ADMINISTRATEUR')) {
      res.status(404).json({ error: 'Médecin introuvable ou inactif.' });
      return;
    }

    const rdvId = 'rdv_' + crypto.randomUUID();
    const numDate = cleanDateRdv.replace(/-/g, '');
    const randomSuffix = crypto.randomUUID().substring(0, 5).toUpperCase();
    const numero_rdv = `RDV-${numDate}-${randomSuffix}`;
    const nowIso = new Date().toISOString();

    const finalStatut = statut ? normalizeRdvStatus(statut) : 'PLANIFIÉ';
    const finalType = type_rdv || (visite_id ? 'CONTROLE' : 'CONSULTATION');
    const finalSource = source_demande || (user?.role === 'MÉDECIN' ? 'CONSULTATION_SUIVI' : 'ACCUEIL');

    const tempNom = !patient ? (patient_nom?.trim()?.toUpperCase() || null) : null;
    const tempPrenom = !patient ? (patient_prenom?.trim() || null) : null;
    const tempTel = !patient ? (patient_telephone?.trim() || null) : null;

    let factureId: string | null = null;
    let createdFacture: any = null;
    let createdPaiement: any = null;

    // Facturation d'avance (Étape 2 / Règle 5)
    if (facturer_avance) {
      // Trouver le tarif sélectionné ou défaut Consultation Médecine Générale (20 USD)
      let tarif = null;
      if (prestation_tarif_id) {
        tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = ?', [prestation_tarif_id]);
      }
      if (!tarif) {
        tarif = await queryOne<any>('SELECT * FROM tarifs WHERE categorie = "CONSULTATION" AND actif = 1 LIMIT 1') || {
          id: 'tar-csl-01',
          nom: 'Consultation Médecine Générale',
          prix_usd: 20,
          categorie: 'CONSULTATION'
        };
      }

      const settingRate = await queryOne<any>("SELECT value FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' LIMIT 1");
      const tauxActuel = settingRate && settingRate.value ? parseFloat(settingRate.value) : 2850;

      const dateStr = nowIso.slice(0, 10).replace(/-/g, '');
      const countTodayRes = await queryOne<any>("SELECT count(*) as count FROM factures WHERE numero_facture LIKE ?", [`FAC-${dateStr}-%`]);
      const countToday = countTodayRes ? Number(countTodayRes.count) + 1 : 1;
      const numeroFacture = `FAC-${dateStr}-${String(countToday).padStart(4, '0')}`;

      factureId = `fac-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const prixUsd = parseFloat(tarif.prix_usd) || 20;

      await execute(
        `INSERT INTO factures (
          id, numero_facture, patient_id, visite_id, rendez_vous_id,
          patient_nom_temp, patient_prenom_temp, patient_telephone_temp,
          type_prestation, montant_total, devise, taux_usd_fc, statut,
          emise_par_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'CONSULTATION', ?, 'USD', ?, 'NON PAYÉ', ?, ?, ?, ?)`,
        [
          factureId,
          numeroFacture,
          patient ? patient.id : null,
          rdvId,
          tempNom,
          tempPrenom,
          tempTel,
          prixUsd,
          tauxActuel,
          user?.id || 'usr-recep-01',
          `Rdv d'avance ${numero_rdv} - ${tarif.nom}`,
          nowIso,
          nowIso
        ]
      );

      // Ligne de facture
      const itemId = `item-${Date.now()}-0-${Math.random().toString(36).substring(2, 5)}`;
      await execute(
        `INSERT INTO facture_items (
          id, facture_id, tarif_id, code_prestation, description, categorie, quantite, prix_unitaire, montant_ligne, devise
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'USD')`,
        [
          itemId,
          factureId,
          tarif.id,
          tarif.id,
          tarif.nom,
          tarif.categorie || 'CONSULTATION',
          prixUsd,
          prixUsd
        ]
      );

      // Si encaissement immédiat demandé
      if (paiement_immediat && paiement_immediat.montant_paye) {
        const montantVerse = parseFloat(paiement_immediat.montant_paye);
        const devisePmt = paiement_immediat.devise === 'FC' ? 'FC' : 'USD';
        if (montantVerse > 0) {
          const equivUsd = devisePmt === 'USD' ? montantVerse : Math.round((montantVerse / tauxActuel) * 100) / 100;
          const equivFc = devisePmt === 'FC' ? Math.round(montantVerse) : Math.round(montantVerse * tauxActuel);

          const countRecuRes = await queryOne<any>("SELECT count(*) as count FROM paiements WHERE numero_recu LIKE ?", [`REC-${dateStr}-%`]);
          const countRecu = countRecuRes ? Number(countRecuRes.count) + 1 : 1;
          const numeroRecu = `REC-${dateStr}-${String(countRecu).padStart(4, '0')}`;
          const paiementId = `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          await execute(
            `INSERT INTO paiements (
              id, numero_recu, facture_id, montant_paye, devise, taux_usd_fc,
              equivalent_usd, equivalent_fc, mode_paiement, reference_transaction, notes,
              date_paiement, encaisse_par_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              paiementId,
              numeroRecu,
              factureId,
              montantVerse,
              devisePmt,
              tauxActuel,
              equivUsd,
              equivFc,
              paiement_immediat.mode_paiement || 'ESPECES',
              paiement_immediat.reference_transaction || null,
              `Paiement d'avance RDV ${numero_rdv}`,
              nowIso,
              user?.id || 'usr-recep-01'
            ]
          );

          const newStatut = equivUsd >= prixUsd - 0.05 ? 'PAYÉ' : 'PARTIELLEMENT PAYÉ';
          await execute('UPDATE factures SET statut = ?, updated_at = ? WHERE id = ?', [newStatut, nowIso, factureId]);

          createdPaiement = {
            id: paiementId,
            numero_recu: numeroRecu,
            montant_paye: montantVerse,
            devise: devisePmt,
            taux_usd_fc: tauxActuel,
            statut: newStatut
          };
        }
      }

      createdFacture = await queryOne<any>('SELECT * FROM factures WHERE id = ?', [factureId]);
    }

    await execute(
      `INSERT INTO rendez_vous (
        id, numero_rdv, patient_id, medecin_id, date_rdv, heure_rdv, motif, type_rdv,
        statut, cree_par_id, notes, visite_id, rappel_statut, source_demande, actif,
        patient_nom_temp, patient_prenom_temp, patient_telephone_temp, facture_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NON_ENVOYE', ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        rdvId,
        numero_rdv,
        patient ? patient.id : null,
        finalMedecinId,
        cleanDateRdv,
        finalHeure,
        motif ? motif.trim() : (finalType === 'CONTROLE' ? 'Contrôle / Suivi médical' : 'Consultation générale'),
        finalType,
        finalStatut,
        user?.id || 'system',
        notes ? notes.trim() : null,
        visite_id || null,
        finalSource,
        tempNom,
        tempPrenom,
        tempTel,
        factureId,
        nowIso,
        nowIso,
      ]
    );

    await auditLogger.log({
      userId: user?.id || 'system',
      action: 'CREATE_APPOINTMENT',
      ressourceType: 'RENDEZ_VOUS',
      ressourceId: rdvId,
      details: JSON.stringify({
        numero_rdv,
        patient_dossier: patient ? patient.numero_dossier : 'SANS DOSSIER (AVANCE)',
        patient_nom: patient ? `${patient.nom} ${patient.prenom}` : `${tempNom} ${tempPrenom || ''}`,
        medecin_nom: medecin.nom_complet,
        date_rdv: cleanDateRdv,
        heure_rdv: finalHeure,
        source_demande: finalSource,
        type_rdv: finalType,
        facture_id: factureId
      }),
      ipAddress: req.ip || '127.0.0.1',
    });

    const created = await queryOne(
      `SELECT r.*, 
              COALESCE(p.nom, r.patient_nom_temp, 'Patient sans dossier') as patient_nom, 
              p.post_nom as patient_post_nom, 
              COALESCE(p.prenom, r.patient_prenom_temp, '') as patient_prenom, 
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier, 
              COALESCE(p.telephone, r.patient_telephone_temp, '') as patient_telephone,
              COALESCE(u.nom_complet, 'Médecin') as medecin_nom,
              COALESCE(c.nom_complet, 'Système') as cree_par_nom,
              f.numero_facture,
              f.montant_total as facture_montant_usd,
              f.statut as statut_paiement
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       LEFT JOIN users u ON r.medecin_id = u.id
       LEFT JOIN users c ON r.cree_par_id = c.id
       LEFT JOIN factures f ON r.facture_id = f.id
       WHERE r.id = ?`,
      [rdvId]
    );

    res.status(201).json({ 
      appointment: created,
      facture: createdFacture,
      paiement: createdPaiement
    });
  } catch (error: any) {
    console.error('Erreur création rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création du rendez-vous.' });
  }
}

/**
 * Mise à jour du statut d'un rendez-vous
 * PATCH /api/rendez-vous/:id/status
 * Statuts : PLANIFIÉ -> CONFIRMÉ -> PATIENT PRÉSENT -> HONORÉ / ABSENT / ANNULÉ
 */
export async function updateAppointmentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { statut, notes } = req.body;

    if (!statut) {
      res.status(400).json({ error: 'Le champ statut est obligatoire.' });
      return;
    }

    const normalized = normalizeRdvStatus(statut);
    if (!VALID_RDV_STATUSES.includes(normalized as any)) {
      res.status(400).json({ 
        error: `Statut invalide : ${statut}. Statuts autorisés : ${VALID_RDV_STATUSES.join(', ')}` 
      });
      return;
    }

    const rdv = await queryOne<any>('SELECT * FROM rendez_vous WHERE id = ? AND actif = 1', [id]);
    if (!rdv) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }

    const nowIso = new Date().toISOString();
    await execute(
      `UPDATE rendez_vous SET statut = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`,
      [normalized, notes ? notes.trim() : null, nowIso, id]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'UPDATE_APPOINTMENT_STATUS',
      ressourceType: 'RENDEZ_VOUS',
      ressourceId: id,
      details: JSON.stringify({ ancien_statut: rdv.statut, nouveau_statut: normalized }),
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne(
      `SELECT r.*, 
              COALESCE(p.nom, r.patient_nom_temp) as patient_nom, 
              COALESCE(p.prenom, r.patient_prenom_temp) as patient_prenom, 
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier, 
              COALESCE(p.telephone, r.patient_telephone_temp, '') as patient_telephone,
              u.nom_complet as medecin_nom,
              c.nom_complet as cree_par_nom
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       JOIN users u ON r.medecin_id = u.id
       LEFT JOIN users c ON r.cree_par_id = c.id
       WHERE r.id = ?`,
      [id]
    );

    res.json({ appointment: updated });
  } catch (error: any) {
    console.error('Erreur statut rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du rendez-vous.' });
  }
}

/**
 * Mise à jour complète / replanification d'un rendez-vous
 * PATCH /api/rendez-vous/:id
 */
export async function updateAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { date_rdv, heure_rdv, medecin_id, motif, type_rdv, notes, source_demande, statut } = req.body;

    const rdv = await queryOne<any>('SELECT * FROM rendez_vous WHERE id = ? AND actif = 1', [id]);
    if (!rdv) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }

    if (date_rdv && !/^\d{4}-\d{2}-\d{2}$/.test(date_rdv)) {
      res.status(400).json({ error: 'Format de date invalide (YYYY-MM-DD).' });
      return;
    }

    const nowIso = new Date().toISOString();
    const finalStatut = statut ? normalizeRdvStatus(statut) : rdv.statut;

    await execute(
      `UPDATE rendez_vous SET 
        date_rdv = COALESCE(?, date_rdv),
        heure_rdv = COALESCE(?, heure_rdv),
        medecin_id = COALESCE(?, medecin_id),
        motif = COALESCE(?, motif),
        type_rdv = COALESCE(?, type_rdv),
        notes = COALESCE(?, notes),
        source_demande = COALESCE(?, source_demande),
        statut = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        date_rdv || null,
        heure_rdv || null,
        medecin_id || null,
        motif ? motif.trim() : null,
        type_rdv || null,
        notes ? notes.trim() : null,
        source_demande || null,
        finalStatut,
        nowIso,
        id
      ]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'UPDATE_APPOINTMENT',
      ressourceType: 'RENDEZ_VOUS',
      ressourceId: id,
      details: JSON.stringify({ 
        date_rdv: date_rdv || rdv.date_rdv, 
        heure_rdv: heure_rdv || rdv.heure_rdv,
        statut: finalStatut,
        medecin_id: medecin_id || rdv.medecin_id
      }),
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne(
      `SELECT r.*, 
              COALESCE(p.nom, r.patient_nom_temp) as patient_nom, 
              COALESCE(p.prenom, r.patient_prenom_temp) as patient_prenom, 
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier, 
              COALESCE(p.telephone, r.patient_telephone_temp, '') as patient_telephone,
              u.nom_complet as medecin_nom,
              c.nom_complet as cree_par_nom
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       JOIN users u ON r.medecin_id = u.id
       LEFT JOIN users c ON r.cree_par_id = c.id
       WHERE r.id = ?`,
      [id]
    );

    res.json({ appointment: updated });
  } catch (error: any) {
    console.error('Erreur modification rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de la modification du rendez-vous.' });
  }
}

/**
 * Gestion des rappels patient (Téléphone, SMS, etc.)
 * PATCH /api/rendez-vous/:id/rappel
 */
export async function updateAppointmentReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { rappel_statut, notes } = req.body;

    const validReminderStatuses = ['NON_ENVOYE', 'ENVOYE', 'CONFIRME_PAR_PATIENT', 'SANS_REPONSE'];
    if (!rappel_statut || !validReminderStatuses.includes(rappel_statut)) {
      res.status(400).json({ 
        error: `Statut de rappel invalide. Statuts autorisés : ${validReminderStatuses.join(', ')}` 
      });
      return;
    }

    const rdv = await queryOne<any>('SELECT * FROM rendez_vous WHERE id = ? AND actif = 1', [id]);
    if (!rdv) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }

    const nowIso = new Date().toISOString();
    await execute(
      `UPDATE rendez_vous SET 
        rappel_statut = ?, 
        rappel_date = ?, 
        notes = COALESCE(?, notes), 
        updated_at = ? 
       WHERE id = ?`,
      [rappel_statut, nowIso, notes ? notes.trim() : null, nowIso, id]
    );

    const updated = await queryOne(
      `SELECT r.*,
              COALESCE(p.nom, r.patient_nom_temp) as patient_nom,
              COALESCE(p.prenom, r.patient_prenom_temp) as patient_prenom,
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier,
              COALESCE(p.telephone, r.patient_telephone_temp, '') as patient_telephone,
              u.nom_complet as medecin_nom,
              c.nom_complet as cree_par_nom
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       JOIN users u ON r.medecin_id = u.id
       LEFT JOIN users c ON r.cree_par_id = c.id
       WHERE r.id = ?`,
      [id]
    );

    res.json({ appointment: updated });
  } catch (error: any) {
    console.error('Erreur rappel rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de la gestion du rappel.' });
  }
}

/**
 * Annulation d'un rendez-vous
 * DELETE /api/rendez-vous/:id
 */
export async function cancelAppointment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { motif_annulation } = req.body || {};

    const rdv = await queryOne<any>('SELECT * FROM rendez_vous WHERE id = ? AND actif = 1', [id]);
    if (!rdv) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedNotes = motif_annulation 
      ? (rdv.notes ? `${rdv.notes} [Annulé : ${motif_annulation}]` : `[Annulé : ${motif_annulation}]`)
      : rdv.notes;

    await execute(
      `UPDATE rendez_vous SET statut = 'ANNULÉ', notes = ?, updated_at = ? WHERE id = ?`,
      [updatedNotes, nowIso, id]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'CANCEL_APPOINTMENT',
      ressourceType: 'RENDEZ_VOUS',
      ressourceId: id,
      details: JSON.stringify({ motif: motif_annulation || 'Non spécifié' }),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ success: true, message: 'Rendez-vous annulé avec succès.' });
  } catch (error: any) {
    console.error('Erreur annulation rendez-vous:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'annulation du rendez-vous.' });
  }
}

/**
 * Signaux de communication Réception <-> Médecin
 * GET /api/signaux-reception
 */
export async function getSignals(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { visite_id, non_traites_seuls } = req.query;

    let sql = `
      SELECT s.*, 
             v.numero_visite, 
             p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier,
             em.nom_complet as emetteur_nom, em.role as emetteur_role,
             dest.nom_complet as destinataire_nom
      FROM signaux_reception s
      LEFT JOIN visites v ON s.visite_id = v.id
      LEFT JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users em ON s.emetteur_id = em.id
      LEFT JOIN users dest ON s.destinataire_id = dest.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (visite_id && typeof visite_id === 'string') {
      sql += ` AND s.visite_id = ?`;
      params.push(visite_id);
    }

    if (non_traites_seuls === 'true') {
      sql += ` AND s.statut = 'NON_TRAITE'`;
    }

    // Filtre par rôle / destinataire
    if (user && isDoctorRole(user)) {
      sql += ` AND (s.destinataire_id = ? OR s.destinataire_id IS NULL)`;
      params.push(user.id);
    }

    sql += ` ORDER BY s.created_at DESC LIMIT 50`;

    const signals = await query(sql, params);
    res.json({ signals });
  } catch (error: any) {
    console.error('Erreur récupération signaux:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des signaux.' });
  }
}

/**
 * Émettre un signal (ex: Patient en attente depuis > 30min, Urgence, etc.)
 * POST /api/signaux-reception
 */
export async function createSignal(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { visite_id, destinataire_id, type_signal, message } = req.body;

    if (!type_signal) {
      res.status(400).json({ error: 'Le type de signal est obligatoire.' });
      return;
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Le message du signal est obligatoire.' });
      return;
    }

    const signalId = 'sig_' + crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await execute(
      `INSERT INTO signaux_reception (
        id, visite_id, emetteur_id, destinataire_id, type_signal, message, statut, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'NON_TRAITE', ?)`,
      [
        signalId,
        visite_id || null,
        user?.id || 'system',
        destinataire_id || null,
        type_signal,
        message.trim(),
        nowIso,
      ]
    );

    const created = await queryOne('SELECT * FROM signaux_reception WHERE id = ?', [signalId]);
    res.status(201).json({ signal: created });
  } catch (error: any) {
    console.error('Erreur création signal:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création du signal.' });
  }
}

/**
 * Traiter ou marquer un signal comme acquitté
 * PATCH /api/signaux-reception/:id/traiter
 */
export async function treatSignal(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const nowIso = new Date().toISOString();

    await execute(
      `UPDATE signaux_reception SET statut = 'TRAITE', traite_le = ? WHERE id = ?`,
      [nowIso, id]
    );

    res.json({ success: true, message: 'Signal traité avec succès.' });
  } catch (error: any) {
    console.error('Erreur traitement signal:', error);
    res.status(500).json({ error: 'Erreur interne lors du traitement du signal.' });
  }
}

