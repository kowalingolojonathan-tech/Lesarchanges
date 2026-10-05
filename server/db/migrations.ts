import { getDb, saveDb } from './database.js';

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  // Active impérativement et séparément le support des clés étrangères
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    -- Table des Utilisateurs
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nom_complet TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMINISTRATEUR', 'RÉCEPTION', 'MÉDECIN', 'LABORATOIRE')),
      must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)),
      actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Table des Sessions sécurisées côté serveur
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Table de Traçabilité et d'Audit Log
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      ressource_type TEXT NOT NULL,
      ressource_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Table des Paramètres généraux de la clinique (Devises RDC: USD & CDF, tarifs, etc.)
    CREATE TABLE IF NOT EXISTS clinic_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
    );

    -- Table des Dossiers Patients (Dossier Unique Permanent)
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      numero_dossier TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      post_nom TEXT,
      prenom TEXT NOT NULL,
      date_naissance TEXT NOT NULL,
      sexe TEXT NOT NULL CHECK(sexe IN ('M', 'F')),
      lieu_naissance TEXT,
      pays_naissance TEXT DEFAULT 'RD Congo',
      profession TEXT,
      etat_civil TEXT,
      telephone TEXT NOT NULL,
      adresse TEXT,
      contact_urgence_nom TEXT,
      contact_urgence_telephone TEXT,
      groupe_sanguin TEXT,
      allergies TEXT,
      antecedents TEXT,
      actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Table des Visites (Épisodes de soins distincts rattachés au patient unique)
    CREATE TABLE IF NOT EXISTS visites (
      id TEXT PRIMARY KEY,
      numero_visite TEXT UNIQUE NOT NULL,
      patient_id TEXT NOT NULL,
      medecin_id TEXT,
      date_arrivee TEXT NOT NULL,
      statut TEXT NOT NULL CHECK(statut IN ('ATTENTE_TRIAGE', 'TRIAGE_TERMINE', 'ATTENTE_PAIEMENT_CONSULTATION', 'ATTENTE_MEDECIN', 'EN_CONSULTATION', 'ATTENTE_EXAMENS', 'ATTENTE_SPECIALISTE', 'CLOTUREE', 'ANNULEE')),
      motif_venue TEXT,
      type_visite TEXT NOT NULL DEFAULT 'STANDARD' CHECK(type_visite IN ('STANDARD', 'URGENCE', 'CONTROLE', 'INTERPRETATION_RESULTATS')),
      cloturee_le TEXT,
      consultation_origine_id TEXT,
      elements_a_interpreter TEXT,
      actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Signes Vitaux & Mesures
    CREATE TABLE IF NOT EXISTS signes_vitaux (
      id TEXT PRIMARY KEY,
      visite_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      temperature REAL,
      tension_systolique INTEGER,
      tension_diastolique INTEGER,
      pouls INTEGER,
      frequence_respiratoire INTEGER,
      spo2 INTEGER,
      poids REAL,
      taille REAL,
      glycemie_mesuree REAL,
      douleur INTEGER CHECK(douleur >= 0 AND douleur <= 10),
      age_calcule INTEGER,
      imc REAL,
      categorie_imc TEXT,
      pam REAL,
      date_prise TEXT NOT NULL,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Consultations Médicales
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      visite_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      date_consultation TEXT NOT NULL,
      motif_consultation TEXT,
      histoire_maladie TEXT,
      examen_physique TEXT,
      diagnostic_principal TEXT,
      diagnostics_associes TEXT,
      hypotheses_diagnostiques TEXT,
      diagnostics_retenus TEXT,
      diagnostics_structures TEXT,
      conduite_a_tenir TEXT,
      notes_confidentielles TEXT,
      heure_prise_en_charge TEXT,
      heure_debut_consultation TEXT,
      heure_fin_consultation TEXT,
      statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK(statut IN ('BROUILLON', 'EN_COURS', 'FINALISEE', 'SUSPENDUE_EXAMENS', 'SUSPENDUE_ORIENTATION', 'TERMINEE')),
      finalisee_le TEXT,
      amendement_motif TEXT,
      actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Prescriptions Thérapeutiques (Phase 2C-1)
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      consultation_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      date_prescription TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'BROUILLON' CHECK(statut IN ('BROUILLON', 'ACTIVE', 'TERMINEE', 'ANNULEE')),
      observations TEXT,
      amendement_motif TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Lignes de Médicaments de Prescription (Phase 2C-1)
    CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      nom_medicament TEXT NOT NULL,
      dosage TEXT,
      forme TEXT,
      voie_administration TEXT,
      frequence TEXT,
      duree TEXT,
      quantite INTEGER,
      instructions TEXT,
      ordre INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
    );

    -- Table des Factures
    CREATE TABLE IF NOT EXISTS factures (
      id TEXT PRIMARY KEY,
      numero_facture TEXT UNIQUE NOT NULL,
      patient_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      type_prestation TEXT NOT NULL CHECK(type_prestation IN ('CONSULTATION', 'LABORATOIRE', 'ACTE_EXTERNE', 'AUTRE')),
      montant_total REAL NOT NULL,
      devise TEXT NOT NULL DEFAULT 'USD',
      statut TEXT NOT NULL DEFAULT 'EN_ATTENTE_PAIEMENT' CHECK(statut IN ('EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE')),
      emise_par_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (emise_par_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Lignes de Facture (Invoice Items avec prix historique fixé)
    CREATE TABLE IF NOT EXISTS facture_items (
      id TEXT PRIMARY KEY,
      facture_id TEXT NOT NULL,
      code_prestation TEXT NOT NULL,
      description TEXT NOT NULL,
      quantite INTEGER NOT NULL DEFAULT 1,
      prix_unitaire REAL NOT NULL,
      montant_ligne REAL NOT NULL,
      devise TEXT NOT NULL DEFAULT 'USD',
      FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
    );

    -- Table des Règlements / Paiements Réception
    CREATE TABLE IF NOT EXISTS paiements (
      id TEXT PRIMARY KEY,
      numero_recu TEXT UNIQUE NOT NULL,
      facture_id TEXT NOT NULL,
      montant_paye REAL NOT NULL,
      devise TEXT NOT NULL DEFAULT 'USD',
      mode_paiement TEXT NOT NULL CHECK(mode_paiement IN ('ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE')),
      reference_transaction TEXT,
      date_paiement TEXT NOT NULL,
      encaisse_par_id TEXT NOT NULL,
      FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT,
      FOREIGN KEY (encaisse_par_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Demandes d'Analyses Laboratoire (Phase 2C-2 & Phase 2C-3)
    CREATE TABLE IF NOT EXISTS demandes_laboratoire (
      id TEXT PRIMARY KEY,
      numero_demande TEXT UNIQUE,
      consultation_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      laborantin_id TEXT,
      assigned_at TEXT,
      assigned_by TEXT,
      date_demande TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN ('DEMANDE_CREEE', 'PRISE_EN_CHARGE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE', 'ANNULEE')),
      urgence TEXT NOT NULL DEFAULT 'NORMALE' CHECK(urgence IN ('NORMALE', 'URGENTE')),
      indication_clinique TEXT,
      commentaire TEXT,
      amendement_motif TEXT,
      facture_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (laborantin_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
    );

    -- Table des Échantillons Prélevés
    CREATE TABLE IF NOT EXISTS echantillons_laboratoire (
      id TEXT PRIMARY KEY,
      demande_id TEXT NOT NULL,
      code_barre TEXT UNIQUE NOT NULL,
      nature_prelevement TEXT NOT NULL CHECK(nature_prelevement IN ('SANG', 'URINE', 'SELLES', 'AUTRE')),
      statut TEXT NOT NULL DEFAULT 'EN_ATTENTE_PRELEVEMENT' CHECK(statut IN ('EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME')),
      motif_non_conformite TEXT,
      preleve_par_id TEXT,
      date_prelevement TEXT,
      date_reception TEXT,
      FOREIGN KEY (demande_id) REFERENCES demandes_laboratoire(id) ON DELETE RESTRICT,
      FOREIGN KEY (preleve_par_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Analyses / Examens individuels (Phase 2C-2)
    CREATE TABLE IF NOT EXISTS analyses_laboratoire (
      id TEXT PRIMARY KEY,
      demande_laboratoire_id TEXT NOT NULL,
      nom_analyse TEXT NOT NULL,
      type_echantillon TEXT NOT NULL CHECK(type_echantillon IN ('SANG', 'URINE', 'SELLES', 'AUTRE')),
      statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN ('DEMANDE_CREEE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE', 'ANNULEE')),
      instructions TEXT,
      ordre INTEGER NOT NULL DEFAULT 0,
      echantillon_id TEXT,
      valeur_mesuree TEXT,
      unite TEXT,
      valeurs_reference TEXT,
      interpretation TEXT CHECK(interpretation IN ('NORMAL', 'ANORMAL', 'CRITIQUE', NULL)),
      technicien_id TEXT,
      valide_par_id TEXT,
      date_analyse TEXT,
      date_validation TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (demande_laboratoire_id) REFERENCES demandes_laboratoire(id) ON DELETE CASCADE,
      FOREIGN KEY (echantillon_id) REFERENCES echantillons_laboratoire(id) ON DELETE RESTRICT,
      FOREIGN KEY (technicien_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (valide_par_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Table des Orientations vers Spécialistes Externes
    CREATE TABLE IF NOT EXISTS orientations_specialistes (
      id TEXT PRIMARY KEY,
      numero_orientation TEXT UNIQUE NOT NULL,
      consultation_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      specialite TEXT NOT NULL,
      etablissement_destinataire TEXT NOT NULL,
      praticien_destinataire TEXT,
      motif_orientation TEXT NOT NULL,
      donnees_cliniques TEXT,
      niveau_urgence TEXT NOT NULL DEFAULT 'ROUTINE' CHECK(niveau_urgence IN ('ROUTINE', 'URGENT', 'TRES_URGENT')),
      statut TEXT NOT NULL DEFAULT 'ENVOYE' CHECK(statut IN ('ENVOYE', 'CONSULTATION_EXTERNE_EFFECTUEE', 'COMPTE_RENDU_RECU', 'INTEGRE_DOSSIER_CLOTURE')),
      compte_rendu_texte TEXT,
      date_orientation TEXT NOT NULL,
      date_reception_cr TEXT,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Index d'optimisation relationnelle et d'intégrité
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_patients_dossier ON patients(numero_dossier);
    CREATE INDEX IF NOT EXISTS idx_patients_telephone ON patients(telephone);
    CREATE INDEX IF NOT EXISTS idx_visites_patient ON visites(patient_id);
    CREATE INDEX IF NOT EXISTS idx_visites_statut ON visites(statut);
    CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
    CREATE INDEX IF NOT EXISTS idx_factures_visite ON factures(visite_id);
    CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_laboratoire(statut);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_visite ON prescriptions(visite_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_medecin ON prescriptions(medecin_id);
    CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
  `);

  // Migration de schéma évolutive : vérification de la présence de must_change_password
  try {
    const tableInfo = db.exec("PRAGMA table_info(users);");
    if (tableInfo.length > 0) {
      const columns = tableInfo[0].values.map((row: any) => row[1]);
      if (!columns.includes('must_change_password')) {
        db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1));");
      }
    }
  } catch (err) {
    console.error('Erreur lors de la vérification de colonne must_change_password:', err);
  }

  // Migration de schéma Phase 2A : Table visites (medecin_id et statut TRIAGE_TERMINE)
  try {
    const visitesInfo = db.exec("PRAGMA table_info(visites);");
    if (visitesInfo.length > 0) {
      const columns = visitesInfo[0].values.map((row: any) => row[1]);
      if (!columns.includes('medecin_id')) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE visites_migration (
            id TEXT PRIMARY KEY,
            numero_visite TEXT UNIQUE NOT NULL,
            patient_id TEXT NOT NULL,
            medecin_id TEXT,
            date_arrivee TEXT NOT NULL,
            statut TEXT NOT NULL CHECK(statut IN ('ATTENTE_TRIAGE', 'TRIAGE_TERMINE', 'ATTENTE_PAIEMENT_CONSULTATION', 'ATTENTE_MEDECIN', 'EN_CONSULTATION', 'ATTENTE_EXAMENS', 'ATTENTE_SPECIALISTE', 'CLOTUREE', 'ANNULEE')),
            motif_venue TEXT,
            type_visite TEXT NOT NULL DEFAULT 'STANDARD' CHECK(type_visite IN ('STANDARD', 'URGENCE', 'CONTROLE')),
            cloturee_le TEXT,
            actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
            created_at TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
            FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
          );
          INSERT INTO visites_migration (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, motif_venue, type_visite, cloturee_le, actif, created_at)
          SELECT id, numero_visite, patient_id, NULL, date_arrivee, statut, motif_venue, type_visite, cloturee_le, actif, created_at FROM visites;
          DROP TABLE visites;
          ALTER TABLE visites_migration RENAME TO visites;
          CREATE INDEX IF NOT EXISTS idx_visites_patient ON visites(patient_id);
          CREATE INDEX IF NOT EXISTS idx_visites_statut ON visites(statut);
          CREATE INDEX IF NOT EXISTS idx_visites_medecin ON visites(medecin_id);
        `);
      }
    }
  } catch (err) {
    console.error('Erreur lors de la migration de la table visites pour Phase 2A:', err);
  }

  // Migration de schéma Phase 2B : Table consultations (statuts BROUILLON, EN_COURS, FINALISEE et colonnes created_at, updated_at, finalisee_le)
  try {
    const consultInfo = db.exec("PRAGMA table_info(consultations);");
    if (consultInfo.length > 0) {
      const columns = consultInfo[0].values.map((row: any) => row[1]);
      if (!columns.includes('finalisee_le') || !columns.includes('created_at')) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE consultations_migration (
            id TEXT PRIMARY KEY,
            visite_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            medecin_id TEXT NOT NULL,
            date_consultation TEXT NOT NULL,
            motif_consultation TEXT,
            histoire_maladie TEXT,
            examen_physique TEXT,
            diagnostic_principal TEXT,
            diagnostics_associes TEXT,
            conduite_a_tenir TEXT,
            notes_confidentielles TEXT,
            statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK(statut IN ('BROUILLON', 'EN_COURS', 'FINALISEE', 'SUSPENDUE_EXAMENS', 'SUSPENDUE_ORIENTATION', 'TERMINEE')),
            finalisee_le TEXT,
            amendement_motif TEXT,
            actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
            FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
          );
          INSERT INTO consultations_migration (
            id, visite_id, patient_id, medecin_id, date_consultation,
            motif_consultation, histoire_maladie, examen_physique,
            diagnostic_principal, diagnostics_associes, conduite_a_tenir,
            notes_confidentielles, statut, finalisee_le, amendement_motif, actif,
            created_at, updated_at
          )
          SELECT 
            id, visite_id, patient_id, medecin_id, date_consultation,
            motif_consultation, histoire_maladie, examen_physique,
            diagnostic_principal, diagnostics_associes, conduite_a_tenir,
            notes_confidentielles, 
            CASE 
              WHEN statut = 'TERMINEE' THEN 'FINALISEE'
              ELSE statut 
            END,
            NULL, NULL, actif,
            COALESCE(date_consultation, datetime('now')),
            COALESCE(date_consultation, datetime('now'))
          FROM consultations;
          DROP TABLE consultations;
          ALTER TABLE consultations_migration RENAME TO consultations;
          CREATE INDEX IF NOT EXISTS idx_consultations_visite ON consultations(visite_id);
          CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
          CREATE INDEX IF NOT EXISTS idx_consultations_medecin ON consultations(medecin_id);
          CREATE INDEX IF NOT EXISTS idx_consultations_statut ON consultations(statut);
        `);
      }
    }
  } catch (err) {
    console.error('Erreur lors de la migration de la table consultations pour Phase 2B:', err);
  }

  // Migration de schéma Phase 2C-1 : Table prescriptions & prescription_items
  try {
    const prescInfo = db.exec("PRAGMA table_info(prescriptions);");
    if (prescInfo.length > 0) {
      const columns = prescInfo[0].values.map((row: any) => row[1]);
      if (!columns.includes('statut')) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          DROP TABLE IF EXISTS prescriptions;
          CREATE TABLE prescriptions (
            id TEXT PRIMARY KEY,
            consultation_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            visite_id TEXT NOT NULL,
            medecin_id TEXT NOT NULL,
            date_prescription TEXT NOT NULL,
            statut TEXT NOT NULL DEFAULT 'BROUILLON' CHECK(statut IN ('BROUILLON', 'ACTIVE', 'TERMINEE', 'ANNULEE')),
            observations TEXT,
            amendement_motif TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
            FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
            FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
          );
          PRAGMA foreign_keys = ON;
        `);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS prescription_items (
        id TEXT PRIMARY KEY,
        prescription_id TEXT NOT NULL,
        nom_medicament TEXT NOT NULL,
        dosage TEXT,
        forme TEXT,
        voie_administration TEXT,
        frequence TEXT,
        duree TEXT,
        quantite INTEGER,
        instructions TEXT,
        ordre INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_visite ON prescriptions(visite_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_medecin ON prescriptions(medecin_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
    `);
  } catch (err) {
    console.error('Erreur lors de la migration de la table prescriptions pour Phase 2C-1:', err);
  }

  // Migration de schéma Phase 2C-2 : Demandes d'analyses de laboratoire
  try {
    const demInfo = db.exec("PRAGMA table_info(demandes_laboratoire);");
    if (demInfo.length > 0) {
      const columns = demInfo[0].values.map((row: any) => row[1]);
      if (!columns.includes('indication_clinique') || !columns.includes('urgence') || !columns.includes('date_demande')) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          DROP TABLE IF EXISTS analyses_laboratoire;
          DROP TABLE IF EXISTS echantillons_laboratoire;
          DROP TABLE IF EXISTS demandes_laboratoire;
          
          CREATE TABLE demandes_laboratoire (
            id TEXT PRIMARY KEY,
            numero_demande TEXT UNIQUE,
            consultation_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            visite_id TEXT NOT NULL,
            medecin_id TEXT NOT NULL,
            date_demande TEXT NOT NULL,
            statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN ('DEMANDE_CREEE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE', 'ANNULEE')),
            urgence TEXT NOT NULL DEFAULT 'NORMALE' CHECK(urgence IN ('NORMALE', 'URGENTE')),
            indication_clinique TEXT,
            commentaire TEXT,
            amendement_motif TEXT,
            facture_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
            FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
            FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
          );

          CREATE TABLE analyses_laboratoire (
            id TEXT PRIMARY KEY,
            demande_laboratoire_id TEXT NOT NULL,
            nom_analyse TEXT NOT NULL,
            type_echantillon TEXT NOT NULL CHECK(type_echantillon IN ('SANG', 'URINE', 'SELLES', 'AUTRE')),
            statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN ('DEMANDE_CREEE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE', 'ANNULEE')),
            instructions TEXT,
            ordre INTEGER NOT NULL DEFAULT 0,
            echantillon_id TEXT,
            valeur_mesuree TEXT,
            unite TEXT,
            valeurs_reference TEXT,
            interpretation TEXT CHECK(interpretation IN ('NORMAL', 'ANORMAL', 'CRITIQUE', NULL)),
            technicien_id TEXT,
            valide_par_id TEXT,
            date_analyse TEXT,
            date_validation TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (demande_laboratoire_id) REFERENCES demandes_laboratoire(id) ON DELETE CASCADE
          );

          PRAGMA foreign_keys = ON;
        `);
      }
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_demandes_consultation ON demandes_laboratoire(consultation_id);
      CREATE INDEX IF NOT EXISTS idx_demandes_patient ON demandes_laboratoire(patient_id);
      CREATE INDEX IF NOT EXISTS idx_demandes_visite ON demandes_laboratoire(visite_id);
      CREATE INDEX IF NOT EXISTS idx_demandes_medecin ON demandes_laboratoire(medecin_id);
      CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_laboratoire(statut);
      CREATE INDEX IF NOT EXISTS idx_analyses_demande ON analyses_laboratoire(demande_laboratoire_id);
    `);
  } catch (err) {
    console.error('Erreur lors de la migration demandes_laboratoire pour Phase 2C-2:', err);
  }

  // Migration de schéma Phase 2C-3 : Attribution des demandes de laboratoire (laborantin_id, assigned_at, assigned_by)
  try {
    const tableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='demandes_laboratoire';");
    const tableSql = tableSqlRes.length > 0 && tableSqlRes[0].values.length > 0 ? String(tableSqlRes[0].values[0][0]) : '';
    if (tableSql && (!tableSql.includes('PRISE_EN_CHARGE') || !tableSql.includes('laborantin_id'))) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS demandes_laboratoire_new (
          id TEXT PRIMARY KEY,
          numero_demande TEXT UNIQUE,
          consultation_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          visite_id TEXT NOT NULL,
          medecin_id TEXT NOT NULL,
          laborantin_id TEXT,
          assigned_at TEXT,
          assigned_by TEXT,
          date_demande TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN ('DEMANDE_CREEE', 'PRISE_EN_CHARGE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE', 'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE', 'ANNULEE')),
          urgence TEXT NOT NULL DEFAULT 'NORMALE' CHECK(urgence IN ('NORMALE', 'URGENTE')),
          indication_clinique TEXT,
          commentaire TEXT,
          amendement_motif TEXT,
          facture_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
          FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY (laborantin_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
        );

        INSERT INTO demandes_laboratoire_new (
          id, numero_demande, consultation_id, patient_id, visite_id, medecin_id,
          date_demande, statut, urgence, indication_clinique, commentaire,
          amendement_motif, facture_id, created_at, updated_at
        )
        SELECT 
          id, numero_demande, consultation_id, patient_id, visite_id, medecin_id,
          date_demande, statut, urgence, indication_clinique, commentaire,
          amendement_motif, facture_id, created_at, updated_at
        FROM demandes_laboratoire;

        DROP TABLE demandes_laboratoire;
        ALTER TABLE demandes_laboratoire_new RENAME TO demandes_laboratoire;
        PRAGMA foreign_keys = ON;
      `);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_demandes_laborantin ON demandes_laboratoire(laborantin_id);
    `);
  } catch (err) {
    console.error('Erreur lors de la migration demandes_laboratoire pour Phase 2C-3:', err);
  }

  // Migration de schéma Phase 2C-4 : Résultats de laboratoire, Validation, Amendements et Notifications
  try {
    const demTableInfo = db.exec("PRAGMA table_info(demandes_laboratoire);");
    if (demTableInfo.length > 0) {
      const colNames = demTableInfo[0].values.map((row: any) => row[1]);
      
      const newDemCols: { name: string; type: string }[] = [
        { name: 'result_entered_by', type: 'TEXT' },
        { name: 'result_entered_at', type: 'TEXT' },
        { name: 'validated_by', type: 'TEXT' },
        { name: 'validated_at', type: 'TEXT' },
        { name: 'date_prelevement', type: 'TEXT' },
        { name: 'preleve_par_id', type: 'TEXT' },
        { name: 'conclusion_globale', type: 'TEXT' },
        { name: 'remarques_techniques', type: 'TEXT' },
        { name: 'document_url', type: 'TEXT' },
        { name: 'document_nom', type: 'TEXT' },
        { name: 'vu_par_medecin_le', type: 'TEXT' }
      ];

      for (const col of newDemCols) {
        if (!colNames.includes(col.name)) {
          db.exec(`ALTER TABLE demandes_laboratoire ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

    // Mise à jour de la table analyses_laboratoire pour supporter les paramètres structurés et observations
    const analysesTableInfo = db.exec("PRAGMA table_info(analyses_laboratoire);");
    if (analysesTableInfo.length > 0) {
      const aColNames = analysesTableInfo[0].values.map((row: any) => row[1]);
      const newAnalysesCols: { name: string; type: string }[] = [
        { name: 'resultats_detailles', type: 'TEXT' },
        { name: 'observation', type: 'TEXT' },
        { name: 'commentaire_technique', type: 'TEXT' }
      ];

      for (const col of newAnalysesCols) {
        if (!aColNames.includes(col.name)) {
          db.exec(`ALTER TABLE analyses_laboratoire ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

    // Migration du CHECK de statut de demandes_laboratoire pour accepter l'ensemble des statuts du workflow complet
    const tableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='demandes_laboratoire';");
    const tableSql = tableSqlRes.length > 0 && tableSqlRes[0].values.length > 0 ? String(tableSqlRes[0].values[0][0]) : '';
    if (tableSql && !tableSql.includes('RESULTATS_VALIDES')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE demandes_laboratoire_v4 (
          id TEXT PRIMARY KEY,
          numero_demande TEXT UNIQUE,
          consultation_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          visite_id TEXT NOT NULL,
          medecin_id TEXT NOT NULL,
          laborantin_id TEXT,
          assigned_at TEXT,
          assigned_by TEXT,
          date_demande TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN (
            'DEMANDE_CREEE', 'PRISE_EN_CHARGE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE',
            'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE',
            'RESULTATS_A_SAISIR', 'RESULTATS_SAISIS', 'RESULTAT_A_VALIDER', 'RESULTATS_VALIDES', 'RESULTAT_VALIDE',
            'TRANSMIS_AU_MEDECIN', 'TERMINEE', 'ANNULEE'
          )),
          urgence TEXT NOT NULL DEFAULT 'NORMALE' CHECK(urgence IN ('NORMALE', 'URGENTE')),
          indication_clinique TEXT,
          commentaire TEXT,
          amendement_motif TEXT,
          facture_id TEXT,
          result_entered_by TEXT,
          result_entered_at TEXT,
          validated_by TEXT,
          validated_at TEXT,
          date_prelevement TEXT,
          preleve_par_id TEXT,
          conclusion_globale TEXT,
          remarques_techniques TEXT,
          document_url TEXT,
          document_nom TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
          FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT,
          FOREIGN KEY (laborantin_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT
        );

        INSERT INTO demandes_laboratoire_v4 (
          id, numero_demande, consultation_id, patient_id, visite_id, medecin_id,
          laborantin_id, assigned_at, assigned_by, date_demande, statut, urgence,
          indication_clinique, commentaire, amendement_motif, facture_id,
          result_entered_by, result_entered_at, validated_by, validated_at,
          date_prelevement, preleve_par_id, conclusion_globale, remarques_techniques,
          document_url, document_nom, created_at, updated_at
        )
        SELECT 
          id, numero_demande, consultation_id, patient_id, visite_id, medecin_id,
          laborantin_id, assigned_at, assigned_by, date_demande, statut, urgence,
          indication_clinique, commentaire, amendement_motif, facture_id,
          result_entered_by, result_entered_at, validated_by, validated_at,
          date_prelevement, preleve_par_id, conclusion_globale, remarques_techniques,
          document_url, document_nom, created_at, updated_at
        FROM demandes_laboratoire;

        DROP TABLE demandes_laboratoire;
        ALTER TABLE demandes_laboratoire_v4 RENAME TO demandes_laboratoire;
        PRAGMA foreign_keys = ON;

        CREATE INDEX IF NOT EXISTS idx_demandes_consultation ON demandes_laboratoire(consultation_id);
        CREATE INDEX IF NOT EXISTS idx_demandes_patient ON demandes_laboratoire(patient_id);
        CREATE INDEX IF NOT EXISTS idx_demandes_visite ON demandes_laboratoire(visite_id);
        CREATE INDEX IF NOT EXISTS idx_demandes_medecin ON demandes_laboratoire(medecin_id);
        CREATE INDEX IF NOT EXISTS idx_demandes_laborantin ON demandes_laboratoire(laborantin_id);
        CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_laboratoire(statut);
      `);
    }

    // Migration du CHECK de statut de analyses_laboratoire pour accepter l'ensemble des statuts complets
    const aTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='analyses_laboratoire';");
    const aTableSql = aTableSqlRes.length > 0 && aTableSqlRes[0].values.length > 0 ? String(aTableSqlRes[0].values[0][0]) : '';
    if (aTableSql && !aTableSql.includes('RESULTATS_VALIDES')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE analyses_laboratoire_v4 (
          id TEXT PRIMARY KEY,
          demande_laboratoire_id TEXT NOT NULL,
          nom_analyse TEXT NOT NULL,
          type_echantillon TEXT NOT NULL CHECK(type_echantillon IN ('SANG', 'URINE', 'SELLES', 'AUTRE')),
          statut TEXT NOT NULL DEFAULT 'DEMANDE_CREEE' CHECK(statut IN (
            'DEMANDE_CREEE', 'PRISE_EN_CHARGE', 'EN_ATTENTE_PRELEVEMENT', 'PRELEVEMENT_EFFECTUE',
            'ECHANTILLON_RECU', 'ECHANTILLON_NON_CONFORME', 'EN_ANALYSE',
            'RESULTATS_A_SAISIR', 'RESULTATS_SAISIS', 'RESULTAT_A_VALIDER', 'RESULTATS_VALIDES', 'RESULTAT_VALIDE',
            'TRANSMIS_AU_MEDECIN', 'TERMINEE', 'ANNULEE'
          )),
          instructions TEXT,
          ordre INTEGER NOT NULL DEFAULT 0,
          echantillon_id TEXT,
          valeur_mesuree TEXT,
          unite TEXT,
          valeurs_reference TEXT,
          interpretation TEXT CHECK(interpretation IN ('NORMAL', 'ANORMAL', 'CRITIQUE', NULL)),
          technicien_id TEXT,
          valide_par_id TEXT,
          date_analyse TEXT,
          date_validation TEXT,
          resultats_detailles TEXT,
          observation TEXT,
          commentaire_technique TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (demande_laboratoire_id) REFERENCES demandes_laboratoire(id) ON DELETE CASCADE
        );

        INSERT INTO analyses_laboratoire_v4 (
          id, demande_laboratoire_id, nom_analyse, type_echantillon, statut,
          instructions, ordre, echantillon_id, valeur_mesuree, unite,
          valeurs_reference, interpretation, technicien_id, valide_par_id,
          date_analyse, date_validation, resultats_detailles, observation,
          commentaire_technique, created_at, updated_at
        )
        SELECT 
          id, demande_laboratoire_id, nom_analyse, type_echantillon, statut,
          instructions, ordre, echantillon_id, valeur_mesuree, unite,
          valeurs_reference, interpretation, technicien_id, valide_par_id,
          date_analyse, date_validation, resultats_detailles, observation,
          commentaire_technique, created_at, updated_at
        FROM analyses_laboratoire;

        DROP TABLE analyses_laboratoire;
        ALTER TABLE analyses_laboratoire_v4 RENAME TO analyses_laboratoire;
        PRAGMA foreign_keys = ON;

        CREATE INDEX IF NOT EXISTS idx_analyses_demande ON analyses_laboratoire(demande_laboratoire_id);
        CREATE INDEX IF NOT EXISTS idx_analyses_statut ON analyses_laboratoire(statut);
      `);
    }

    // Table d'audit des amendements et corrections de résultats (Phase 2C-4)
    db.exec(`
      CREATE TABLE IF NOT EXISTS amendements_analyses_laboratoire (
        id TEXT PRIMARY KEY,
        demande_laboratoire_id TEXT NOT NULL,
        analyse_laboratoire_id TEXT,
        ancien_resultat TEXT NOT NULL,
        nouveau_resultat TEXT NOT NULL,
        motif TEXT NOT NULL,
        amende_par_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (demande_laboratoire_id) REFERENCES demandes_laboratoire(id) ON DELETE CASCADE,
        FOREIGN KEY (amende_par_id) REFERENCES users(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_amendements_demande ON amendements_analyses_laboratoire(demande_laboratoire_id);
    `);

    // Table des Notifications système (Phase 2C-4)
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        titre TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'LAB_RESULTS_READY',
        patient_id TEXT,
        consultation_id TEXT,
        visite_id TEXT,
        lab_order_id TEXT,
        lu INTEGER NOT NULL DEFAULT 0 CHECK(lu IN (0, 1)),
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(user_id, lu);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    `);

    // Migration des colonnes de communication (Étape 10 : Médecin <-> Réception)
    const notifInfo = db.exec("PRAGMA table_info(notifications);");
    if (notifInfo.length > 0) {
      const notifCols = notifInfo[0].values.map((row: any) => row[1]);
      const addCols = [
        { name: 'emetteur_id', type: 'TEXT' },
        { name: 'emetteur_nom', type: 'TEXT' },
        { name: 'emetteur_role', type: 'TEXT' },
        { name: 'destinataire_role', type: 'TEXT' },
        { name: 'lu_le', type: 'TEXT' }
      ];
      for (const col of addCols) {
        if (!notifCols.includes(col.name)) {
          db.exec(`ALTER TABLE notifications ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

  } catch (err) {
    console.error('Erreur lors de la migration Phase 2C-4:', err);
  }

  // Migration de schéma Amélioration Socle Clinique (État Civil, Constantes, Rendez-vous, Signaux, Ordonnances)
  try {
    // 1. Mise à jour de la table patients
    const patInfo = db.exec("PRAGMA table_info(patients);");
    if (patInfo.length > 0) {
      const patCols = patInfo[0].values.map((row: any) => row[1]);
      const newPatCols = [
        { name: 'post_nom', type: 'TEXT' },
        { name: 'lieu_naissance', type: 'TEXT' },
        { name: 'pays_naissance', type: "TEXT DEFAULT 'RD Congo'" },
        { name: 'profession', type: 'TEXT' },
        { name: 'etat_civil', type: 'TEXT' }
      ];
      for (const col of newPatCols) {
        if (!patCols.includes(col.name)) {
          db.exec(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

    // 2. Mise à jour de la table visites (timestamps de prise en charge et type INTERPRETATION_RESULTATS)
    const visInfo = db.exec("PRAGMA table_info(visites);");
    if (visInfo.length > 0) {
      const visCols = visInfo[0].values.map((row: any) => row[1]);
      const newVisCols = [
        { name: 'heure_orientation', type: 'TEXT' },
        { name: 'heure_prise_en_charge', type: 'TEXT' },
        { name: 'heure_debut_consultation', type: 'TEXT' },
        { name: 'heure_fin_consultation', type: 'TEXT' },
        { name: 'consultation_origine_id', type: 'TEXT' },
        { name: 'elements_a_interpreter', type: 'TEXT' }
      ];
      for (const col of newVisCols) {
        if (!visCols.includes(col.name)) {
          db.exec(`ALTER TABLE visites ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

    // Migration du CHECK de type_visite si nécessaire pour autoriser 'INTERPRETATION_RESULTATS'
    const visTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='visites';");
    const visTableSql = visTableSqlRes.length > 0 && visTableSqlRes[0].values.length > 0 ? String(visTableSqlRes[0].values[0][0]) : '';
    if (visTableSql && !visTableSql.includes('INTERPRETATION_RESULTATS')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE visites_new (
          id TEXT PRIMARY KEY,
          numero_visite TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          medecin_id TEXT,
          date_arrivee TEXT NOT NULL,
          statut TEXT NOT NULL CHECK(statut IN ('ATTENTE_TRIAGE', 'TRIAGE_TERMINE', 'ATTENTE_PAIEMENT_CONSULTATION', 'ATTENTE_MEDECIN', 'EN_CONSULTATION', 'ATTENTE_EXAMENS', 'ATTENTE_SPECIALISTE', 'CLOTUREE', 'ANNULEE')),
          motif_venue TEXT,
          type_visite TEXT NOT NULL DEFAULT 'STANDARD' CHECK(type_visite IN ('STANDARD', 'URGENCE', 'CONTROLE', 'INTERPRETATION_RESULTATS')),
          cloturee_le TEXT,
          heure_orientation TEXT,
          heure_prise_en_charge TEXT,
          heure_debut_consultation TEXT,
          heure_fin_consultation TEXT,
          actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
          created_at TEXT NOT NULL,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
        );

        INSERT INTO visites_new (
          id, numero_visite, patient_id, medecin_id, date_arrivee, statut,
          motif_venue, type_visite, cloturee_le, heure_orientation,
          heure_prise_en_charge, heure_debut_consultation, heure_fin_consultation,
          actif, created_at
        )
        SELECT 
          id, numero_visite, patient_id, medecin_id, date_arrivee, statut,
          motif_venue, type_visite, cloturee_le, heure_orientation,
          heure_prise_en_charge, heure_debut_consultation, heure_fin_consultation,
          actif, created_at
        FROM visites;

        DROP TABLE visites;
        ALTER TABLE visites_new RENAME TO visites;
        PRAGMA foreign_keys = ON;

        CREATE INDEX IF NOT EXISTS idx_visites_patient ON visites(patient_id);
        CREATE INDEX IF NOT EXISTS idx_visites_medecin ON visites(medecin_id);
        CREATE INDEX IF NOT EXISTS idx_visites_statut ON visites(statut);
        CREATE INDEX IF NOT EXISTS idx_visites_date ON visites(date_arrivee);
      `);
    }

    // 3. Mise à jour de signes_vitaux (surface corporelle, pression pulsée, alertes)
    const svInfo = db.exec("PRAGMA table_info(signes_vitaux);");
    if (svInfo.length > 0) {
      const svCols = svInfo[0].values.map((row: any) => row[1]);
      const newSvCols = [
        { name: 'surface_corporelle', type: 'REAL' },
        { name: 'pression_pulsee', type: 'REAL' },
        { name: 'alertes_constantes', type: 'TEXT' }
      ];
      for (const col of newSvCols) {
        if (!svCols.includes(col.name)) {
          db.exec(`ALTER TABLE signes_vitaux ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }

    // 4. Mise à jour de consultations (diagnostics_structures, hypotheses_diagnostiques, diagnostics_retenus)
    const cslInfo = db.exec("PRAGMA table_info(consultations);");
    if (cslInfo.length > 0) {
      const cslCols = cslInfo[0].values.map((row: any) => row[1]);
      if (!cslCols.includes('diagnostics_structures')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN diagnostics_structures TEXT;`);
      }
      if (!cslCols.includes('hypotheses_diagnostiques')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN hypotheses_diagnostiques TEXT;`);
      }
      if (!cslCols.includes('diagnostics_retenus')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN diagnostics_retenus TEXT;`);
      }
      if (!cslCols.includes('heure_prise_en_charge')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN heure_prise_en_charge TEXT;`);
      }
      if (!cslCols.includes('heure_debut_consultation')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN heure_debut_consultation TEXT;`);
      }
      if (!cslCols.includes('heure_fin_consultation')) {
        db.exec(`ALTER TABLE consultations ADD COLUMN heure_fin_consultation TEXT;`);
      }
    }

    // 5. Mise à jour de prescriptions (statut VALIDEE, IMPRIMEE, REMISE, horodatages)
    const pscTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='prescriptions';");
    const pscTableSql = pscTableSqlRes.length > 0 && pscTableSqlRes[0].values.length > 0 ? String(pscTableSqlRes[0].values[0][0]) : '';
    if (pscTableSql && (!pscTableSql.includes('VALIDEE') || !pscTableSql.includes('IMPRIMEE') || !pscTableSql.includes('REMISE'))) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE prescriptions_new (
          id TEXT PRIMARY KEY,
          consultation_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          visite_id TEXT NOT NULL,
          medecin_id TEXT NOT NULL,
          date_prescription TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'BROUILLON' CHECK(statut IN ('BROUILLON', 'VALIDEE', 'IMPRIMEE', 'REMISE', 'ACTIVE', 'TERMINEE', 'ANNULEE')),
          observations TEXT,
          amendement_motif TEXT,
          imprimee_le TEXT,
          imprimee_par_id TEXT,
          remise_le TEXT,
          remise_par_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
          FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
        );

        INSERT INTO prescriptions_new (
          id, consultation_id, patient_id, visite_id, medecin_id,
          date_prescription, statut, observations, amendement_motif,
          created_at, updated_at
        )
        SELECT 
          id, consultation_id, patient_id, visite_id, medecin_id,
          date_prescription, statut, observations, amendement_motif,
          created_at, updated_at
        FROM prescriptions;

        DROP TABLE prescriptions;
        ALTER TABLE prescriptions_new RENAME TO prescriptions;
        PRAGMA foreign_keys = ON;

        CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_visite ON prescriptions(visite_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_medecin ON prescriptions(medecin_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_statut ON prescriptions(statut);
      `);
    }

    // Sécurisation des colonnes de traçabilité pour le workflow d'impression (VALIDEE, IMPRIMEE, REMISE)
    const prescColsRes = db.exec("PRAGMA table_info(prescriptions);");
    if (prescColsRes.length > 0 && prescColsRes[0].values.length > 0) {
      const prescCols = prescColsRes[0].values.map(v => String(v[1]));
      if (!prescCols.includes('validee_le')) {
        db.exec("ALTER TABLE prescriptions ADD COLUMN validee_le TEXT;");
      }
      if (!prescCols.includes('validee_par')) {
        db.exec("ALTER TABLE prescriptions ADD COLUMN validee_par TEXT;");
      }
      if (!prescCols.includes('imprimee_par')) {
        db.exec("ALTER TABLE prescriptions ADD COLUMN imprimee_par TEXT;");
      }
      if (!prescCols.includes('remise_par')) {
        db.exec("ALTER TABLE prescriptions ADD COLUMN remise_par TEXT;");
      }
    }

    // 6. Table unifiée des Rendez-vous (Réception & Médecin - Étape 7)
    const rdvTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='rendez_vous';");
    const rdvTableSql = rdvTableSqlRes.length > 0 && rdvTableSqlRes[0].values.length > 0 ? String(rdvTableSqlRes[0].values[0][0]) : '';
    if (!rdvTableSql || !rdvTableSql.includes('PLANIFIÉ') || !rdvTableSql.includes('PATIENT PRÉSENT')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS rendez_vous_new (
          id TEXT PRIMARY KEY,
          numero_rdv TEXT UNIQUE NOT NULL,
          patient_id TEXT,
          medecin_id TEXT,
          date_rdv TEXT NOT NULL,
          heure_rdv TEXT,
          motif TEXT NOT NULL,
          type_rdv TEXT DEFAULT 'CONSULTATION',
          statut TEXT NOT NULL DEFAULT 'PLANIFIÉ' CHECK(statut IN (
            'PLANIFIÉ', 'CONFIRMÉ', 'PATIENT PRÉSENT', 'HONORÉ', 'ABSENT', 'ANNULÉ',
            'PLANIFIE', 'CONFIRME', 'PATIENT_PRESENT', 'HONORE', 'ANNULE', 'PROGRAMME', 'REPORTE'
          )),
          cree_par_id TEXT,
          notes TEXT,
          visite_id TEXT,
          rappel_statut TEXT DEFAULT 'NON_ENVOYE',
          rappel_date TEXT,
          source_demande TEXT DEFAULT 'ACCUEIL',
          actif INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE SET NULL
        );
      `);

      if (rdvTableSql) {
        db.exec(`
          INSERT INTO rendez_vous_new (
            id, numero_rdv, patient_id, medecin_id, date_rdv, heure_rdv, motif, type_rdv, statut, cree_par_id, notes, visite_id, created_at, updated_at
          )
          SELECT 
            id, numero_rdv, patient_id, medecin_id, date_rdv, heure_rdv, motif, type_rdv, 
            CASE 
              WHEN statut = 'PROGRAMME' THEN 'PLANIFIÉ'
              WHEN statut = 'HONORE' THEN 'HONORÉ'
              WHEN statut = 'ANNULE' THEN 'ANNULÉ'
              ELSE statut 
            END,
            cree_par_id, notes, visite_id, created_at, updated_at
          FROM rendez_vous;

          DROP TABLE rendez_vous;
          ALTER TABLE rendez_vous_new RENAME TO rendez_vous;
        `);
      } else {
        db.exec(`ALTER TABLE rendez_vous_new RENAME TO rendez_vous;`);
      }

      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE INDEX IF NOT EXISTS idx_rdv_patient ON rendez_vous(patient_id);
        CREATE INDEX IF NOT EXISTS idx_rdv_medecin ON rendez_vous(medecin_id);
        CREATE INDEX IF NOT EXISTS idx_rdv_date ON rendez_vous(date_rdv);
        CREATE INDEX IF NOT EXISTS idx_rdv_statut ON rendez_vous(statut);
      `);
    }

    // 7. Table des signaux de communication Médecin -> Réception
    db.exec(`
      CREATE TABLE IF NOT EXISTS signaux_reception (
        id TEXT PRIMARY KEY,
        medecin_id TEXT NOT NULL,
        visite_id TEXT,
        patient_id TEXT,
        type_signal TEXT NOT NULL,
        message TEXT NOT NULL,
        statut TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK(statut IN ('EN_ATTENTE', 'TRAITE', 'ARCHIVE')),
        traite_par_id TEXT,
        traite_le TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE CASCADE,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (traite_par_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_signaux_medecin ON signaux_reception(medecin_id);
      CREATE INDEX IF NOT EXISTS idx_signaux_statut ON signaux_reception(statut);
      CREATE INDEX IF NOT EXISTS idx_signaux_created ON signaux_reception(created_at);
    `);

    // 8. ÉTAPE 8 — TARIFS, TAUX USD -> FC, FACTURATION MULTI-PRESTATIONS & PAIEMENTS
    db.exec(`
      -- Table des Tarifs & Prestations Cliniques
      CREATE TABLE IF NOT EXISTS tarifs (
        id TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        categorie TEXT NOT NULL CHECK(categorie IN ('TYPE_VISITE', 'CONSULTATION', 'EXAMEN_LABORATOIRE', 'IMAGERIE', 'ACTE_SERVICE')),
        prix_usd REAL NOT NULL CHECK(prix_usd >= 0),
        actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tarifs_categorie ON tarifs(categorie);
      CREATE INDEX IF NOT EXISTS idx_tarifs_actif ON tarifs(actif);
    `);

    // Migration de schéma pour factures (Étape 8 : support multi-prestations, taux USD->FC, statuts NON PAYÉ / PARTIELLEMENT PAYÉ / PAYÉ)
    const facturesTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='factures';");
    const facturesTableSql = facturesTableSqlRes.length > 0 && facturesTableSqlRes[0].values.length > 0 ? String(facturesTableSqlRes[0].values[0][0]) : '';
    if (!facturesTableSql || !facturesTableSql.includes('taux_usd_fc') || !facturesTableSql.includes('NON PAYÉ')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS factures_new (
          id TEXT PRIMARY KEY,
          numero_facture TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          visite_id TEXT,
          type_prestation TEXT NOT NULL DEFAULT 'MULTI_PRESTATIONS',
          montant_total REAL NOT NULL,
          devise TEXT NOT NULL DEFAULT 'USD',
          taux_usd_fc REAL NOT NULL DEFAULT 2850,
          statut TEXT NOT NULL DEFAULT 'NON PAYÉ' CHECK(statut IN ('NON PAYÉ', 'PARTIELLEMENT PAYÉ', 'PAYÉ', 'NON_PAYE', 'PARTIELLEMENT_PAYE', 'PAYE', 'EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE')),
          emise_par_id TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE SET NULL,
          FOREIGN KEY (emise_par_id) REFERENCES users(id) ON DELETE RESTRICT
        );
      `);

      if (facturesTableSql) {
        db.exec(`
          INSERT INTO factures_new (
            id, numero_facture, patient_id, visite_id, type_prestation, montant_total,
            devise, taux_usd_fc, statut, emise_par_id, notes, created_at, updated_at
          )
          SELECT 
            id, numero_facture, patient_id, visite_id, type_prestation, montant_total,
            devise, 2850,
            CASE 
              WHEN statut = 'PAYEE' THEN 'PAYÉ'
              WHEN statut = 'PARTIELLEMENT_PAYEE' THEN 'PARTIELLEMENT PAYÉ'
              ELSE 'NON PAYÉ'
            END,
            emise_par_id, NULL, created_at, created_at
          FROM factures;

          DROP TABLE factures;
          ALTER TABLE factures_new RENAME TO factures;
        `);
      } else {
        db.exec(`ALTER TABLE factures_new RENAME TO factures;`);
      }

      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE INDEX IF NOT EXISTS idx_factures_patient ON factures(patient_id);
        CREATE INDEX IF NOT EXISTS idx_factures_visite ON factures(visite_id);
        CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
        CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures(numero_facture);
      `);
    }

    // Migration de schéma pour paiements (Étape 8 : support devise FC/USD, taux scellé au paiement, équivalents)
    const paiementsTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='paiements';");
    const paiementsTableSql = paiementsTableSqlRes.length > 0 && paiementsTableSqlRes[0].values.length > 0 ? String(paiementsTableSqlRes[0].values[0][0]) : '';
    if (!paiementsTableSql || !paiementsTableSql.includes('taux_usd_fc') || !paiementsTableSql.includes('equivalent_fc')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS paiements_new (
          id TEXT PRIMARY KEY,
          numero_recu TEXT UNIQUE NOT NULL,
          facture_id TEXT NOT NULL,
          montant_paye REAL NOT NULL,
          devise TEXT NOT NULL CHECK(devise IN ('USD', 'FC', 'CDF')),
          taux_usd_fc REAL NOT NULL DEFAULT 2850,
          equivalent_usd REAL NOT NULL,
          equivalent_fc REAL NOT NULL,
          mode_paiement TEXT NOT NULL DEFAULT 'ESPECES' CHECK(mode_paiement IN ('ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE')),
          reference_transaction TEXT,
          notes TEXT,
          date_paiement TEXT NOT NULL,
          encaisse_par_id TEXT NOT NULL,
          FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE RESTRICT,
          FOREIGN KEY (encaisse_par_id) REFERENCES users(id) ON DELETE RESTRICT
        );
      `);

      if (paiementsTableSql) {
        db.exec(`
          INSERT INTO paiements_new (
            id, numero_recu, facture_id, montant_paye, devise, taux_usd_fc,
            equivalent_usd, equivalent_fc, mode_paiement, reference_transaction, notes,
            date_paiement, encaisse_par_id
          )
          SELECT 
            id, numero_recu, facture_id, montant_paye, 
            CASE WHEN devise = 'CDF' THEN 'FC' ELSE devise END,
            2850,
            CASE WHEN devise = 'CDF' OR devise = 'FC' THEN ROUND(montant_paye / 2850.0, 2) ELSE montant_paye END,
            CASE WHEN devise = 'USD' THEN ROUND(montant_paye * 2850.0, 2) ELSE montant_paye END,
            mode_paiement, reference_transaction, NULL, date_paiement, encaisse_par_id
          FROM paiements;

          DROP TABLE paiements;
          ALTER TABLE paiements_new RENAME TO paiements;
        `);
      } else {
        db.exec(`ALTER TABLE paiements_new RENAME TO paiements;`);
      }

      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE INDEX IF NOT EXISTS idx_paiements_facture ON paiements(facture_id);
        CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);
        CREATE INDEX IF NOT EXISTS idx_paiements_devise ON paiements(devise);
      `);
    }

    // Migration facture_items pour supporter categorie et tarif_id
    const factureItemsColsRes = db.exec("PRAGMA table_info(facture_items);");
    if (factureItemsColsRes.length > 0 && factureItemsColsRes[0].values.length > 0) {
      const fiCols = factureItemsColsRes[0].values.map(v => String(v[1]));
      if (!fiCols.includes('tarif_id')) {
        db.exec("ALTER TABLE facture_items ADD COLUMN tarif_id TEXT;");
      }
      if (!fiCols.includes('categorie')) {
        db.exec("ALTER TABLE facture_items ADD COLUMN categorie TEXT;");
      }
    }

    // ------------------------------------------------------------------------
    // ÉTAPE 9 : ADMINISTRATION, GESTION AVANCÉE DES UTILISATEURS, RÔLES & PERMISSIONS
    // ------------------------------------------------------------------------
    // 1. Table des Rôles configurables
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        nom TEXT NOT NULL,
        description TEXT,
        categorie TEXT NOT NULL,
        is_system INTEGER DEFAULT 0,
        actif INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Table des Permissions par Rôle
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        PRIMARY KEY (role_id, permission),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
    `);

    // 3. Mise à jour de la table des utilisateurs (nom, prenom, fonction, telephone, email, role_id)
    const userColsRes = db.exec("PRAGMA table_info(users);");
    if (userColsRes.length > 0 && userColsRes[0].values.length > 0) {
      const uCols = userColsRes[0].values.map(v => String(v[1]));
      
      if (!uCols.includes('nom')) {
        db.exec("ALTER TABLE users ADD COLUMN nom TEXT;");
      }
      if (!uCols.includes('prenom')) {
        db.exec("ALTER TABLE users ADD COLUMN prenom TEXT;");
      }
      if (!uCols.includes('fonction')) {
        db.exec("ALTER TABLE users ADD COLUMN fonction TEXT;");
      }
      if (!uCols.includes('telephone')) {
        db.exec("ALTER TABLE users ADD COLUMN telephone TEXT;");
      }
      if (!uCols.includes('email')) {
        db.exec("ALTER TABLE users ADD COLUMN email TEXT;");
      }
      if (!uCols.includes('role_id')) {
        db.exec("ALTER TABLE users ADD COLUMN role_id TEXT;");
      }
    }

    // 4. Déverrouiller le CHECK constraint sur users.role si présent pour permettre tout rôle (ex: DIRECTEUR, MEDECIN_PEDIATRE, etc.)
    const userTableSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users';");
    const userTableSql = userTableSqlRes.length > 0 && userTableSqlRes[0].values.length > 0 ? String(userTableSqlRes[0].values[0][0]) : '';
    if (userTableSql.includes('CHECK(role IN')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE users_etape9 (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          nom_complet TEXT NOT NULL,
          nom TEXT,
          prenom TEXT,
          fonction TEXT,
          telephone TEXT,
          email TEXT,
          role_id TEXT,
          role TEXT NOT NULL,
          must_change_password INTEGER NOT NULL DEFAULT 0,
          actif INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO users_etape9 (
          id, username, password_hash, nom_complet, nom, prenom, fonction, telephone, email, role_id, role, must_change_password, actif, created_at, updated_at
        )
        SELECT 
          id, username, password_hash, nom_complet, 
          COALESCE(nom, ''), COALESCE(prenom, ''), COALESCE(fonction, ''), COALESCE(telephone, ''), COALESCE(email, ''), role_id,
          role, must_change_password, actif, created_at, updated_at
        FROM users;

        DROP TABLE users;
        ALTER TABLE users_etape9 RENAME TO users;
        PRAGMA foreign_keys = ON;
      `);
    }

    // ------------------------------------------------------------------------
    // ÉTAPE 2 : FACTURATION LIÉE, RDV AVANCE & PROTECTION ANTI-DOUBLONS
    // ------------------------------------------------------------------------
    const rdvColsRes = db.exec("PRAGMA table_info(rendez_vous);");
    if (rdvColsRes.length > 0 && rdvColsRes[0].values.length > 0) {
      const rdvCols = rdvColsRes[0].values.map(v => String(v[1]));
      if (!rdvCols.includes('patient_nom_temp')) {
        db.exec("ALTER TABLE rendez_vous ADD COLUMN patient_nom_temp TEXT;");
      }
      if (!rdvCols.includes('patient_prenom_temp')) {
        db.exec("ALTER TABLE rendez_vous ADD COLUMN patient_prenom_temp TEXT;");
      }
      if (!rdvCols.includes('patient_telephone_temp')) {
        db.exec("ALTER TABLE rendez_vous ADD COLUMN patient_telephone_temp TEXT;");
      }
      if (!rdvCols.includes('facture_id')) {
        db.exec("ALTER TABLE rendez_vous ADD COLUMN facture_id TEXT;");
      }
    }

    const facColsRes = db.exec("PRAGMA table_info(factures);");
    if (facColsRes.length > 0 && facColsRes[0].values.length > 0) {
      const facCols = facColsRes[0].values.map(v => String(v[1]));
      if (!facCols.includes('rendez_vous_id')) {
        db.exec("ALTER TABLE factures ADD COLUMN rendez_vous_id TEXT;");
      }
      if (!facCols.includes('patient_nom_temp')) {
        db.exec("ALTER TABLE factures ADD COLUMN patient_nom_temp TEXT;");
      }
      if (!facCols.includes('patient_prenom_temp')) {
        db.exec("ALTER TABLE factures ADD COLUMN patient_prenom_temp TEXT;");
      }
      if (!facCols.includes('patient_telephone_temp')) {
        db.exec("ALTER TABLE factures ADD COLUMN patient_telephone_temp TEXT;");
      }
    }

    // Aligne la table existante : patient_id devient nullable (support RDV sans dossier médical)
    const rdvPkRes = db.exec("PRAGMA table_info(rendez_vous);");
    const rdvPkInfo = rdvPkRes.length > 0 && rdvPkRes[0].values.length > 0
      ? rdvPkRes[0].values.find((v: any[]) => v[1] === 'patient_id')
      : null;
    if (rdvPkInfo && String(rdvPkInfo[3]).toUpperCase() === 'NOT NULL') {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS rendez_vous__tmp (
          id TEXT PRIMARY KEY,
          numero_rdv TEXT UNIQUE NOT NULL,
          patient_id TEXT,
          medecin_id TEXT,
          date_rdv TEXT NOT NULL,
          heure_rdv TEXT,
          motif TEXT NOT NULL,
          type_rdv TEXT DEFAULT 'CONSULTATION',
          statut TEXT NOT NULL DEFAULT 'PLANIFIÉ',
          cree_par_id TEXT,
          notes TEXT,
          visite_id TEXT,
          rappel_statut TEXT DEFAULT 'NON_ENVOYE',
          rappel_date TEXT,
          source_demande TEXT DEFAULT 'ACCUEIL',
          actif INTEGER DEFAULT 1,
          patient_nom_temp TEXT,
          patient_prenom_temp TEXT,
          patient_telephone_temp TEXT,
          facture_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const colsRes = db.exec("PRAGMA table_info(rendez_vous);");
      const cols = colsRes.length > 0 && colsRes[0].values.length > 0
        ? colsRes[0].values.map((v: any[]) => String(v[1]))
        : [];
      const colList = cols.join(', ');
      db.exec(`INSERT INTO rendez_vous__tmp (${colList}) SELECT ${colList} FROM rendez_vous;`);
      db.exec("DROP TABLE rendez_vous;");
      db.exec("ALTER TABLE rendez_vous__tmp RENAME TO rendez_vous;");
      db.exec(`CREATE INDEX IF NOT EXISTS idx_rdv_patient ON rendez_vous(patient_id);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_rdv_medecin ON rendez_vous(medecin_id);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_rdv_date ON rendez_vous(date_rdv);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_rdv_statut ON rendez_vous(statut);`);
      db.exec('PRAGMA foreign_keys = ON;');
    }

  } catch (err) {
    console.error('Erreur lors de la migration Améliorations Socle Clinique:', err);
  }

  // Migration : ajouter type_orientation aux orientations_specialistes
  try {
    const colsRes = db.exec("PRAGMA table_info(orientations_specialistes);");
    const cols = colsRes.length > 0 && colsRes[0].values.length > 0
      ? colsRes[0].values.map((v: any[]) => String(v[1]).toUpperCase())
      : [];
    if (!cols.includes('TYPE_ORIENTATION')) {
      db.exec(`ALTER TABLE orientations_specialistes ADD COLUMN type_orientation TEXT NOT NULL DEFAULT 'EXTERNE' CHECK(type_orientation IN ('EXTERNE', 'INTERNE'));`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_orient_type ON orientations_specialistes(type_orientation);`);
    }
    if (!cols.includes('MEDECIN_DESTINATAIRE_ID')) {
      db.exec(`ALTER TABLE orientations_specialistes ADD COLUMN medecin_destinataire_id TEXT REFERENCES users(id);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_orient_dest_med ON orientations_specialistes(medecin_destinataire_id);`);
    }
    if (!cols.includes('VISITE_RETOUR_ID')) {
      db.exec(`ALTER TABLE orientations_specialistes ADD COLUMN visite_retour_id TEXT REFERENCES visites(id);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_orient_visite_retour ON orientations_specialistes(visite_retour_id);`);
    }
  } catch (err) {
    console.error('Erreur lors de la migration type_orientation:', err);
  }

  db.exec('PRAGMA foreign_keys = ON;');
  saveDb();
}
