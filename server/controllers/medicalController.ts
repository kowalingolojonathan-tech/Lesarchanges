import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { AuthenticatedRequest, isDoctorRole } from '../middleware/auth.js';
import { createLinkedFactureCore } from './billingController.js';
import { saveDb } from '../db/database.js';

/**
 * Récupère le tableau de bord et la file d'attente du médecin connecté
 * GET /api/medical/queue
 * Strictement réservé au rôle MÉDECIN.
 * Filtre hermétiquement : Dr A ne voit que ses visites et consultations.
 */
export async function getDoctorQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const doctorId = user.id;

    // 1. Patients en attente du médecin (visites avec statut ATTENTE_MEDECIN affectées à ce médecin)
    const attente = await query(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.consultation_origine_id, v.elements_a_interpreter, v.created_at,
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2, 
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.imc, 
              sv.categorie_imc, sv.pam, sv.surface_corporelle, sv.pression_pulsee, sv.alertes_constantes, sv.douleur, sv.date_prise as triage_date_prise,
              u_agent.nom_complet as triage_agent_nom,
              COALESCE(fp.statut_paiement, 'NON PAYÉ') as statut_paiement
       FROM visites v
       INNER JOIN patients p ON v.patient_id = p.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       LEFT JOIN users u_agent ON sv.agent_id = u_agent.id
       LEFT JOIN (
         SELECT visite_id,
           CASE 
             WHEN count(CASE WHEN statut NOT IN ('PAYÉ', 'PAYEE') THEN 1 END) = 0 AND count(*) > 0 THEN 'PAYÉ'
             WHEN count(CASE WHEN statut IN ('PAYÉ', 'PAYEE', 'PARTIELLEMENT PAYÉ', 'PARTIELLEMENT_PAYEE') THEN 1 END) > 0 THEN 'PARTIELLEMENT PAYÉ'
             ELSE 'NON PAYÉ'
           END as statut_paiement
         FROM factures
         GROUP BY visite_id
       ) fp ON fp.visite_id = v.id
       WHERE v.medecin_id = ? AND v.statut = 'ATTENTE_MEDECIN' AND v.actif = 1
       ORDER BY CASE WHEN v.type_visite = 'URGENCE' THEN 0 WHEN v.type_visite = 'INTERPRETATION_RESULTATS' THEN 1 ELSE 2 END, v.date_arrivee ASC`,
      [doctorId]
    );

    // 2. Consultations en cours pour ce médecin (visite en cours ou consultation active non finalisée)
    const en_cours = await query(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation, 
              c.motif_consultation, c.diagnostic_principal, c.statut, c.created_at, c.updated_at,
              v.numero_visite, v.date_arrivee, v.type_visite,
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2,
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.douleur,
              sv.imc, sv.categorie_imc, sv.pam, sv.surface_corporelle, sv.pression_pulsee, sv.alertes_constantes,
              sv.date_prise as triage_date_prise,
              u_agent.nom_complet as triage_agent_nom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       LEFT JOIN users u_agent ON sv.agent_id = u_agent.id
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
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
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
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       WHERE c.medecin_id = ? AND c.actif = 1
       ORDER BY c.date_consultation DESC LIMIT 10`,
      [doctorId]
    );

    // 6. Compteurs et listes détaillés pour les accès rapides Médecin
    // 6a. Patients reçus aujourd'hui (visites du jour avec statut EN_CONSULTATION ou CLOTUREE)
    const patientsReçusAujourdhui = await query<any>(
      `SELECT v.id, v.numero_visite, v.patient_id, v.date_arrivee, v.statut,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom,
              p.sexe as patient_sexe
       FROM visites v
       INNER JOIN patients p ON v.patient_id = p.id
       WHERE v.medecin_id = ? AND date(v.date_arrivee) = date('now')
         AND v.statut IN ('EN_CONSULTATION', 'CLOTUREE') AND v.actif = 1
       ORDER BY v.date_arrivee DESC`,
      [doctorId]
    );
    const patientsReçusJourCount = patientsReçusAujourdhui.length;

    // 6b. Rendez-vous du jour non honorés (patient n'est pas encore arrivé chez le médecin)
    const rdvAujourdhui = await query<any>(
      `SELECT r.id, r.numero_rdv, r.date_rdv, r.heure_rdv, r.statut, r.motif, r.visite_id,
              COALESCE(p.nom, r.patient_nom_temp) as patient_nom,
              COALESCE(p.prenom, r.patient_prenom_temp) as patient_prenom,
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       WHERE r.medecin_id = ? AND r.date_rdv = date('now')
         AND r.statut NOT IN ('PATIENT PRÉSENT', 'HONORÉ', 'ABSENT', 'ANNULÉ') AND r.actif = 1
       ORDER BY r.heure_rdv ASC`,
      [doctorId]
    );
    const rdvEnAttenteCount = rdvAujourdhui.length;

    // 6b2. Rendez-vous planifiés futurs (date > aujourd'hui, non annulés)
    const rdvPlanifiesFuturs = await query<any>(
      `SELECT r.id, r.numero_rdv, r.date_rdv, r.heure_rdv, r.statut, r.motif, r.type_rdv, r.visite_id, r.medecin_id,
              COALESCE(p.nom, r.patient_nom_temp) as patient_nom,
              COALESCE(p.prenom, r.patient_prenom_temp) as patient_prenom,
              COALESCE(p.numero_dossier, 'SANS DOSSIER') as numero_dossier
       FROM rendez_vous r
       LEFT JOIN patients p ON r.patient_id = p.id
       WHERE r.medecin_id = ? AND r.date_rdv > date('now')
         AND r.statut NOT IN ('HONORÉ', 'ABSENT', 'ANNULÉ') AND r.actif = 1
       ORDER BY r.date_rdv ASC, r.heure_rdv ASC`,
      [doctorId]
    );
    const rdvPlanifiesCount = rdvPlanifiesFuturs.length;

    // 6c. Consultations en attente de prise en charge (même logique que la file attente)
    const consultationsEnAttente = attente;

    // 6d. Ordonnances non remises (VALIDEE ou IMPRIMEE, pas REMISE) — sans filtre date
    const ordonnancesAujourdhui = await query<any>(
      `SELECT p.id, p.statut, p.date_prescription, p.imprimee_le, p.remise_le,
              p.observations, c.id as consultation_id,
              pat.numero_dossier, pat.nom as patient_nom, pat.prenom as patient_prenom,
              v.numero_visite, c.motif_consultation,
              pi.nom_medicament, pi.dosage
       FROM prescriptions p
       JOIN consultations c ON p.consultation_id = c.id
       JOIN patients pat ON p.patient_id = pat.id
       LEFT JOIN visites v ON p.visite_id = v.id
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
       WHERE c.medecin_id = ? AND p.statut IN ('VALIDEE', 'IMPRIMEE')
       ORDER BY p.created_at DESC`,
      [doctorId]
    );
    // Grouper par prescription
    const ordonnancesByPresc = new Map<string, any>();
    for (const row of ordonnancesAujourdhui) {
      if (!ordonnancesByPresc.has(row.id)) {
        ordonnancesByPresc.set(row.id, {
          ...row,
          items: []
        });
      }
      if (row.nom_medicament) {
        ordonnancesByPresc.get(row.id).items.push({
          nom_medicament: row.nom_medicament,
          dosage: row.dosage
        });
      }
    }
    const ordonnancesList = Array.from(ordonnancesByPresc.values());
    const ordonnancesCount = ordonnancesList.length;

    // 6e. Résultats Labo non lus — tout resultat valide non lu, sans filtre date
    const labResultsNonLus = await query<any>(
      `SELECT n.id, n.titre, n.message, n.created_at, n.patient_id, n.consultation_id, n.lab_order_id,
              pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier,
              d.numero_demande
       FROM notifications n
       LEFT JOIN patients pat ON n.patient_id = pat.id
       LEFT JOIN demandes_laboratoire d ON n.lab_order_id = d.id
       WHERE n.user_id = ? AND n.type = 'LAB_RESULTS_READY' AND n.lu = 0
       ORDER BY n.created_at DESC`,
      [doctorId]
    );
    const labResultsCount = labResultsNonLus.length;

