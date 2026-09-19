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
      'DEFAULT_CURRENCY', 'USD', 'Devise de référence principale', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'SECONDARY_CURRENCY', 'CDF', 'Devise locale (Franc Congolais - RDC)', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'EXCHANGE_RATE_USD_CDF', '2850', 'Taux de conversion 1 USD en CDF', now
    ]);
    await execute('INSERT INTO clinic_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [
      'CLINIC_LOCATION', 'Kinshasa, RDC', 'Localisation', now
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
        ('usr-lab-01', 'labo.biologiste', ?, 'Dr. Patrick Kalonji (Biologiste Médical)', 'LABORATOIRE', 1, ?, ?)
    `, [
      hashAdmin, now, now,
      hashRecep, now, now,
      hashMed, now, now,
      hashMed, now, now,
      hashLab, now, now
    ]);

    // Enregistrement d'audit initial
    await execute(`
      INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
      VALUES ('audit-init-01', 'usr-admin-01', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'DB_INIT', 'Initialisation du socle V1 et des 4 rôles fondamentaux', '127.0.0.1', ?)
    `, [now]);
  } else {
    // Vérification présence second médecin usr-med-02
    const existingMed2 = await queryOne('SELECT id FROM users WHERE username = ?', ['dr.mutombo']);
    if (!existingMed2) {
      const now = new Date().toISOString();
      const hashMed = await bcrypt.hash('ArchangesMed2026!', 10);
      await execute(`
        INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
        VALUES ('usr-med-02', 'dr.mutombo', ?, 'Dr. Thérèse Mutombo (Médecin Pédiatre)', 'MÉDECIN', 1, ?, ?)
      `, [hashMed, now, now]);
    }
  }
}
