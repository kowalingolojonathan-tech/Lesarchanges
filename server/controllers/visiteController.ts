import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { validateAndComputeVitals, VitalsInput } from '../utils/vitalsCalculator.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    nom_complet: string;
  };
}

/**
 * Génère un identifiant unique de visite au format VIS-YYYYMMDD-XXXX
 */
async function generateUniqueNumeroVisite(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `VIS-${year}${month}${day}-`;

  const lastVisite = await queryOne<{ numero_visite: string }>(
    `SELECT numero_visite FROM visites WHERE numero_visite LIKE ? ORDER BY numero_visite DESC LIMIT 1`,
    [`${datePrefix}%`]
  );

  let nextSequence = 1;
  if (lastVisite && lastVisite.numero_visite) {
    const parts = lastVisite.numero_visite.split('-');
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  return `${datePrefix}${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Récupère la liste des visites avec filtres
 * GET /api/visites
 */
export async function getVisites(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { statut, date, patient_id, medecin_id } = req.query;

    let sql = `
      SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
             v.motif_venue, v.type_visite, v.cloturee_le, v.created_at,
             p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
             p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
             u.nom_complet as medecin_nom,
             sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2, 
             sv.frequence_respiratoire, sv.poids, sv.taille, sv.imc, sv.categorie_imc, sv.pam, sv.douleur
      FROM visites v
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.medecin_id = u.id
      LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
      WHERE v.actif = 1
    `;
    const params: (string | number)[] = [];

    if (statut && typeof statut === 'string') {
      sql += ` AND v.statut = ?`;
      params.push(statut);
    }

    if (date && typeof date === 'string') {
      sql += ` AND date(v.date_arrivee) = date(?)`;
      params.push(date);
    }

    if (patient_id && typeof patient_id === 'string') {
      sql += ` AND v.patient_id = ?`;
      params.push(patient_id);
    }

    if (medecin_id && typeof medecin_id === 'string') {
      sql += ` AND v.medecin_id = ?`;
      params.push(medecin_id);
    }

    sql += ` ORDER BY v.date_arrivee DESC`;

    const visites = await query(sql, params);
    res.json({ visites });
  } catch (error: any) {
    console.error('Erreur liste visites:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des visites' });
  }
}

/**
 * Récupère le détail d'une visite avec patient et signes vitaux
 * GET /api/visites/:id
 * SÉCURITÉ : Pas d'accès aux notes confidentielles pour la réception.
 */
export async function getVisiteById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const visite = await queryOne(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.cloturee_le, v.created_at,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, 
              p.telephone as patient_telephone, p.allergies, p.antecedents, p.groupe_sanguin,
              u.nom_complet as medecin_nom
       FROM visites v
       INNER JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.medecin_id = u.id
       WHERE v.id = ? AND v.actif = 1`,
      [id]
    );

    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable' });
      return;
    }

    const signesVitaux = await queryOne(
      `SELECT sv.*, u.nom_complet as agent_nom 
       FROM signes_vitaux sv
       LEFT JOIN users u ON sv.agent_id = u.id
       WHERE sv.visite_id = ? 
       ORDER BY sv.date_prise DESC LIMIT 1`,
      [id]
    );

    res.json({ visite, signesVitaux });
  } catch (error: any) {
    console.error('Erreur récupération visite:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de la visite' });
  }
}

/**
 * Création d'une nouvelle visite pour un patient existant
 * POST /api/visites
 * RÈGLE ABSOLUE : PATIENT ≠ VISITE ≠ CONSULTATION
 * Un patient existant conserve son dossier permanent et reçoit un nouvel épisode de soin (visite).
 * Aucune consultation n'est créée dans cette phase.
 */