// 6f. Bulletins labo disponibles (statut validé ET non encore vus par le médecin)
    const bulletinsDispo = await query<any>(
      `SELECT d.id, d.numero_demande, d.statut, d.date_demande, d.conclusion_globale,
              d.vu_par_medecin_le,
              d.consultation_id, d.patient_id, d.visite_id,
              pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier
       FROM demandes_laboratoire d
       INNER JOIN patients pat ON d.patient_id = pat.id
       WHERE d.medecin_id = ? AND d.statut IN ('RESULTATS_VALIDES', 'RESULTAT_VALIDE')
         AND d.vu_par_medecin_le IS NULL
       ORDER BY d.updated_at DESC`,
      [doctorId]
    );

    // 6g. Demandes Labo non traitées
    const demandesLaboNonTraitees = await query<any>(
      `SELECT d.id, d.numero_demande, d.statut, d.date_demande, d.urgence, d.indication_clinique,
              pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite, c.motif_consultation
       FROM demandes_laboratoire d
       INNER JOIN patients pat ON d.patient_id = pat.id
       LEFT JOIN visites v ON d.visite_id = v.id
       LEFT JOIN consultations c ON d.consultation_id = c.id
       WHERE d.medecin_id = ?
          AND d.statut IN ('DEMANDE_CREEE', 'PRISE_EN_CHARGE', 'EN_ATTENTE_PRELEVEMENT',
                           'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME',
                           'EN_ANALYSE', 'RESULTATS_A_SAISIR', 'RESULTATS_SAISIS',
                           'RESULTAT_A_VALIDER')
        ORDER BY d.created_at DESC`,
      [doctorId]
    );
    const demandesLaboCount = demandesLaboNonTraitees.length;

    // 6h. Arrivées du jour
    const arriveesJour = await queryOne<any>(
      `SELECT COUNT(*) as count FROM visites v
        WHERE v.medecin_id = ? AND date(v.date_arrivee) = date('now') AND v.actif = 1`,
      [doctorId]
    );

    // 6i. Orientations en attente pour le médecin connecté
    const orientationsEnAttente = await query<any>(
      `SELECT o.id, o.type_orientation, o.specialite, o.etablissement_destinataire,
              o.praticien_destinataire, o.medecin_destinataire_id, o.motif_orientation,
              o.niveau_urgence, o.date_orientation, o.statut, o.visite_retour_id,
              o.patient_id, o.consultation_id, o.visite_id,
              p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier,
              u.nom_complet as destinataire_nom
       FROM orientations_specialistes o
       INNER JOIN patients p ON o.patient_id = p.id
       LEFT JOIN users u ON o.medecin_destinataire_id = u.id
       WHERE o.medecin_destinataire_id = ? AND o.statut = 'ENVOYE' 
       ORDER BY o.date_orientation DESC`,
      [doctorId]
    );
    const orientationsEnAttenteCount = orientationsEnAttente.length;

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
      quickAccess: {
        patients: patientsReçusJourCount,
        rdv: rdvEnAttenteCount,
        rdvPlanifies: rdvPlanifiesCount,
        ordonnances: ordonnancesCount,
        labResults: labResultsCount,
        bulletins: bulletinsDispo.length,
        arriveesJour: arriveesJour ? Number(arriveesJour.count) : 0,
        demandesLabo: demandesLaboCount,
        orientations: orientationsEnAttenteCount
      },
      quickAccessLists: {
        patientsReçusAujourdhui: patientsReçusAujourdhui,
        rdvAujourdhui,
        rdvPlanifiesFuturs,
        ordonnancesList,
        labResultsNonLus,
        bulletinsDispo,
        demandesLaboNonTraitees,
        orientationsEnAttente
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
/**
 * Charge le contexte de la consultation précédente et les résultats de laboratoire
 * pour les visites de type INTERPRÉTATION DES RÉSULTATS
 */
async function buildInterpretationContext(visite: any, patientId: string) {
  if (visite.type_visite !== 'INTERPRETATION_RESULTATS' && !visite.consultation_origine_id) {
    return null;
  }

  let previousConsultation: any = null;
  if (visite.consultation_origine_id) {
    previousConsultation = await queryOne<any>(
      `SELECT c.*, u.nom_complet as medecin_nom, v.numero_visite as origin_numero_visite, v.date_arrivee as origin_date_arrivee
       FROM consultations c
       JOIN users u ON c.medecin_id = u.id
       JOIN visites v ON c.visite_id = v.id
       WHERE c.id = ?`,
      [visite.consultation_origine_id]
    );
  } else {
    previousConsultation = await queryOne<any>(
      `SELECT c.*, u.nom_complet as medecin_nom, v.numero_visite as origin_numero_visite, v.date_arrivee as origin_date_arrivee
       FROM consultations c
       JOIN users u ON c.medecin_id = u.id
       JOIN visites v ON c.visite_id = v.id
       WHERE c.patient_id = ?
       ORDER BY c.date_consultation DESC LIMIT 1`,
      [patientId]
    );
  }

  const originId = previousConsultation ? previousConsultation.id : null;
  let originLabOrders: any[] = [];
  if (originId) {
    const rawOrders = await query<any>(
      `SELECT d.*, u.nom_complet as medecin_nom,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       WHERE d.consultation_id = ?
       ORDER BY d.created_at DESC`,
      [originId]
    );
    originLabOrders = await Promise.all(
      rawOrders.map(async (d: any) => {
        const analyses = await query<any>(
          `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
          [d.id]
        );
        return { ...d, analyses };
      })
    );
  }

  let parsedElements: any[] = [];
  if (visite.elements_a_interpreter) {
    try {
      parsedElements = JSON.parse(visite.elements_a_interpreter);
    } catch {
      parsedElements = [visite.elements_a_interpreter];
    }
  }

  return {
    consultation_origine: previousConsultation,
    lab_orders: originLabOrders,
    elements_selectionnes: parsedElements
  };
}

export async function getMedicalVisiteDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    // Charger la visite
    const visite = await queryOne<any>(
      `SELECT v.id, v.numero_visite, v.patient_id, v.medecin_id, v.date_arrivee, v.statut, 
              v.motif_venue, v.type_visite, v.consultation_origine_id, v.elements_a_interpreter,
              v.cloturee_le, v.created_at,
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

    // Contexte d'interprétation si visite de type INTERPRETATION_RESULTATS
    const interpretation_context = await buildInterpretationContext(visite, visite.patient_id);

    res.json({
      visite,
      patient: { ...patient, age: patient_age },
      constantes,
      consultation: existingConsultation || null,
      interpretation_context
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
    if (!user || !isDoctorRole(user)) {
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
        const now = new Date().toISOString();
        await execute(
          `UPDATE visites SET statut = 'EN_CONSULTATION', medecin_id = ?, heure_prise_en_charge = COALESCE(heure_prise_en_charge, ?), heure_debut_consultation = COALESCE(heure_debut_consultation, ?) WHERE id = ?`,
          [user.id, now, now, visite_id]
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
        `UPDATE visites SET statut = 'EN_CONSULTATION', medecin_id = ?, heure_prise_en_charge = COALESCE(heure_prise_en_charge, ?), heure_debut_consultation = COALESCE(heure_debut_consultation, ?) WHERE id = ?`,
        [user.id, now, now, visite_id]
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
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const consultation = await queryOne<any>(
      `SELECT c.*, 
              v.numero_visite, v.date_arrivee, v.statut as visite_statut, v.type_visite,
              v.consultation_origine_id, v.elements_a_interpreter,
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom,
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
              p.allergies, p.antecedents, p.groupe_sanguin,
              u.nom_complet as medecin_nom,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2,
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.douleur,
              sv.imc, sv.categorie_imc, sv.pam, sv.surface_corporelle, sv.pression_pulsee, sv.alertes_constantes,
              sv.date_prise as triage_date_prise,
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

    // Récupération des prescriptions thérapeutiques associées
    const prescriptions = await query<any>(
      `SELECT p.*, u.nom_complet as medecin_nom
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       WHERE p.consultation_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    const enrichedPrescriptions = await Promise.all(
      prescriptions.map(async (p) => {
        const items = await query<any>(
          `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
          [p.id]
        );
        return {
          ...p,
          items
        };
      })
    );

    // Récupération des demandes d'analyses de laboratoire associées (Phase 2C-2)
    const labOrders = await query<any>(
      `SELECT d.*, u.nom_complet as medecin_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       WHERE d.consultation_id = ?
       ORDER BY d.created_at DESC`,
      [id]
    );

    const enrichedLabOrders = await Promise.all(
      labOrders.map(async (d) => {
        const analyses = await query<any>(
          `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
          [d.id]
        );
        return {
          ...d,
          analyses
        };
      })
    );

    await auditLogger.log({
      userId: user.id,
      action: 'CONSULTATION_LECTURE',
      ressourceType: 'CONSULTATION',
      ressourceId: id,
      details: `Lecture de la consultation ${id} par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const interpretation_context = await buildInterpretationContext(consultation, consultation.patient_id);

    res.json({
      consultation: {
        ...consultation,
        patient_age,
        prescriptions: enrichedPrescriptions,
        lab_orders: enrichedLabOrders,
        interpretation_context
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
    if (!user || !isDoctorRole(user)) {
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
      hypotheses_diagnostiques,
      diagnostics_retenus,
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

    // Hypothèses diagnostiques
    let hypothesesString: string | null = null;
    if (hypotheses_diagnostiques !== undefined) {
      if (Array.isArray(hypotheses_diagnostiques)) {
        hypothesesString = JSON.stringify(hypotheses_diagnostiques);
      } else if (typeof hypotheses_diagnostiques === 'string') {
        hypothesesString = hypotheses_diagnostiques;
      }
    } else {
      hypothesesString = existing.hypotheses_diagnostiques;
    }

    // Diagnostics retenus
    let diagRetenusString: string | null = null;
    if (diagnostics_retenus !== undefined) {
      if (Array.isArray(diagnostics_retenus)) {
        diagRetenusString = JSON.stringify(diagnostics_retenus);
      } else if (typeof diagnostics_retenus === 'string') {
        diagRetenusString = diagnostics_retenus;
      }
    } else {
      diagRetenusString = existing.diagnostics_retenus;
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
        hypotheses_diagnostiques = ?,
        diagnostics_retenus = ?,
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
        hypothesesString,
        diagRetenusString,
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
    if (!user || !isDoctorRole(user)) {
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

    // Hypothèses diagnostiques
    let hypothesesString: string | null = null;
    if (body.hypotheses_diagnostiques !== undefined) {
      if (Array.isArray(body.hypotheses_diagnostiques)) {
        hypothesesString = JSON.stringify(body.hypotheses_diagnostiques);
      } else if (typeof body.hypotheses_diagnostiques === 'string') {
        hypothesesString = body.hypotheses_diagnostiques;
      }
    } else {
      hypothesesString = existing.hypotheses_diagnostiques;
    }

    // Diagnostics retenus
    let diagRetenusString: string | null = null;
    if (body.diagnostics_retenus !== undefined) {
      if (Array.isArray(body.diagnostics_retenus)) {
        diagRetenusString = JSON.stringify(body.diagnostics_retenus);
      } else if (typeof body.diagnostics_retenus === 'string') {
        diagRetenusString = body.diagnostics_retenus;
      }
    } else {
      diagRetenusString = existing.diagnostics_retenus;
    }

    // Diagnostic principal retenu effectif
    let effectiveDiagnosticPrincipal = diagnosticPrincipal;
    if ((!effectiveDiagnosticPrincipal || effectiveDiagnosticPrincipal.length < 2) && diagRetenusString) {
      try {
        const parsed = JSON.parse(diagRetenusString);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const p = parsed.find((item: any) => item.is_principal) || parsed[0];
          effectiveDiagnosticPrincipal = (p.libelle || '').trim();
        }
      } catch {}
    }

    // Contrôles stricts des champs obligatoires pour finalisation V1
    const missingFields: string[] = [];
    if (!motif || motif.length < 2) {
      missingFields.push('Motif de consultation');
    }
    // 4. FINALISATION CONSULTATION : Une consultation peut être finalisée même sans diagnostic retenu, 
    // dès lors que les hypothèses diagnostiques renseignées sont correctement indiquées comme retenues ou non retenues.
    let hasDiagnosticValid = false;
    if (effectiveDiagnosticPrincipal && effectiveDiagnosticPrincipal.length >= 2) {
      hasDiagnosticValid = true;
    } else if (hypothesesString) {
      try {
        const parsedHypo = typeof hypothesesString === 'string' ? JSON.parse(hypothesesString) : hypothesesString;
        if (Array.isArray(parsedHypo) && parsedHypo.length > 0) {
          const allHaveStatus = parsedHypo.every((h: any) => h.libelle && h.libelle.trim().length >= 2);
          if (allHaveStatus) {
            hasDiagnosticValid = true;
          }
        }
      } catch {}
    }

    if (!hasDiagnosticValid) {
      missingFields.push('Diagnostic (au moins un diagnostic retenu ou des hypothèses diagnostiques qualifiées requis)');
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
          hypotheses_diagnostiques = ?,
          diagnostics_retenus = ?,
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
          effectiveDiagnosticPrincipal,
          diagAssociesString,
          hypothesesString,
          diagRetenusString,
          conduite,
          notes || null,
          now,
          now,
          id
        ]
      );

      // 2. Mettre à jour la visite liée (clôture médicale)
      await execute(
        `UPDATE visites SET statut = 'CLOTUREE', cloturee_le = ?, heure_fin_consultation = COALESCE(heure_fin_consultation, ?) WHERE id = ?`,
        [now, now, existing.visite_id]
      );

      // 3. Marquer l'orientation interne comme traitée si elle existe
      await execute(
        `UPDATE orientations_specialistes 
         SET statut = 'INTEGRE_DOSSIER_CLOTURE', updated_at = ? 
         WHERE medecin_destinataire_id = ? 
           AND patient_id = ? 
           AND statut = 'ENVOYE' 
           AND type_orientation = 'INTERNE' 
           AND actif = 1`,
        [now, user.id, existing.patient_id]
      );

      // 4. Marquer l'orientation externe comme traitée si elle existe (via visite_retour_id)
      await execute(
        `UPDATE orientations_specialistes 
         SET statut = 'INTEGRE_DOSSIER_CLOTURE', updated_at = ? 
         WHERE visite_retour_id = ? 
           AND statut = 'COMPTE_RENDU_RECU' 
           AND type_orientation = 'EXTERNE' 
           AND actif = 1`,
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
    if (!user || !isDoctorRole(user)) {
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
              c.diagnostic_principal, c.diagnostics_associes, c.hypotheses_diagnostiques, c.diagnostics_retenus, c.conduite_a_tenir,
              c.statut, c.finalisee_le, c.created_at,
              v.numero_visite, v.date_arrivee, v.type_visite,
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              u.nom_complet as medecin_nom,
              sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2,
              sv.frequence_respiratoire, sv.poids, sv.taille, sv.glycemie_mesuree, sv.douleur,
              sv.imc, sv.categorie_imc, sv.pam, sv.surface_corporelle, sv.pression_pulsee, sv.alertes_constantes,
              sv.date_prise as triage_date_prise,
              u_agent.nom_complet as triage_agent_nom
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN users u ON c.medecin_id = u.id
       LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
       LEFT JOIN users u_agent ON sv.agent_id = u_agent.id
       WHERE c.patient_id = ? AND c.actif = 1
       ORDER BY c.date_consultation DESC`,
      [patient_id]
    );

    const enrichedHistory = await Promise.all(
      history.map(async (c: any) => {
        const prescs = await query<any>(
          `SELECT p.*, u.nom_complet as medecin_nom
           FROM prescriptions p
           JOIN users u ON p.medecin_id = u.id
           WHERE p.consultation_id = ?
           ORDER BY p.created_at DESC`,
          [c.id]
        );
        const prescsWithItems = await Promise.all(
          prescs.map(async (p: any) => {
            const items = await query<any>(
              `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
              [p.id]
            );
            return { ...p, items };
          })
        );

        // Demandes de laboratoire associées à cette consultation (Phase 2C-2 & Phase 2C-4)
        const labOrders = await query<any>(
          `SELECT d.*, u.nom_complet as medecin_nom,
                  u_lab.nom_complet as laborantin_nom,
                  u_val.nom_complet as validated_by_nom,
                  u_ent.nom_complet as result_entered_by_nom,
                  u_prl.nom_complet as preleve_par_nom
           FROM demandes_laboratoire d
           JOIN users u ON d.medecin_id = u.id
           LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
           LEFT JOIN users u_val ON d.validated_by = u_val.id
           LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
           LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
           WHERE d.consultation_id = ?
           ORDER BY d.created_at DESC`,
          [c.id]
        );
        const labOrdersWithAnalyses = await Promise.all(
          labOrders.map(async (d: any) => {
            const analyses = await query<any>(
              `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
              [d.id]
            );
            const amendements = await query<any>(
              `SELECT a.*, u.nom_complet as amende_par_nom
               FROM amendements_analyses_laboratoire a
               LEFT JOIN users u ON a.amende_par_id = u.id
               WHERE a.demande_laboratoire_id = ?
               ORDER BY a.created_at ASC`,
              [d.id]
            );
            return { ...d, analyses, amendements };
          })
        );

        return {
          ...c,
          prescriptions: prescsWithItems,
          lab_orders: labOrdersWithAnalyses
        };
      })
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
      history: enrichedHistory
    });
  } catch (error: any) {
    console.error('Erreur historique médical patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de l’historique médical.' });
  }
}

// ============================================================================
// PHASE 2C-1 : PRESCRIPTION MÉDICALE UNIQUEMENT
// ============================================================================

/**
 * Création d'une prescription médicale
 * POST /api/medical/prescriptions
 * Rôle strict : MÉDECIN
 */
export async function createPrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { consultation_id, observations, items, statut, is_amendment, amendement_motif } = req.body;

    if (!consultation_id) {
      res.status(400).json({ error: 'Identifiant de consultation (consultation_id) obligatoire.' });
      return;
    }

    // 1. Vérifier que la consultation existe
    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [consultation_id]
    );

    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    // 2. Vérifier que la consultation appartient bien au médecin connecté
    if (consultation.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: consultation_id,
        details: `Dr. ${user.nom_complet} a tenté de créer une prescription pour une consultation d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas prescrire pour la consultation d’un confrère.' });
      return;
    }

    // 3. Consultation non interdite à la modification
    if (consultation.statut === 'FINALISEE') {
      if (!is_amendment || !amendement_motif || typeof amendement_motif !== 'string' || amendement_motif.trim().length < 5) {
        res.status(409).json({
          error: 'Cette consultation est finalisée. Un motif explicite d’amendement est requis pour ajouter une prescription.'
        });
        return;
      }
    }

    // Validation des items si statut demandé != BROUILLON
    const targetStatus = statut === 'ACTIVE' ? 'ACTIVE' : 'BROUILLON';
    const itemsArray = Array.isArray(items) ? items : [];

    if (targetStatus === 'ACTIVE') {
      if (itemsArray.length === 0) {
        res.status(400).json({ error: 'Au moins un médicament est requis pour activer la prescription.' });
        return;
      }
      for (const it of itemsArray) {
        if (!it.nom_medicament || typeof it.nom_medicament !== 'string' || it.nom_medicament.trim().length === 0) {
          res.status(400).json({ error: 'Le nom du médicament est obligatoire pour chaque ligne.' });
          return;
        }
      }
    }

    // Relation sécurisée serveur : ne jamais faire confiance aux IDs client
    const prescriptionId = `psc-${crypto.randomUUID().substring(0, 12)}`;
    const now = new Date().toISOString();

    await transaction(async () => {
      await execute(
        `INSERT INTO prescriptions (
          id, consultation_id, patient_id, visite_id, medecin_id,
          date_prescription, statut, observations, amendement_motif, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prescriptionId,
          consultation.id,
          consultation.patient_id,
          consultation.visite_id,
          user.id,
          now,
          targetStatus,
          observations?.trim() || null,
          amendement_motif?.trim() || null,
          now,
          now
        ]
      );

      for (let i = 0; i < itemsArray.length; i++) {
        const it = itemsArray[i];
        const itemId = `psi-${crypto.randomUUID().substring(0, 12)}`;
        await execute(
          `INSERT INTO prescription_items (
            id, prescription_id, nom_medicament, dosage, forme,
            voie_administration, frequence, duree, quantite, instructions, ordre,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            prescriptionId,
            it.nom_medicament?.trim() || 'Médicament',
            it.dosage?.trim() || null,
            it.forme?.trim() || null,
            it.voie_administration?.trim() || null,
            it.frequence?.trim() || null,
            it.duree?.trim() || null,
            it.quantite !== undefined && it.quantite !== null && !isNaN(Number(it.quantite)) ? Number(it.quantite) : null,
            it.instructions?.trim() || null,
            it.ordre !== undefined ? Number(it.ordre) : i,
            now,
            now
          ]
        );
      }
    });

    const createdPrescription = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [prescriptionId]
    );

    const createdItems = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
      [prescriptionId]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PRESCRIPTION_CREATED',
      ressourceType: 'PRESCRIPTION',
      ressourceId: prescriptionId,
      details: `Prescription (${targetStatus}, ${itemsArray.length} médicament(s)) créée par Dr. ${user.nom_complet} pour patient ${consultation.patient_id}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      message: 'Prescription créée avec succès.',
      prescription: {
        ...createdPrescription,
        items: createdItems
      }
    });
  } catch (error: any) {
    console.error('Erreur création prescription:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de la prescription.' });
  }
}

/**
 * Récupérer une prescription médicale par son ID
 * GET /api/medical/prescriptions/:id
 * Rôles : MÉDECIN, RÉCEPTION, ADMINISTRATEUR
 * Règle : La réception n'a accès qu'aux ordonnances validées par le médecin (VALIDEE, IMPRIMEE, REMISE)
 */
export async function getPrescriptionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }

    const { id } = req.params;

    const prescription = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, pat.date_naissance as patient_date_naissance, pat.sexe as patient_sexe,
              v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    if (!prescription) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // Contrôle d'accès strict selon le rôle :
    // 1. Pour la RÉCEPTION : la prescription ne devient disponible qu'après validation médicale
    if (user.role === 'RÉCEPTION') {
      if (prescription.statut === 'BROUILLON') {
        res.status(403).json({ error: 'Cette prescription est au statut BROUILLON et n’est pas accessible à la réception avant validation par le médecin.' });
        return;
      }
    }

    // 2. Pour un MÉDECIN : seul le médecin prescripteur (ou confrère si validée) peut accéder au brouillon
    if (user.role === 'MÉDECIN' && prescription.medecin_id !== user.id && prescription.statut === 'BROUILLON') {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de consulter le brouillon d'ordonnance d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas accéder au brouillon d’un confrère.' });
      return;
    }

    const items = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    res.json({
      prescription: {
        ...prescription,
        items
      }
    });
  } catch (error: any) {
    console.error('Erreur lecture prescription:', error);
    res.status(500).json({ error: 'Erreur interne lors de la lecture de la prescription.' });
  }
}

/**
 * Récupérer les ordonnances disponibles à la réception
 * GET /api/reception/prescriptions
 * Rôles : RÉCEPTION, MÉDECIN, ADMINISTRATEUR
 * Règle : Uniquement les ordonnances validées (VALIDEE, IMPRIMEE, REMISE)
 */
