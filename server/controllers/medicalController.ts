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
 * Récupère le tableau de bord et la file d'attente du médecin connecté
 * GET /api/medical/queue
 * Strictement réservé au rôle MÉDECIN.
 * Filtre hermétiquement : Dr A ne voit que ses visites et consultations.
 */
export async function getDoctorQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const doctorId = user.id;

    // 1. Patients en attente du médecin (visites avec statut ATTENTE_MEDECIN affectées à ce médecin)
    const attente = await query(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.created_at,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2, 
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.imc, 
              sv.categorie_imc, sv.pam, sv.douleur, sv.date_prise as triage_date_prise,
              u_agent.nom_complet as triage_agent_nom
       FROM visites v
       INNER JOIN patients p ON v.patient_id = p.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       LEFT JOIN users u_agent ON sv.agent_id = u_agent.id
       WHERE v.medecin_id = ? AND v.statut = 'ATTENTE_MEDECIN' AND v.actif = 1
       ORDER BY CASE WHEN v.type_visite = 'URGENCE' THEN 0 ELSE 1 END, v.date_arrivee ASC`,
      [doctorId]
    );

    // 2. Consultations en cours pour ce médecin (visite en cours ou consultation active non finalisée)
    const en_cours = await query(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation, 
              c.motif_consultation, c.diagnostic_principal, c.statut, c.created_at, c.updated_at,
              v.numero_visite, v.date_arrivee, v.type_visite,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2, sv.imc, sv.pam
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       WHERE c.medecin_id = ? AND c.statut IN ('EN_COURS', 'BROUILLON') AND c.actif = 1
       ORDER BY c.updated_at DESC`,
      [doctorId]
    );

    // 3. Consultations à finaliser (statut BROUILLON ou EN_COURS)
    const a_finaliser = en_cours.filter((item: any) => item.statut === 'EN_COURS' || item.statut === 'BROUILLON');

    // 4. Consultations finalisées du jour pour ce médecin
    const terminees_jour = await query(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation, 
              c.motif_consultation, c.diagnostic_principal, c.statut, c.finalisee_le,
              v.numero_visite, v.date_arrivee,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       WHERE c.medecin_id = ? AND c.statut = 'FINALISEE' AND c.actif = 1 
         AND date(c.finalisee_le) = date('now')
       ORDER BY c.finalisee_le DESC`,
      [doctorId]
    );

    // 5. Dernières consultations du médecin (historique récent personnel)
    const dernieres_consultations = await query(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation, 
              c.motif_consultation, c.diagnostic_principal, c.statut, c.finalisee_le,
              v.numero_visite, v.date_arrivee,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       WHERE c.medecin_id = ? AND c.actif = 1
       ORDER BY c.date_consultation DESC LIMIT 10`,
      [doctorId]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'DOCTOR_QUEUE_ACCESSED',
      ressourceType: 'MEDECIN_QUEUE',
      ressourceId: doctorId,
      details: `Consultation de la file d'attente par ${user.nom_complet}. Attente: ${attente.length}, En cours: ${en_cours.length}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      doctor: {
        id: user.id,
        nom_complet: user.nom_complet,
        username: user.username,
        role: user.role
      },
      stats: {
        attente: attente.length,
        en_cours: en_cours.length,
        a_finaliser: a_finaliser.length,
        terminees_jour: terminees_jour.length
      },
      queue: {
        attente,
        en_cours,
        a_finaliser,
        terminees_jour,
        dernieres_consultations
      }
    });
  } catch (error: any) {
    console.error('Erreur récupération file médecin:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de la file médecin' });
  }
}

/**
 * Détails complets d'une visite pour le praticien
 * GET /api/medical/visites/:id
 */
export async function getMedicalVisiteDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    // Charger la visite
    const visite = await queryOne<any>(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.cloturee_le, v.created_at,
              u.nom_complet as medecin_nom
       FROM visites v
       LEFT JOIN users u ON v.medecin_id = u.id
       WHERE v.id = ? AND v.actif = 1`,
      [id]
    );

    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    // Contrôle d'accès : la visite doit être affectée à ce médecin (ou non encore affectée si prise en charge)
    if (visite.medecin_id && visite.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCES_REFUSE_VISITE_AUTRE_MEDECIN',
        ressourceType: 'VISITE',
        ressourceId: id,
        details: `Tentative d'accès à la visite ${visite.numero_visite} affectée à un autre médecin`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Cette visite est affectée à un autre confrère.' });
      return;
    }

    // Charger le patient complet
    const patient = await queryOne<any>(
      `SELECT id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, 
              adresse, contact_urgence_nom, contact_urgence_telephone, groupe_sanguin, 
              allergies, antecedents, created_at
       FROM patients WHERE id = ? AND actif = 1`,
      [visite.patient_id]
    );

    // Calcul de l'âge au moment de la visite
    let patient_age: number | null = null;
    if (patient && patient.date_naissance) {
      const birth = new Date(patient.date_naissance);
      const visitDate = new Date(visite.date_arrivee);
      let age = visitDate.getFullYear() - birth.getFullYear();
      const m = visitDate.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && visitDate.getDate() < birth.getDate())) {
        age--;
      }
      patient_age = age >= 0 ? age : 0;
    }

    // Charger les signes vitaux du triage de cette visite
    const constantes = await queryOne<any>(
      `SELECT sv.*, u.nom_complet as agent_nom
       FROM signes_vitaux sv
       LEFT JOIN users u ON sv.agent_id = u.id
       WHERE sv.visite_id = ?
       ORDER BY sv.date_prise DESC LIMIT 1`,
      [id]
    );

    // Vérifier si une consultation existe déjà pour cette visite
    const existingConsultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE visite_id = ? AND actif = 1`,
      [id]
    );

    res.json({
      visite,
      patient: { ...patient, age: patient_age },
      constantes,
      consultation: existingConsultation || null
    });
  } catch (error: any) {
    console.error('Erreur détail visite médicale:', error);
    res.status(500).json({ error: 'Erreur interne lors du chargement de la visite.' });
  }
}

/**
 * Démarre ou récupère la consultation pour une visite
 * POST /api/medical/consultations
 * Idempotent : empêche la création multiple pour la même visite.
 * Transitionne la visite vers EN_CONSULTATION.
 */
export async function startOrGetConsultation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { visite_id, motif_consultation } = req.body;
    if (!visite_id) {
      res.status(400).json({ error: 'Le paramètre visite_id est obligatoire.' });
      return;
    }

    const visite = await queryOne<any>(
      `SELECT * FROM visites WHERE id = ? AND actif = 1`,
      [visite_id]
    );

    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    // Contrôle d'affectation : la visite ne doit pas appartenir à un autre médecin
    if (visite.medecin_id && visite.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCES_REFUSE_VISITE_AUTRE_MEDECIN',
        ressourceType: 'VISITE',
        ressourceId: visite_id,
        details: `Tentative d'ouverture de consultation sur visite affectée à un autre médecin`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Cette visite est affectée à un autre médecin.' });
      return;
    }

    // 1. Règle absolue anti-doublon : Vérifier si une consultation existe déjà pour cette visite
    const existingConsultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE visite_id = ? AND actif = 1`,
      [visite_id]
    );

    if (existingConsultation) {
      // Si la visite n'était pas encore en statut EN_CONSULTATION, on la met à jour
      if (visite.statut === 'ATTENTE_MEDECIN') {
        await execute(
          `UPDATE visites SET statut = 'EN_CONSULTATION', medecin_id = ? WHERE id = ?`,
          [user.id, visite_id]
        );
      }

      await auditLogger.log({
        userId: user.id,
        action: 'CONSULTATION_OUVERTURE',
        ressourceType: 'CONSULTATION',
        ressourceId: existingConsultation.id,
        details: `Reprise de la consultation existante pour la visite ${visite.numero_visite}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      res.json({
        message: 'Consultation existante récupérée.',
        consultation: existingConsultation,
        is_new: false
      });
      return;
    }

    // 2. Création d'une nouvelle consultation (commence toujours en EN_COURS)
    const consultationId = `csl-${crypto.randomUUID().substring(0, 12)}`;
    const now = new Date().toISOString();
    const initialMotif = motif_consultation?.trim() || visite.motif_venue?.trim() || 'Consultation médicale';

    await transaction(async () => {
      // Mettre à jour la visite en EN_CONSULTATION et affecter ce médecin
      await execute(
        `UPDATE visites SET statut = 'EN_CONSULTATION', medecin_id = ? WHERE id = ?`,
        [user.id, visite_id]
      );

      // Créer la consultation liée à patient_id, visite_id, medecin_id
      await execute(
        `INSERT INTO consultations (
          id, visite_id, patient_id, medecin_id, date_consultation,
          motif_consultation, statut, created_at, updated_at, actif
        ) VALUES (?, ?, ?, ?, ?, ?, 'EN_COURS', ?, ?, 1)`,
        [
          consultationId,
          visite_id,
          visite.patient_id,
          user.id,
          now,
          initialMotif,
          now,
          now
        ]
      );
    });

    const newConsultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ?`,
      [consultationId]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_CREATION',
      ressourceType: 'CONSULTATION',
      ressourceId: consultationId,
      details: `Création de consultation pour la visite ${visite.numero_visite} par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      message: 'Consultation ouverte avec succès.',
      consultation: newConsultation,
      is_new: true
    });
  } catch (error: any) {
    console.error('Erreur démarrage consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de la consultation.' });
  }
}