export async function createVisite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { patient_id, motif_venue, type_visite } = req.body;

    if (!patient_id) {
      res.status(400).json({ error: 'L\'identifiant du patient (patient_id) est obligatoire.' });
      return;
    }

    const patient = await queryOne('SELECT id, numero_dossier, nom, prenom FROM patients WHERE id = ? AND actif = 1', [patient_id]);
    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable ou inactif.' });
      return;
    }

    const validTypes = ['STANDARD', 'URGENCE', 'CONTROLE'];
    const chosenType = type_visite && validTypes.includes(type_visite) ? type_visite : 'STANDARD';

    const visiteId = 'vis_' + crypto.randomUUID();
    const numeroVisite = await generateUniqueNumeroVisite();
    const nowIso = new Date().toISOString();

    // Statut initial obligatoire : ATTENTE_TRIAGE
    const statutInitial = 'ATTENTE_TRIAGE';

    await execute(
      `INSERT INTO visites (
        id, numero_visite, patient_id, date_arrivee, statut, motif_venue, type_visite, actif, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        visiteId,
        numeroVisite,
        patient_id,
        nowIso,
        statutInitial,
        motif_venue ? motif_venue.trim() : 'Accueil et consultation générale',
        chosenType,
        nowIso,
      ]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'CREATE_VISITE',
      ressourceType: 'VISITE',
      ressourceId: visiteId,
      details: JSON.stringify({
        numero_visite: numeroVisite,
        numero_dossier: patient.numero_dossier,
        patient_nom: `${patient.nom} ${patient.prenom}`,
        type_visite: chosenType,
        statut: statutInitial,
      }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const createdVisite = await queryOne(
      `SELECT v.*, p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom 
       FROM visites v 
       JOIN patients p ON v.patient_id = p.id 
       WHERE v.id = ?`,
      [visiteId]
    );

    res.status(201).json({ visite: createdVisite });
  } catch (error: any) {
    console.error('Erreur création visite:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de la visite' });
  }
}

/**
 * Enregistrement des signes vitaux et calculs physiologiques automatiques
 * POST /api/visites/:id/vitals
 * Transitions : ATTENTE_TRIAGE -> TRIAGE_TERMINE
 */
export async function recordVitals(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const vitalsData: VitalsInput = req.body;

    const visite = await queryOne(
      `SELECT v.id, v.patient_id, v.statut, p.date_naissance, p.numero_dossier 
       FROM visites v 
       JOIN patients p ON v.patient_id = p.id 
       WHERE v.id = ? AND v.actif = 1`,
      [id]
    );

    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    // Validation physiologique rigoureuse côté serveur & calculs automatiques
    const validation = validateAndComputeVitals(vitalsData, visite.date_naissance);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'INVALID_VITALS',
        message: 'Constantes physiologiques rejetées en raison d\'incohérences de mesure.',
        details: validation.errors,
      });
      return;
    }

    const { calculated } = validation;
    const vitalsId = 'sv_' + crypto.randomUUID();
    const agentId = req.user?.id || 'system';
    const nowIso = new Date().toISOString();

    const tailleFinale = calculated.taille_normalisee_cm ?? vitalsData.taille ?? null;

    await transaction(async () => {
      // 1. Enregistrement des constantes et des valeurs calculées historiques
      await execute(
        `INSERT INTO signes_vitaux (
          id, visite_id, patient_id, agent_id, temperature, tension_systolique, tension_diastolique,
          pouls, frequence_respiratoire, spo2, poids, taille, glycemie_mesuree, douleur,
          age_calcule, imc, categorie_imc, pam, date_prise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vitalsId,
          id,
          visite.patient_id,
          agentId,
          vitalsData.temperature ?? null,
          vitalsData.tension_systolique ?? null,
          vitalsData.tension_diastolique ?? null,
          vitalsData.pouls ?? null,
          vitalsData.frequence_respiratoire ?? null,
          vitalsData.spo2 ?? null,
          vitalsData.poids ?? null,
          tailleFinale,
          vitalsData.glycemie_mesuree ?? null,
          vitalsData.douleur ?? null,
          calculated.age_calcule ?? null,
          calculated.imc ?? null,
          calculated.categorie_imc ?? null,
          calculated.pam ?? null,
          nowIso,
        ]
      );

      // 2. Transition de statut : ATTENTE_TRIAGE -> TRIAGE_TERMINE
      await execute(
        `UPDATE visites SET statut = 'TRIAGE_TERMINE' WHERE id = ?`,
        [id]
      );
    });

    await auditLogger.log({
      userId: agentId,
      action: 'RECORD_VITALS',
      ressourceType: 'SIGNES_VITAUX',
      ressourceId: vitalsId,
      details: JSON.stringify({
        visite_id: id,
        patient_dossier: visite.numero_dossier,
        imc: calculated.imc,
        categorie_imc: calculated.categorie_imc,
        pam: calculated.pam,
      }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const recordedVitals = await queryOne('SELECT * FROM signes_vitaux WHERE id = ?', [vitalsId]);
    const updatedVisite = await queryOne('SELECT * FROM visites WHERE id = ?', [id]);

    res.status(201).json({
      signesVitaux: recordedVitals,
      visite: updatedVisite,
      message: 'Signes vitaux enregistrés avec succès. Triage terminé.',
    });
  } catch (error: any) {
    console.error('Erreur enregistrement signes vitaux:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'enregistrement des signes vitaux' });
  }
}

/**
 * Choix et affectation du médecin prenant en charge la visite
 * PATCH /api/visites/:id/assign-doctor
 * Transition : TRIAGE_TERMINE -> ATTENTE_MEDECIN
 */
export async function assignDoctor(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { medecin_id } = req.body;

    if (!medecin_id) {
      res.status(400).json({ error: 'L\'identifiant du médecin (medecin_id) est obligatoire.' });
      return;
    }

    // Vérification de l'existence et du rôle du praticien
    const medecin = await queryOne(
      `SELECT id, nom_complet, role, actif FROM users WHERE id = ? AND actif = 1`,
      [medecin_id]
    );

    if (!medecin) {
      res.status(404).json({ error: 'Praticien introuvable ou compte inactif.' });
      return;
    }

    if (medecin.role !== 'MÉDECIN') {
      res.status(400).json({ error: 'L\'utilisateur sélectionné ne possède pas le rôle MÉDECIN.' });
      return;
    }

    const visite = await queryOne('SELECT id, numero_visite, statut FROM visites WHERE id = ? AND actif = 1', [id]);
    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    // Affectation du médecin et passage en ATTENTE_MEDECIN
    await execute(
      `UPDATE visites SET medecin_id = ?, statut = 'ATTENTE_MEDECIN' WHERE id = ?`,
      [medecin_id, id]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'ASSIGN_DOCTOR',
      ressourceType: 'VISITE',
      ressourceId: id,
      details: JSON.stringify({
        numero_visite: visite.numero_visite,
        medecin_id: medecin.id,
        medecin_nom: medecin.nom_complet,
        nouveau_statut: 'ATTENTE_MEDECIN',
      }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const updatedVisite = await queryOne(
      `SELECT v.*, u.nom_complet as medecin_nom 
       FROM visites v 
       LEFT JOIN users u ON v.medecin_id = u.id 
       WHERE v.id = ?`,
      [id]
    );

    res.json({
      visite: updatedVisite,
      message: `Visite affectée au Dr. ${medecin.nom_complet}. Patient placé en attente de consultation.`,
    });
  } catch (error: any) {
    console.error('Erreur affectation médecin:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'affectation du médecin' });
  }
}

/**
 * Mise à jour de statut de visite (Machine d'état)
 * PATCH /api/visites/:id/status
 */
export async function updateVisiteStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const allowedStatuses = [
      'ATTENTE_TRIAGE',
      'TRIAGE_TERMINE',
      'ATTENTE_PAIEMENT_CONSULTATION',
      'ATTENTE_MEDECIN',
      'EN_CONSULTATION',
      'ATTENTE_EXAMENS',
      'ATTENTE_SPECIALISTE',
      'CLOTUREE',
      'ANNULEE',
    ];

    if (!statut || !allowedStatuses.includes(statut)) {
      res.status(400).json({ error: `Statut invalide. Statuts permis : ${allowedStatuses.join(', ')}` });
      return;
    }

    const visite = await queryOne('SELECT id, numero_visite, statut FROM visites WHERE id = ? AND actif = 1', [id]);
    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    await execute('UPDATE visites SET statut = ? WHERE id = ?', [statut, id]);

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'UPDATE_VISITE_STATUS',
      ressourceType: 'VISITE',
      ressourceId: id,
      details: JSON.stringify({
        ancien_statut: visite.statut,
        nouveau_statut: statut,
      }),
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    });

    const updated = await queryOne('SELECT * FROM visites WHERE id = ?', [id]);
    res.json({ visite: updated });
  } catch (error: any) {
    console.error('Erreur statut visite:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du statut' });
  }
}