export async function getPrescriptionsForReception(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }

    const { statut, date, patient_id, search } = req.query;

    let sql = `
      SELECT p.*, 
             u.nom_complet as medecin_nom, 
             pat.nom as patient_nom, 
             pat.prenom as patient_prenom,
             pat.numero_dossier, 
             pat.date_naissance as patient_date_naissance, 
             pat.sexe as patient_sexe,
             pat.telephone as patient_telephone,
             v.numero_visite,
             v.date_arrivee
      FROM prescriptions p
      JOIN users u ON p.medecin_id = u.id
      JOIN patients pat ON p.patient_id = pat.id
      JOIN visites v ON p.visite_id = v.id
      WHERE p.statut IN ('VALIDEE', 'IMPRIMEE', 'REMISE')
    `;
    const params: (string | number)[] = [];

    if (statut && typeof statut === 'string' && ['VALIDEE', 'IMPRIMEE', 'REMISE'].includes(statut)) {
      sql += ` AND p.statut = ?`;
      params.push(statut);
    }

    if (date && typeof date === 'string') {
      sql += ` AND date(p.date_prescription) = date(?)`;
      params.push(date);
    }

    if (patient_id && typeof patient_id === 'string') {
      sql += ` AND p.patient_id = ?`;
      params.push(patient_id);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      sql += ` AND (pat.nom LIKE ? OR pat.prenom LIKE ? OR pat.numero_dossier LIKE ? OR v.numero_visite LIKE ?)`;
      params.push(q, q, q, q);
    }

    sql += ` ORDER BY p.date_prescription DESC LIMIT 100`;

    const prescriptions = await query<any>(sql, params);

    // Enrichir chaque ordonnance avec ses médicaments
    const enriched = await Promise.all(
      prescriptions.map(async (p) => {
        const items = await query<any>(
          `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
          [p.id]
        );
        return {
          ...p,
          items
        };
      })
    );

    res.json({ prescriptions: enriched });
  } catch (error: any) {
    console.error('Erreur récupération ordonnances réception:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des ordonnances.' });
  }
}

/**
 * Récupérer toutes les prescriptions d'une consultation
 * GET /api/medical/consultations/:id/prescriptions
 * Rôle strict : MÉDECIN
 */
export async function getPrescriptionsByConsultation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    if (consultation.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'CONSULTATION_PRESCRIPTIONS',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de lire les prescriptions d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas lire les prescriptions d’un confrère.' });
      return;
    }

    const prescriptions = await query<any>(
      `SELECT p.*, u.nom_complet as medecin_nom
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       WHERE p.consultation_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    const enriched = await Promise.all(
      prescriptions.map(async (p) => {
        const items = await query<any>(
          `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
          [p.id]
        );
        return {
          ...p,
          items
        };
      })
    );

    res.json({ prescriptions: enriched });
  } catch (error: any) {
    console.error('Erreur récupération prescriptions de la consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des prescriptions.' });
  }
}

/**
 * Modifier une prescription médicale (Brouillon ou amendement après finalisation)
 * PATCH /api/medical/prescriptions/:id
 * Rôle strict : MÉDECIN
 */
export async function updatePrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT * FROM prescriptions WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // Propriétaire
    if (existing.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de modifier la prescription d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas modifier la prescription d’un confrère.' });
      return;
    }

    const {
      observations,
      items,
      statut,
      is_amendment,
      amendement_motif
    } = req.body;

    // Protection après finalisation ou validation formelle
    const isLockedStatus = ['TERMINEE', 'VALIDEE', 'IMPRIMEE', 'REMISE'].includes(existing.statut);
    if (isLockedStatus) {
      if (!is_amendment || !amendement_motif || typeof amendement_motif !== 'string' || amendement_motif.trim().length < 5) {
        res.status(409).json({
          error: `Cette prescription est au statut ${existing.statut} et verrouillée contre toute modification silencieuse. Un motif explicite d’amendement est requis.`
        });
        return;
      }

      await auditLogger.log({
        userId: user.id,
        action: 'PRESCRIPTION_UPDATED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Amendement prescription (${existing.statut}) par Dr. ${user.nom_complet}. Motif: "${amendement_motif.trim()}"`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    // Gestion du statut
    let targetStatus = existing.statut;
    if (statut && ['BROUILLON', 'ACTIVE', 'TERMINEE', 'ANNULEE', 'VALIDEE', 'IMPRIMEE', 'REMISE'].includes(statut)) {
      if (isLockedStatus && statut !== existing.statut && !is_amendment) {
        res.status(409).json({ error: 'Impossible de changer le statut d’une prescription verrouillée sans amendement formel.' });
        return;
      }
      targetStatus = statut;
    }

    // Si on passe à ACTIVE ou TERMINEE, valider les items
    const itemsArray = items !== undefined ? (Array.isArray(items) ? items : []) : null;

    if (itemsArray !== null && (targetStatus === 'ACTIVE' || targetStatus === 'TERMINEE')) {
      if (itemsArray.length === 0) {
        res.status(400).json({ error: 'Au moins un médicament est requis pour activer ou finaliser la prescription.' });
        return;
      }
      for (const it of itemsArray) {
        if (!it.nom_medicament || typeof it.nom_medicament !== 'string' || it.nom_medicament.trim().length === 0) {
          res.status(400).json({ error: 'Le nom du médicament est obligatoire pour chaque ligne.' });
          return;
        }
      }
    }

    const now = new Date().toISOString();

    await transaction(async () => {
      await execute(
        `UPDATE prescriptions SET
          observations = ?,
          statut = ?,
          amendement_motif = COALESCE(?, amendement_motif),
          updated_at = ?
         WHERE id = ?`,
        [
          observations !== undefined ? (observations?.trim() || null) : existing.observations,
          targetStatus,
          amendement_motif?.trim() || null,
          now,
          id
        ]
      );

      if (itemsArray !== null) {
        // Remplacer les items
        await execute(`DELETE FROM prescription_items WHERE prescription_id = ?`, [id]);
        for (let i = 0; i < itemsArray.length; i++) {
          const it = itemsArray[i];
          const itemId = it.id && it.id.startsWith('psi-') ? it.id : `psi-${crypto.randomUUID().substring(0, 12)}`;
          await execute(
            `INSERT INTO prescription_items (
              id, prescription_id, nom_medicament, dosage, forme,
              voie_administration, frequence, duree, quantite, instructions, ordre,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              id,
              it.nom_medicament?.trim() || 'Médicament',
              it.dosage?.trim() || null,
              it.forme?.trim() || null,
              it.voie_administration?.trim() || null,
              it.frequence?.trim() || null,
              it.duree?.trim() || null,
              it.quantite !== undefined && it.quantite !== null && !isNaN(Number(it.quantite)) ? Number(it.quantite) : null,
              it.instructions?.trim() || null,
              it.ordre !== undefined ? Number(it.ordre) : i,
              it.created_at || now,
              now
            ]
          );
        }
      }
    });

    const updatedPrescription = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    const updatedItems = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    if (targetStatus === 'ANNULEE' && existing.statut !== 'ANNULEE') {
      await auditLogger.log({
        userId: user.id,
        action: 'PRESCRIPTION_CANCELLED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Prescription annulée par Dr. ${user.nom_complet}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } else {
      await auditLogger.log({
        userId: user.id,
        action: 'PRESCRIPTION_UPDATED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Mise à jour prescription (${targetStatus}) par Dr. ${user.nom_complet}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    res.json({
      message: 'Prescription mise à jour avec succès.',
      prescription: {
        ...updatedPrescription,
        items: updatedItems
      }
    });
  } catch (error: any) {
    console.error('Erreur mise à jour prescription:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la prescription.' });
  }
}

/**
 * Finalisation de la prescription médicale
 * POST /api/medical/prescriptions/:id/finalize
 * Rôle strict : MÉDECIN
 */
export async function finalizePrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT * FROM prescriptions WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // Propriétaire
    if (existing.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'PRESCRIPTION',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de finaliser la prescription d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas finaliser la prescription d’un confrère.' });
      return;
    }

    if (existing.statut === 'TERMINEE') {
      res.status(400).json({ error: 'Cette prescription est déjà finalisée (TERMINEE).' });
      return;
    }

    const now = new Date().toISOString();

    // Si des items sont passés dans le corps, les enregistrer d'abord
    const bodyItems = req.body?.items;
    if (Array.isArray(bodyItems)) {
      await transaction(async () => {
        await execute(`DELETE FROM prescription_items WHERE prescription_id = ?`, [id]);
        for (let i = 0; i < bodyItems.length; i++) {
          const it = bodyItems[i];
          const itemId = it.id && it.id.startsWith('psi-') ? it.id : `psi-${crypto.randomUUID().substring(0, 12)}`;
          await execute(
            `INSERT INTO prescription_items (
              id, prescription_id, nom_medicament, dosage, forme,
              voie_administration, frequence, duree, quantite, instructions, ordre,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              id,
              it.nom_medicament?.trim() || '',
              it.dosage?.trim() || null,
              it.forme?.trim() || null,
              it.voie_administration?.trim() || null,
              it.frequence?.trim() || null,
              it.duree?.trim() || null,
              it.quantite !== undefined && it.quantite !== null && !isNaN(Number(it.quantite)) ? Number(it.quantite) : null,
              it.instructions?.trim() || null,
              it.ordre !== undefined ? Number(it.ordre) : i,
              now,
              now
            ]
          );
        }
      });
    }

    // Récupérer les items actuels en base
    const currentItems = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    // Contrôles de validation stricts
    if (currentItems.length === 0) {
      res.status(400).json({ error: 'Au moins un médicament est requis pour finaliser la prescription.' });
      return;
    }

    for (const it of currentItems) {
      if (!it.nom_medicament || typeof it.nom_medicament !== 'string' || it.nom_medicament.trim().length === 0) {
        res.status(400).json({ error: 'Le nom du médicament est obligatoire pour chaque ligne.' });
        return;
      }
    }

    // Mettre à jour en TERMINEE
    await execute(
      `UPDATE prescriptions SET
        statut = 'TERMINEE',
        observations = COALESCE(?, observations),
        updated_at = ?
       WHERE id = ?`,
      [
        req.body?.observations !== undefined ? (req.body.observations?.trim() || null) : existing.observations,
        now,
        id
      ]
    );

    const finalizedPrescription = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PRESCRIPTION_FINALIZED',
      ressourceType: 'PRESCRIPTION',
      ressourceId: id,
      details: `Prescription finalisée (${currentItems.length} médicament(s)) par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      message: 'Prescription médicale finalisée avec succès.',
      prescription: {
        ...finalizedPrescription,
        items: currentItems
      }
    });
  } catch (error: any) {
    console.error('Erreur finalisation prescription:', error);
    res.status(500).json({ error: 'Erreur interne lors de la finalisation de la prescription.' });
  }
}

/**
 * Validation formelle de l'ordonnance médicale
 * POST /api/medical/prescriptions/:id/validate
 * Workflow : BROUILLON -> VALIDEE
 * Rôle strict : MÉDECIN prescripteur
 */
export async function validatePrescriptionWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;
    const existing = await queryOne<any>('SELECT * FROM prescriptions WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }
    if (existing.medecin_id !== user.id) {
      res.status(403).json({ error: 'Vous ne pouvez pas valider l\'ordonnance d\'un confrère.' });
      return;
    }

    const now = new Date().toISOString();

    // Si des items sont passés dans le corps, les enregistrer d'abord
    const bodyItems = req.body?.items;
    if (Array.isArray(bodyItems) && bodyItems.length > 0) {
      await transaction(async () => {
        await execute(`DELETE FROM prescription_items WHERE prescription_id = ?`, [id]);
        for (let i = 0; i < bodyItems.length; i++) {
          const it = bodyItems[i];
          const itemId = it.id && it.id.startsWith('psi-') ? it.id : `psi-${crypto.randomUUID().substring(0, 12)}`;
          await execute(
            `INSERT INTO prescription_items (
              id, prescription_id, nom_medicament, dosage, forme,
              voie_administration, frequence, duree, quantite, instructions, ordre,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              id,
              it.nom_medicament?.trim() || '',
              it.dosage?.trim() || null,
              it.forme?.trim() || null,
              it.voie_administration?.trim() || null,
              it.frequence?.trim() || null,
              it.duree?.trim() || null,
              it.quantite !== undefined && it.quantite !== null && !isNaN(Number(it.quantite)) ? Number(it.quantite) : null,
              it.instructions?.trim() || null,
              it.ordre !== undefined ? Number(it.ordre) : i,
              now,
              now
            ]
          );
        }
      });
    }

    // Contrôle d'au moins un médicament
    const currentItems = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC`,
      [id]
    );

    if (currentItems.length === 0) {
      res.status(400).json({ error: 'Au moins un médicament est requis pour valider l\'ordonnance.' });
      return;
    }

    await execute(
      `UPDATE prescriptions SET 
        statut = 'VALIDEE', 
        validee_le = COALESCE(validee_le, ?), 
        validee_par = COALESCE(validee_par, ?), 
        observations = COALESCE(?, observations),
        updated_at = ? 
       WHERE id = ?`,
      [now, user.id, req.body?.observations !== undefined ? (req.body.observations?.trim() || null) : existing.observations, now, id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PRESCRIPTION_VALIDATED',
      ressourceType: 'PRESCRIPTION',
      ressourceId: id,
      details: `Ordonnance validée par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    // 6. ORDONNANCE : Après validation par le médecin, notifier la Réception des ordonnances NON REMISES
    const signalId = 'sig_' + crypto.randomUUID();
    await execute(
      `INSERT INTO signaux_reception (
        id, medecin_id, visite_id, patient_id, type_signal, message, statut, created_at
      ) VALUES (?, ?, ?, ?, 'ORDONNANCE_NON_REMISE', ?, 'EN_ATTENTE', ?)`,
      [
        signalId,
        user.id,
        existing.visite_id,
        existing.patient_id,
        `Ordonnance validée non remise pour ${updated?.patient_nom || ''} ${updated?.patient_prenom || ''} (${updated?.numero_dossier || ''}) — N° ${updated?.numero_ordonnance || id}`,
        now
      ]
    );

    res.json({
      message: 'Ordonnance validée avec succès.',
      prescription: {
        ...updated,
        items: currentItems
      }
    });
  } catch (error: any) {
    console.error('Erreur validation ordonnance:', error);
    res.status(500).json({ error: 'Erreur interne lors de la validation de l\'ordonnance.' });
  }
}

/**
 * Marquage d'impression de l'ordonnance
 * POST /api/medical/prescriptions/:id/print
 * Workflow : VALIDEE -> IMPRIMEE (ou réimpression si REMISE)
 * Rôles autorisés : MÉDECIN, RÉCEPTION, ADMINISTRATEUR
 * Règle : L'impression ne modifie en aucun cas le contenu médical, ni le prescripteur, ni la date.
 */
export async function printPrescriptionWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }

    const { id } = req.params;
    const existing = await queryOne<any>('SELECT * FROM prescriptions WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    // La réception ne peut imprimer qu'une ordonnance validée
    if (user.role === 'RÉCEPTION' && existing.statut === 'BROUILLON') {
      res.status(403).json({ error: 'La prescription est au statut BROUILLON et ne peut pas être imprimée par la réception.' });
      return;
    }

    const now = new Date().toISOString();
    // Si la prescription est déjà REMISE, elle reste REMISE (pas de régression de statut lors d'un duplicata)
    // Si elle est VALIDEE ou BROUILLON (médecin), elle passe en IMPRIMEE
    const newStatut = existing.statut === 'REMISE' ? 'REMISE' : 'IMPRIMEE';

    await execute(
      `UPDATE prescriptions SET 
        statut = ?, 
        imprimee_le = COALESCE(imprimee_le, ?), 
        imprimee_par = COALESCE(imprimee_par, ?), 
        imprimee_par_id = COALESCE(imprimee_par_id, ?), 
        updated_at = ? 
       WHERE id = ?`,
      [newStatut, now, user.nom_complet || user.id, user.id, now, id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PRESCRIPTION_PRINTED',
      ressourceType: 'PRESCRIPTION',
      ressourceId: id,
      details: `Ordonnance imprimée par ${user.role} ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    const items = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC`,
      [id]
    );

    res.json({ message: 'Impression enregistrée.', prescription: { ...updated, items } });
  } catch (error: any) {
    console.error('Erreur impression ordonnance:', error);
    res.status(500).json({ error: 'Erreur interne lors du traitement de l\'impression.' });
  }
}

/**
 * Remise de l'ordonnance au patient
 * POST /api/medical/prescriptions/:id/deliver
 * Workflow : IMPRIMEE -> REMISE (ou VALIDEE -> REMISE si remise directe)
 * Rôles autorisés : RÉCEPTION, MÉDECIN, ADMINISTRATEUR
 */
