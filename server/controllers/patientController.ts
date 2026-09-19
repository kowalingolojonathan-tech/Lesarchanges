import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    nom_complet: string;
  };
}

/**
 * Génère un numéro de dossier permanent unique au format ARCH-YYYY-XXXX
 */
async function generateUniqueNumeroDossier(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `ARCH-${currentYear}-`;

  const lastPatient = await queryOne<{ numero_dossier: string }>(
    `SELECT numero_dossier FROM patients WHERE numero_dossier LIKE ? ORDER BY numero_dossier DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSequence = 1;
  if (lastPatient && lastPatient.numero_dossier) {
    const parts = lastPatient.numero_dossier.split('-');
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Recherche de patients selon les critères : numéro de dossier, nom, prénom, téléphone, date de naissance
 * GET /api/patients/search
 */
export async function searchPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { q, numero_dossier, nom, prenom, telephone, date_naissance } = req.query;

    let sql = `SELECT id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, 
                      contact_urgence_nom, contact_urgence_telephone, groupe_sanguin, allergies, antecedents, 
                      actif, created_at, updated_at 
               FROM patients WHERE actif = 1`;
    const params: (string | number)[] = [];

    // Recherche globale rapide par mot-clé
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const term = `%${q.trim().toLowerCase()}%`;
      sql += ` AND (
        LOWER(numero_dossier) LIKE ? OR
        LOWER(nom) LIKE ? OR
        LOWER(prenom) LIKE ? OR
        LOWER(telephone) LIKE ? OR
        date_naissance LIKE ?
      )`;
      params.push(term, term, term, term, term);
    } else {
      // Filtres ciblés
      if (numero_dossier && typeof numero_dossier === 'string') {
        sql += ` AND LOWER(numero_dossier) LIKE ?`;
        params.push(`%${numero_dossier.trim().toLowerCase()}%`);
      }
      if (nom && typeof nom === 'string') {
        sql += ` AND LOWER(nom) LIKE ?`;
        params.push(`%${nom.trim().toLowerCase()}%`);
      }
      if (prenom && typeof prenom === 'string') {
        sql += ` AND LOWER(prenom) LIKE ?`;
        params.push(`%${prenom.trim().toLowerCase()}%`);
      }
      if (telephone && typeof telephone === 'string') {
        sql += ` AND LOWER(telephone) LIKE ?`;
        params.push(`%${telephone.trim().toLowerCase()}%`);
      }
      if (date_naissance && typeof date_naissance === 'string') {
        sql += ` AND date_naissance = ?`;
        params.push(date_naissance.trim());
      }
    }

    sql += ` ORDER BY updated_at DESC LIMIT 50`;
    const patients = await query(sql, params);

    res.json({ patients });
  } catch (error: any) {
    console.error('Erreur recherche patients:', error);
    res.status(500).json({ error: 'Erreur interne lors de la recherche de patients' });
  }
}

/**
 * Récupère le dossier administratif d'un patient et l'historique de ses visites
 * GET /api/patients/:id
 * SÉCURITÉ : Cloisonnement strict du secret médical respecté pour le rôle RÉCEPTION.
 */
export async function getPatientById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const patient = await queryOne(
      `SELECT id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse, 
              contact_urgence_nom, contact_urgence_telephone, groupe_sanguin, allergies, antecedents, 
              actif, created_at, updated_at 
       FROM patients WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable' });
      return;
    }

    // Historique des visites du patient (métadonnées administratives autorisées pour la réception)
    const visites = await query(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.cloturee_le, v.created_at,
              u.nom_complet as medecin_nom
       FROM visites v
       LEFT JOIN users u ON v.medecin_id = u.id
       WHERE v.patient_id = ? AND v.actif = 1
       ORDER BY v.date_arrivee DESC`,
      [id]
    );

    res.json({ patient, visites });
  } catch (error: any) {
    console.error('Erreur consultation patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la consultation du patient' });
  }
}

/**
 * Création d'un NOUVEAU dossier patient permanent
 * POST /api/patients
 * Vérifie l'absence de doublon avant création.
 */
export async function createPatient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      nom,
      prenom,
      date_naissance,
      sexe,
      telephone,
      adresse,
      contact_urgence_nom,
      contact_urgence_telephone,
      groupe_sanguin,
      allergies,
      antecedents,
    } = req.body;

    // 1. Validations obligatoires
    if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
      res.status(400).json({ error: 'Le nom du patient est obligatoire.' });
      return;
    }
    if (!prenom || typeof prenom !== 'string' || prenom.trim().length === 0) {
      res.status(400).json({ error: 'Le prénom du patient est obligatoire.' });
      return;
    }
    if (!date_naissance || isNaN(new Date(date_naissance).getTime())) {
      res.status(400).json({ error: 'Date de naissance valide requise (YYYY-MM-DD).' });
      return;
    }
    if (!sexe || !['M', 'F'].includes(sexe.toUpperCase())) {
      res.status(400).json({ error: 'Le sexe doit être M ou F.' });
      return;
    }
    if (!telephone || typeof telephone !== 'string' || telephone.trim().length < 6) {
      res.status(400).json({ error: 'Numéro de téléphone valide obligatoire.' });
      return;
    }

    const cleanNom = nom.trim().toUpperCase();
    const cleanPrenom = prenom.trim();
    const cleanDateNaissance = date_naissance.trim();
    const cleanTelephone = telephone.trim();

    // 2. Détection de doublon
    // Un patient existant avec même nom, prénom, date de naissance et téléphone ne doit pas être dupliqué !
    const existingDuplicate = await queryOne(
      `SELECT id, numero_dossier, nom, prenom, telephone, date_naissance 
       FROM patients 
       WHERE LOWER(nom) = LOWER(?) 
         AND LOWER(prenom) = LOWER(?) 
         AND date_naissance = ? 
         AND telephone = ? 
         AND actif = 1`,
      [cleanNom, cleanPrenom, cleanDateNaissance, cleanTelephone]
    );

    if (existingDuplicate) {
      res.status(409).json({
        error: 'DUPLICATE_PATIENT',
        message: `Un dossier patient permanent existe déjà pour cette personne (Dossier N° ${existingDuplicate.numero_dossier}). Ne pas créer de nouveau patient : réutiliser le dossier existant.`,
        patient: existingDuplicate,
      });
      return;
    }

    // 3. Attribution d'un ID et numéro de dossier permanent
    const patientId = 'pat_' + crypto.randomUUID();
    const numeroDossier = await generateUniqueNumeroDossier();
    const nowIso = new Date().toISOString();

    await execute(
      `INSERT INTO patients (
        id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, adresse,
        contact_urgence_nom, contact_urgence_telephone, groupe_sanguin, allergies, antecedents,
        actif, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        patientId,
        numeroDossier,
        cleanNom,
        cleanPrenom,
        cleanDateNaissance,
        sexe.toUpperCase(),
        cleanTelephone,
        adresse ? adresse.trim() : null,
        contact_urgence_nom ? contact_urgence_nom.trim() : null,
        contact_urgence_telephone ? contact_urgence_telephone.trim() : null,
        groupe_sanguin ? groupe_sanguin.trim().toUpperCase() : null,
        allergies ? allergies.trim() : null,
        antecedents ? antecedents.trim() : null,
        nowIso,
        nowIso,
      ]
    );

    // 4. Traçabilité et Audit Log
    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'CREATE_PATIENT',
      ressourceType: 'PATIENT',
      ressourceId: patientId,
      details: JSON.stringify({
        numero_dossier: numeroDossier,
        nom: cleanNom,
        prenom: cleanPrenom,
        sexe: sexe.toUpperCase(),
      }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const createdPatient = await queryOne('SELECT * FROM patients WHERE id = ?', [patientId]);
    res.status(201).json({ patient: createdPatient });
  } catch (error: any) {
    console.error('Erreur création patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création du dossier patient' });
  }
}