/**
 * Récupère une consultation spécifique avec ses données associées
 * GET /api/medical/consultations/:id
 * Strictement réservé au rôle MÉDECIN.
 */
export async function getConsultationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const consultation = await queryOne<any>(
      `SELECT c.*, 
              v.numero_visite, v.date_arrivee, v.statut as visite_statut, v.type_visite,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom,
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              p.allergies, p.antecedents, p.groupe_sanguin,
              u.nom_complet as medecin_nom,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2,
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.douleur,
              sv.imc, sv.categorie_imc, sv.pam, sv.date_prise as triage_date_prise,
              u_agent.nom_complet as triage_agent_nom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       INNER JOIN users u ON c.medecin_id = u.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       LEFT JOIN users u_agent ON sv.agent_id = u_agent.id
       WHERE c.id = ? AND c.actif = 1`,
      [id]
    );

    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    // Calcul de l'âge du patient
    let patient_age: number | null = null;
    if (consultation.patient_date_naissance) {
      const birth = new Date(consultation.patient_date_naissance);
      const visitDate = new Date(consultation.date_arrivee || consultation.date_consultation);
      let age = visitDate.getFullYear() - birth.getFullYear();
      const m = visitDate.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && visitDate.getDate() < birth.getDate())) {
        age--;
      }
      patient_age = age >= 0 ? age : 0;
    }

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_LECTURE',
      ressourceType: 'CONSULTATION',
      ressourceId: id,
      details: `Lecture de la consultation ${id} par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      consultation: {
        ...consultation,
        patient_age
      }
    });
  } catch (error: any) {
    console.error('Erreur lecture consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la lecture de la consultation.' });
  }
}

/**
 * Mise à jour de la consultation (Sauvegarde brouillon ou en cours)
 * PATCH /api/medical/consultations/:id
 * Vérifie que le médecin connecté est bien le médecin en charge.
 * Protège contre la modification silencieuse d'une consultation finalisée.
 */
export async function updateConsultation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;
    const existing = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    // Règle d'autorisation stricte : Seul le médecin créateur/assigné peut modifier
    if (existing.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'TENTATIVE_MODIFICATION_NON_AUTORISEE',
        ressourceType: 'CONSULTATION',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de modifier la consultation de Dr. (id: ${existing.medecin_id})`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas modifier la consultation d’un confrère.' });
      return;
    }

    const {
      motif_consultation,
      histoire_maladie,
      examen_physique,
      diagnostic_principal,
      diagnostics_associes,
      conduite_a_tenir,
      notes_confidentielles,
      statut, // 'BROUILLON' ou 'EN_COURS'
      is_amendment,
      amendement_motif
    } = req.body;

    // Protection contre modification silencieuse d'une consultation déjà finalisée
    if (existing.statut === 'FINALISEE') {
      if (!is_amendment || !amendement_motif || typeof amendement_motif !== 'string' || amendement_motif.trim().length < 5) {
        res.status(409).json({
          error: 'Cette consultation est finalisée et verrouillée contre toute modification silencieuse. Un motif explicite d’amendement est requis.'
        });
        return;
      }

      // Tracé d'audit obligatoire pour modification post-finalisation
      await auditLogger.log({
        userId: user.id,
        action: 'CONSULTATION_AMENDEMENT',
        ressourceType: 'CONSULTATION',
        ressourceId: id,
        details: `Amendement après finalisation par Dr. ${user.nom_complet}. Motif: "${amendement_motif.trim()}"`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    // Formatage des diagnostics associés (string ou JSON stringify)
    let diagAssociesString: string | null = null;
    if (diagnostics_associes !== undefined) {
      if (Array.isArray(diagnostics_associes)) {
        diagAssociesString = JSON.stringify(diagnostics_associes);
      } else if (typeof diagnostics_associes === 'string') {
        diagAssociesString = diagnostics_associes;
      }
    } else {
      diagAssociesString = existing.diagnostics_associes;
    }

    const targetStatus = (existing.statut === 'FINALISEE') 
      ? 'FINALISEE' 
      : (statut === 'BROUILLON' ? 'BROUILLON' : 'EN_COURS');

    const now = new Date().toISOString();

    await execute(
      `UPDATE consultations SET 
        motif_consultation = ?,
        histoire_maladie = ?,
        examen_physique = ?,
        diagnostic_principal = ?,
        diagnostics_associes = ?,
        conduite_a_tenir = ?,
        notes_confidentielles = ?,
        statut = ?,
        amendement_motif = COALESCE(?, amendement_motif),
        updated_at = ?
       WHERE id = ?`,
      [
        motif_consultation !== undefined ? motif_consultation : existing.motif_consultation,
        histoire_maladie !== undefined ? histoire_maladie : existing.histoire_maladie,
        examen_physique !== undefined ? examen_physique : existing.examen_physique,
        diagnostic_principal !== undefined ? diagnostic_principal : existing.diagnostic_principal,
        diagAssociesString,
        conduite_a_tenir !== undefined ? conduite_a_tenir : existing.conduite_a_tenir,
        notes_confidentielles !== undefined ? notes_confidentielles : existing.notes_confidentielles,
        targetStatus,
        amendement_motif?.trim() || null,
        now,
        id
      ]
    );

    const updated = await queryOne<any>(`SELECT * FROM consultations WHERE id = ?`, [id]);

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_MODIFICATION',
      ressourceType: 'CONSULTATION',
      ressourceId: id,
      details: `Sauvegarde de consultation (${targetStatus}) par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      message: 'Consultation mise à jour avec succès.',
      consultation: updated
    });
  } catch (error: any) {
    console.error('Erreur mise à jour consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la consultation.' });
  }
}

/**
 * Finalisation de la consultation médicale
 * POST /api/medical/consultations/:id/finalize
 * Contrôle rigoureux côté backend des champs obligatoires.
 * Verrouille la consultation et clôture l'étape médicale de la visite.
 */
export async function finalizeConsultation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;
    const existing = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    if (existing.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'TENTATIVE_FINALISATION_NON_AUTORISEE',
        ressourceType: 'CONSULTATION',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de finaliser la consultation d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas finaliser la consultation d’un confrère.' });
      return;
    }

    if (existing.statut === 'FINALISEE') {
      res.status(400).json({ error: `Cette consultation a déjà été finalisée le ${existing.finalisee_le}.` });
      return;
    }

    // Récupérer les valeurs passées dans la requête ou préexistantes
    const body = req.body || {};
    const motif = (body.motif_consultation !== undefined ? body.motif_consultation : existing.motif_consultation)?.trim();
    const histoire = (body.histoire_maladie !== undefined ? body.histoire_maladie : existing.histoire_maladie)?.trim();
    const examen = (body.examen_physique !== undefined ? body.examen_physique : existing.examen_physique)?.trim();
    const diagnosticPrincipal = (body.diagnostic_principal !== undefined ? body.diagnostic_principal : existing.diagnostic_principal)?.trim();
    const conduite = (body.conduite_a_tenir !== undefined ? body.conduite_a_tenir : existing.conduite_a_tenir)?.trim();
    const notes = body.notes_confidentielles !== undefined ? body.notes_confidentielles : existing.notes_confidentielles;

    // Diagnostics associés
    let diagAssociesString: string | null = null;
    if (body.diagnostics_associes !== undefined) {
      if (Array.isArray(body.diagnostics_associes)) {
        diagAssociesString = JSON.stringify(body.diagnostics_associes);
      } else if (typeof body.diagnostics_associes === 'string') {
        diagAssociesString = body.diagnostics_associes;
      }
    } else {
      diagAssociesString = existing.diagnostics_associes;
    }

    // Contrôles stricts des champs obligatoires pour finalisation V1
    const missingFields: string[] = [];
    if (!motif || motif.length < 2) {
      missingFields.push('Motif de consultation');
    }
    if (!diagnosticPrincipal || diagnosticPrincipal.length < 2) {
      missingFields.push('Diagnostic principal');
    }
    if (!conduite || conduite.length < 2) {
      missingFields.push('Conduite à tenir');
    }
    if ((!histoire || histoire.length < 2) && (!examen || examen.length < 2)) {
      missingFields.push('Histoire de la maladie ou Examen physique (au moins un requis)');
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Impossible de finaliser la consultation : des champs obligatoires sont incomplets.',
        missing_fields: missingFields
      });
      return;
    }

    const now = new Date().toISOString();

    await transaction(async () => {
      // 1. Verrouiller la consultation en FINALISEE
      await execute(
        `UPDATE consultations SET 
          motif_consultation = ?,
          histoire_maladie = ?,
          examen_physique = ?,
          diagnostic_principal = ?,
          diagnostics_associes = ?,
          conduite_a_tenir = ?,
          notes_confidentielles = ?,
          statut = 'FINALISEE',
          finalisee_le = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          motif,
          histoire || null,
          examen || null,
          diagnosticPrincipal,
          diagAssociesString,
          conduite,
          notes || null,
          now,
          now,
          id
        ]
      );

      // 2. Mettre à jour la visite liée (clôture médicale)
      await execute(
        `UPDATE visites SET statut = 'CLOTUREE', cloturee_le = ? WHERE id = ?`,
        [now, existing.visite_id]
      );
    });

    const finalizedConsultation = await queryOne<any>(`SELECT * FROM consultations WHERE id = ?`, [id]);

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_FINALISATION',
      ressourceType: 'CONSULTATION',
      ressourceId: id,
      details: `Finalisation de la consultation par Dr. ${user.nom_complet}. Diagnostic: "${diagnosticPrincipal}"`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      message: 'Consultation finalisée avec succès. Dossier médical verrouillé.',
      consultation: finalizedConsultation
    });
  } catch (error: any) {
    console.error('Erreur finalisation consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la finalisation de la consultation.' });
  }
}