export async function deliverPrescriptionWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }

    const { id } = req.params;
    const existing = await queryOne<any>('SELECT * FROM prescriptions WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Prescription introuvable.' });
      return;
    }

    if (existing.statut === 'BROUILLON') {
      res.status(400).json({ error: 'Une prescription en brouillon ne peut pas être remise au patient avant d’avoir été validée.' });
      return;
    }

    const now = new Date().toISOString();
    await execute(
      `UPDATE prescriptions SET 
        statut = 'REMISE', 
        remise_le = ?, 
        remise_par = ?, 
        remise_par_id = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [now, user.nom_complet || user.id, user.id, now, id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'PRESCRIPTION_DELIVERED',
      ressourceType: 'PRESCRIPTION',
      ressourceId: id,
      details: `Ordonnance remise au patient par ${user.role} ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const updated = await queryOne<any>(
      `SELECT p.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite
       FROM prescriptions p
       JOIN users u ON p.medecin_id = u.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN visites v ON p.visite_id = v.id
       WHERE p.id = ?`,
      [id]
    );

    const items = await query<any>(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY ordre ASC`,
      [id]
    );

    res.json({ message: 'Ordonnance remise au patient avec succès.', prescription: { ...updated, items } });
  } catch (error: any) {
    console.error('Erreur remise ordonnance:', error);
    res.status(500).json({ error: 'Erreur interne lors de la remise de l\'ordonnance.' });
  }
}

// ============================================================================
// PHASE 2C-2 : DEMANDES D'ANALYSES DE LABORATOIRE (MÉDECIN UNIQUEMENT)
// ============================================================================

const VALID_LAB_STATUSES = [
  'DEMANDE_CREEE',
  'PRISE_EN_CHARGE',
  'EN_ATTENTE_PRELEVEMENT',
  'PRELEVEMENT_EFFECTUE',
  'ECHANTILLON_RECU',
  'ECHANTILLON_NON_CONFORME',
  'EN_ANALYSE',
  'RESULTATS_A_SAISIR',
  'RESULTATS_SAISIS',
  'RESULTAT_A_VALIDER',
  'RESULTATS_VALIDES',
  'RESULTAT_VALIDE',
  'TRANSMIS_AU_MEDECIN',
  'TERMINEE',
  'ANNULEE'
];

const VALID_SAMPLE_TYPES = ['SANG', 'URINE', 'SELLES', 'AUTRE'];

/**
 * Créer une demande d'analyses de laboratoire depuis une consultation
 * POST /api/medical/lab-orders
 * Rôle strict : MÉDECIN
 */
export async function createLabOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const {
      consultation_id,
      patient_id,
      visite_id,
      urgence,
      indication_clinique,
      commentaire,
      analyses,
      statut,
      laborantin_id,
      is_amendment,
      amendement_motif
    } = req.body;

    if (!consultation_id || typeof consultation_id !== 'string') {
      res.status(400).json({ error: 'L\'identifiant de consultation (consultation_id) est obligatoire.' });
      return;
    }

    // 1. Vérifier que la consultation existe
    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [consultation_id]
    );

    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    // 2. Vérifier que la consultation appartient bien au médecin connecté
    if (consultation.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: consultation_id,
        details: `Dr. ${user.nom_complet} a tenté de créer une demande de laboratoire pour une consultation d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas prescrire d’analyses pour la consultation d’un confrère.' });
      return;
    }

    // 3. Vérifier la cohérence patient & visite si fournis
    if (patient_id && consultation.patient_id !== patient_id) {
      res.status(400).json({ error: 'Incohérence entre le patient indiqué et la consultation.' });
      return;
    }
    if (visite_id && consultation.visite_id !== visite_id) {
      res.status(400).json({ error: 'Incohérence entre la visite indiquée et la consultation.' });
      return;
    }

    // 4. Consultation finalisée : exiger un motif d'amendement explicite
    if (consultation.statut === 'FINALISEE') {
      if (!is_amendment || !amendement_motif || typeof amendement_motif !== 'string' || amendement_motif.trim().length < 5) {
        res.status(409).json({
          error: 'Cette consultation est finalisée. Un motif explicite d’amendement est requis pour ajouter une demande d\'analyses.'
        });
        return;
      }
    }

    // 5. Validation de l'urgence
    if (urgence !== undefined && !['NORMALE', 'URGENTE'].includes(urgence)) {
      res.status(400).json({ error: 'Niveau d\'urgence invalide. Valeurs autorisées: NORMALE, URGENTE.' });
      return;
    }
    const targetUrgence = urgence === 'URGENTE' ? 'URGENTE' : 'NORMALE';

    // 6. Validation du statut
    if (statut !== undefined && !VALID_LAB_STATUSES.includes(statut)) {
      res.status(400).json({ error: 'Statut de demande de laboratoire invalide.' });
      return;
    }
    const targetStatus = statut || 'DEMANDE_CREEE';

    // 7. Validation des analyses demandées
    const analysesArray = Array.isArray(analyses) ? analyses : [];
    if (analysesArray.length === 0) {
      res.status(400).json({ error: 'Au moins une analyse est requise pour créer une demande de laboratoire.' });
      return;
    }

    for (let i = 0; i < analysesArray.length; i++) {
      const it = analysesArray[i];
      if (!it.nom_analyse || typeof it.nom_analyse !== 'string' || it.nom_analyse.trim().length === 0) {
        res.status(400).json({ error: 'Le nom de l\'analyse est obligatoire pour chaque examen.' });
        return;
      }
      if (!it.type_echantillon || !VALID_SAMPLE_TYPES.includes(it.type_echantillon)) {
        res.status(400).json({
          error: `Type d'échantillon invalide pour l'analyse "${it.nom_analyse}". Valeurs autorisées: SANG, URINE, SELLES, AUTRE.`
        });
        return;
      }
    }

    // 8. Validation facultative de l'attribution laborantin
    let assignedLaborantinId: string | null = null;
    let assignedAt: string | null = null;
    let assignedBy: string | null = null;
    let targetLabUser: any = null;

    if (laborantin_id !== undefined && laborantin_id !== null && String(laborantin_id).trim() !== '' && String(laborantin_id).trim() !== 'none') {
      const cleanLabId = String(laborantin_id).trim();
      targetLabUser = await queryOne<any>(
        `SELECT id, username, nom_complet, role, actif FROM users WHERE id = ?`,
        [cleanLabId]
      );

      if (!targetLabUser) {
        res.status(400).json({ error: 'Le laborantin spécifié est introuvable.' });
        return;
      }
      if (targetLabUser.role !== 'LABORATOIRE') {
        res.status(400).json({ error: 'L\'utilisateur sélectionné n\'est pas un laborantin autorisé.' });
        return;
      }
      if (targetLabUser.actif !== 1) {
        res.status(400).json({ error: 'Le laborantin sélectionné est inactif.' });
        return;
      }

      assignedLaborantinId = targetLabUser.id;
    }

    // 9. Génération des clés et rattachement serveur sécurisé
    const orderId = `dla-${crypto.randomUUID().substring(0, 12)}`;
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const numeroDemande = `LAB-${new Date().getFullYear()}-${randSuffix}`;
    const now = new Date().toISOString();

    if (assignedLaborantinId) {
      assignedAt = now;
      assignedBy = user.id;
    }

    await transaction(async () => {
      await execute(
        `INSERT INTO demandes_laboratoire (
          id, numero_demande, consultation_id, patient_id, visite_id, medecin_id,
          laborantin_id, assigned_at, assigned_by,
          date_demande, statut, urgence, indication_clinique, commentaire,
          amendement_motif, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          numeroDemande,
          consultation.id,
          consultation.patient_id,
          consultation.visite_id,
          user.id,
          assignedLaborantinId,
          assignedAt,
          assignedBy,
          now,
          targetStatus,
          targetUrgence,
          indication_clinique?.trim() || null,
          commentaire?.trim() || null,
          amendement_motif?.trim() || null,
          now,
          now
        ]
      );

      for (let i = 0; i < analysesArray.length; i++) {
        const it = analysesArray[i];
        const analysisId = `als-${crypto.randomUUID().substring(0, 12)}`;
        const modeVal = it.mode === 'PERSONNALISE' ? 'PERSONNALISE' : 'GLOBAL';
        const examId = it.examen_id || null;
        const parametreId = it.parametre_id || null;
        const sousParametreId = it.sous_parametre_id || null;
        const selectionDetails = it.selection_details ? JSON.stringify(it.selection_details) : null;
        await execute(
          `INSERT INTO analyses_laboratoire (
            id, demande_laboratoire_id, nom_analyse, type_echantillon, statut,
            instructions, ordre, mode, examen_id, parametre_id, sous_parametre_id,
            selection_details, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            analysisId,
            orderId,
            it.nom_analyse.trim(),
            it.type_echantillon,
            targetStatus,
            it.instructions?.trim() || null,
            it.ordre !== undefined ? Number(it.ordre) : i,
            modeVal,
            examId,
            parametreId,
            sousParametreId,
            selectionDetails,
            now,
            now
          ]
        );
      }
    });

    const createdOrder = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, pat.date_naissance as patient_date_naissance, pat.sexe as patient_sexe,
              v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       WHERE d.id = ?`,
      [orderId]
    );

    const createdAnalyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [orderId]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_ORDER_CREATED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: orderId,
      details: assignedLaborantinId 
        ? `Demande d'analyses (${targetUrgence}, ${analysesArray.length} examen(s)) créée par Dr. ${user.nom_complet} et attribuée au laborantin ${targetLabUser?.nom_complet}`
        : `Demande d'analyses (${targetUrgence}, ${analysesArray.length} examen(s)) créée par Dr. ${user.nom_complet} en file générale`,
      ipAddress: req.ip || '127.0.0.1'
    });

    if (assignedLaborantinId && targetLabUser) {
      await auditLogger.log({
        userId: user.id,
        action: 'LAB_ORDER_ASSIGNED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: orderId,
        details: `Attribution directe au laborantin ${targetLabUser.nom_complet} lors de la création par Dr. ${user.nom_complet}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

// Facturation automatique liée des examens de laboratoire (mode GLOBAL / PERSONNALISE)
    let totalAmountUsd = 0;
    const billedItems: any[] = [];
    const exchangeRateRow = await queryOne<any>("SELECT value FROM clinic_settings WHERE key = 'EXCHANGE_RATE_USD_FC' OR key = 'EXCHANGE_RATE_USD_CDF' LIMIT 1");
    const officialRate = exchangeRateRow && exchangeRateRow.value ? parseFloat(exchangeRateRow.value) : 2850;

    for (const an of analysesArray) {
      const modeVal = an.mode === 'PERSONNALISE' ? 'PERSONNALISE' : 'GLOBAL';
      let itemPrice = 0;
      let tarifRow: any = null;

      if (modeVal === 'GLOBAL' && an.examen_id) {
        // MODE GLOBAL : utiliser le prix global de l'examen
        tarifRow = await queryOne<any>(
          `SELECT * FROM examens_laboratoire WHERE id = ? AND actif = 1`,
          [an.examen_id]
        );
        if (tarifRow && tarifRow.prix_global_usd != null) {
          itemPrice = parseFloat(tarifRow.prix_global_usd);
        }
        if (itemPrice === 0) {
          const fallbackTarif = await queryOne<any>(
            `SELECT * FROM tarifs WHERE ( categorie = 'EXAMEN_LABORATOIRE' OR categorie = 'LABORATOIRE' ) AND (nom LIKE ? OR id = ?) AND actif = 1 LIMIT 1`,
            [`%${an.nom_analyse}%`, an.tarif_id || '']
          ) || await queryOne<any>(
            `SELECT * FROM tarifs WHERE categorie = 'EXAMEN_LABORATOIRE' AND actif = 1 LIMIT 1`
          );
          itemPrice = fallbackTarif && fallbackTarif.prix_usd ? parseFloat(fallbackTarif.prix_usd) : 10;
          tarifRow = fallbackTarif;
        }
      } else if (modeVal === 'PERSONNALISE') {
        // MODE PERSONNALISE : somme des prix des paramètres/sous-paramètres sélectionnés
        const selectedIds: string[] = [];
        if (an.parametre_id) selectedIds.push(an.parametre_id);
        if (an.sous_parametre_id) selectedIds.push(an.sous_parametre_id);
        if (an.selection_details && Array.isArray(an.selection_details)) {
          for (const sel of an.selection_details) {
            if (sel.parametre_id) selectedIds.push(sel.parametre_id);
            if (sel.sous_parametre_id) selectedIds.push(sel.sous_parametre_id);
          }
        }
        if (selectedIds.length > 0) {
          const placeholders = selectedIds.map(() => '?').join(',');
          const priceRows = await query<any>(
            `SELECT prix_usd FROM parametres_laboratoire WHERE id IN (${placeholders}) AND actif = 1`,
            selectedIds
          );
          const sousIds = selectedIds.filter(id => id.startsWith('sp-'));
          if (sousIds.length > 0) {
            const sousPlaceholders = sousIds.map(() => '?').join(',');
            const sousPriceRows = await query<any>(
              `SELECT prix_usd FROM sous_parametres_laboratoire WHERE id IN (${sousPlaceholders}) AND actif = 1`,
              sousIds
            );
            priceRows.push(...sousPriceRows);
          }
          itemPrice = priceRows.reduce((sum: number, r: any) => sum + (parseFloat(r.prix_usd) || 0), 0);
        }
        if (itemPrice === 0) {
          const fallbackTarif = await queryOne<any>(
            `SELECT * FROM tarifs WHERE ( categorie = 'EXAMEN_LABORATOIRE' OR categorie = 'LABORATOIRE' ) AND (nom LIKE ? OR id = ?) AND actif = 1 LIMIT 1`,
            [`%${an.nom_analyse}%`, an.tarif_id || '']
          ) || await queryOne<any>(
            `SELECT * FROM tarifs WHERE categorie = 'EXAMEN_LABORATOIRE' AND actif = 1 LIMIT 1`
          );
          itemPrice = fallbackTarif && fallbackTarif.prix_usd ? parseFloat(fallbackTarif.prix_usd) : 10;
          tarifRow = fallbackTarif;
        }
      } else {
        // Fallback rétrocompatibilité : recherche dans tarifs
        const fallbackTarif = await queryOne<any>(
          `SELECT * FROM tarifs WHERE ( categorie = 'EXAMEN_LABORATOIRE' OR categorie = 'LABORATOIRE' ) AND (nom LIKE ? OR id = ?) AND actif = 1 LIMIT 1`,
          [`%${an.nom_analyse}%`, an.tarif_id || '']
        ) || await queryOne<any>(
          `SELECT * FROM tarifs WHERE categorie = 'EXAMEN_LABORATOIRE' AND actif = 1 LIMIT 1`
        );
        itemPrice = fallbackTarif && fallbackTarif.prix_usd ? parseFloat(fallbackTarif.prix_usd) : 10;
        tarifRow = fallbackTarif;
      }

      totalAmountUsd += itemPrice;
      billedItems.push({
        tarif_id: tarifRow?.id || null,
        description: `Examen: ${an.nom_analyse} (${modeVal})`,
        categorie: 'EXAMEN_LABORATOIRE',
        quantite: 1,
        prix_unitaire: itemPrice
      });
    }

    let linkedFacture: any = null;
    try {
      const factureResult = await createLinkedFactureCore({
        patient_id: consultation.patient_id,
        visite_id: consultation.visite_id,
        type_prestation: 'LABORATOIRE',
        items: billedItems.length > 0 ? billedItems : [{
          description: 'Examens de laboratoire',
          categorie: 'EXAMEN_LABORATOIRE',
          quantite: 1,
          prix_unitaire: 10
        }],
        emise_par_id: user.id,
        notes: `Facture examens de laboratoire bon ${numeroDemande}`,
        ip_address: req.ip || '127.0.0.1'
      });
      linkedFacture = factureResult.facture;

      if (linkedFacture?.id) {
        await execute(
          `UPDATE demandes_laboratoire SET facture_id = ? WHERE id = ?`,
          [linkedFacture.id, orderId]
        );
      }
    } catch (fErr) {
      console.error('Erreur génération facture labo:', fErr);
    }

    const totalAmountFc = Math.round(totalAmountUsd * officialRate);

    // Notification d'encaissement directe pour la RÉCEPTION (qui joue le rôle de Caisse)
    try {
      const receptionUsers = await query<any>(
        `SELECT u.id FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE (u.role IN ('RÉCEPTION', 'RECEPTION') OR r.categorie = 'RÉCEPTION') AND u.actif = 1`
      );
      const analysesNoms = analysesArray.map((a: any) => a.nom_analyse).join(', ');
      for (const recUser of receptionUsers) {
        const notifId = `notif-${crypto.randomUUID().substring(0, 12)}`;
        await execute(
          `INSERT INTO notifications (
            id, user_id, emetteur_id, emetteur_nom, emetteur_role, destinataire_role,
            titre, message, type, patient_id, consultation_id, visite_id, lab_order_id, lu, created_at
          ) VALUES (?, ?, ?, ?, ?, 'RÉCEPTION', ?, ?, 'LAB_ORDER_TO_COLLECT', ?, ?, ?, ?, 0, ?)`,
          [
            notifId,
            recUser.id,
            user.id,
            user.nom_complet,
            user.role,
            `🔬 Labo à encaisser : ${createdOrder?.patient_nom || 'Patient'} ${createdOrder?.patient_prenom || ''}`,
            `Bon n° ${numeroDemande} prescrit par Dr. ${user.nom_complet}. Analyses : ${analysesNoms}. Montant à percevoir : ${totalAmountUsd.toFixed(2)} USD (${totalAmountFc.toLocaleString('fr-FR')} FC).`,
            consultation.patient_id,
            consultation.id,
            consultation.visite_id,
            orderId,
            now
          ]
        );
      }
    } catch (nErr) {
      console.error('Erreur envoi notification réception pour labo:', nErr);
    }

    saveDb();

    res.status(201).json({
      message: 'Demande d\'analyses de laboratoire créée avec succès.',
      lab_order: {
        ...createdOrder,
        facture_id: linkedFacture?.id || null,
        analyses: createdAnalyses
      },
      facture: linkedFacture
    });
  } catch (error: any) {
    console.error('Erreur création demande laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de la demande de laboratoire.' });
  }
}

/**
 * Récupérer une demande d'analyses par son identifiant
 * GET /api/medical/lab-orders/:id
 * Rôles autorisés : MÉDECIN, LABORATOIRE
 * Confidentialité garantie : Le laboratoire n'a pas accès aux notes médicales privées
 */
export async function getLabOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    if (!['MÉDECIN', 'LABORATOIRE'].includes(user.role)) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: req.params.id,
        details: `Tentative d'accès non autorisée par le rôle ${user.role} (${user.nom_complet})`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Accès strictement réservé au corps médical et au laboratoire.' });
      return;
    }

    const { id } = req.params;

    const order = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, pat.date_naissance as patient_date_naissance, pat.sexe as patient_sexe,
              v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    if (!order) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    // Contrôle d'accès médecin prescripteur
    if (user.role === 'MÉDECIN' && order.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de consulter la demande de laboratoire d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas accéder à la demande de laboratoire d’un confrère.' });
      return;
    }

    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    const amendements = await query<any>(
      `SELECT a.*, u.nom_complet as amende_par_nom
       FROM amendements_analyses_laboratoire a
       LEFT JOIN users u ON a.amende_par_id = u.id
       WHERE a.demande_laboratoire_id = ?
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      lab_order: {
        ...order,
        analyses,
        amendements
      }
    });
  } catch (error: any) {
    console.error('Erreur lecture demande laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de la lecture de la demande de laboratoire.' });
  }
}

/**
 * Récupérer toutes les demandes d'analyses d'une consultation
 * GET /api/medical/consultations/:id/lab-orders
 * Rôle strict : MÉDECIN
 */
export async function getLabOrdersByConsultation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    if (consultation.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'CONSULTATION_LAB_ORDERS',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de lire les demandes de laboratoire d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas lire les demandes de laboratoire d’un confrère.' });
      return;
    }

    const orders = await query<any>(
      `SELECT d.*, u.nom_complet as medecin_nom,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.consultation_id = ?
       ORDER BY d.created_at DESC`,
      [id]
    );

    const enriched = await Promise.all(
      orders.map(async (o) => {
        const analyses = await query<any>(
          `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
          [o.id]
        );
        const amendements = await query<any>(
          `SELECT a.*, u.nom_complet as amende_par_nom
           FROM amendements_analyses_laboratoire a
           LEFT JOIN users u ON a.amende_par_id = u.id
           WHERE a.demande_laboratoire_id = ?
           ORDER BY a.created_at ASC`,
          [o.id]
        );
        return {
          ...o,
          analyses,
          amendements
        };
      })
    );

    res.json({ lab_orders: enriched });
  } catch (error: any) {
    console.error('Erreur récupération demandes de laboratoire de la consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des demandes de laboratoire.' });
  }
}