/**
 * Liste des médecins actifs disponibles pour affectation
 * GET /api/doctors
 */
export async function getActiveDoctors(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const doctors = await query(
      `SELECT id, username, nom_complet, role FROM users WHERE role = 'MÉDECIN' AND actif = 1 ORDER BY nom_complet ASC`
    );
    res.json({ doctors });
  } catch (error: any) {
    console.error('Erreur liste médecins:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des médecins' });
  }
}

/**
 * Statistiques du tableau de bord de la Réception pour la journée
 * GET /api/visites/dashboard-stats
 */
export async function getReceptionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Visites du jour
    const visitesToday = await query(
      `SELECT statut, count(*) as count FROM visites WHERE date(date_arrivee) = date(?) AND actif = 1 GROUP BY statut`,
      [today]
    );

    const counts: Record<string, number> = {
      total_jour: 0,
      attente_triage: 0,
      triage_termine: 0,
      attente_medecin: 0,
    };

    visitesToday.forEach((v: any) => {
      counts.total_jour += Number(v.count);
      if (v.statut === 'ATTENTE_TRIAGE') counts.attente_triage = Number(v.count);
      if (v.statut === 'TRIAGE_TERMINE') counts.triage_termine = Number(v.count);
      if (v.statut === 'ATTENTE_MEDECIN') counts.attente_medecin = Number(v.count);
    });

    // Nouveaux patients créés aujourd'hui
    const newPatients = await queryOne<{ count: number }>(
      `SELECT count(*) as count FROM patients WHERE date(created_at) = date(?) AND actif = 1`,
      [today]
    );

    // Total patients enregistrés dans la clinique
    const totalPatients = await queryOne<{ count: number }>(
      `SELECT count(*) as count FROM patients WHERE actif = 1`
    );

    res.json({
      stats: {
        total_visites_jour: counts.total_jour,
        attente_triage: counts.attente_triage,
        triage_termine: counts.triage_termine,
        attente_medecin: counts.attente_medecin,
        nouveaux_patients_jour: Number(newPatients?.count || 0),
        total_patients_clinique: Number(totalPatients?.count || 0),
      },
    });
  } catch (error: any) {
    console.error('Erreur stats réception:', error);
    res.status(500).json({ error: 'Erreur interne lors du calcul des statistiques de réception' });
  }
}
