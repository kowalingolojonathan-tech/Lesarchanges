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
      prenom TEXT NOT NULL,
      date_naissance TEXT NOT NULL,
      sexe TEXT NOT NULL CHECK(sexe IN ('M', 'F')),
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
      type_visite TEXT NOT NULL DEFAULT 'STANDARD' CHECK(type_visite IN ('STANDARD', 'URGENCE', 'CONTROLE')),
      cloturee_le TEXT,
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

    -- Table des Prescriptions Thérapeutiques
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      consultation_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      date_prescription TEXT NOT NULL,
      lignes_medicaments TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0, 1)),
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT
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

    -- Table des Demandes d'Analyses Laboratoire
    CREATE TABLE IF NOT EXISTS demandes_laboratoire (
      id TEXT PRIMARY KEY,
      numero_demande TEXT UNIQUE NOT NULL,
      consultation_id TEXT NOT NULL,
      visite_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      medecin_id TEXT NOT NULL,
      facture_id TEXT,
      renseignements_cliniques TEXT,
      statut TEXT NOT NULL DEFAULT 'ATTENTE_PAIEMENT' CHECK(statut IN ('ATTENTE_PAIEMENT', 'AUTORISE_A_PRELEVER', 'EN_COURS_ANALYSE', 'PARTIELLEMENT_VALIDE', 'VALIDE_DISPONIBLE')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE RESTRICT,
      FOREIGN KEY (visite_id) REFERENCES visites(id) ON DELETE RESTRICT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      FOREIGN KEY (medecin_id) REFERENCES users(id) ON DELETE RESTRICT,
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

    -- Table des Analyses / Examens individuels
    CREATE TABLE IF NOT EXISTS analyses_laboratoire (
      id TEXT PRIMARY KEY,
      demande_id TEXT NOT NULL,
      echantillon_id TEXT,
      code_analyse TEXT NOT NULL,
      libelle_analyse TEXT NOT NULL,
      valeur_mesuree TEXT,
      unite TEXT,
      valeurs_reference TEXT,
      interpretation TEXT CHECK(interpretation IN ('NORMAL', 'ANORMAL', 'CRITIQUE', NULL)),
      statut TEXT NOT NULL DEFAULT 'ATTENTE_PAIEMENT' CHECK(statut IN ('ATTENTE_PAIEMENT', 'EN_ANALYSE', 'RESULTAT_A_VALIDER', 'RESULTAT_VALIDE')),
      technicien_id TEXT,
      valide_par_id TEXT,
      date_analyse TEXT,
      date_validation TEXT,
      FOREIGN KEY (demande_id) REFERENCES demandes_laboratoire(id) ON DELETE RESTRICT,
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

  db.exec('PRAGMA foreign_keys = ON;');
  saveDb();
}
