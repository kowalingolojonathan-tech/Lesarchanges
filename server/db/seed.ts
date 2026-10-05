import bcrypt from 'bcryptjs';
import { queryOne, execute } from './database.js';

export async function seedDatabase(): Promise<void> {
  // 1. Initialisation des paramètres de la clinique (Devises RDC, etc.)
  const existingSetting = await queryOne('SELECT key FROM clinic_settings WHERE key = ?', ['CLINIC_NAME']);
  if (!existingSetting) {
    const now = new Date().toISOString();
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_NAME', 'Clinique Les Archanges', 'Nom officiel de la clinique', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_ADDRESS', "À 100 mètres après l'arrêt Libaya (en venant du quartier Salongo-Nord), commune de Lemba, Kinshasa.", 'Adresse officielle', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_PHONE', '+243 989 715 771', 'Téléphone officiel', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_HOURS', 'Ouvert 24h/24 et 7j/7.', 'Horaires d ouverture', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'DEFAULT_CURRENCY', 'USD', 'Devise de référence principale', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'SECONDARY_CURRENCY', 'CDF', 'Devise locale (Franc Congolais - RDC)', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'EXCHANGE_RATE_USD_CDF', '2850', 'Taux de conversion 1 USD en CDF', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'EXCHANGE_RATE_USD_FC', '2850', 'Taux de conversion 1 USD en FC', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_LOCATION', 'Commune de Lemba, Kinshasa', 'Localisation', now
    ]);
  }

  // 2. Initialisation des comptes utilisateurs par défaut pour les 4 rôles V1
  const existingAdmin = await queryOne('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!existingAdmin) {
    const now = new Date().toISOString();
    
    // Mots de passe chiffrés par bcrypt
    const hashAdmin = await bcrypt.hash('ArchangesAdmin2026!', 10);
    const hashRecep = await bcrypt.hash('ArchangesRecep2026!', 10);
    const hashMed = await bcrypt.hash('ArchangesMed2026!', 10);
    const hashLab = await bcrypt.hash('ArchangesLab2026!', 10);

    await execute(`
      INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
      VALUES 
        ('usr-admin-01', 'admin', ?, 'M. Éric Banza (Admin Système)', 'ADMINISTRATEUR', 1, ?, ?),
        ('usr-recep-01', 'reception', ?, 'Mme Sarah Mwamba (Accueil & Caisse)', 'RÉCEPTION', 1, ?, ?),
        ('usr-med-01', 'dr.sawadogo', ?, 'Dr. Marc Sawadogo (Médecin Généraliste)', 'MÉDECIN', 1, ?, ?),
        ('usr-med-02', 'dr.mutombo', ?, 'Dr. Thérèse Mutombo (Médecin Pédiatre)', 'MÉDECIN', 1, ?, ?),
        ('usr-lab-01', 'labo.biologiste', ?, 'Dr. Patrick Kalonji (Biologiste Médical)', 'LABORATOIRE', 1, ?, ?),
        ('usr-lab-02', 'labo.technicien', ?, 'Mme Chantal Tshala (Technicienne Supérieure)', 'LABORATOIRE', 1, ?, ?),
        ('usr-lab-inactive', 'labo.inactif', ?, 'M. Paul Mbayo (Laborantin Inactif)', 'LABORATOIRE', 0, ?, ?)
    `, [
      hashAdmin, now, now,
      hashRecep, now, now,
      hashMed, now, now,
      hashMed, now, now,
      hashLab, now, now,
      hashLab, now, now,
      hashLab, now, now
    ]);

    // Enregistrement d'audit initial
    await execute(`
      INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
      VALUES ('audit-init-01', 'usr-admin-01', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'DB_INIT', 'Initialisation du socle V1 et des 4 rôles fondamentaux', '127.0.0.1', ?)
    `, [now]);
  } else {
    const now = new Date().toISOString();
    // Vérification présence second médecin usr-med-02
    const existingMed2 = await queryOne('SELECT id FROM users WHERE username = ?', ['dr.mutombo']);
    if (!existingMed2) {
      const hashMed = await bcrypt.hash('ArchangesMed2026!', 10);
      await execute(`
        INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
        VALUES ('usr-med-02', 'dr.mutombo', ?, 'Dr. Thérèse Mutombo (Médecin Pédiatre)', 'MÉDECIN', 1, ?, ?)
      `, [hashMed, now, now]);
    }

    // Vérification présence second laborantin usr-lab-02
    const existingLab2 = await queryOne('SELECT id FROM users WHERE username = ?', ['labo.technicien']);
    if (!existingLab2) {
      const hashLab = await bcrypt.hash('ArchangesLab2026!', 10);
      await execute(`
        INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
        VALUES ('usr-lab-02', 'labo.technicien', ?, 'Mme Chantal Tshala (Technicienne Supérieure)', 'LABORATOIRE', 1, ?, ?)
      `, [hashLab, now, now]);
    }

    // Laborantin inactif pour tests RBAC
    const existingLabInactif = await queryOne('SELECT id FROM users WHERE username = ?', ['labo.inactif']);
    if (!existingLabInactif) {
      const hashLab = await bcrypt.hash('ArchangesLab2026!', 10);
      await execute(`
        INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
        VALUES ('usr-lab-inactive', 'labo.inactif', ?, 'M. Paul Mbayo (Laborantin Inactif)', 'LABORATOIRE', 0, ?, ?)
      `, [hashLab, now, now]);
    }
  }

  // 3. Initialisation du Taux USD -> FC officiel
  const existingRate = await queryOne('SELECT key FROM clinic_settings WHERE key = ?', ['EXCHANGE_RATE_USD_FC']);
  if (!existingRate) {
    const now = new Date().toISOString();
    await execute('INSERT OR REPLACE INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'EXCHANGE_RATE_USD_FC', '2850', 'Taux officiel de conversion 1 USD en FC (Franc Congolais)', now
    ]);
  }

  // 4. Initialisation des Tarifs & Prestations cliniques de référence (Étape 8)
  const existingTarifs = await queryOne('SELECT count(*) as count FROM tarifs', []);
  if (!existingTarifs || Number(existingTarifs.count) === 0) {
    const now = new Date().toISOString();
    const defaultTarifs = [
      // 1. Types de visite
      { id: 'tar-vis-01', nom: 'Visite Ambulatoire Standard', categorie: 'TYPE_VISITE', prix_usd: 15, actif: 1, description: 'Accueil standard, triage et orientation' },
      { id: 'tar-vis-02', nom: 'Visite d\'Urgence / Triage Prioritaire', categorie: 'TYPE_VISITE', prix_usd: 30, actif: 1, description: 'Prise en charge immédiate au déchocage / urgences' },
      { id: 'tar-vis-03', nom: 'Visite de Contrôle / Post-Consultation', categorie: 'TYPE_VISITE', prix_usd: 10, actif: 1, description: 'Suivi clinique sous 7 jours' },

      // 2. Consultations
      { id: 'tar-csl-01', nom: 'Consultation Médecine Générale', categorie: 'CONSULTATION', prix_usd: 20, actif: 1, description: 'Examen clinique général complet et prescription' },
      { id: 'tar-csl-02', nom: 'Consultation Pédiatrie', categorie: 'CONSULTATION', prix_usd: 25, actif: 1, description: 'Prise en charge spécialisée nourrisson et enfant' },
      { id: 'tar-csl-03', nom: 'Consultation Spécialisée / Avis Expert', categorie: 'CONSULTATION', prix_usd: 35, actif: 1, description: 'Cardiologie, Gynécologie, Médecine interne' },
      { id: 'tar-csl-04', nom: 'Interprétation des résultats', categorie: 'CONSULTATION', prix_usd: 10, actif: 1, description: 'Revue et interprétation médicale des examens de laboratoire ou imagerie' },

      // 3. Examens laboratoire
      { id: 'tar-lab-01', nom: 'Goutte Épaisse & Frottis (Paludisme)', categorie: 'EXAMEN_LABORATOIRE', prix_usd: 10, actif: 1, description: 'Recherche plasmodium et densité parasitaire' },
      { id: 'tar-lab-02', nom: 'Numération Formule Sanguine (NFS)', categorie: 'EXAMEN_LABORATOIRE', prix_usd: 15, actif: 1, description: 'Hémogramme complet automatisé' },
      { id: 'tar-lab-03', nom: 'Glycémie à jeun', categorie: 'EXAMEN_LABORATOIRE', prix_usd: 8, actif: 1, description: 'Dosage du glucose plasmatique' },
      { id: 'tar-lab-04', nom: 'Sédiment Urinaire & Bandelette', categorie: 'EXAMEN_LABORATOIRE', prix_usd: 10, actif: 1, description: 'Cytologie et chimie urinaire' },
      { id: 'tar-lab-05', nom: 'Sérodiagnostic de Widal (Typhoïde)', categorie: 'EXAMEN_LABORATOIRE', prix_usd: 12, actif: 1, description: 'Agglutination Salmonella' },

      // 4. Imagerie
      { id: 'tar-img-01', nom: 'Échographie Abdomino-Pelvienne', categorie: 'IMAGERIE', prix_usd: 35, actif: 1, description: 'Exploration hépatique, rénale et pelvienne' },
      { id: 'tar-img-02', nom: 'Radiographie Thoracique (Face)', categorie: 'IMAGERIE', prix_usd: 25, actif: 1, description: 'Cliché pulmonaire standard' },
      { id: 'tar-img-03', nom: 'Échographie Obstétricale', categorie: 'IMAGERIE', prix_usd: 30, actif: 1, description: 'Suivi morphologique de grossesse' },

      // 5. Actes / Services
      { id: 'tar-act-01', nom: 'Pansement Simple & Désinfection', categorie: 'ACTE_SERVICE', prix_usd: 10, actif: 1, description: 'Soins infirmiers et réfection aseptique' },
      { id: 'tar-act-02', nom: 'Perfusion & Réhydratation IV', categorie: 'ACTE_SERVICE', prix_usd: 20, actif: 1, description: 'Pose de voie veineuse et soluté de réhydratation' },
      { id: 'tar-act-03', nom: 'Injection Intra-Musculaire / Sous-Cutanée', categorie: 'ACTE_SERVICE', prix_usd: 5, actif: 1, description: 'Administration médicamenteuse infirmière' },
      { id: 'tar-act-04', nom: 'Suture de Plaie Simple', categorie: 'ACTE_SERVICE', prix_usd: 25, actif: 1, description: 'Anesthésie locale et points de suture' },
    ];

    for (const t of defaultTarifs) {
      await execute(`
        INSERT INTO tarifs (id, nom, categorie, prix_usd, actif, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [t.id, t.nom, t.categorie, t.prix_usd, t.actif, t.description, now, now]);
    }
  }

  // 5. Initialisation des Rôles configurables & Permissions (Étape 9)
  const existingRolesCount = await queryOne<{ count: number }>('SELECT count(*) as count FROM roles', []);
  if (!existingRolesCount || Number(existingRolesCount.count) === 0) {
    const now = new Date().toISOString();

    const standardRoles = [
      {
        id: 'role-admin',
        code: 'ADMINISTRATEUR',
        nom: 'Administrateur',
        description: 'Contrôle total du système, gestion des utilisateurs, rôles, tarifs et configuration.',
        categorie: 'ADMINISTRATEUR',
        is_system: 1,
        permissions: [
          'factures:voir', 'factures:ajouter', 'factures:modifier', 'factures:supprimer', 'factures:imprimer',
          'paiements:voir', 'paiements:ajouter', 'paiements:modifier', 'paiements:annuler', 'paiements:imprimer',
          'rapports_financiers:voir', 'rapports_financiers:ajouter', 'rapports_financiers:modifier', 'rapports_financiers:supprimer', 'rapports_financiers:imprimer',
          'patients:voir', 'patients:ajouter', 'patients:modifier', 'patients:supprimer', 'patients:voir_tous',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander', 'laboratoire:traiter', 'laboratoire:valider', 'laboratoire:imprimer',
          'utilisateurs:gerer', 'roles:gerer', 'tarifs:gerer'
        ]
      },
      {
        id: 'role-directeur',
        code: 'DIRECTEUR',
        nom: 'Directeur',
        description: 'Direction médicale & administrative : vue sur tous les dossiers patients, consultations, rapports financiers et supervision générale.',
        categorie: 'DIRECTEUR',
        is_system: 1,
        permissions: [
          'patients:voir', 'patients:ajouter', 'patients:modifier', 'patients:voir_tous',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander',
          'factures:voir', 'paiements:voir', 'rapports_financiers:voir', 'rapports_financiers:imprimer'
        ]
      },
      {
        id: 'role-medecin-gen',
        code: 'MEDECIN_GENERALISTE',
        nom: 'Médecin généraliste',
        description: 'Consultations cliniques adultes, prescriptions médicales, examens de laboratoire. Restreint par défaut aux patients attribués.',
        categorie: 'MÉDECIN',
        is_system: 1,
        permissions: [
          'patients:voir', 'patients:modifier', 'patients:voir_attribues',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander'
        ]
      },
      {
        id: 'role-medecin-ped',
        code: 'MEDECIN_PEDIATRE',
        nom: 'Médecin pédiatre',
        description: 'Consultations pédiatriques, nourrissons et enfants, prescriptions spécifiques. Restreint aux patients attribués.',
        categorie: 'MÉDECIN',
        is_system: 1,
        permissions: [
          'patients:voir', 'patients:modifier', 'patients:voir_attribues',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander'
        ]
      },
      {
        id: 'role-medecin-ext',
        code: 'MEDECIN_EXTERNE',
        nom: 'Médecin externe',
        description: 'Praticien vacataire ou spécialiste invité. Accès strictement limité aux patients expressément attribués.',
        categorie: 'MÉDECIN',
        is_system: 1,
        permissions: [
          'patients:voir', 'patients:voir_attribues',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander'
        ]
      },
      {
        id: 'role-reception',
        code: 'RECEPTION',
        nom: 'Réception & Caisse',
        description: 'Accueil, identification des patients, facturation multi-prestations, encaissements de règlements et tenue du journal de caisse.',
        categorie: 'RÉCEPTION',
        is_system: 1,
        permissions: [
          'patients:voir', 'patients:ajouter', 'patients:modifier', 'patients:voir_tous',
          'factures:voir', 'factures:ajouter', 'factures:modifier', 'factures:imprimer',
          'paiements:voir', 'paiements:ajouter', 'paiements:imprimer',
          'rapports_financiers:voir', 'rapports_financiers:imprimer',
          'prescriptions:voir', 'prescriptions:imprimer'
        ]
      },
      {
        id: 'role-labo',
        code: 'LABORATOIRE',
        nom: 'Laboratoire biomédical',
        description: 'Réception des échantillons, réalisation des analyses biologiques, validation technique et édition des bulletins.',
        categorie: 'LABORATOIRE',
        is_system: 1,
        permissions: [
          'laboratoire:voir', 'laboratoire:traiter', 'laboratoire:valider', 'laboratoire:imprimer',
          'patients:voir'
        ]
      }
    ];

    for (const r of standardRoles) {
      await execute(`
        INSERT INTO roles (id, code, nom, description, categorie, is_system, actif, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [r.id, r.code, r.nom, r.description, r.categorie, r.is_system, now, now]);

      for (const p of r.permissions) {
        await execute(`
          INSERT OR IGNORE INTO role_permissions (role_id, permission)
          VALUES (?, ?)
        `, [r.id, p]);
      }
    }

    // Associer les utilisateurs pré-existants à leurs rôles et profils détaillés
    await execute(`
      UPDATE users SET 
        nom = 'Banza', prenom = 'Éric', fonction = 'Administrateur Système', telephone = '+243 81 000 0001', email = 'admin@lesarchanges.cd', role_id = 'role-admin'
      WHERE username = 'admin';
    `);

    await execute(`
      UPDATE users SET 
        nom = 'Mwamba', prenom = 'Sarah', fonction = 'Caissière Principale & Accueil', telephone = '+243 81 000 0002', email = 'reception@lesarchanges.cd', role_id = 'role-reception'
      WHERE username = 'reception';
    `);

    await execute(`
      UPDATE users SET 
        nom = 'Sawadogo', prenom = 'Marc', fonction = 'Médecin Généraliste', telephone = '+243 81 000 0003', email = 'dr.sawadogo@lesarchanges.cd', role_id = 'role-medecin-gen'
      WHERE username = 'dr.sawadogo';
    `);

    await execute(`
      UPDATE users SET 
        nom = 'Mutombo', prenom = 'Thérèse', fonction = 'Médecin Pédiatre', telephone = '+243 81 000 0004', email = 'dr.mutombo@lesarchanges.cd', role_id = 'role-medecin-ped'
      WHERE username = 'dr.mutombo';
    `);

    await execute(`
      UPDATE users SET 
        nom = 'Kalonji', prenom = 'Patrick', fonction = 'Biologiste Médical', telephone = '+243 81 000 0005', email = 'labo@lesarchanges.cd', role_id = 'role-labo'
      WHERE username = 'labo.biologiste';
    `);

    await execute(`
      UPDATE users SET 
        nom = 'Tshala', prenom = 'Chantal', fonction = 'Technicienne de Laboratoire', telephone = '+243 81 000 0006', email = 'technique.labo@lesarchanges.cd', role_id = 'role-labo'
      WHERE username = 'labo.technicien';
    `);
  }

  // 6. Initialisation du Catalogue Réel de Laboratoire (Phase 4)
  const existingExamensCount = await queryOne<{ count: number }>('SELECT count(*) as count FROM examens_laboratoire', []);
  if (!existingExamensCount || Number(existingExamensCount.count) === 0) {
    const now = new Date().toISOString();

    const realExams = [
      // 1. NFS
      {
        id: 'exam-nfs',
        nom: 'Numération Formule Sanguine (NFS)',
        code: 'NFS',
        description: 'Hémogramme complet automatisé avec numération et formule leucocytaire',
        prix_global_usd: 15.0,
        ordre_affichage: 1,
        parametres: [
          {
            id: 'param-gb',
            nom: 'Globules Blancs (Leucocytes)',
            code: 'NFS_GB',
            unite: '10^3/µL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', min: 4.0, max: 10.0, unite: '10^3/µL' }
          },
          {
            id: 'param-gr',
            nom: 'Globules Rouges (Hématies)',
            code: 'NFS_GR',
            unite: '10^6/µL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', min: 4.0, max: 5.5, unite: '10^6/µL' }
          },
          {
            id: 'param-hb',
            nom: 'Hémoglobine',
            code: 'NFS_HB',
            unite: 'g/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 3,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', min: 12.0, max: 17.0, unite: 'g/dL' }
          },
          {
            id: 'param-ht',
            nom: 'Hématocrite',
            code: 'NFS_HT',
            unite: '%',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 4,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', min: 36.0, max: 50.0, unite: '%' }
          },
          {
            id: 'param-plq',
            nom: 'Plaquettes',
            code: 'NFS_PLQ',
            unite: '10^3/µL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 5,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', min: 150.0, max: 450.0, unite: '10^3/µL' }
          },
          {
            id: 'param-formule',
            nom: 'Formule Leucocytaire',
            code: 'NFS_FORMULE',
            unite: '%',
            type_resultat: 'TEXTE',
            obligatoire: 0,
            ordre_affichage: 6,
            prix_usd: 4.0,
            sous_parametres: [
              {
                id: 'sp-pnn',
                nom: 'Polynucléaires Neutrophiles',
                code: 'NFS_PNN',
                unite: '%',
                type_resultat: 'NUMERIQUE',
                obligatoire: 1,
                ordre_affichage: 1,
                prix_usd: 1.0,
                valeurs_ref: { type: 'GENERAL', min: 40.0, max: 75.0, unite: '%' }
              },
              {
                id: 'sp-pne',
                nom: 'Polynucléaires Éosinophiles',
                code: 'NFS_PNE',
                unite: '%',
                type_resultat: 'NUMERIQUE',
                obligatoire: 0,
                ordre_affichage: 2,
                prix_usd: 1.0,
                valeurs_ref: { type: 'GENERAL', min: 1.0, max: 4.0, unite: '%' }
              },
              {
                id: 'sp-pnb',
                nom: 'Polynucléaires Basophiles',
                code: 'NFS_PNB',
                unite: '%',
                type_resultat: 'NUMERIQUE',
                obligatoire: 0,
                ordre_affichage: 3,
                prix_usd: 1.0,
                valeurs_ref: { type: 'GENERAL', min: 0.0, max: 1.0, unite: '%' }
              },
              {
                id: 'sp-lym',
                nom: 'Lymphocytes',
                code: 'NFS_LYM',
                unite: '%',
                type_resultat: 'NUMERIQUE',
                obligatoire: 1,
                ordre_affichage: 4,
                prix_usd: 1.0,
                valeurs_ref: { type: 'GENERAL', min: 20.0, max: 45.0, unite: '%' }
              },
              {
                id: 'sp-mon',
                nom: 'Monocytes',
                code: 'NFS_MON',
                unite: '%',
                type_resultat: 'NUMERIQUE',
                obligatoire: 0,
                ordre_affichage: 5,
                prix_usd: 1.0,
                valeurs_ref: { type: 'GENERAL', min: 2.0, max: 10.0, unite: '%' }
              }
            ]
          }
        ]
      },

      // 2. Goutte Épaisse & Frottis
      {
        id: 'exam-ge',
        nom: 'Goutte Épaisse & TDR Paludisme',
        code: 'GE_PALU',
        description: 'Recherche qualitative et quantitative de Plasmodium',
        prix_global_usd: 10.0,
        ordre_affichage: 2,
        parametres: [
          {
            id: 'param-ge-result',
            nom: 'Résultat Goutte Épaisse',
            code: 'GE_RES',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-ge-densite',
            nom: 'Densité Parasitaire',
            code: 'GE_DP',
            unite: 'trophozoïtes/µL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 0,
            ordre_affichage: 2,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', min: 0, max: 0, unite: 'trophozoïtes/µL' }
          },
          {
            id: 'param-ge-espece',
            nom: 'Espèce Plasmodiale',
            code: 'GE_ESP',
            unite: '',
            type_resultat: 'TEXTE',
            obligatoire: 0,
            ordre_affichage: 3,
            prix_usd: 2.0
          },
          {
            id: 'param-tdr-palu',
            nom: 'TDR Paludisme (Ag Pf/Pan)',
            code: 'TDR_PALU',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 0,
            ordre_affichage: 4,
            prix_usd: 3.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          }
        ]
      },

      // 3. Glycémie à jeun
      {
        id: 'exam-gly',
        nom: 'Glycémie à jeun',
        code: 'GLYCEMIE',
        description: 'Dosage du glucose plasmatique à jeun',
        prix_global_usd: 8.0,
        ordre_affichage: 3,
        parametres: [
          {
            id: 'param-gly-val',
            nom: 'Glycémie veineuse à jeun',
            code: 'GLY_VAL',
            unite: 'mg/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 8.0,
            valeurs_ref: { type: 'GENERAL', min: 70.0, max: 110.0, unite: 'mg/dL' }
          }
        ]
      },

      // 4. CRP
      {
        id: 'exam-crp',
        nom: 'Protéine C-Réactive (CRP)',
        code: 'CRP',
        description: 'Marqueur de l\'inflammation aiguë',
        prix_global_usd: 12.0,
        ordre_affichage: 4,
        parametres: [
          {
            id: 'param-crp-val',
            nom: 'Dosage quantitatif CRP',
            code: 'CRP_VAL',
            unite: 'mg/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 12.0,
            valeurs_ref: { type: 'GENERAL', min: 0.0, max: 6.0, unite: 'mg/L' }
          }
        ]
      },

      // 5. Ionogramme Sanguin
      {
        id: 'exam-iono',
        nom: 'Ionogramme Sanguin',
        code: 'IONO',
        description: 'Bilan électrolytique plasmatique de base',
        prix_global_usd: 18.0,
        ordre_affichage: 5,
        parametres: [
          {
            id: 'param-na',
            nom: 'Sodium (Na+)',
            code: 'IONO_NA',
            unite: 'mmol/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', min: 135.0, max: 145.0, unite: 'mmol/L' }
          },
          {
            id: 'param-k',
            nom: 'Potassium (K+)',
            code: 'IONO_K',
            unite: 'mmol/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', min: 3.5, max: 5.0, unite: 'mmol/L' }
          },
          {
            id: 'param-cl',
            nom: 'Chlore (Cl-)',
            code: 'IONO_CL',
            unite: 'mmol/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 3,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', min: 95.0, max: 105.0, unite: 'mmol/L' }
          },
          {
            id: 'param-ca',
            nom: 'Calcium total (Ca2+)',
            code: 'IONO_CA',
            unite: 'mg/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 0,
            ordre_affichage: 4,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', min: 8.5, max: 10.5, unite: 'mg/dL' }
          }
        ]
      },

      // 6. Fonction Rénale (Créatininémie & Urée)
      {
        id: 'exam-renal',
        nom: 'Bilan Rénal (Urée & Créatinine)',
        code: 'RENAL',
        description: 'Évaluation de la fonction de filtration glomérulaire',
        prix_global_usd: 12.0,
        ordre_affichage: 6,
        parametres: [
          {
            id: 'param-creat',
            nom: 'Créatininémie',
            code: 'CREAT',
            unite: 'mg/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 6.0,
            valeurs_ref: { type: 'GENERAL', min: 0.6, max: 1.2, unite: 'mg/dL' }
          },
          {
            id: 'param-uree',
            nom: 'Urée sanguine',
            code: 'UREE',
            unite: 'mg/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 6.0,
            valeurs_ref: { type: 'GENERAL', min: 15.0, max: 45.0, unite: 'mg/dL' }
          },
          {
            id: 'param-clairance',
            nom: 'Clairance estimée (DFG / CKD-EPI)',
            code: 'DFG_ESTIM',
            unite: 'mL/min/1.73m²',
            type_resultat: 'NUMERIQUE',
            obligatoire: 0,
            ordre_affichage: 3,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', min: 90.0, max: 120.0, unite: 'mL/min/1.73m²' }
          }
        ]
      },

      // 7. Bilan Hépatique (Transaminases)
      {
        id: 'exam-foie',
        nom: 'Bilan Hépatique (ASAT / ALAT)',
        code: 'HEPATIQUE',
        description: 'Cytolyse et enzymes hépatiques',
        prix_global_usd: 14.0,
        ordre_affichage: 7,
        parametres: [
          {
            id: 'param-asat',
            nom: 'Transaminases ASAT (GOT)',
            code: 'ASAT_GOT',
            unite: 'UI/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 7.0,
            valeurs_ref: { type: 'GENERAL', min: 5.0, max: 40.0, unite: 'UI/L' }
          },
          {
            id: 'param-alat',
            nom: 'Transaminases ALAT (GPT)',
            code: 'ALAT_GPT',
            unite: 'UI/L',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 7.0,
            valeurs_ref: { type: 'GENERAL', min: 5.0, max: 45.0, unite: 'UI/L' }
          },
          {
            id: 'param-bili-tot',
            nom: 'Bilirubine Totale',
            code: 'BILI_TOT',
            unite: 'mg/dL',
            type_resultat: 'NUMERIQUE',
            obligatoire: 0,
            ordre_affichage: 3,
            prix_usd: 4.0,
            valeurs_ref: { type: 'GENERAL', min: 0.2, max: 1.0, unite: 'mg/dL' }
          }
        ]
      },

      // 8. Sédiment Urinaire & Bandelette
      {
        id: 'exam-urine',
        nom: 'Sédiment Urinaire & Bandelette',
        code: 'BANDELETTE_URINE',
        description: 'Chimie urinaire et cytologie sommaire',
        prix_global_usd: 10.0,
        ordre_affichage: 8,
        parametres: [
          {
            id: 'param-bu-leuco',
            nom: 'Leucocytes urinaires',
            code: 'BU_LEUCO',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 2.5,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-bu-nitrites',
            nom: 'Nitrites',
            code: 'BU_NITRITES',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 2.5,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-bu-prot',
            nom: 'Protéines urinaires',
            code: 'BU_PROT',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 3,
            prix_usd: 2.5,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-bu-sang',
            nom: 'Sang / Hémoglobine',
            code: 'BU_SANG',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 4,
            prix_usd: 2.5,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          }
        ]
      },

      // 9. Sérodiagnostic de Widal (Typhoïde)
      {
        id: 'exam-widal',
        nom: 'Sérodiagnostic de Widal (Typhoïde)',
        code: 'WIDAL',
        description: 'Agglutination sérique Salmonella typhi / paratyphi',
        prix_global_usd: 12.0,
        ordre_affichage: 9,
        parametres: [
          {
            id: 'param-widal-to',
            nom: 'Antigène O (Soma)',
            code: 'WIDAL_TO',
            unite: 'titre',
            type_resultat: 'TEXTE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 6.0,
            valeurs_ref: { type: 'GENERAL', texte: '< 1/80 (Négatif)' }
          },
          {
            id: 'param-widal-th',
            nom: 'Antigène H (Flagelle)',
            code: 'WIDAL_TH',
            unite: 'titre',
            type_resultat: 'TEXTE',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 6.0,
            valeurs_ref: { type: 'GENERAL', texte: '< 1/80 (Négatif)' }
          }
        ]
      },

      // 10. Vitesse de Sédimentation (VS) - ajouté séparément
      {
        id: 'exam-vs',
        nom: 'Vitesse de Sédimentation (VS)',
        code: 'VS',
        description: 'Taux de sédimentation des globules rouges',
        prix_global_usd: 5.0,
        ordre_affichage: 10,
        parametres: [
          {
            id: 'param-vs-val',
            nom: 'Vitesse de sédimentation',
            code: 'VS_VAL',
            unite: 'mm/h',
            type_resultat: 'NUMERIQUE',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 5.0,
            valeurs_ref: { type: 'GENERAL', min: 0.0, max: 20.0, unite: 'mm/h' }
          }
        ]
      },

      // 11. Bandelette Urinaire - ajouté séparément
      {
        id: 'exam-ban',
        nom: 'Bandelette Urinaire',
        code: 'BAN_S',
        description: 'Dosage par bandelette réactive des paramètres urinaires',
        prix_global_usd: 8.0,
        ordre_affichage: 11,
        parametres: [
          {
            id: 'param-ban-leuco',
            nom: 'Leucocytes',
            code: 'BAN_LEUCO',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 1,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-ban-nitrites',
            nom: 'Nitrites',
            code: 'BAN_NIT',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 2,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-ban-sang',
            nom: 'Sang',
            code: 'BAN_SANG',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 3,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          },
          {
            id: 'param-ban-prot',
            nom: 'Protéines',
            code: 'BAN_PROT',
            unite: '',
            type_resultat: 'CHOIX',
            obligatoire: 1,
            ordre_affichage: 4,
            prix_usd: 2.0,
            valeurs_ref: { type: 'GENERAL', texte: 'NÉGATIF' }
          }
        ]
      }
    ];

    for (const ex of realExams) {
      // Insertion examen
      await execute(`
        INSERT OR IGNORE INTO examens_laboratoire (
          id, nom, code, description, actif, ordre_affichage, prix_global_usd, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      `, [
        ex.id,
        ex.nom,
        ex.code,
        ex.description,
        ex.ordre_affichage,
        ex.prix_global_usd,
        now,
        now
      ]);

      // Insertion paramètres
      for (const p of ex.parametres) {
        await execute(`
          INSERT OR IGNORE INTO parametres_laboratoire (
            id, examen_id, nom, code, unite, type_resultat, obligatoire, ordre_affichage, actif, prix_usd, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
          p.id,
          ex.id,
          p.nom,
          p.code,
          p.unite,
          p.type_resultat,
          p.obligatoire,
          p.ordre_affichage,
          p.prix_usd,
          now,
          now
        ]); // Valeurs de référence insérées séparément via migration ou API

await execute(`
          INSERT OR IGNORE INTO parametres_laboratoire (
            id, examen_id, nom, code, unite, type_resultat, obligatoire, ordre_affichage, actif, prix_usd, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
          p.id,
          ex.id,
          p.nom,
          p.code,
          p.unite,
          p.type_resultat,
          p.obligatoire,
          p.ordre_affichage,
          p.prix_usd,
          now,
          now
        ]); // Valeurs de référence et sous-paramètres insérés via migration/API

        // Insertion sous-paramètres si existants
        // Vérification runtime : la propriété peut être absente selon le type narrowed de TS
        if ('sous_parametres' in p && p.sous_parametres !== undefined) {
          for (let i = 0; i < p.sous_parametres.length; i++) {
            const sp = p.sous_parametres[i];
            await execute(`
              INSERT OR IGNORE INTO sous_parametres_laboratoire (
                id, parametre_id, nom, code, unite, type_resultat, obligatoire, ordre_affichage, actif, prix_usd, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            `, [
              sp.id,
              p.id,
              sp.nom,
              sp.code,
              sp.unite,
              sp.type_resultat,
              sp.obligatoire,
              sp.ordre_affichage,
              sp.prix_usd,
              now,
              now
            ]);
          }
        }
    }
  }
}
}
