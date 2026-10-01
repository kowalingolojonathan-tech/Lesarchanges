import { getDb } from '../db/database';
import { runMigrations } from '../db/migrations';

async function runDiagnosticTests() {
  console.log('--- DÉMARRAGE DES TESTS : ÉTAPE MODIFICATION DU DIAGNOSTIC ---');

  // Initialisation DB et migrations
  const db = await getDb();
  await runMigrations();

  // Test 1 : Vérifier la présence des nouvelles colonnes
  console.log('\n[TEST 1] Présence des colonnes hypotheses_diagnostiques et diagnostics_retenus');
  const tableInfo = db.exec("PRAGMA table_info(consultations)");
  const cols = tableInfo[0].values.map(v => v[1] as string);

  const hasHypo = cols.includes('hypotheses_diagnostiques');
  const hasRetenus = cols.includes('diagnostics_retenus');

  if (!hasHypo || !hasRetenus) {
    throw new Error(`Colonnes manquantes ! hypotheses_diagnostiques: ${hasHypo}, diagnostics_retenus: ${hasRetenus}`);
  }
  console.log('✓ Colonnes SQL vérifiées avec succès.');

  // Test 2 : Conservation des diagnostics existants (Rétrocompatibilité)
  console.log('\n[TEST 2] Conservation des diagnostics existants sans perte de données');
  // Insérer une ancienne consultation sans hypotheses_diagnostiques ni diagnostics_retenus
  const legacyConsultId = `legacy_test_${Date.now()}`;
  db.run(`
    INSERT INTO consultations (
      id, visite_id, patient_id, medecin_id, date_consultation, motif_consultation,
      diagnostic_principal, diagnostics_associes, statut, created_at, updated_at
    ) VALUES (
      ?, 'visite_mock_1', 'patient_mock_1', 'medecin_mock_1', datetime('now'),
      'Fièvre et céphalées anciennes', 'Paludisme simple', '["Anémie légère", "Déshydratation"]', 'EN_COURS',
      datetime('now'), datetime('now')
    )
  `, [legacyConsultId]);

  const legacyRes = db.exec(`SELECT diagnostic_principal, diagnostics_associes, hypotheses_diagnostiques, diagnostics_retenus FROM consultations WHERE id = '${legacyConsultId}'`);
  const legacyRow = legacyRes[0].values[0];
  console.log('Données consultation existante :', {
    diag_principal: legacyRow[0],
    diag_associes: legacyRow[1],
    hypotheses: legacyRow[2],
    retenus: legacyRow[3]
  });

  if (legacyRow[0] !== 'Paludisme simple') {
    throw new Error('Données existantes altérées !');
  }
  console.log('✓ Données historiques préservées intactes.');

  // Test 3 : Ajout d'hypothèses diagnostiques multiples en attente d'analyses
  console.log('\n[TEST 3] Ajout d\'hypothèses diagnostiques avec attente d\'analyses');
  const testConsultId = `test_diag_${Date.now()}`;
  const initialHypotheses = [
    {
      id: 'hypo_1',
      libelle: 'Suspicion de Paludisme grave',
      statut: 'EN_ATTENTE_LABO',
      attente_details: 'Goutte épaisse + NFS en urgence',
      certitude: 'FORTE',
      created_at: new Date().toISOString()
    },
    {
      id: 'hypo_2',
      libelle: 'Pneumopathie bactérienne fébrile',
      statut: 'EN_ATTENTE_IMAGERIE',
      attente_details: 'Radiographie pulmonaire face et profil',
      certitude: 'MOYENNE',
      created_at: new Date().toISOString()
    }
  ];

  db.run(`
    INSERT INTO consultations (
      id, visite_id, patient_id, medecin_id, date_consultation, motif_consultation,
      hypotheses_diagnostiques, diagnostics_retenus, statut, created_at, updated_at
    ) VALUES (
      ?, 'visite_mock_2', 'patient_mock_2', 'medecin_mock_2', datetime('now'),
      'Syndrome infectieux aigu', ?, '[]', 'EN_COURS',
      datetime('now'), datetime('now')
    )
  `, [testConsultId, JSON.stringify(initialHypotheses)]);

  // Test 4 : Vérification de l'absence de conversion automatique
  console.log('\n[TEST 4] Vérification de l\'absence de conversion automatique');
  const checkHypoRes = db.exec(`SELECT hypotheses_diagnostiques, diagnostics_retenus, diagnostic_principal FROM consultations WHERE id = '${testConsultId}'`);
  const checkRow = checkHypoRes[0].values[0];
  const storedHypotheses = JSON.parse(checkRow[0] as string);
  const storedRetenus = JSON.parse(checkRow[1] as string);
  const storedPrincipal = checkRow[2];

  if (storedHypotheses.length !== 2) {
    throw new Error(`Nombre d'hypothèses incorrect : ${storedHypotheses.length}`);
  }
  if (storedRetenus.length !== 0) {
    throw new Error(`Erreur : Les hypothèses ont été converties automatiquement en diagnostics retenus !`);
  }
  if (storedPrincipal && String(storedPrincipal).trim()) {
    throw new Error(`Erreur : Le diagnostic principal a été renseigné automatiquement sans décision du médecin !`);
  }
  console.log('✓ Aucune conversion automatique : les 2 hypothèses restent en attente, le bloc Diagnostics Retenus est vide.');

  // Test 5 : Action explicite du médecin pour ajouter un diagnostic retenu & retenir une hypothèse
  console.log('\n[TEST 5] Action explicite du médecin pour retenir une hypothèse et ajouter un diagnostic retenu');
  // Le médecin retient l'hypothèse de paludisme après réception du labo positif
  const promotedHypo = initialHypotheses[0];
  const remainingHypotheses = initialHypotheses.slice(1); // L'autre hypothèse reste en attente

  const updatedRetenus = [
    {
      id: 'diag_ret_1',
      libelle: promotedHypo.libelle,
      statut: 'CONFIRME', // Statut confirmé par la biologie, sans bloc tiers séparé
      is_principal: true,
      precision: 'GE positive à Plasmodium falciparum (40 000 trophozoïtes/µL)',
      created_at: new Date().toISOString()
    },
    {
      id: 'diag_ret_2',
      libelle: 'Anémie modérée normocytaire',
      statut: 'RETENU', // Statut retenu présomptif/clinique
      is_principal: false,
      precision: 'Hb à 9.5 g/dL',
      created_at: new Date().toISOString()
    }
  ];

  db.run(`
    UPDATE consultations
    SET hypotheses_diagnostiques = ?,
        diagnostics_retenus = ?,
        diagnostic_principal = ?
    WHERE id = ?
  `, [
    JSON.stringify(remainingHypotheses),
    JSON.stringify(updatedRetenus),
    updatedRetenus[0].libelle,
    testConsultId
  ]);

  const verifyRes = db.exec(`SELECT hypotheses_diagnostiques, diagnostics_retenus, diagnostic_principal FROM consultations WHERE id = '${testConsultId}'`);
  const vRow = verifyRes[0].values[0];
  const finalHypo = JSON.parse(vRow[0] as string);
  const finalRetenus = JSON.parse(vRow[1] as string);
  const finalPrincipal = vRow[2] as string;

  console.log('Résultats après action explicite du médecin :', {
    hypotheses_restantes: finalHypo.map((h: any) => h.libelle),
    diagnostics_retenus: finalRetenus.map((d: any) => ({ libelle: d.libelle, statut: d.statut, is_principal: d.is_principal })),
    diagnostic_principal_synchro: finalPrincipal
  });

  if (finalHypo.length !== 1 || finalHypo[0].libelle !== 'Pneumopathie bactérienne fébrile') {
    throw new Error('Incohérence sur les hypothèses restantes en attente !');
  }
  if (finalRetenus.length !== 2) {
    throw new Error('Incohérence sur les diagnostics retenus !');
  }
  if (finalPrincipal !== 'Suspicion de Paludisme grave') {
    throw new Error('Synchronisation du diagnostic principal défaillante !');
  }
  if (finalRetenus[0].statut !== 'CONFIRME' || finalRetenus[1].statut !== 'RETENU') {
    throw new Error('Statuts des diagnostics retenus incorrects !');
  }

  console.log('✓ Action explicite réussie : hypothèse promue, diagnostic principal synchronisé, statuts CONFIRMÉ / RETENU distincts sans 3ème bloc inutile.');

  // Test 6 : Nettoyage des mocks de test
  db.run(`DELETE FROM consultations WHERE id IN (?, ?)`, [legacyConsultId, testConsultId]);
  console.log('✓ Données de test nettoyées.');

  console.log('\n======================================================');
  console.log('TOUS LES TESTS DE L\'ÉTAPE MODIFICATION DU DIAGNOSTIC SONT VALIDÉS AVEC SUCCÈS !');
  console.log('======================================================\n');
}

runDiagnosticTests().catch(err => {
  console.error('ÉCHEC DES TESTS :', err);
  process.exit(1);
});
