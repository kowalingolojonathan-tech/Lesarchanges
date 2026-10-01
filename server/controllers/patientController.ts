import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { AuthenticatedRequest, isDoctorRole } from '../middleware/auth.js';

/**
 * Génère un numéro de dossier permanent unique au format ARCH-YYYY-XXXX
 */
async function generateUniqueNumeroDossier(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `ARCH-${currentYear}-`;

  const rows = await query<{ numero_dossier: string }>(
    `SELECT numero_dossier FROM patients WHERE numero_dossier LIKE ?`,
    [`${prefix}%`]
  );

  let maxSeq = 0;
  for (const row of rows) {
    const numPart = row.numero_dossier.replace(prefix, '');
    if (/^\d+$/.test(numPart)) {
      const val = parseInt(numPart, 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  // Garantie absolue d'unicité dans la base
  while (await queryOne('SELECT id FROM patients WHERE numero_dossier = ?', [candidate])) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

/**
 * Recherche de patients selon les critères : numéro de dossier, nom, prénom, téléphone, date de naissance
 * GET /api/patients/search
 */
export async function searchPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { q, query: queryParam, search, numero_dossier, nom, post_nom, prenom, telephone, date_naissance } = req.query;
    const searchTerm = (q || search || queryParam) as string | undefined;
    const isReception = req.user?.role === 'RÉCEPTION';

    let sql = `SELECT id, numero_dossier, nom, post_nom, prenom, date_naissance, sexe, 
                      lieu_naissance, pays_naissance, profession, etat_civil, telephone, adresse, 
                      contact_urgence_nom, contact_urgence_telephone, groupe_sanguin,
                      ${isReception ? 'NULL as allergies, NULL as antecedents' : 'allergies, antecedents'}, 
                      actif, created_at, updated_at 
               FROM patients WHERE actif = 1`;
    const params: (string | number)[] = [];

    // Recherche globale rapide par mot-clé
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim().length > 0) {
      const term = `%${searchTerm.trim().toLowerCase()}%`;
      sql += ` AND (
        LOWER(numero_dossier) LIKE ? OR
        LOWER(nom) LIKE ? OR
        LOWER(COALESCE(post_nom, '')) LIKE ? OR
        LOWER(prenom) LIKE ? OR
        LOWER(telephone) LIKE ? OR
        date_naissance LIKE ?
      )`;
      params.push(term, term, term, term, term, term);
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
      if (post_nom && typeof post_nom === 'string') {
        sql += ` AND LOWER(COALESCE(post_nom, '')) LIKE ?`;
        params.push(`%${post_nom.trim().toLowerCase()}%`);
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

    // ÉTAPE 9 : Par défaut, un médecin ne voit QUE les patients qui lui sont attribués.
    // Un médecin autorisé par l'administrateur (ex: Directeur ou permission 'patients:voir_tous') peut voir tous les dossiers.
    const isDoctor = req.user && isDoctorRole(req.user);
    const hasViewAll = req.user?.role === 'ADMINISTRATEUR' || req.user?.permissions?.includes('patients:voir_tous');
    if (isDoctor && !hasViewAll && req.user) {
      sql += ` AND (
        EXISTS (SELECT 1 FROM visites v WHERE v.patient_id = patients.id AND v.medecin_id = ?)
        OR EXISTS (SELECT 1 FROM rendez_vous r WHERE r.patient_id = patients.id AND r.medecin_id = ?)
        OR EXISTS (SELECT 1 FROM consultations c WHERE c.patient_id = patients.id AND c.medecin_id = ?)
      )`;
      params.push(req.user.id, req.user.id, req.user.id);
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
 * ÉTAPE 9 : Contrôle d'accès backend pour les médecins non autorisés à voir tous les dossiers.
 */
export async function getPatientById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const isReception = req.user?.role === 'RÉCEPTION';

    // Contrôle d'accès médecin attribué
    const isDoctor = req.user && isDoctorRole(req.user);
    const hasViewAll = req.user?.role === 'ADMINISTRATEUR' || req.user?.permissions?.includes('patients:voir_tous');
    if (isDoctor && !hasViewAll && req.user) {
      const isAttributed = await queryOne(
        `SELECT 1 FROM patients p
         WHERE p.id = ? AND (
           EXISTS (SELECT 1 FROM visites v WHERE v.patient_id = p.id AND v.medecin_id = ?)
           OR EXISTS (SELECT 1 FROM rendez_vous r WHERE r.patient_id = p.id AND r.medecin_id = ?)
           OR EXISTS (SELECT 1 FROM consultations c WHERE c.patient_id = p.id AND c.medecin_id = ?)
         )`,
        [id, req.user.id, req.user.id, req.user.id]
      );
      if (!isAttributed) {
        res.status(403).json({
          error: "Accès refusé. Par défaut, un médecin ne voit que les patients qui lui sont attribués."
        });
        return;
      }
    }

    const patient = await queryOne(
      `SELECT id, numero_dossier, nom, post_nom, prenom, date_naissance, sexe, 
              lieu_naissance, pays_naissance, profession, etat_civil, telephone, adresse, 
              contact_urgence_nom, contact_urgence_telephone, groupe_sanguin,
              ${isReception ? 'NULL as allergies, NULL as antecedents' : 'allergies, antecedents'}, 
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
              v.motif_venue, v.type_visite, v.cloturee_le, v.heure_orientation, 
              v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              v.created_at, u.nom_complet as medecin_nom
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
      post_nom,
      prenom,
      date_naissance,
      sexe,
      lieu_naissance,
      pays_naissance,
      profession,
      etat_civil,
      telephone,
      adresse,
      contact_urgence_nom,
      contact_urgence_telephone,
      groupe_sanguin,
      allergies,
      antecedents,
    } = req.body;

    // 1. Validations obligatoires d'identité (Les 5 champs obligatoires stricts)
    if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
      res.status(400).json({ error: 'Le nom du patient est obligatoire.' });
      return;
    }
    if (!post_nom || typeof post_nom !== 'string' || post_nom.trim().length === 0) {
      res.status(400).json({ error: 'Le post-nom du patient est obligatoire.' });
      return;
    }
    if (!prenom || typeof prenom !== 'string' || prenom.trim().length === 0) {
      res.status(400).json({ error: 'Le prénom du patient est obligatoire.' });
      return;
    }
    if (!lieu_naissance || typeof lieu_naissance !== 'string' || lieu_naissance.trim().length === 0) {
      res.status(400).json({ error: 'Le lieu de naissance du patient est obligatoire.' });
      return;
    }
    if (!pays_naissance || typeof pays_naissance !== 'string' || pays_naissance.trim().length === 0) {
      res.status(400).json({ error: 'Le pays de naissance du patient est obligatoire.' });
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
    const cleanPostNom = post_nom.trim().toUpperCase();
    const cleanPrenom = prenom.trim();
    const cleanDateNaissance = date_naissance.trim();
    const cleanTelephone = telephone.trim();
    const cleanLieuNaissance = lieu_naissance.trim();
    const cleanPaysNaissance = pays_naissance.trim();
    const cleanProfession = profession ? profession.trim() : null;
    const cleanEtatCivil = etat_civil ? etat_civil.trim() : null;

    // 2. Détection de doublon
    // Un patient existant avec même nom, prénom, date de naissance et téléphone ne doit pas être dupliqué !
    const existingDuplicate = await queryOne(
      `SELECT id, numero_dossier, nom, post_nom, prenom, telephone, date_naissance 
       FROM patients 
       WHERE LOWER(nom) = LOWER(?) 
         AND (LOWER(COALESCE(post_nom, '')) = LOWER(?) OR ? = '' OR post_nom IS NULL)
         AND LOWER(prenom) = LOWER(?) 
         AND date_naissance = ? 
         AND telephone = ? 
         AND actif = 1`,
      [cleanNom, cleanPostNom, cleanPostNom, cleanPrenom, cleanDateNaissance, cleanTelephone]
    );

    if (existingDuplicate) {
      res.status(409).json({
        error: 'DUPLICATE_PATIENT',
        message: `Un dossier patient permanent existe déjà pour cette personne (Dossier N° ${existingDuplicate.numero_dossier}). Ne pas créer de nouveau patient : réutiliser le dossier existant.`,
        patient: existingDuplicate,
        existingDossier: existingDuplicate.numero_dossier,
      });
      return;
    }

    // 3. Attribution d'un ID et numéro de dossier permanent
    const patientId = 'pat_' + crypto.randomUUID();
    const numeroDossier = await generateUniqueNumeroDossier();
    const nowIso = new Date().toISOString();

    await execute(
      `INSERT INTO patients (
        id, numero_dossier, nom, post_nom, prenom, date_naissance, sexe, 
        lieu_naissance, pays_naissance, profession, etat_civil,
        telephone, adresse, contact_urgence_nom, contact_urgence_telephone, 
        groupe_sanguin, allergies, antecedents,
        actif, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        patientId,
        numeroDossier,
        cleanNom,
        cleanPostNom,
        cleanPrenom,
        cleanDateNaissance,
        sexe.toUpperCase(),
        cleanLieuNaissance,
        cleanPaysNaissance,
        cleanProfession,
        cleanEtatCivil,
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
        post_nom: cleanPostNom,
        prenom: cleanPrenom,
        sexe: sexe.toUpperCase(),
        telephone: cleanTelephone,
      }),
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    });

    const createdPatient = await queryOne('SELECT * FROM patients WHERE id = ?', [patientId]);
    res.status(201).json({ patient: createdPatient });
  } catch (error: any) {
    console.error('Erreur création patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création du patient' });
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
      post_nom,
      lieu_naissance,
      pays_naissance,
      profession,
      etat_civil,
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
       SET post_nom = COALESCE(?, post_nom),
           lieu_naissance = COALESCE(?, lieu_naissance),
           pays_naissance = COALESCE(?, pays_naissance),
           profession = COALESCE(?, profession),
           etat_civil = COALESCE(?, etat_civil),
           telephone = COALESCE(?, telephone),
           adresse = COALESCE(?, adresse),
           contact_urgence_nom = COALESCE(?, contact_urgence_nom),
           contact_urgence_telephone = COALESCE(?, contact_urgence_telephone),
           groupe_sanguin = COALESCE(?, groupe_sanguin),
           allergies = COALESCE(?, allergies),
           antecedents = COALESCE(?, antecedents),
           updated_at = ?
       WHERE id = ?`,
      [
        post_nom !== undefined ? (post_nom ? post_nom.trim().toUpperCase() : null) : null,
        lieu_naissance !== undefined ? (lieu_naissance ? lieu_naissance.trim() : null) : null,
        pays_naissance !== undefined ? (pays_naissance ? pays_naissance.trim() : null) : null,
        profession !== undefined ? (profession ? profession.trim() : null) : null,
        etat_civil !== undefined ? (etat_civil ? etat_civil.trim() : null) : null,
        telephone !== undefined ? (telephone ? telephone.trim() : null) : null,
        adresse !== undefined ? (adresse ? adresse.trim() : null) : null,
        contact_urgence_nom !== undefined ? (contact_urgence_nom ? contact_urgence_nom.trim() : null) : null,
        contact_urgence_telephone !== undefined ? (contact_urgence_telephone ? contact_urgence_telephone.trim() : null) : null,
        groupe_sanguin !== undefined ? (groupe_sanguin ? groupe_sanguin.trim().toUpperCase() : null) : null,
        allergies !== undefined ? (allergies ? allergies.trim() : null) : null,
        antecedents !== undefined ? (antecedents ? antecedents.trim() : null) : null,
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
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    });

    const updated = await queryOne('SELECT * FROM patients WHERE id = ?', [id]);
    res.json({ patient: updated });
  } catch (error: any) {
    console.error('Erreur mise à jour patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du dossier patient' });
  }
}