/**
 * Modifier ou annuler une demande d'analyses
 * PATCH /api/medical/lab-orders/:id
 * Rôle strict : MÉDECIN (propriétaire uniquement)
 */
export async function updateLabOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT * FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    // Propriétaire strict (Médecin A ne peut pas modifier la demande de Médecin B)
    if (existing.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: id,
        details: `Dr. ${user.nom_complet} a tenté de modifier la demande de laboratoire d'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas modifier la demande d’analyses d’un confrère.' });
      return;
    }

    const {
      urgence,
      indication_clinique,
      commentaire,
      statut,
      analyses,
      laborantin_id,
      is_amendment,
      amendement_motif
    } = req.body;

    // Validation du statut
    if (statut !== undefined && !VALID_LAB_STATUSES.includes(statut)) {
      res.status(400).json({ error: 'Statut de demande de laboratoire invalide.' });
      return;
    }

    // Validation de l'urgence
    if (urgence !== undefined && !['NORMALE', 'URGENTE'].includes(urgence)) {
      res.status(400).json({ error: 'Niveau d\'urgence invalide. Valeurs autorisées: NORMALE, URGENTE.' });
      return;
    }

    // Validation de l'attribution laborantin si fournie
    let targetLaborantinId: string | null = existing.laborantin_id;
    let targetAssignedAt: string | null = existing.assigned_at;
    let targetAssignedBy: string | null = existing.assigned_by;
    let assignmentChanged: 'ASSIGNED' | 'UNASSIGNED' | null = null;
    let targetLabUser: any = null;

    if (laborantin_id !== undefined) {
      if (laborantin_id === null || String(laborantin_id).trim() === '' || String(laborantin_id).trim() === 'none') {
        if (existing.laborantin_id !== null) {
          targetLaborantinId = null;
          targetAssignedAt = null;
          targetAssignedBy = null;
          assignmentChanged = 'UNASSIGNED';
        }
      } else {
        const cleanLabId = String(laborantin_id).trim();
        targetLabUser = await queryOne<any>(
          `SELECT id, username, nom_complet, role, actif FROM users WHERE id = ?`,
          [cleanLabId]
        );

        if (!targetLabUser) {
          res.status(400).json({ error: 'Le laborantin spécifié est introuvable.' });
          return;
        }
        if (targetLabUser.role !== 'LABORATOIRE') {
          res.status(400).json({ error: 'L\'utilisateur sélectionné n\'a pas le rôle LABORATOIRE.' });
          return;
        }
        if (targetLabUser.actif !== 1) {
          res.status(400).json({ error: 'Le laborantin sélectionné est inactif.' });
          return;
        }

        if (existing.laborantin_id !== targetLabUser.id) {
          targetLaborantinId = targetLabUser.id;
          targetAssignedAt = new Date().toISOString();
          targetAssignedBy = user.id;
          assignmentChanged = 'ASSIGNED';
        }
      }
    }

    // Vérifier si la consultation d'origine est finalisée
    const consultation = await queryOne<any>(
      `SELECT statut FROM consultations WHERE id = ?`,
      [existing.consultation_id]
    );

    const isConsultationFinalized = consultation && consultation.statut === 'FINALISEE';

    if (isConsultationFinalized || existing.statut === 'RESULTAT_VALIDE' || existing.statut === 'ANNULEE') {
      if (!is_amendment || !amendement_motif || typeof amendement_motif !== 'string' || amendement_motif.trim().length < 5) {
        res.status(409).json({
          error: 'Cette demande ou sa consultation est finalisée/verrouillée. Un motif explicite d’amendement est requis.'
        });
        return;
      }
    }

    // Validation des analyses si fournies
    if (analyses !== undefined) {
      if (!Array.isArray(analyses) || analyses.length === 0) {
        res.status(400).json({ error: 'Au moins une analyse est requise.' });
        return;
      }
      for (const it of analyses) {
        if (!it.nom_analyse || typeof it.nom_analyse !== 'string' || it.nom_analyse.trim().length === 0) {
          res.status(400).json({ error: 'Le nom de l\'analyse est obligatoire pour chaque examen.' });
          return;
        }
        if (!it.type_echantillon || !VALID_SAMPLE_TYPES.includes(it.type_echantillon)) {
          res.status(400).json({
            error: `Type d'échantillon invalide pour l'analyse "${it.nom_analyse}". Valeurs autorisées: SANG, URINE, SELLES, AUTRE.`
          });
          return;
        }
      }
    }

    const targetStatus = statut || existing.statut;
    const targetUrgence = urgence || existing.urgence;
    const now = new Date().toISOString();

    await transaction(async () => {
      await execute(
        `UPDATE demandes_laboratoire SET
          statut = ?,
          urgence = ?,
          laborantin_id = ?,
          assigned_at = ?,
          assigned_by = ?,
          indication_clinique = COALESCE(?, indication_clinique),
          commentaire = COALESCE(?, commentaire),
          amendement_motif = COALESCE(?, amendement_motif),
          updated_at = ?
         WHERE id = ?`,
        [
          targetStatus,
          targetUrgence,
          targetLaborantinId,
          targetAssignedAt,
          targetAssignedBy,
          indication_clinique !== undefined ? (indication_clinique?.trim() || null) : existing.indication_clinique,
          commentaire !== undefined ? (commentaire?.trim() || null) : existing.commentaire,
          amendement_motif !== undefined ? (amendement_motif?.trim() || null) : existing.amendement_motif,
          now,
          id
        ]
      );

      if (analyses !== undefined) {
        await execute(`DELETE FROM analyses_laboratoire WHERE demande_laboratoire_id = ?`, [id]);
        for (let i = 0; i < analyses.length; i++) {
          const it = analyses[i];
          const analysisId = `als-${crypto.randomUUID().substring(0, 12)}`;
          const modeVal = it.mode === 'PERSONNALISE' ? 'PERSONNALISE' : 'GLOBAL';
          const examId = it.examen_id || null;
          const parametreId = it.parametre_id || null;
          const sousParametreId = it.sous_parametre_id || null;
          const selectionDetails = it.selection_details ? JSON.stringify(it.selection_details) : null;
          await execute(
            `INSERT INTO analyses_laboratoire (
              id, demande_laboratoire_id, nom_analyse, type_echantillon, statut,
              instructions, ordre, mode, examen_id, parametre_id, sous_parametre_id,
              selection_details, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              analysisId,
              id,
              it.nom_analyse.trim(),
              it.type_echantillon,
              targetStatus,
              it.instructions?.trim() || null,
              it.ordre !== undefined ? Number(it.ordre) : i,
              modeVal,
              examId,
              parametreId,
              sousParametreId,
              selectionDetails,
              now,
              now
            ]
          );
        }
      }
    });

    const updatedOrder = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       WHERE d.id = ?`,
      [id]
    );

    const updatedAnalyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    const auditAction = targetStatus === 'ANNULEE' ? 'LAB_ORDER_CANCELLED' : 'LAB_ORDER_UPDATED';

    await auditLogger.log({
      userId: user.id,
      action: auditAction,
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: targetStatus === 'ANNULEE'
        ? `Demande de laboratoire annulée par Dr. ${user.nom_complet}`
        : `Demande de laboratoire mise à jour (statut: ${targetStatus}) par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    if (assignmentChanged === 'ASSIGNED' && targetLabUser) {
      await auditLogger.log({
        userId: user.id,
        action: 'LAB_ORDER_ASSIGNED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: id,
        details: `Réattribution de la demande au laborantin ${targetLabUser.nom_complet} (ancien: ${existing.laborantin_id || 'File générale'}) par Dr. ${user.nom_complet}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } else if (assignmentChanged === 'UNASSIGNED') {
      await auditLogger.log({
        userId: user.id,
        action: 'LAB_ORDER_UNASSIGNED',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: id,
        details: `Désattribution de la demande (remise en file générale, ancien laborantin: ${existing.laborantin_id}) par Dr. ${user.nom_complet}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    res.json({
      message: 'Demande de laboratoire mise à jour avec succès.',
      lab_order: {
        ...updatedOrder,
        analyses: updatedAnalyses
      }
    });
  } catch (error: any) {
    console.error('Erreur mise à jour demande laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la demande de laboratoire.' });
  }
}

/**
 * Récupérer la liste des laborantins actifs autorisés
 * GET /api/laborantins
 * Rôles : MÉDECIN, LABORATOIRE, ADMINISTRATEUR
 */
export async function getActiveLaborantins(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const laborantins = await query<any>(
      `SELECT id, username, nom_complet, role, actif 
       FROM users 
       WHERE role = 'LABORATOIRE' AND actif = 1 
       ORDER BY nom_complet ASC`
    );

    res.json({ laborantins });
  } catch (error: any) {
    console.error('Erreur récupération laborantins:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des laborantins.' });
  }
}

/**
 * File de travail du laboratoire
 * GET /api/laboratory/queue
 * Rôles : LABORATOIRE, MÉDECIN, ADMINISTRATEUR
 * Sépare :
 * - general_orders : demandes en file générale (laborantin_id IS NULL)
 * - my_orders : demandes assignées au laborantin connecté (laborantin_id = user.id)
 * - other_assigned_orders : demandes assignées à d'autres laborantins (pour visibilité d'équipe)
 * CONFIDENTIALITÉ MÉDICALE : Pas d'accès aux notes médicales privées
 */
export async function getLaboratoryQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    if (!['LABORATOIRE', 'MÉDECIN', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès strictement réservé au laboratoire et au corps médical.' });
      return;
    }

    const baseSql = `
      SELECT d.*,
             u.nom_complet as medecin_nom,
             pat.nom as patient_nom, pat.prenom as patient_prenom, pat.numero_dossier,
             pat.date_naissance as patient_date_naissance, pat.sexe as patient_sexe, pat.telephone as patient_telephone,
             v.numero_visite,
             u_lab.nom_complet as laborantin_nom,
             u_asb.nom_complet as assigned_by_nom,
             u_val.nom_complet as validated_by_nom,
             u_ent.nom_complet as result_entered_by_nom,
             u_prl.nom_complet as preleve_par_nom,
             COALESCE(fp.statut_paiement, 'NON PAYÉ') as statut_paiement
      FROM demandes_laboratoire d
      JOIN users u ON d.medecin_id = u.id
      JOIN patients pat ON d.patient_id = pat.id
      JOIN visites v ON d.visite_id = v.id
      LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
      LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
      LEFT JOIN users u_val ON d.validated_by = u_val.id
      LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
      LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
      LEFT JOIN (
        SELECT visite_id,
          CASE 
            WHEN count(CASE WHEN statut NOT IN ('PAYÉ', 'PAYEE') THEN 1 END) = 0 AND count(*) > 0 THEN 'PAYÉ'
            WHEN count(CASE WHEN statut IN ('PAYÉ', 'PAYEE', 'PARTIELLEMENT PAYÉ', 'PARTIELLEMENT_PAYEE') THEN 1 END) > 0 THEN 'PARTIELLEMENT PAYÉ'
            ELSE 'NON PAYÉ'
          END as statut_paiement
        FROM factures
        GROUP BY visite_id
      ) fp ON fp.visite_id = d.visite_id
      WHERE d.statut != 'ANNULEE'
      ORDER BY 
        CASE WHEN d.urgence = 'URGENTE' THEN 0 ELSE 1 END,
        d.created_at ASC
    `;

    const allOrders = await query<any>(baseSql);

    const enriched = await Promise.all(
      allOrders.map(async (o) => {
        const analyses = await query<any>(
          `SELECT *
           FROM analyses_laboratoire 
           WHERE demande_laboratoire_id = ? 
           ORDER BY ordre ASC, created_at ASC`,
          [o.id]
        );
        const amendements = await query<any>(
          `SELECT a.*, u.nom_complet as amende_par_nom
           FROM amendements_analyses_laboratoire a
           LEFT JOIN users u ON a.amende_par_id = u.id
           WHERE a.demande_laboratoire_id = ?
           ORDER BY a.created_at ASC`,
          [o.id]
        );

        let finLab: any = null;
        if (o.facture_id) {
          finLab = await queryOne<any>('SELECT * FROM factures WHERE id = ?', [o.facture_id]);
        }
        const hasDerogation = (finLab?.notes && finLab.notes.includes('DÉROGATION')) ||
                              (o.amendement_motif && o.amendement_motif.includes('DÉROGATION'));
        const labStatutFacture = finLab ? finLab.statut : o.statut_paiement;

        const isPaid = ['PAYÉ', 'PAYEE'].includes(labStatutFacture);
        const isPartial = ['PARTIELLEMENT PAYÉ', 'PARTIELLEMENT_PAYEE'].includes(labStatutFacture);
        const isAuthorizedByCashier = !o.facture_id || isPaid || isPartial || hasDerogation;

        const bloqueCaisse = !isAuthorizedByCashier;
        const statutAffichage = isPaid 
          ? 'PAYÉ' 
          : (isPartial 
              ? 'PARTIELLEMENT PAYÉ' 
              : (hasDerogation 
                  ? 'NON PAYÉ (Dérogation Caisse)' 
                  : 'NON PAYÉ (En attente d’encaissement à la réception)'));

        return {
          ...o,
          analyses,
          amendements,
          bloque_caisse: bloqueCaisse,
          statut_paiement_labo: statutAffichage,
          has_derogation: Boolean(hasDerogation)
        };
      })
    );

    const isCompleted = (statut: string) => ['RESULTATS_VALIDES', 'RESULTAT_VALIDE', 'TERMINEE'].includes(statut);

    const general_orders = enriched.filter((o) => !o.laborantin_id && !isCompleted(o.statut));
    const my_orders = enriched.filter((o) => o.laborantin_id === user.id && !isCompleted(o.statut));
    const other_assigned_orders = enriched.filter((o) => o.laborantin_id && o.laborantin_id !== user.id && !isCompleted(o.statut));
    const completed_orders = enriched.filter((o) => isCompleted(o.statut));

    res.json({
      general_orders,
      my_orders,
      other_assigned_orders,
      completed_orders,
      all_active_orders: enriched,
      total_count: enriched.length
    });
  } catch (error: any) {
    console.error('Erreur récupération file laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de la file laboratoire.' });
  }
}

/**
 * Prise en charge atomique d'une demande par un laborantin
 * POST /api/laboratory/orders/:id/claim
 * Rôle strict : LABORATOIRE
 */
