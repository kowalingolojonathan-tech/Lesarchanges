import { Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, transaction, saveDb } from '../db/database.js';
import { auditLogger } from '../utils/auditLogger.js';
import { validateAndComputeVitals, VitalsInput } from '../utils/vitalsCalculator.js';
import { AuthenticatedRequest, isDoctorRole } from '../middleware/auth.js';
import { createLinkedFactureCore, getFactureFinancialDetails, processPaiementDirectCore } from './billingController.js';

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
             v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
             p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
             p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, p.telephone as patient_telephone,
             u.nom_complet as medecin_nom,
             COALESCE(fp.statut_paiement, 'NON PAYÉ') as statut_paiement,
             sv.temperature, sv.tension_systolique, sv.tension_diastolique, sv.pouls, sv.spo2, 
             sv.frequence_respiratoire, sv.poids, sv.taille, sv.imc, sv.categorie_imc, sv.pam, sv.douleur,
             sv.surface_corporelle, sv.pression_pulsee, sv.alertes_constantes
      FROM visites v
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.medecin_id = u.id
      LEFT JOIN signes_vitaux sv ON sv.visite_id = v.id
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
              v.heure_orientation, v.heure_prise_en_charge, v.heure_debut_consultation, v.heure_fin_consultation,
              p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom, 
              p.date_naissance as patient_date_naissance, p.sexe as patient_sexe, 
              p.telephone as patient_telephone, p.allergies, p.antecedents, p.groupe_sanguin,
              u.nom_complet as medecin_nom,
              COALESCE(fp.statut_paiement, 'NON PAYÉ') as statut_paiement
       FROM visites v
       INNER JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.medecin_id = u.id
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
    const { 
      patient_id, 
      motif_venue, 
      type_visite,
      consultation_origine_id,
      elements_a_interpreter,
      medecin_id,
      rendez_vous_id,
      tarif_id,
      create_facture = true,
      reglement_immediat,
      type_encaissement = 'COMPLET',
      montant_paye,
      devise = 'USD',
      mode_paiement = 'ESPECES',
      reference_transaction,
      motif_non_paiement
    } = req.body;

    if (!patient_id) {
      res.status(400).json({ error: 'L\'identifiant du patient (patient_id) est obligatoire.' });
      return;
    }

    const patient = await queryOne('SELECT id, numero_dossier, nom, prenom FROM patients WHERE id = ? AND actif = 1', [patient_id]);
    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable ou inactif.' });
      return;
    }

    const validTypes = ['STANDARD', 'URGENCE', 'CONTROLE', 'INTERPRETATION_RESULTATS'];
    const chosenType = type_visite && validTypes.includes(type_visite) ? type_visite : 'STANDARD';

    const visiteId = 'vis_' + crypto.randomUUID();
    const numeroVisite = await generateUniqueNumeroVisite();
    const nowIso = new Date().toISOString();

    let assignedMedecinId: string | null = null;
    let heureOrientation: string | null = null;
    let statutInitial = 'ATTENTE_TRIAGE';

    if (medecin_id) {
      const medecin = await queryOne('SELECT id, nom_complet, role FROM users WHERE id = ? AND role = "MÉDECIN" AND actif = 1', [medecin_id]);
      if (medecin) {
        assignedMedecinId = medecin.id;
        statutInitial = 'ATTENTE_MEDECIN';
        heureOrientation = nowIso;
      }
    }

    const serializedElements = elements_a_interpreter
      ? (typeof elements_a_interpreter === 'string' ? elements_a_interpreter : JSON.stringify(elements_a_interpreter))
      : null;

    await execute(
      `INSERT INTO visites (
        id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite,
        consultation_origine_id, elements_a_interpreter, heure_orientation, actif, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        visiteId,
        numeroVisite,
        patient_id,
        assignedMedecinId,
        nowIso,
        statutInitial,
        motif_venue ? motif_venue.trim() : (chosenType === 'INTERPRETATION_RESULTATS' ? 'Interprétation des résultats' : 'Accueil et consultation générale'),
        chosenType,
        consultation_origine_id || null,
        serializedElements,
        heureOrientation,
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
        medecin_id: assignedMedecinId,
        consultation_origine_id,
      }),
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    });

    let linkedFacture: any = null;

    // Si la visite provient d'un rendez-vous
    if (rendez_vous_id) {
      // 1. Mettre à jour le rendez-vous pour le lier à cette visite et ce patient
      await execute(
        `UPDATE rendez_vous SET visite_id = ?, patient_id = COALESCE(patient_id, ?), statut = 'PATIENT PRÉSENT', updated_at = ? WHERE id = ?`,
        [visiteId, patient_id, nowIso, rendez_vous_id]
      );

      // 2. Vérifier si une facture d'avance existait déjà pour ce rendez-vous (protection anti-doublon absolue)
      const existingRdvFacture = await queryOne<any>(
        `SELECT id FROM factures WHERE rendez_vous_id = ? LIMIT 1`,
        [rendez_vous_id]
      );

      if (existingRdvFacture) {
        // Rattacher la facture d'avance existante à la nouvelle visite et au dossier permanent sans créer de doublon
        await execute(
          `UPDATE factures SET visite_id = ?, patient_id = COALESCE(patient_id, ?), updated_at = ? WHERE id = ?`,
          [visiteId, patient_id, nowIso, existingRdvFacture.id]
        );
        linkedFacture = await getFactureFinancialDetails(existingRdvFacture.id);
      }
    }

    // Si aucune facture existante n'a été rattachée depuis le RDV, et que la facturation est requise
    if (!linkedFacture && create_facture) {
      let tarif: any = null;
      if (tarif_id) {
        tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = ? AND actif = 1', [tarif_id]);
      }
      if (!tarif) {
        if (chosenType === 'URGENCE') {
          tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = "tar-vis-02" AND actif = 1') ||
                  await queryOne<any>('SELECT * FROM tarifs WHERE categorie = "TYPE_VISITE" AND nom LIKE "%Urgence%" AND actif = 1 LIMIT 1');
        } else if (chosenType === 'CONTROLE') {
          tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = "tar-vis-03" AND actif = 1') ||
                  await queryOne<any>('SELECT * FROM tarifs WHERE categorie = "TYPE_VISITE" AND nom LIKE "%Contrôle%" AND actif = 1 LIMIT 1');
        } else if (chosenType === 'INTERPRETATION_RESULTATS') {
          tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = "tar-csl-04" AND actif = 1') ||
                  await queryOne<any>('SELECT * FROM tarifs WHERE nom LIKE "%Interprétation%" AND actif = 1 LIMIT 1');
        } else {
          // Consultation générale par défaut
          tarif = await queryOne<any>('SELECT * FROM tarifs WHERE id = "tar-csl-01" AND actif = 1') ||
                  await queryOne<any>('SELECT * FROM tarifs WHERE categorie = "CONSULTATION" AND actif = 1 LIMIT 1');
        }
      }

      if (tarif) {
        const factureResult = await createLinkedFactureCore({
          patient_id,
          visite_id: visiteId,
          rendez_vous_id: rendez_vous_id || null,
          type_prestation: 'CONSULTATION',
          items: [{
            tarif_id: tarif.id,
            description: tarif.nom,
            categorie: tarif.categorie || 'CONSULTATION',
            quantite: 1,
            prix_unitaire: parseFloat(tarif.prix_usd) || 20
          }],
          emise_par_id: req.user?.id || 'usr-recep-01',
          notes: `Facture liée : ${motif_venue || tarif.nom}`,
          ip_address: req.ip || '127.0.0.1'
        });
        linkedFacture = factureResult.facture;
      }
    }

    let paiementInfo: any = null;

    // Encaissement direct immédiat par la Réception (faisant office de Caisse)
    if (reglement_immediat && linkedFacture) {
      const devisePaiement = (devise === 'CDF' || devise === 'FC') ? 'FC' : 'USD';

      if (linkedFacture.solde_usd !== undefined && linkedFacture.solde_usd <= 0.005) {
        paiementInfo = {
          deja_paye: true,
          statut: 'PAYÉ',
          message: 'Facture déjà intégralement réglée par anticipation lors de la réservation'
        };
      } else if (type_encaissement === 'COMPLET' || type_encaissement === 'PARTIEL') {
        const totalUsd = linkedFacture.solde_usd !== undefined ? linkedFacture.solde_usd : (linkedFacture.montant_total_usd || 20);
        let verser = parseFloat(String(montant_paye));
        if (isNaN(verser) || verser <= 0) {
          verser = devisePaiement === 'USD' ? totalUsd : Math.round(totalUsd * 2850);
        }

        try {
          const directPay = await processPaiementDirectCore({
            facture_id: linkedFacture.id,
            montant_paye: verser,
            devise: devisePaiement,
            mode_paiement,
            reference_transaction,
            notes: `Règlement direct perçu à l'accueil / caisse lors de la création de la visite`,
            encaisse_par_id: req.user?.id || 'usr-recep-01',
            ip_address: req.ip || '127.0.0.1'
          });
          paiementInfo = directPay.paiement;
          linkedFacture = directPay.facture;
        } catch (payErr: any) {
          console.error('Erreur encaissement direct visite:', payErr);
        }
      } else if (type_encaissement === 'NON_PAYE') {
        const derogStr = `[DÉROGATION ACCUEIL/CAISSE - Par ${req.user?.nom_complet || 'Réception'}] Motif non-règlement : ${motif_non_paiement?.trim() || 'Urgence vitale / Entente administrative'}`;
        await execute(
          `UPDATE factures SET notes = COALESCE(notes || ' | ', '') || ?, updated_at = ? WHERE id = ?`,
          [derogStr, nowIso, linkedFacture.id]
        );
        linkedFacture = await getFactureFinancialDetails(linkedFacture.id);
      }
    }

    saveDb();

    const createdVisite = await queryOne(
      `SELECT v.*, p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom,
              u.nom_complet as medecin_nom,
              COALESCE(?, 'NON PAYÉ') as statut_paiement
       FROM visites v 
       JOIN patients p ON v.patient_id = p.id 
       LEFT JOIN users u ON v.medecin_id = u.id
       WHERE v.id = ?`,
      [linkedFacture?.statut || 'NON PAYÉ', visiteId]
    );

    res.status(201).json({ 
      visite: createdVisite,
      facture: linkedFacture,
      paiement: paiementInfo,
      recu: paiementInfo?.numero_recu || null
    });
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
      `SELECT v.id, v.patient_id, v.statut, p.date_naissance, p.numero_dossier, p.sexe 
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
    const validation = validateAndComputeVitals(vitalsData, visite.date_naissance, visite.sexe);
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
          age_calcule, imc, categorie_imc, pam, surface_corporelle, pression_pulsee, alertes_constantes, date_prise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          calculated.surface_corporelle ?? null,
          calculated.pression_pulsee ?? null,
          calculated.alertes ? JSON.stringify(calculated.alertes) : null,
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
        surface_corporelle: calculated.surface_corporelle,
        pression_pulsee: calculated.pression_pulsee,
        alertes: calculated.alertes,
      }),
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
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
    const medecin = await queryOne<{ id: string; nom_complet: string; role: string; actif: number; role_categorie?: string }>(
      `SELECT u.id, u.nom_complet, u.role, u.actif, r.categorie as role_categorie 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.code
       WHERE u.id = ? AND u.actif = 1`,
      [medecin_id]
    );

    if (!medecin) {
      res.status(404).json({ error: 'Praticien introuvable ou compte inactif.' });
      return;
    }

    if (!isDoctorRole(medecin)) {
      res.status(400).json({ error: 'L\'utilisateur sélectionné ne possède pas de rôle médical autorisé.' });
      return;
    }

    const visite = await queryOne('SELECT id, numero_visite, statut FROM visites WHERE id = ? AND actif = 1', [id]);
    if (!visite) {
      res.status(404).json({ error: 'Visite introuvable.' });
      return;
    }

    const nowIso = new Date().toISOString();
    // Affectation du médecin et passage en ATTENTE_MEDECIN avec horodatage d'orientation
    await execute(
      `UPDATE visites SET medecin_id = ?, statut = 'ATTENTE_MEDECIN', heure_orientation = COALESCE(heure_orientation, ?) WHERE id = ?`,
      [medecin_id, nowIso, id]
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
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
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
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
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
      `SELECT u.id, u.username, u.nom_complet, u.role, u.fonction, COALESCE(r.nom, u.role) as role_nom 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.code
       WHERE (
         u.role IN ('MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR')
         OR r.categorie IN ('MÉDECIN', 'DIRECTEUR')
       ) AND u.actif = 1 
       ORDER BY u.nom_complet ASC`
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

/**
 * Récupère l'historique complet des constantes d'un patient
 * GET /api/patients/:id/vitals-history
 */
export async function getPatientVitalsHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const vitals = await query(
      `SELECT sv.*, v.numero_visite, v.date_arrivee, u.nom_complet as agent_nom
       FROM signes_vitaux sv
       JOIN visites v ON sv.visite_id = v.id
       LEFT JOIN users u ON sv.agent_id = u.id
       WHERE sv.patient_id = ?
       ORDER BY sv.date_prise DESC`,
      [id]
    );

    res.json({ vitals });
  } catch (error: any) {
    console.error('Erreur historique constantes patient:', error);
    res.status(500).json({ error: 'Erreur interne lors de la récupération de l\'historique des constantes' });
  }
}

/**
 * Recherche les dossiers médicaux / consultations antérieurs d'un patient
 * pour identification par la réception lors d'une visite d'interprétation des résultats.
 * SÉCURITÉ : Ne transmet aucun secret médical privé, uniquement métadonnées et examens.
 * GET /api/visites/patient/:id/interpretation-dossiers
 */
export async function getPatientDossiersForInterpretation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const patient = await queryOne<any>(
      `SELECT id, numero_dossier, nom, post_nom, prenom, date_naissance, sexe, telephone
       FROM patients WHERE id = ? AND actif = 1`,
      [id]
    );

    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable ou inactif.' });
      return;
    }

    const consultations = await query<any>(
      `SELECT c.id, c.visite_id, c.patient_id, c.medecin_id, c.date_consultation,
              c.motif_consultation, c.diagnostic_principal, c.statut, c.finalisee_le,
              u.nom_complet as medecin_nom,
              v.numero_visite, v.date_arrivee, v.type_visite
       FROM consultations c
       INNER JOIN visites v ON c.visite_id = v.id
       INNER JOIN users u ON c.medecin_id = u.id
       WHERE c.patient_id = ? AND c.actif = 1
       ORDER BY c.date_consultation DESC`,
      [id]
    );

    const dossiers = await Promise.all(
      consultations.map(async (c: any) => {
        const labOrders = await query<any>(
          `SELECT d.id, d.numero_demande, d.statut, d.urgence, d.date_prescription,
                  u.nom_complet as medecin_nom
           FROM demandes_laboratoire d
           JOIN users u ON d.medecin_id = u.id
           WHERE d.consultation_id = ?
           ORDER BY d.created_at DESC`,
          [c.id]
        );

        const labOrdersWithAnalyses = await Promise.all(
          labOrders.map(async (d: any) => {
            const analyses = await query<any>(
              `SELECT a.id, a.demande_laboratoire_id, a.nom_analyse, a.type_echantillon,
                      a.statut, a.valeur_resultat, a.unite, a.norme_min, a.norme_max,
                      a.est_anormal, a.validated_at
               FROM analyses_laboratoire a
               WHERE a.demande_laboratoire_id = ?
               ORDER BY a.ordre ASC, a.created_at ASC`,
              [d.id]
            );
            return { ...d, analyses };
          })
        );

        return {
          ...c,
          lab_orders: labOrdersWithAnalyses,
        };
      })
    );

    res.json({ patient, dossiers });
  } catch (error: any) {
    console.error('Erreur récupération dossiers pour interprétation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la recherche des dossiers.' });
  }
}

/**
 * Création d'une visite d'interprétation des résultats avec orientation vers le médecin
 * POST /api/visites/interpretation
 */
export async function createInterpretationVisite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      patient_id,
      consultation_origine_id,
      elements_a_interpreter,
      medecin_id,
      motif_venue,
      reglement_immediat,
      type_encaissement = 'COMPLET',
      montant_paye,
      devise = 'USD',
      mode_paiement = 'ESPECES',
      reference_transaction,
      motif_non_paiement
    } = req.body;

    if (!patient_id) {
      res.status(400).json({ error: 'L\'identifiant du patient est obligatoire.' });
      return;
    }

    const patient = await queryOne<any>(
      'SELECT id, numero_dossier, nom, prenom FROM patients WHERE id = ? AND actif = 1',
      [patient_id]
    );

    if (!patient) {
      res.status(404).json({ error: 'Patient introuvable ou inactif.' });
      return;
    }

    // Médecin d'orientation
    let targetMedecinId: string | null = null;
    let targetMedecinNom = '';
    if (medecin_id) {
      const medecin = await queryOne<any>(
        'SELECT id, nom_complet FROM users WHERE id = ? AND role = "MÉDECIN" AND actif = 1',
        [medecin_id]
      );
      if (medecin) {
        targetMedecinId = medecin.id;
        targetMedecinNom = medecin.nom_complet;
      }
    }

    const elementsStr = Array.isArray(elements_a_interpreter)
      ? elements_a_interpreter.join(', ')
      : (typeof elements_a_interpreter === 'string' ? elements_a_interpreter : '');

    const generatedMotif = motif_venue?.trim() || (
      elementsStr 
        ? `Interprétation des résultats : ${elementsStr}`
        : 'Interprétation des résultats d’analyses'
    );

    const serializedElements = elements_a_interpreter
      ? (typeof elements_a_interpreter === 'string' ? elements_a_interpreter : JSON.stringify(elements_a_interpreter))
      : null;

    const visiteId = 'vis_' + crypto.randomUUID();
    const numeroVisite = await generateUniqueNumeroVisite();
    const nowIso = new Date().toISOString();

    const statutInitial = targetMedecinId ? 'ATTENTE_MEDECIN' : 'ATTENTE_TRIAGE';
    const heureOrientation = targetMedecinId ? nowIso : null;

    await execute(
      `INSERT INTO visites (
        id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue,
        type_visite, consultation_origine_id, elements_a_interpreter, heure_orientation,
        actif, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INTERPRETATION_RESULTATS', ?, ?, ?, 1, ?)`,
      [
        visiteId,
        numeroVisite,
        patient_id,
        targetMedecinId,
        nowIso,
        statutInitial,
        generatedMotif,
        consultation_origine_id || null,
        serializedElements,
        heureOrientation,
        nowIso
      ]
    );

    await auditLogger.log({
      userId: req.user?.id || 'system',
      action: 'VISITE_INTERPRETATION_CREEE',
      ressourceType: 'VISITE',
      ressourceId: visiteId,
      details: JSON.stringify({
        numero_visite: numeroVisite,
        numero_dossier: patient.numero_dossier,
        patient_nom: `${patient.nom} ${patient.prenom}`,
        medecin_id: targetMedecinId,
        medecin_nom: targetMedecinNom,
        consultation_origine_id,
        elements: elements_a_interpreter
      }),
      ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1'
    });

    // Facture liée pour interprétation des résultats (tar-csl-04 ou 10 USD)
    const tarifInterpretation = await queryOne<any>('SELECT * FROM tarifs WHERE id = "tar-csl-04" AND actif = 1') ||
                               await queryOne<any>('SELECT * FROM tarifs WHERE nom LIKE "%Interprétation%" AND actif = 1 LIMIT 1') ||
                               { id: 'tar-csl-04', nom: 'Interprétation des résultats', categorie: 'CONSULTATION', prix_usd: 10 };

    const factureResult = await createLinkedFactureCore({
      patient_id,
      visite_id: visiteId,
      type_prestation: 'INTERPRETATION_RESULTATS',
      items: [{
        tarif_id: tarifInterpretation.id,
        description: tarifInterpretation.nom,
        categorie: tarifInterpretation.categorie || 'CONSULTATION',
        quantite: 1,
        prix_unitaire: parseFloat(tarifInterpretation.prix_usd) || 10
      }],
      emise_par_id: req.user?.id || 'usr-recep-01',
      notes: `Facture liée : Interprétation des résultats d'analyses`,
      ip_address: req.ip || '127.0.0.1'
    });

    let linkedFacture = factureResult.facture;
    let paiementInfo: any = null;

    // Encaissement direct immédiat par la Réception (faisant office de Caisse)
    if (reglement_immediat && linkedFacture) {
      const devisePaiement = (devise === 'CDF' || devise === 'FC') ? 'FC' : 'USD';

      if (type_encaissement === 'COMPLET' || type_encaissement === 'PARTIEL') {
        const totalUsd = linkedFacture.solde_usd !== undefined ? linkedFacture.solde_usd : (linkedFacture.montant_total_usd || 10);
        let verser = parseFloat(String(montant_paye));
        if (isNaN(verser) || verser <= 0) {
          verser = devisePaiement === 'USD' ? totalUsd : Math.round(totalUsd * 2850);
        }

        try {
          const directPay = await processPaiementDirectCore({
            facture_id: linkedFacture.id,
            montant_paye: verser,
            devise: devisePaiement,
            mode_paiement,
            reference_transaction,
            notes: `Règlement direct perçu à l'accueil / caisse pour visite d'interprétation`,
            encaisse_par_id: req.user?.id || 'usr-recep-01',
            ip_address: req.ip || '127.0.0.1'
          });
          paiementInfo = directPay.paiement;
          linkedFacture = directPay.facture;
        } catch (payErr: any) {
          console.error('Erreur encaissement direct interprétation:', payErr);
        }
      } else if (type_encaissement === 'NON_PAYE') {
        const derogStr = `[DÉROGATION ACCUEIL/CAISSE - Par ${req.user?.nom_complet || 'Réception'}] Motif non-règlement : ${motif_non_paiement?.trim() || 'Urgence vitale / Entente administrative'}`;
        await execute(
          `UPDATE factures SET notes = COALESCE(notes || ' | ', '') || ?, updated_at = ? WHERE id = ?`,
          [derogStr, nowIso, linkedFacture.id]
        );
        linkedFacture = await getFactureFinancialDetails(linkedFacture.id);
      }
    }

    saveDb();

    const createdVisite = await queryOne(
      `SELECT v.*, p.numero_dossier, p.nom as patient_nom, p.prenom as patient_prenom,
              u.nom_complet as medecin_nom,
              COALESCE(?, 'NON PAYÉ') as statut_paiement
       FROM visites v
       JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.medecin_id = u.id
       WHERE v.id = ?`,
      [linkedFacture?.statut || 'NON PAYÉ', visiteId]
    );

    res.status(201).json({
      success: true,
      visite: createdVisite,
      facture: linkedFacture,
      paiement: paiementInfo,
      recu: paiementInfo?.numero_recu || null,
      message: targetMedecinId 
        ? `Visite créée, encaissée et orientée vers le Dr. ${targetMedecinNom}.`
        : 'Visite d\'interprétation créée et encaissée avec succès.'
    });
  } catch (error: any) {
    console.error('Erreur création visite interprétation:', error);
    res.status(500).json({ error: 'Erreur interne lors de la création de la visite d\'interprétation.' });
  }
}
