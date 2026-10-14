import('./server/db/migrations.js').then(m => m.runMigrations()).then(() => {
  console.log('Migrations OK');
}).then(() => import('./server/db/database.js')).then(db => {
  const { execute } = db;
  const now = new Date().toISOString();
  
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-med-01', 'dr.sawadogo', '\$2b\$10\$2H5jH9w0KSEYVaVSg3VUG.lk2dL/vqKH6fNfGpujiWaKV4OHRB8/6', 'Dr. Marc Sawadogo (Médecin Généraliste)', 'MÉDECIN', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-med-02', 'dr.mutombo', '\$2b\$10\$2H5jH9w0KSEYVaVSg3VUG.lk2dL/vqKH6fNfGpujiWaKV4OHRB8/6', 'Dr. Thérèse Mutombo (Médecin Pédiatre)', 'MÉDECIN', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-lab-01', 'labo.biologiste', '\$2b\$10\$2H5jH9w0KSEYVaVSg3VUG.lk2dL/vqKH6fNfGpujiWaKV4OHRB8/6', 'Dr. Patrick Kalonji (Biologiste Médical)', 'LABORATOIRE', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-recep-01', 'reception', '\$2b\$10\$SOCOG3NdFsJEW.D64xFOfupzPoN2ylzbksMMUs1x5owbRqweZFxRy', 'Mme Sarah Mwamba (Accueil & Caisse)', 'RÉCEPTION', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-admin-01', 'admin', '\$2b\$10\$SOCOG3NdFsJEW.D64xFOfupzPoN2ylzbksMMUs1x5owbRqweZFxRy', 'M. Éric Banza (Admin Système)', 'ADMINISTRATEUR', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-img-01', 'img.radiologue', '\$2b\$10\$YPFZMkxAR6nBXVqMdP3SuOvGD8hvQSNyPICwLpkzIxqQYbEK0UiAy', 'Dr. Joseph Kambulu (Radiologue)', 'IMAGERIE', 1, \$now, \$now)");
  execute("INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at) VALUES ('usr-img-02', 'img.technicien', '\$2b\$10\$YPFZMkxAR6nBXVqMdP3SuOvGD8hvQSNyPICwLpkzIxqQYbEK0UiAy', 'Mme Marie Lukusa (Technicienne en Imagerie)', 'IMAGERIE', 1, \$now, \$now)");
  
  console.log('7 users insérés');
}).then(() => import('./server/tests/phase71.test.ts').then(m => m.runPhase71Tests())).then(() => console.log('Tests terminés')).catch(e => console.error('ERR:', e.message));