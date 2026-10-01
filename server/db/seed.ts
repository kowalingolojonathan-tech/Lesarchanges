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
}