/**
 * Historique médical complet du patient
 * GET /api/medical/patients/:patient_id/history
 * Strictement réservé au rôle MÉDECIN.
 * ADMINISTRATEUR, RÉCEPTION et LABORATOIRE reçoivent un 403 strict.
 * Tri chronologique avec rattachement rigoureux de chaque consultation à sa visite d'origine.
 */
export async function getPatientMedicalHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'MÉDECIN') {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { patient_id } = req.params;

    const patient = await queryOne<any>(
      `SELECT id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, 
              adresse, contact_urgence_nom, contact_urgence_telephone, groupe_sanguin, 
              allergies, antecedents, created_at
       FROM patients WHERE id = ? AND actif = 1`,
      [patient_id]
    );

    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable.' });
      return;
    }

    // Récupérer toutes les consultations historiques de ce patient
    const history = await query(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation,
              c.motif_consultation, c.histoire_maladie, c.examen_physique,
              c.diagnostic_principal, c.diagnostics_associes, c.conduite_a_tenir,
              c.statut, c.finalisee_le, c.created_at,
              v.numero_visite, v.date_arrivee, v.type_visite,
              u.nom_complet as medecin_nom,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.imc, sv.pam
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN users u ON c.medecin_id = u.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       WHERE c.patient_id = ? AND c.actif = 1
       ORDER BY c.date_consultation DESC`,
      [patient_id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_HISTORIQUE_CONSULTE',
      ressourceType: 'DOSSIER_PATIENT',
      ressourceId: patient_id,
      details: `Consultation de l'historique médical (${history.length} consultations) par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      patient,
      history
    });
  } catch (error: any) {
    console.error('Erreur historique médical patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de l’historique médical.' });
  }
}