/**
 * Mise à jour administrative d'un dossier patient
 * PUT /api/patients/:id
 */
export async function updatePatient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      telephone,
      adresse,
      contact_urgence_nom,
      contact_urgence_telephone,
      groupe_sanguin,
      allergies,
      antecedents,
    } = req.body;

    const patient = await queryOne('SELECT id, numero_dossier FROM patients WHERE id = ? AND actif = 1', [id]);
    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable' });
      return;
    }

    const nowIso = new Date().toISOString();
    await execute(
      `UPDATE patients 
       SET telephone = COALESCE(?, telephone),
           adresse = COALESCE(?, adresse),
           contact_urgence_nom = COALESCE(?, contact_urgence_nom),
           contact_urgence_telephone = COALESCE(?, contact_urgence_telephone),
           groupe_sanguin = COALESCE(?, groupe_sanguin),
           allergies = COALESCE(?, allergies),
           antecedents = COALESCE(?, antecedents),
           updated_at = ?
       WHERE id = ?`,
      [
        telephone ? telephone.trim() : null,
        adresse ? adresse.trim() : null,
        contact_urgence_nom ? contact_urgence_nom.trim() : null,
        contact_urgence_telephone ? contact_urgence_telephone.trim() : null,
        groupe_sanguin ? groupe_sanguin.trim().toUpperCase() : null,
        allergies ? allergies.trim() : null,
        antecedents ? antecedents.trim() : null,
        nowIso,
        id,
      ]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'UPDATE_PATIENT',
      ressourceType: 'PATIENT',
      ressourceId: id,
      details: JSON.stringify({ numero_dossier: patient.numero_dossier }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const updated = await queryOne('SELECT * FROM patients WHERE id = ?', [id]);
    res.json({ patient: updated });
  } catch (error: any) {
    console.error('Erreur mise à jour patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du dossier patient' });
  }
}