export async function claimLabOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Accès strictement réservé au personnel du laboratoire (LABORATOIRE).' });
      return;
    }

    // Vérification en base de données de l'état actif du laborantin
    const labUser = await queryOne<any>(
      `SELECT id, role, actif FROM users WHERE id = ?`,
      [user.id]
    );

    if (!labUser || labUser.actif !== 1 || labUser.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Compte laborantin introuvable, inactif ou non autorisé.' });
      return;
    }

    const { id } = req.params;
    const now = new Date().toISOString();

    const existing = await queryOne<any>(
      `SELECT * FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (existing.statut === 'ANNULEE' || existing.statut === 'RESULTAT_VALIDE') {
      res.status(400).json({ error: `Cette demande ne peut plus être prise en charge (statut: ${existing.statut}).` });
      return;
    }

    // Contrôle strict : Le patient doit avoir réglé à la caisse d'accueil ou disposer d'une dérogation
    if (existing.facture_id) {
      const fLab = await queryOne<any>('SELECT * FROM factures WHERE id = ?', [existing.facture_id]);
      const hasDerog = (fLab?.notes && fLab.notes.includes('DÉROGATION')) ||
                       (existing.amendement_motif && existing.amendement_motif.includes('DÉROGATION'));
      const isPaid = fLab && ['PAYÉ', 'PAYEE', 'PARTIELLEMENT PAYÉ', 'PARTIELLEMENT_PAYEE'].includes(fLab.statut);
      if (!isPaid && !hasDerog) {
        res.status(403).json({
          error: 'Encaissement préalable obligatoire : Le patient doit d\'abord régler les examens à la réception/caisse ou consigner un motif dérogatoire avant la prise en charge au laboratoire.'
        });
        return;
      }
    }

    // Si déjà attribuée à un autre laborantin précis
    if (existing.laborantin_id && existing.laborantin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'LAB_ORDER_CLAIM_CONFLICT',
        ressourceType: 'DEMANDE_LABORATOIRE',
        ressourceId: id,
        details: `Tentative de prise en charge refusée : demande déjà attribuée au laborantin ${existing.laborantin_id}`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(409).json({
        error: 'Cette demande a déjà été attribuée ou prise en charge par un autre laborantin.',
        current_laborantin_id: existing.laborantin_id
      });
      return;
    }

    const targetStatus = existing.statut === 'DEMANDE_CREEE' ? 'PRISE_EN_CHARGE' : existing.statut;

    // Mise à jour atomique conditionnelle
    const updateRes = await execute(
      `UPDATE demandes_laboratoire SET
        laborantin_id = ?,
        assigned_at = COALESCE(assigned_at, ?),
        assigned_by = COALESCE(assigned_by, ?),
        statut = ?,
        updated_at = ?
       WHERE id = ? AND (laborantin_id IS NULL OR laborantin_id = ?)`,
      [user.id, now, user.id, targetStatus, now, id, user.id]
    );

    if (updateRes.changes === 0) {
      res.status(409).json({
        error: 'Conflit de concurrence : la demande vient d\'être prise en charge par un autre laborantin.'
      });
      return;
    }

    if (targetStatus === 'PRISE_EN_CHARGE') {
      await execute(
        `UPDATE analyses_laboratoire SET statut = 'EN_ATTENTE_PRELEVEMENT', updated_at = ? WHERE demande_laboratoire_id = ? AND statut = 'DEMANDE_CREEE'`,
        [now, id]
      );
    }

    const updatedOrder = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       WHERE d.id = ?`,
      [id]
    );

    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_ORDER_CLAIMED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Demande ${existing.numero_demande || id} prise en charge par ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      message: 'Demande de laboratoire prise en charge avec succès.',
      lab_order: {
        ...updatedOrder,
        analyses
      }
    });
  } catch (error: any) {
    console.error('Erreur claim lab order:', error);
    res.status(500).json({ error: 'Erreur interne lors de la prise en charge de la demande.', details: error.message, stack: error.stack });
  }
}

/**
 * Modifier l'affectation d'une demande de laboratoire
 * PATCH /api/laboratory/orders/:id/assign
 * Rôles : MÉDECIN (prescripteur), LABORATOIRE, ADMINISTRATEUR
 */
export async function assignLabOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'LABORATOIRE', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès strictement réservé au personnel médical et au laboratoire.' });
      return;
    }

    const { id } = req.params;
    const { laborantin_id } = req.body;
    const now = new Date().toISOString();

    const existing = await queryOne<any>(
      `SELECT * FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    // Si médecin, vérifier qu'il est le prescripteur
    if (user.role === 'MÉDECIN' && existing.medecin_id !== user.id) {
      res.status(403).json({ error: 'Vous ne pouvez pas modifier l’affectation d’une demande d’un confrère.' });
      return;
    }

    let targetLaborantinId: string | null = null;
    let targetLaborantinNom: string = 'File générale';

    if (laborantin_id && String(laborantin_id).trim() !== '' && String(laborantin_id).trim() !== 'none') {
      const cleanLabId = String(laborantin_id).trim();
      const targetUser = await queryOne<any>(
        `SELECT * FROM users WHERE id = ?`,
        [cleanLabId]
      );
      if (!targetUser) {
        res.status(400).json({ error: 'Le laborantin spécifié est introuvable.' });
        return;
      }
      if (targetUser.role !== 'LABORATOIRE') {
        res.status(400).json({ error: 'L\'utilisateur sélectionné n\'a pas le rôle LABORATOIRE.' });
        return;
      }
      if (targetUser.actif !== 1) {
        res.status(400).json({ error: 'Le laborantin sélectionné est inactif.' });
        return;
      }
      targetLaborantinId = targetUser.id;
      targetLaborantinNom = targetUser.nom_complet;
    }

    await execute(
      `UPDATE demandes_laboratoire SET
        laborantin_id = ?,
        assigned_at = ?,
        assigned_by = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        targetLaborantinId,
        targetLaborantinId ? now : null,
        targetLaborantinId ? user.id : null,
        now,
        id
      ]
    );

    const action = targetLaborantinId ? 'LAB_ORDER_ASSIGNED' : 'LAB_ORDER_UNASSIGNED';
    const details = targetLaborantinId
      ? `Attribution de la demande ${existing.numero_demande || id} au laborantin ${targetLaborantinNom} (ancien: ${existing.laborantin_id || 'File générale'}) par ${user.nom_complet}`
      : `Désattribution de la demande ${existing.numero_demande || id} (remise en file générale, ancien: ${existing.laborantin_id}) par ${user.nom_complet}`;

    await auditLogger.log({
      userId: user.id,
      action,
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details,
      ipAddress: req.ip || '127.0.0.1'
    });

    const updated = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_asb.nom_complet as assigned_by_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_asb ON d.assigned_by = u_asb.id
       WHERE d.id = ?`,
      [id]
    );

    res.json({
      message: targetLaborantinId ? 'Demande assignée avec succès.' : 'Demande remise en file générale.',
      lab_order: updated
    });
  } catch (error: any) {
    console.error('Erreur assign lab order:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'affectation de la demande.' });
  }
}

// ============================================================================
// PHASE 2C-4 : SAISIE DES RÉSULTATS, VALIDATION, NOTIFICATIONS & AMENDEMENTS
// ============================================================================

/**
 * Enregistrer la réalisation du prélèvement biologique
 * POST /api/laboratory/orders/:id/prelevement
 * Rôle strict : LABORATOIRE
 */
export async function recordLabPrelevement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Accès strictement réservé au personnel du laboratoire (LABORATOIRE).' });
      return;
    }

    const { id } = req.params;
    const { date_prelevement, preleve_par_id, statut } = req.body;
    const now = new Date().toISOString();

    const existing = await queryOne<any>(
      `SELECT * FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (existing.statut === 'ANNULEE') {
      res.status(400).json({ error: 'Cette demande de laboratoire a été annulée.' });
      return;
    }

    const targetDatePrelevement = date_prelevement || now;
    const targetPreleveurId = preleve_par_id || user.id;
    const targetStatus = statut || 'PRELEVEMENT_EFFECTUE';

    await transaction(async () => {
      await execute(
        `UPDATE demandes_laboratoire SET
          date_prelevement = ?,
          preleve_par_id = ?,
          statut = ?,
          updated_at = ?
         WHERE id = ?`,
        [targetDatePrelevement, targetPreleveurId, targetStatus, now, id]
      );

      await execute(
        `UPDATE analyses_laboratoire SET
          statut = ?,
          updated_at = ?
         WHERE demande_laboratoire_id = ? AND statut IN ('DEMANDE_CREEE', 'PRISE_EN_CHARGE')`,
        [targetStatus, now, id]
      );
    });

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_ORDER_UPDATED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Prélèvement biologique enregistré pour la demande ${existing.numero_demande || id} par ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const updated = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    res.json({
      message: 'Prélèvement enregistré avec succès.',
      lab_order: {
        ...updated,
        analyses
      }
    });
  } catch (error: any) {
    console.error('Erreur enregistrement prélèvement:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'enregistrement du prélèvement.' });
  }
}

/**
 * Enregistrer ou modifier les résultats d'analyses (brouillon ou intermédiaire)
 * POST /api/laboratory/orders/:id/results
 * Rôle strict : LABORATOIRE
 */
export async function saveLabResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Accès strictement réservé au personnel du laboratoire (LABORATOIRE).' });
      return;
    }

    const { id } = req.params;
    const {
      results,
      conclusion_globale,
      remarques_techniques,
      document_url,
      document_nom,
      statut
    } = req.body;
    const now = new Date().toISOString();

    const existing = await queryOne<any>(
      `SELECT * FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (existing.statut === 'ANNULEE') {
      res.status(400).json({ error: 'Cette demande de laboratoire a été annulée.' });
      return;
    }

    // Protection anti-modification silencieuse après validation définitive
    if (['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(existing.statut)) {
      res.status(400).json({
        error: 'Cette demande a déjà été validée. Toute rectification de résultats validés doit obligatoirement faire l’objet d’un amendement officiel motivé.'
      });
      return;
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      res.status(400).json({ error: 'La liste des résultats des analyses est obligatoire.' });
      return;
    }

    const targetStatut = statut && VALID_LAB_STATUSES.includes(statut) ? statut : 'RESULTATS_SAISIS';

    await transaction(async () => {
      // 1. Mettre à jour chaque analyse individuelle
      for (const resItem of results) {
        if (!resItem.id) continue;

        let detailsString: string | null = null;
        if (resItem.resultats_detailles !== undefined && resItem.resultats_detailles !== null) {
          detailsString = typeof resItem.resultats_detailles === 'string'
            ? resItem.resultats_detailles
            : JSON.stringify(resItem.resultats_detailles);
        }

        await execute(
          `UPDATE analyses_laboratoire SET
            valeur_mesuree = ?,
            unite = ?,
            valeurs_reference = ?,
            interpretation = ?,
            resultats_detailles = COALESCE(?, resultats_detailles),
            observation = ?,
            commentaire_technique = ?,
            technicien_id = ?,
            date_analyse = ?,
            statut = ?,
            updated_at = ?
           WHERE id = ? AND demande_laboratoire_id = ?`,
          [
            resItem.valeur_mesuree?.trim() || null,
            resItem.unite?.trim() || null,
            resItem.valeurs_reference?.trim() || null,
            resItem.interpretation || null,
            detailsString,
            resItem.observation?.trim() || null,
            resItem.commentaire_technique?.trim() || null,
            user.id,
            now,
            targetStatut,
            now,
            resItem.id,
            id
          ]
        );
      }

      // 2. Mettre à jour la demande globale
      await execute(
        `UPDATE demandes_laboratoire SET
          statut = ?,
          result_entered_by = COALESCE(result_entered_by, ?),
          result_entered_at = COALESCE(result_entered_at, ?),
          conclusion_globale = COALESCE(?, conclusion_globale),
          remarques_techniques = COALESCE(?, remarques_techniques),
          document_url = COALESCE(?, document_url),
          document_nom = COALESCE(?, document_nom),
          updated_at = ?
         WHERE id = ?`,
        [
          targetStatut,
          user.id,
          now,
          conclusion_globale !== undefined ? (conclusion_globale?.trim() || null) : existing.conclusion_globale,
          remarques_techniques !== undefined ? (remarques_techniques?.trim() || null) : existing.remarques_techniques,
          document_url !== undefined ? (document_url?.trim() || null) : existing.document_url,
          document_nom !== undefined ? (document_nom?.trim() || null) : existing.document_nom,
          now,
          id
        ]
      );
    });

    const isUpdate = !!existing.result_entered_at;
    const auditAction = isUpdate ? 'LAB_RESULT_UPDATED' : 'LAB_RESULT_CREATED';

    await auditLogger.log({
      userId: user.id,
      action: auditAction,
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Enregistrement des résultats (${results.length} analyses) de la demande ${existing.numero_demande || id} par ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const updated = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    res.json({
      message: 'Résultats enregistrés avec succès.',
      lab_order: {
        ...updated,
        analyses
      }
    });
  } catch (error: any) {
    console.error('Erreur enregistrement résultats laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'enregistrement des résultats.' });
  }
}

/**
 * Validation définitive et transmission des résultats au médecin
 * POST /api/laboratory/orders/:id/validate
 * Rôle strict : LABORATOIRE
 */
export async function validateLabResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Accès strictement réservé au personnel habilité du laboratoire (LABORATOIRE).' });
      return;
    }

    const { id } = req.params;
    const { conclusion_globale, remarques_techniques } = req.body;
    const now = new Date().toISOString();

    const existing = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom, pat.numero_dossier
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       WHERE d.id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (existing.statut === 'ANNULEE') {
      res.status(400).json({ error: 'Cette demande de laboratoire a été annulée.' });
      return;
    }

    // Récupérer les analyses
    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ?`,
      [id]
    );

    if (analyses.length === 0) {
      res.status(400).json({ error: 'Aucune analyse n\'est associée à cette demande.' });
      return;
    }

    // Validation : Vérifier qu'au moins une valeur ou observation ou détail a été renseigné
    const hasValues = analyses.some((a) => (a.valeur_mesuree && a.valeur_mesuree.trim().length > 0) || (a.observation && a.observation.trim().length > 0) || a.resultats_detailles);
    if (!hasValues) {
      res.status(400).json({
        error: 'Impossible de valider : aucun résultat biologique n\'a été saisi pour les examens demandés.'
      });
      return;
    }

    await transaction(async () => {
      // 1. Mettre à jour chaque analyse au statut RESULTATS_VALIDES
      await execute(
        `UPDATE analyses_laboratoire SET
          statut = 'RESULTATS_VALIDES',
          valide_par_id = ?,
          date_validation = ?,
          updated_at = ?
         WHERE demande_laboratoire_id = ?`,
        [user.id, now, now, id]
      );

      // 2. Mettre à jour la demande globale
      await execute(
        `UPDATE demandes_laboratoire SET
          statut = 'RESULTATS_VALIDES',
          validated_by = ?,
          validated_at = ?,
          result_entered_by = COALESCE(result_entered_by, ?),
          result_entered_at = COALESCE(result_entered_at, ?),
          conclusion_globale = COALESCE(?, conclusion_globale),
          remarques_techniques = COALESCE(?, remarques_techniques),
          updated_at = ?
         WHERE id = ?`,
        [
          user.id,
          now,
          user.id,
          now,
          conclusion_globale?.trim() || null,
          remarques_techniques?.trim() || null,
          now,
          id
        ]
      );

      // 3. Création automatique de la notification destinée au médecin prescripteur
      const notifId = `notif-${crypto.randomUUID().substring(0, 12)}`;
      const patientFullName = `${existing.patient_nom} ${existing.patient_prenom}`;
      await execute(
        `INSERT INTO notifications (
          id, user_id, titre, message, type, patient_id, consultation_id, visite_id, lab_order_id, lu, created_at
        ) VALUES (?, ?, ?, ?, 'LAB_RESULTS_READY', ?, ?, ?, ?, 0, ?)`,
        [
          notifId,
          existing.medecin_id,
          'Résultats d\'analyses disponibles',
          `Les résultats d'analyses de laboratoire pour le patient ${patientFullName} (Dossier ${existing.numero_dossier}) sont validés et disponibles.`,
          existing.patient_id,
          existing.consultation_id,
          existing.visite_id,
          existing.id,
          now
        ]
      );
    });

    // 4. Audit logs certifiés
    await auditLogger.log({
      userId: user.id,
      action: 'LAB_RESULT_VALIDATED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Validation biologique des résultats de la demande ${existing.numero_demande || id} par ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_RESULT_SENT_TO_DOCTOR',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Résultats validés transmis automatiquement au Dr. ${existing.medecin_nom} pour la consultation ${existing.consultation_id}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const updated = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    const updatedAnalyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    res.json({
      message: 'Résultats validés avec succès et transmis au médecin prescripteur.',
      lab_order: {
        ...updated,
        analyses: updatedAnalyses
      }
    });
  } catch (error: any) {
    console.error('Erreur validation résultats laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de la validation des résultats.' });
  }
}

/**
 * Amendement / Rectification d'un résultat déjà validé
 * POST /api/laboratory/orders/:id/amend
 * Rôle strict : LABORATOIRE
 */
export async function amendLabResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || user.role !== 'LABORATOIRE') {
      res.status(403).json({ error: 'Accès strictement réservé au personnel du laboratoire (LABORATOIRE).' });
      return;
    }

    const { id } = req.params;
    const { motif, results, conclusion_globale, remarques_techniques } = req.body;
    const now = new Date().toISOString();

    if (!motif || typeof motif !== 'string' || motif.trim().length < 5) {
      res.status(400).json({
        error: 'Un motif explicite d’amendement d\'au moins 5 caractères est strictement obligatoire pour rectifier un résultat validé.'
      });
      return;
    }

    const existing = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom, pat.numero_dossier
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       WHERE d.id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (!['RESULTATS_VALIDES', 'RESULTAT_VALIDE'].includes(existing.statut)) {
      res.status(400).json({
        error: 'La procédure d’amendement ne s’applique qu’aux demandes dont les résultats ont déjà été validés.'
      });
      return;
    }

    // Récupérer l'état actuel pour archivage dans l'historique des amendements
    const previousAnalyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC`,
      [id]
    );

    const oldStateSnapshot = {
      conclusion_globale: existing.conclusion_globale,
      remarques_techniques: existing.remarques_techniques,
      analyses: previousAnalyses
    };

    const amendementId = `amd-${crypto.randomUUID().substring(0, 12)}`;

    await transaction(async () => {
      // 1. Mettre à jour les analyses si fournies
      if (results && Array.isArray(results)) {
        for (const resItem of results) {
          if (!resItem.id) continue;

          let detailsString: string | null = null;
          if (resItem.resultats_detailles !== undefined && resItem.resultats_detailles !== null) {
            detailsString = typeof resItem.resultats_detailles === 'string'
              ? resItem.resultats_detailles
              : JSON.stringify(resItem.resultats_detailles);
          }

          await execute(
            `UPDATE analyses_laboratoire SET
              valeur_mesuree = COALESCE(?, valeur_mesuree),
              unite = COALESCE(?, unite),
              valeurs_reference = COALESCE(?, valeurs_reference),
              interpretation = COALESCE(?, interpretation),
              resultats_detailles = COALESCE(?, resultats_detailles),
              observation = COALESCE(?, observation),
              commentaire_technique = COALESCE(?, commentaire_technique),
              valide_par_id = ?,
              date_validation = ?,
              updated_at = ?
             WHERE id = ? AND demande_laboratoire_id = ?`,
            [
              resItem.valeur_mesuree?.trim() || null,
              resItem.unite?.trim() || null,
              resItem.valeurs_reference?.trim() || null,
              resItem.interpretation || null,
              detailsString,
              resItem.observation?.trim() || null,
              resItem.commentaire_technique?.trim() || null,
              user.id,
              now,
              now,
              resItem.id,
              id
            ]
          );
        }
      }

      // 2. Mettre à jour la demande
      await execute(
        `UPDATE demandes_laboratoire SET
          amendement_motif = ?,
          conclusion_globale = COALESCE(?, conclusion_globale),
          remarques_techniques = COALESCE(?, remarques_techniques),
          updated_at = ?
         WHERE id = ?`,
        [
          motif.trim(),
          conclusion_globale !== undefined ? (conclusion_globale?.trim() || null) : existing.conclusion_globale,
          remarques_techniques !== undefined ? (remarques_techniques?.trim() || null) : existing.remarques_techniques,
          now,
          id
        ]
      );

      // Récupérer le nouvel état après modifications
      const newAnalyses = await query<any>(
        `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC`,
        [id]
      );

      const newStateSnapshot = {
        conclusion_globale: conclusion_globale !== undefined ? conclusion_globale : existing.conclusion_globale,
        remarques_techniques: remarques_techniques !== undefined ? remarques_techniques : existing.remarques_techniques,
        analyses: newAnalyses
      };

      // 3. Enregistrer l'amendement dans la table d'audit
      await execute(
        `INSERT INTO amendements_analyses_laboratoire (
          id, demande_laboratoire_id, ancien_resultat, nouveau_resultat, motif, amende_par_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          amendementId,
          id,
          JSON.stringify(oldStateSnapshot),
          JSON.stringify(newStateSnapshot),
          motif.trim(),
          user.id,
          now
        ]
      );

      // 4. Notifier le médecin prescripteur de la rectification
      const notifId = `notif-${crypto.randomUUID().substring(0, 12)}`;
      const patientFullName = `${existing.patient_nom} ${existing.patient_prenom}`;
      await execute(
        `INSERT INTO notifications (
          id, user_id, titre, message, type, patient_id, consultation_id, visite_id, lab_order_id, lu, created_at
        ) VALUES (?, ?, ?, ?, 'LAB_RESULTS_READY', ?, ?, ?, ?, 0, ?)`,
        [
          notifId,
          existing.medecin_id,
          'Résultats de laboratoire rectifiés (Amendement)',
          `Un amendement a été apporté aux résultats du patient ${patientFullName} (Dossier ${existing.numero_dossier}). Motif: "${motif.trim()}".`,
          existing.patient_id,
          existing.consultation_id,
          existing.visite_id,
          existing.id,
          now
        ]
      );
    });

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_RESULT_AMENDED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Amendement des résultats de la demande ${existing.numero_demande || id} par ${user.nom_complet}. Motif: "${motif.trim()}"`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const updated = await queryOne<any>(
      `SELECT d.*, u.nom_complet as medecin_nom, pat.nom as patient_nom, pat.prenom as patient_prenom,
              pat.numero_dossier, v.numero_visite,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    const updatedAnalyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    const amendements = await query<any>(
      `SELECT a.*, u.nom_complet as amende_par_nom
       FROM amendements_analyses_laboratoire a
       LEFT JOIN users u ON a.amende_par_id = u.id
       WHERE a.demande_laboratoire_id = ?
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      message: 'Amendement validé avec succès. Les résultats rectifiés ont été enregistrés.',
      lab_order: {
        ...updated,
        analyses: updatedAnalyses,
        amendements
      }
    });
  } catch (error: any) {
    console.error('Erreur amendement laboratoire:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'amendement des résultats.' });
  }
}

/**
 * Obtenir le bulletin officiel d'analyses biologiques format Clinique Les Archanges
 * GET /api/medical/lab-orders/:id/bulletin
 * Rôles : MÉDECIN, LABORATOIRE, ADMINISTRATEUR
 */
export async function getLabBulletin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'LABORATOIRE', 'ADMINISTRATEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical et au laboratoire.' });
      return;
    }

    const { id } = req.params;

    const order = await queryOne<any>(
      `SELECT d.*,
              u.nom_complet as medecin_nom,
              pat.nom as patient_nom, pat.prenom as patient_prenom, pat.numero_dossier,
              pat.date_naissance as patient_date_naissance, pat.sexe as patient_sexe,
              pat.telephone as patient_telephone, pat.adresse as patient_adresse,
              pat.groupe_sanguin as patient_groupe_sanguin,
              v.numero_visite, v.date_arrivee as visite_date_arrivee,
              u_lab.nom_complet as laborantin_nom,
              u_val.nom_complet as validated_by_nom,
              u_ent.nom_complet as result_entered_by_nom,
              u_prl.nom_complet as preleve_par_nom
       FROM demandes_laboratoire d
       JOIN users u ON d.medecin_id = u.id
       JOIN patients pat ON d.patient_id = pat.id
       JOIN visites v ON d.visite_id = v.id
       LEFT JOIN users u_lab ON d.laborantin_id = u_lab.id
       LEFT JOIN users u_val ON d.validated_by = u_val.id
       LEFT JOIN users u_ent ON d.result_entered_by = u_ent.id
       LEFT JOIN users u_prl ON d.preleve_par_id = u_prl.id
       WHERE d.id = ?`,
      [id]
    );

    if (!order) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    // Contrôle d'accès médecin prescripteur
    if (user.role === 'MÉDECIN' && order.medecin_id !== user.id) {
      res.status(403).json({ error: 'Vous ne pouvez pas consulter le bulletin d’un confrère.' });
      return;
    }

    const analyses = await query<any>(
      `SELECT * FROM analyses_laboratoire WHERE demande_laboratoire_id = ? ORDER BY ordre ASC, created_at ASC`,
      [id]
    );

    const amendements = await query<any>(
      `SELECT a.*, u.nom_complet as amende_par_nom
       FROM amendements_analyses_laboratoire a
       LEFT JOIN users u ON a.amende_par_id = u.id
       WHERE a.demande_laboratoire_id = ?
       ORDER BY a.created_at ASC`,
      [id]
    );

    // Calcul de l'âge du patient
    let patient_age: number | null = null;
    if (order.patient_date_naissance) {
      const birth = new Date(order.patient_date_naissance);
      const refDate = new Date(order.date_prelevement || order.date_demande);
      let age = refDate.getFullYear() - birth.getFullYear();
      const m = refDate.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
        age--;
      }
      patient_age = age >= 0 ? age : 0;
    }

    await auditLogger.log({
      userId: user.id,
      action: 'LAB_RESULT_VIEWED',
      ressourceType: 'DEMANDE_LABORATOIRE',
      ressourceId: id,
      details: `Consultation du bulletin officiel d'analyses de la demande ${order.numero_demande || id} par ${user.nom_complet} (${user.role})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const bulletin = {
      clinique: {
        nom: 'Clinique Les Archanges',
        devise: 'Soins Médicaux de Qualité • Service Médical Polyvalent',
        adresse: "À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.",
        telephone: '+243 989 715 771',
        email: 'contact@lesarchanges.cd',
        horaires: 'Ouvert 24h/24 et 7j/7.',
        departement: 'DÉPARTEMENT DE BIOLOGIE MÉDICALE'
      },
      patient: {
        nom: order.patient_nom,
        prenom: order.patient_prenom,
        numero_dossier: order.numero_dossier,
        date_naissance: order.patient_date_naissance,
        age: patient_age,
        sexe: order.patient_sexe,
        telephone: order.patient_telephone,
        groupe_sanguin: order.patient_groupe_sanguin
      },
      prescripteur: {
        nom: order.medecin_nom,
        numero_visite: order.numero_visite,
        indication_clinique: order.indication_clinique
      },
      demande: {
        id: order.id,
        numero_demande: order.numero_demande,
        date_demande: order.date_demande,
        date_prelevement: order.date_prelevement,
        preleve_par_nom: order.preleve_par_nom,
        statut: order.statut,
        urgence: order.urgence,
        document_url: order.document_url,
        document_nom: order.document_nom
      },
      validation: {
        validated_by_nom: order.validated_by_nom,
        validated_at: order.validated_at,
        result_entered_by_nom: order.result_entered_by_nom,
        result_entered_at: order.result_entered_at,
        conclusion_globale: order.conclusion_globale,
        remarques_techniques: order.remarques_techniques
      },
      analyses,
      amendements
    };
  } catch (error: any) {
    console.error('Erreur bulletin analyses:', error);
    res.status(500).json({ error: 'Erreur interne lors de la génération du bulletin d\'analyses.' });
  }
}

/**
 * Marquer un résultat de laboratoire comme vu par le médecin
 * POST /api/medical/lab-orders/:id/mark-viewed
 * Rôle : MÉDECIN
 * Trouve la notification associée à ce bon de laboratoire et la marque comme lue
 */
export async function markLabOrderViewed(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;
    const doctorId = user.id;

    // Vérifier que le bon de laboratoire appartient à ce médecin
    const order = await queryOne<any>(
      `SELECT id, medecin_id FROM demandes_laboratoire WHERE id = ?`,
      [id]
    );

    if (!order) {
      res.status(404).json({ error: 'Demande de laboratoire introuvable.' });
      return;
    }

    if (order.medecin_id !== doctorId) {
      res.status(403).json({ error: 'Cette demande de laboratoire ne vous appartient pas.' });
      return;
    }

    const now = new Date().toISOString();

    // Mettre à jour le champ vu_par_medecin_le sur le bon de laboratoire
    await execute(
      `UPDATE demandes_laboratoire SET vu_par_medecin_le = ? WHERE id = ?`,
      [now, id]
    );

    // Trouver la notification associée à ce bon de laboratoire pour ce médecin
    const notification = await queryOne<any>(
      `SELECT id FROM notifications 
       WHERE lab_order_id = ? AND user_id = ? AND type = 'LAB_RESULTS_READY' AND lu = 0`,
      [id, doctorId]
    );

    if (notification) {
      await execute(
        `UPDATE notifications SET lu = 1, lu_le = ? WHERE id = ?`,
        [now, notification.id]
      );
    }

    await auditLogger.log({
      userId: doctorId,
      action: 'LAB_RESULT_MARKED_VIEWED',
      ressourceType: 'LAB_ORDER',
      ressourceId: id,
      details: `Résultat de laboratoire marqué comme vu par Dr. ${user.nom_complet}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ 
      success: true, 
      message: 'Résultat marqué comme vu.',
      notification_marked: !!notification
    });
  } catch (error: any) {
    console.error('Erreur marquage résultat comme vu:', error);
    res.status(500).json({ error: 'Erreur interne lors du marquage du résultat comme vu.' });
  }
}

/**
 * Récupérer les notifications de l'utilisateur connecté
 * GET /api/notifications
 */
export async function getUserNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const nowIso = new Date().toISOString();

// Règle métier stricte : si un bon de laboratoire est déjà payé à la caisse,
    // on l'enève des notifications non lues / alertes en le marquant lu = 1.
    // Filtre user_id pour ne toucher que les notifications de l'utilisateur connecté.
    await execute(
      `UPDATE notifications
        SET lu = 1, lu_le = COALESCE(lu_le, ?)
        WHERE user_id = ? AND lu = 0 AND type = 'LAB_RESULTS_READY' AND lab_order_id IN (
          SELECT d.id FROM demandes_laboratoire d
          JOIN factures f ON d.facture_id = f.id
          WHERE f.statut = 'PAYÉ'
        )`,
      [nowIso, user.id]
    );

    const notifications = await query<any>(
      `SELECT n.*,
              COALESCE(n.emetteur_nom, u_em.nom_complet) as emetteur_nom,
              COALESCE(n.emetteur_role, u_em.role) as emetteur_role,
              p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier,
              d.facture_id as lab_facture_id,
              f.statut as lab_facture_statut,
              f.numero_facture as lab_numero_facture
       FROM notifications n
       LEFT JOIN users u_em ON n.emetteur_id = u_em.id
       LEFT JOIN patients p ON n.patient_id = p.id
       LEFT JOIN demandes_laboratoire d ON n.lab_order_id = d.id
       LEFT JOIN factures f ON d.facture_id = f.id
       WHERE n.user_id = ? AND n.type IN ('APPOINTMENT', 'LAB_RESULTS_READY', 'CONSULTATION_WAITING')
       ORDER BY n.created_at DESC LIMIT 50`,
      [user.id]
    );

    const unreadCountRow = await queryOne<any>(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND lu = 0 AND type IN ('APPOINTMENT', 'LAB_RESULTS_READY', 'CONSULTATION_WAITING')`,
      [user.id]
    );

    // Compter les bulletins labo disponibles pour ce médecin (statut validé)
    const bulletinsRow = await queryOne<any>(
      `SELECT COUNT(*) as bulletins_count FROM demandes_laboratoire d
       WHERE d.medecin_id = ? AND d.statut IN ('RESULTATS_VALIDES', 'RESULTAT_VALIDE')`,
      [user.id]
    );

    res.json({
      notifications: notifications.map(n => ({
        ...n,
        est_lu: Boolean(n.lu),
        lu: Number(n.lu),
        is_lab_paid: n.lab_facture_statut === 'PAYÉ'
      })),
      unread_count: unreadCountRow ? Number(unreadCountRow.unread_count) : 0,
      bulletins_count: bulletinsRow ? Number(bulletinsRow.bulletins_count) : 0,
      total_count: (unreadCountRow ? Number(unreadCountRow.unread_count) : 0) + (bulletinsRow ? Number(bulletinsRow.bulletins_count) : 0)
    });
  } catch (error: any) {
    console.error('Erreur notifications utilisateur:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des notifications.' });
  }
}

/**
 * Émettre une notification (Médecin -> Réception ou Réception -> Médecin)
 * POST /api/notifications
 */
export async function sendNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const { 
      destinataire_id, 
      destinataire_role, 
      titre, 
      message, 
      type, 
      patient_id, 
      visite_id 
    } = req.body;

    if (!titre || typeof titre !== 'string' || titre.trim().length === 0) {
      res.status(400).json({ error: 'Le titre de la notification est requis.' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Le message de la notification est requis.' });
      return;
    }

    // Confidentialité stricte : Interdiction d'exposer des données médicales confidentielles à la réception
    const isSenderDoctor = isDoctorRole(user);
    const isTargetReception = (destinataire_role && ['RÉCEPTION', 'RECEPTION'].includes(String(destinataire_role).toUpperCase()));

    // Déterminer les destinataires
    let targetUsers: { id: string; nom_complet: string; role: string }[] = [];

    if (destinataire_id) {
      const target = await queryOne<{ id: string; nom_complet: string; role: string; actif: number }>(
        'SELECT id, nom_complet, role, actif FROM users WHERE id = ?',
        [destinataire_id]
      );
      if (target && target.actif) {
        targetUsers.push(target);
      }
    } else if (destinataire_role) {
      const roleUpper = String(destinataire_role).toUpperCase();
      if (roleUpper === 'RÉCEPTION' || roleUpper === 'RECEPTION') {
        targetUsers = await query<{ id: string; nom_complet: string; role: string }>(
          `SELECT u.id, u.nom_complet, u.role 
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE (u.role IN ('RÉCEPTION', 'RECEPTION') OR r.categorie = 'RÉCEPTION') AND u.actif = 1`
        );
      } else if (roleUpper === 'MÉDECIN' || roleUpper === 'MEDECIN') {
        targetUsers = await query<{ id: string; nom_complet: string; role: string }>(
          `SELECT u.id, u.nom_complet, u.role 
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE (u.role IN ('MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR') 
                  OR r.categorie IN ('MÉDECIN', 'DIRECTEUR')) AND u.actif = 1`
        );
      } else {
        targetUsers = await query<{ id: string; nom_complet: string; role: string }>(
          'SELECT id, nom_complet, role FROM users WHERE role = ? AND actif = 1',
          [destinataire_role]
        );
      }
    }

    if (targetUsers.length === 0) {
      res.status(400).json({ error: 'Aucun destinataire actif trouvé pour cette notification.' });
      return;
    }

    const notifType = type || (isSenderDoctor ? 'COMMUNICATION_MEDECIN_RECEPTION' : 'COMMUNICATION_RECEPTION_MEDECIN');
    const now = new Date().toISOString();
    const createdNotifications: any[] = [];

    for (const recipient of targetUsers) {
      const notifId = `notif-${crypto.randomUUID().substring(0, 12)}`;
      await execute(
        `INSERT INTO notifications (
          id, user_id, emetteur_id, emetteur_nom, emetteur_role, destinataire_role,
          titre, message, type, patient_id, visite_id, lu, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          notifId,
          recipient.id,
          user.id,
          user.nom_complet,
          user.role,
          destinataire_role || recipient.role,
          titre.trim(),
          message.trim(),
          notifType,
          patient_id || null,
          visite_id || null,
          now
        ]
      );
      createdNotifications.push({ id: notifId, recipient_id: recipient.id });
    }

    // Mirroring dans signaux_reception pour synchronisation
    try {
      const signalId = `sig-${crypto.randomUUID().substring(0, 12)}`;
      await execute(
        `INSERT INTO signaux_reception (
          id, medecin_id, visite_id, patient_id, type_signal, message, statut, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?)`,
        [
          signalId,
          isSenderDoctor ? user.id : (destinataire_id || targetUsers[0]?.id || user.id),
          visite_id || null,
          patient_id || null,
          notifType,
          `[${titre.trim()}] ${message.trim()}`,
          now
        ]
      );
    } catch {}

    // Audit log
    await auditLogger.log({
      userId: user.id,
      action: 'NOTIFICATION_SENT',
      ressourceType: 'COMMUNICATION',
      ressourceId: createdNotifications[0]?.id || 'notif',
      details: `Notification "${titre.trim()}" envoyée par ${user.nom_complet} (${user.role}) vers ${targetUsers.length} destinataire(s)`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      message: `Notification envoyée avec succès à ${targetUsers.length} destinataire(s).`,
      count: targetUsers.length,
      notifications: createdNotifications
    });
  } catch (error: any) {
    console.error('Erreur envoi notification:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'envoi de la notification.' });
  }
}

/**
 * Marquer une notification comme lue
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const { id } = req.params;
    const now = new Date().toISOString();
    await execute(
      `UPDATE notifications SET lu = 1, lu_le = ? WHERE id = ? AND user_id = ? AND type IN ('APPOINTMENT', 'LAB_RESULTS_READY', 'CONSULTATION_WAITING')`,
      [now, id, user.id]
    );

    res.json({ success: true, message: 'Notification marquée comme lue.' });
  } catch (error: any) {
    console.error('Erreur lecture notification:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour de la notification.' });
  }
}

/**
 * Marquer toutes les notifications de l'utilisateur comme lues
 * PATCH /api/notifications/read-all
 */
export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const now = new Date().toISOString();
    await execute(
      `UPDATE notifications SET lu = 1, lu_le = ? WHERE user_id = ? AND lu = 0 AND type IN ('APPOINTMENT', 'LAB_RESULTS_READY', 'CONSULTATION_WAITING')`,
      [now, user.id]
    );

    res.json({ success: true, message: 'Toutes les notifications ont été marquées comme lues.' });
  } catch (error: any) {
    console.error('Erreur lecture toutes notifications:', error);
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour des notifications.' });
  }
}



/**
 * Créer une orientation (externe ou interne)
 * POST /api/medical/orientations
 * Strictement réservé au rôle MÉDECIN.
 * L'orientation est liée à la consultation en cours.
 * type_orientation : 'EXTERNE' ou 'INTERNE'
 */
export async function createOrientation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const {
      consultation_id,
      patient_id,
      visite_id,
      type_orientation,
      specialite,
      etablissement_destinataire,
      praticien_destinataire,
      medecin_destinataire_id,
      motif_orientation,
      donnees_cliniques,
      niveau_urgence
    } = req.body;

    // Validation du type d'orientation
    const orientationType = type_orientation === 'INTERNE' ? 'INTERNE' : 'EXTERNE';
    if (orientationType !== 'EXTERNE' && orientationType !== 'INTERNE') {
      res.status(400).json({ error: 'Le type d\'orientation doit être EXTERNE ou INTERNE.' });
      return;
    }

    // Validation des champs obligatoires communs
    if (!consultation_id || typeof consultation_id !== 'string') {
      res.status(400).json({ error: 'L\'identifiant de consultation (consultation_id) est obligatoire.' });
      return;
    }
    if (!specialite || typeof specialite !== 'string' || specialite.trim().length < 2) {
      res.status(400).json({ error: 'La spécialité est obligatoire (min. 2 caractères).' });
      return;
    }
    if (!motif_orientation || typeof motif_orientation !== 'string' || motif_orientation.trim().length < 5) {
      res.status(400).json({ error: 'Le motif de l\'orientation est obligatoire (min. 5 caractères).' });
      return;
    }
    const validUrgence = ['ROUTINE', 'URGENT', 'TRES_URGENT'].includes(niveau_urgence) ? niveau_urgence : 'ROUTINE';

    // 1. Vérifier que la consultation existe
    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [consultation_id]
    );
    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }

    // 2. Vérifier que la consultation appartient bien au médecin connecté
    if (consultation.medecin_id !== user.id) {
      await auditLogger.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        ressourceType: 'ORIENTATION_SPECIALISTE',
        ressourceId: consultation_id,
        details: `Dr. ${user.nom_complet} a tenté de créer une orientation pour une consultation d\'un confrère`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.status(403).json({ error: 'Vous ne pouvez pas créer d\'orientation pour la consultation d\'un confrère.' });
      return;
    }

    // 3. Cohérence patient & visite
    if (patient_id && consultation.patient_id !== patient_id) {
      res.status(400).json({ error: 'Incohérence entre le patient indiqué et la consultation.' });
      return;
    }
    if (visite_id && consultation.visite_id !== visite_id) {
      res.status(400).json({ error: 'Incohérence entre la visite indiquée et la consultation.' });
      return;
    }

    // 4. Consultation finalisée : refuser
    if (consultation.statut === 'FINALISEE') {
      res.status(409).json({
        error: "Cette consultation est finalisée. Un motif explicite d'amendement est requis pour ajouter une orientation."
      });
      return;
    }

    // 5. Validation spécifique selon le type
    if (orientationType === 'INTERNE') {
      if (!medecin_destinataire_id || typeof medecin_destinataire_id !== 'string') {
        res.status(400).json({ error: 'Le médecin destinataire (medecin_destinataire_id) est obligatoire pour une orientation interne.' });
        return;
      }
      // Vérifier que le médecin destinataire existe et est actif
      const destinataire = await queryOne<any>(
        `SELECT id, nom_complet, role FROM users WHERE id = ? AND actif = 1`,
        [medecin_destinataire_id]
      );
      if (!destinataire) {
        res.status(400).json({ error: 'Le médecin destinataire n\'existe pas ou n\'est pas actif.' });
        return;
      }
      // Le destinataire ne peut pas être le même que le créateur
      if (destinataire.id === user.id) {
        res.status(400).json({ error: 'Vous ne pouvez pas vous orienter vous-même.' });
        return;
      }
    } else {
      // ORIENTATION EXTERNE
      if (!etablissement_destinataire || typeof etablissement_destinataire !== 'string' || etablissement_destinataire.trim().length < 2) {
        res.status(400).json({ error: 'L\'établissement / hôpital destinataire est obligatoire pour une orientation externe (min. 2 caractères).' });
        return;
      }
    }

    const now = new Date().toISOString();
    const id = `orient_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const numero_orientation = `OR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Déterminer les valeurs selon le type
    const destEtablissement = orientationType === 'INTERNE' ? 'Interne — ' + (await queryOne<any>(`SELECT nom_complet FROM users WHERE id = ?`, [medecin_destinataire_id]))?.nom_complet : etablissement_destinataire;
    const destPraticien = orientationType === 'INTERNE' ? (await queryOne<any>(`SELECT nom_complet FROM users WHERE id = ?`, [medecin_destinataire_id]))?.nom_complet : praticien_destinataire;

    await execute(
      `INSERT INTO orientations_specialistes (
        id, numero_orientation, consultation_id, visite_id, patient_id, medecin_id,
        specialite, etablissement_destinataire, praticien_destinataire, motif_orientation,
        donnees_cliniques, niveau_urgence, statut, date_orientation, type_orientation, medecin_destinataire_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENVOYE', ?, ?)`,
      [
        id,
        numero_orientation,
        consultation_id,
        consultation.visite_id || null,
        consultation.patient_id,
        user.id,
        specialite.trim(),
        destEtablissement || '',
        destPraticien || null,
        motif_orientation.trim(),
        donnees_cliniques ? donnees_cliniques.trim() : null,
        validUrgence,
        now,
        orientationType,
        orientationType === 'INTERNE' ? medecin_destinataire_id : null
      ]
    );

    // Récupérer l'orientation créée
    const created = await queryOne<any>(
      `SELECT * FROM orientations_specialistes WHERE id = ?`,
      [id]
    );

    await auditLogger.log({
      userId: user.id,
      action: 'ORIENTATION_SPECIALISTE_CREATE',
      ressourceType: 'ORIENTATION_SPECIALISTE',
      ressourceId: id,
      details: `Orientation ${orientationType} vers ${specialite.trim()} (${destEtablissement}) — Niveau: ${validUrgence}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({ success: true, orientation: created });
  } catch (error: any) {
    console.error('Erreur création orientation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de l\'orientation.' });
  }
}

/**
 * Recherche de rapports de médecin (Phase 2C-3)
 * GET /api/medical/reports/search
 * Strictement réservé au rôle MÉDECIN.
 */
export async function searchDoctorReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { q, patient_id, date_debut, date_fin, statut, nom_patient, numero_dossier } = req.query;
    const conditions: string[] = ['c.medecin_id = ?'];
    const params: any[] = [user.id];

    if (patient_id) {
      conditions.push('c.patient_id = ?');
      params.push(patient_id);
    }
    if (nom_patient && typeof nom_patient === 'string' && nom_patient.trim().length >= 2) {
      conditions.push('(p.nom LIKE ? OR p.prenom LIKE ?)');
      const like = `%${nom_patient.trim()}%`;
      params.push(like, like);
    }
    if (numero_dossier && typeof numero_dossier === 'string' && numero_dossier.trim().length >= 2) {
      conditions.push('p.numero_dossier LIKE ?');
      params.push(`%${numero_dossier.trim()}%`);
    }
    if (date_debut) {
      conditions.push('date(c.date_consultation) >= ?');
      params.push(date_debut);
    }
    if (date_fin) {
      conditions.push('date(c.date_consultation) <= ?');
      params.push(date_fin);
    }
    if (statut) {
      conditions.push('c.statut = ?');
      params.push(statut);
    }
    if (q && typeof q === 'string' && q.trim().length >= 2) {
      conditions.push('(c.diagnostic_principal LIKE ? OR c.motif_consultation LIKE ? OR c.conduite_a_tenir LIKE ?)');
      const like = `%${q.trim()}%`;
      params.push(like, like, like);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await query<any>(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation,
              c.motif_consultation, c.diagnostic_principal, c.statut, c.finalisee_le,
              v.numero_visite, v.date_arrivee,
              p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN patients p ON c.patient_id = p.id
       ${where}
       AND c.actif = 1
       ORDER BY c.date_consultation DESC
       LIMIT 200`,
      params
    );

    res.json({ reports: rows, total: rows.length });
  } catch (error: any) {
    console.error('Erreur recherche rapports médecin:', error);
    res.status(500).json({ error: 'Erreur interne lors de la recherche de rapports.' });
  }
}

/**
 * Récupère les orientations spécialistes liées à une consultation
 * GET /api/medical/consultations/:id/orientations
 * Strictement réservé au rôle MÉDECIN.
 */
export async function getConsultationOrientations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const { id } = req.params;

    // Vérifier que la consultation appartient au médecin
    const consultation = await queryOne<any>(
      `SELECT * FROM consultations WHERE id = ? AND actif = 1`,
      [id]
    );
    if (!consultation) {
      res.status(404).json({ error: 'Consultation introuvable.' });
      return;
    }
    if (consultation.medecin_id !== user.id) {
      res.status(403).json({ error: 'Vous ne pouvez pas consulter les orientations d\'un confrère.' });
      return;
    }

    const orientations = await query<any>(
      `SELECT * FROM orientations_specialistes
       WHERE consultation_id = ? AND actif = 1
       ORDER BY date_orientation DESC`,
      [id]
    );

    res.json({ orientations });
  } catch (error: any) {
    console.error('Erreur lecture orientations consultation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des orientations.' });
  }
}

/**
 * Récupère les orientations en attente pour le médecin connecté
 * GET /api/medical/orientations/pending
 * Strictement réservé au rôle MÉDECIN.
 */
export async function getPendingOrientations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !isDoctorRole(user)) {
      res.status(403).json({ error: 'Accès strictement réservé au corps médical (MÉDECIN).' });
      return;
    }

    const orientations = await query<any>(
      `SELECT o.*, c.id as consultation_id, c.motif_consultation,
              p.nom as patient_nom, p.prenom as patient_prenom, p.numero_dossier
       FROM orientations_specialistes o
       INNER JOIN consultations c ON o.consultation_id = c.id
       INNER JOIN patients p ON c.patient_id = p.id
       WHERE o.medecin_destinataire_id = ? AND o.statut = 'ENVOYE' 
       ORDER BY o.date_orientation DESC`,
      [user.id]
    );

    res.json({ orientations });
  } catch (error: any) {
    console.error('Erreur lecture orientations en attente:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération des orientations en attente.' });
  }
}

/**
 * Récupère tous les examens actifs du catalogue laboratoire
 * GET /api/lab/catalogue/exams
 * Rôles autorisés : MÉDECIN, LABORATOIRE, ADMINISTRATEUR
 */
export async function getCatalogueExams(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user || !['MÉDECIN', 'MEDECIN', 'LABORATOIRE', 'ADMINISTRATEUR', 'DIRECTEUR'].includes(user.role)) {
      res.status(403).json({ error: 'Accès interdit.' });
      return;
    }

    const exams = await query<any>(
      `SELECT id, nom, code, description, actif, ordre_affichage, prix_global_usd
       FROM examens_laboratoire
       WHERE actif = 1
       ORDER BY ordre_affichage ASC, nom ASC`
    );

    // Charge les paramètres pour chaque examen
    const examsWithParams = await Promise.all(
      exams.map(async (exam: any) => {
        const params = await query<any>(
          `SELECT id, nom, code, unite, type_resultat, obligatoire, ordre_affichage, actif, prix_usd
           FROM parametres_laboratoire
           WHERE examen_id = ? AND actif = 1
           ORDER BY ordre_affichage ASC`,
          [exam.id]
        );
        const paramsWithSubs = await Promise.all(
          params.map(async (param: any) => {
            const subs = await query<any>(
              `SELECT id, nom, code, unite, type_resultat, obligatoire, ordre_affichage, actif, prix_usd
               FROM sous_parametres_laboratoire
               WHERE parametre_id = ? AND actif = 1
               ORDER BY ordre_affichage ASC`,
              [param.id]
            );
            return { ...param, sous_parametres: subs };
          })
        );
        return { ...exam, parametres: paramsWithSubs };
      })
    );

    res.json({ exams: examsWithParams });
  } catch (error: any) {
    console.error('Erreur récupération catalogue examens:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération du catalogue.' });
  }
}

/**
 * Récupère les paramètres et sous-paramètres d'un examen du catalogue
 * GET /api/lab/catalogue/exams/:id/details
 * Rôles autorisés : MÉDECIN, LABORATOIRE
 */
export async function getCatalogueExamDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const exam = await queryOne<any>(
      `SELECT * FROM examens_laboratoire WHERE id = ? AND actif = 1`,
      [id]
    );
    if (!exam) {
      res.status(404).json({ error: 'Examen introuvable dans le catalogue.' });
      return;
    }

    const params = await query<any>(
      `SELECT * FROM parametres_laboratoire WHERE examen_id = ? AND actif = 1 ORDER BY ordre_affichage ASC`,
      [id]
    );

    const paramsWithSubs = await Promise.all(
      params.map(async (param: any) => {
        const subs = await query<any>(
          `SELECT * FROM sous_parametres_laboratoire WHERE parametre_id = ? AND actif = 1 ORDER BY ordre_affichage ASC`,
          [param.id]
        );
        return { ...param, sous_parametres: subs };
      })
    );

    res.json({ exam, parametres: paramsWithSubs });
  } catch (error: any) {
    console.error('Erreur récupération détails examen catalogue:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération du catalogue.' });
  }
}

