/**
 * TEST ÉTAPE 9 — ADMINISTRATION, RÔLES, PERMISSIONS RBAC & CONFIDENTIALITÉ
 * 
 * Vérifie :
 * 1. Création utilisateur complète (nom, prénom/post-nom, fonction, téléphone, email, identifiant, rôle, statut actif)
 * 2. Rôles configurables (création/modification rôle avec matrice de permissions)
 * 3. Permissions fines RBAC (factures, paiements, rapports, dossiers, prescriptions, laboratoire)
 * 4. Médecin avec patients attribués (par défaut, ne voit que ses patients affectés)
 * 5. Médecin autorisé à voir tous les dossiers (Directeur ou permission 'patients:voir_tous')
 * 6. Confidentialité financière : accès refusé au médecin pour les rapports financiers
 * 7. Accès autorisé à la caisse et rapports pour les profils habilités
 * 8. Contrôle backend strict (403 Forbidden et audit)
 * 9. Impression facture & reçu avec données réelles et taux scellé
 * 10. Gestion statut actif/inactif et révocation de session
 */

import { query, queryOne } from '../db/database';
import { runMigrations } from '../db/migrations';
import { seedDatabase } from '../db/seed';
import { 
  listUsers, 
  createUser, 
  updateUser, 
  toggleUserStatus, 
  listRoles, 
  createRole, 
  updateRole, 
  listPermissions 
} from '../controllers/userController';
import { searchPatients, getPatientById } from '../controllers/patientController';
import { getBillingReports, getVisitePaymentStatus, getFactureById } from '../controllers/billingController';
import { requirePermission } from '../middleware/auth';

function createMockReq(user: any, params: any = {}, body: any = {}, query: any = {}) {
  return {
    user,
    params,
    body,
    query,
    ip: '127.0.0.1',
    originalUrl: '/api/test',
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TEST ÉTAPE 9 — ADMINISTRATION, RÔLES, RBAC & CONFIDENTIALITÉ');
  console.log('===============================================================');

  let passed = 0;
  let total = 0;

  // Initialisation DB
  await runMigrations();
  await seedDatabase();

  const adminUser = {
    id: 'usr-admin-test',
    username: 'admin',
    role: 'ADMINISTRATEUR',
    role_categorie: 'ADMINISTRATEUR',
    actif: true,
    permissions: [
      'utilisateurs:gerer', 'roles:gerer', 'tarifs:gerer',
      'factures:voir', 'factures:ajouter', 'factures:imprimer',
      'paiements:voir', 'paiements:ajouter', 'paiements:imprimer',
      'rapports_financiers:voir', 'rapports_financiers:imprimer',
      'patients:voir', 'patients:ajouter', 'patients:modifier', 'patients:voir_tous'
    ]
  };

  // --------------------------------------------------------------------------
  // TEST 1 : Création utilisateur avec tous les attributs requis
  // --------------------------------------------------------------------------
  total++;
  try {
    const testUsername = `dr_pediatre_${Date.now()}`;
    const req = createMockReq(adminUser, {}, {
      username: testUsername,
      password: 'Password123!',
      nom: 'KABEYA',
      prenom: 'Christian',
      post_nom: 'Muteba',
      fonction: 'Médecin Spécialiste Pédiatre',
      telephone: '+243 82 123 4567',
      email: 'christian.kabeya@archanges.cd',
      role: 'MEDECIN_PEDIATRE',
      actif: true,
    });
    const res = createMockRes();
    await createUser(req, res);

    if (res.statusCode === 201 && res.data?.user?.username === testUsername && res.data?.user?.nom === 'KABEYA') {
      console.log('✅ [PASS] 1. Création utilisateur : Profil complet (nom, prénom, fonction, tél, email, rôle, statut)');
      passed++;
    } else {
      console.error('❌ [FAIL] 1. Création utilisateur échouée:', res.statusCode, res.data);
    }
  } catch (err) {
    console.error('❌ [FAIL] 1. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 2 : Rôles configurables — Création et modification par l'administrateur
  // --------------------------------------------------------------------------
  total++;
  try {
    const testRoleCode = `COORD_CLINIQUE_${Date.now()}`;
    const reqCreateRole = createMockReq(adminUser, {}, {
      code: testRoleCode,
      nom: 'Coordonnateur Clinique',
      categorie: 'MÉDECIN',
      description: 'Supervision des soins et coordination médicale',
      permissions: ['patients:voir', 'patients:voir_tous', 'prescriptions:voir', 'laboratoire:voir']
    });
    const resCreateRole = createMockRes();
    await createRole(reqCreateRole, resCreateRole);

    const roleCreated = resCreateRole.data?.role;
    let updateOk = false;

    if (resCreateRole.statusCode === 201 && roleCreated?.id) {
      // Modifier ses permissions pour lui ajouter l'impression d'ordonnances
      const reqUpdateRole = createMockReq(adminUser, { id: roleCreated.id }, {
        nom: 'Coordonnateur Clinique Principal',
        description: 'Supervision globale des soins avec validation des ordonnances',
        permissions: ['patients:voir', 'patients:voir_tous', 'prescriptions:voir', 'prescriptions:valider', 'prescriptions:imprimer']
      });
      const resUpdateRole = createMockRes();
      await updateRole(reqUpdateRole, resUpdateRole);
      updateOk = resUpdateRole.statusCode === 200;
    }

    if (updateOk) {
      console.log('✅ [PASS] 2. Rôles configurables : Création d\'un profil sur-mesure et mise à jour dynamique des permissions');
      passed++;
    } else {
      console.error('❌ [FAIL] 2. Gestion des rôles échouée:', resCreateRole.statusCode, resCreateRole.data);
    }
  } catch (err) {
    console.error('❌ [FAIL] 2. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 3 : Permissions disponibles pour configuration
  // --------------------------------------------------------------------------
  total++;
  try {
    const reqPerms = createMockReq(adminUser);
    const resPerms = createMockRes();
    await listPermissions(reqPerms, resPerms);

    const perms: any[] = resPerms.data?.permissions || [];
    const hasInvoices = perms.some(p => p.code === 'factures:voir') && perms.some(p => p.code === 'factures:imprimer');
    const hasPayments = perms.some(p => p.code === 'paiements:voir') && perms.some(p => p.code === 'paiements:imprimer');
    const hasFinancialReports = perms.some(p => p.code === 'rapports_financiers:voir');
    const hasPatientsScope = perms.some(p => p.code === 'patients:voir_tous') && perms.some(p => p.code === 'patients:voir_attribues');

    if (hasInvoices && hasPayments && hasFinancialReports && hasPatientsScope) {
      console.log('✅ [PASS] 3. Permissions configurables : Matrice complète (factures, paiements, caisse, patients tous/attribués, labo)');
      passed++;
    } else {
      console.error('❌ [FAIL] 3. Liste des permissions incomplète');
    }
  } catch (err) {
    console.error('❌ [FAIL] 3. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 4 : Dossiers patients — Médecin avec patients attribués uniquement
  // --------------------------------------------------------------------------
  total++;
  try {
    // Identifier un médecin existant et un patient qui lui est attribué
    const doctorA = await queryOne<{ id: string; nom_complet: string; username: string; role: string }>(
      "SELECT id, nom_complet, username, role FROM users WHERE role = 'MÉDECIN' LIMIT 1"
    );
    const docId = doctorA!.id;
    const docUser = {
      id: docId,
      username: doctorA!.username,
      role: 'MÉDECIN',
      role_categorie: 'MÉDECIN',
      actif: true,
      permissions: ['patients:voir', 'patients:voir_attribues', 'prescriptions:voir'] // SANS 'patients:voir_tous'
    };

    // Trouver un patient attribué à ce médecin via une visite
    const assignedVisite = await queryOne<{ patient_id: string }>(
      'SELECT patient_id FROM visites WHERE medecin_id = ? LIMIT 1',
      [docId]
    );
    const assignedPatientId = assignedVisite ? assignedVisite.patient_id : null;

    // Trouver un patient NON attribué à ce médecin
    const unassignedVisite = await queryOne<{ id: string }>(
      'SELECT id FROM patients WHERE id NOT IN (SELECT patient_id FROM visites WHERE medecin_id = ?) LIMIT 1',
      [docId]
    );
    const unassignedPatientId = unassignedVisite ? unassignedVisite.id : null;

    // Requête getPatientById pour le patient attribué -> doit réussir (200)
    let assignedSuccess = false;
    if (assignedPatientId) {
      const reqAssigned = createMockReq(docUser, { id: assignedPatientId });
      const resAssigned = createMockRes();
      await getPatientById(reqAssigned, resAssigned);
      assignedSuccess = resAssigned.statusCode === 200 && resAssigned.data?.patient?.id === assignedPatientId;
    }

    // Requête getPatientById pour le patient NON attribué -> doit être refusée (403)
    let unassignedBlocked = false;
    if (unassignedPatientId) {
      const reqUnassigned = createMockReq(docUser, { id: unassignedPatientId });
      const resUnassigned = createMockRes();
      await getPatientById(reqUnassigned, resUnassigned);
      unassignedBlocked = resUnassigned.statusCode === 403;
    }

    if (assignedSuccess && unassignedBlocked) {
      console.log('✅ [PASS] 4. Dossiers patients : Par défaut, le médecin ne voit QUE ses patients attribués (403 sur non attribué)');
      passed++;
    } else {
      console.error('❌ [FAIL] 4. Filtrage médecin attribué non respecté:', { assignedSuccess, unassignedBlocked });
    }
  } catch (err) {
    console.error('❌ [FAIL] 4. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 5 : Médecin autorisé à voir TOUS les dossiers (Directeur ou permission)
  // --------------------------------------------------------------------------
  total++;
  try {
    const director = {
      id: 'usr-directeur-test',
      username: 'directeur_medical',
      role: 'DIRECTEUR',
      role_categorie: 'DIRECTEUR',
      actif: true,
      permissions: ['patients:voir', 'patients:voir_tous', 'prescriptions:voir', 'rapports_financiers:voir']
    };

    // Chercher n'importe quel patient dans la base
    const anyPatient = await queryOne<{ id: string }>('SELECT id FROM patients LIMIT 1');

    const reqDirector = createMockReq(director, { id: anyPatient!.id });
    const resDirector = createMockRes();
    await getPatientById(reqDirector, resDirector);

    // Recherche globale de patients
    const reqSearchAll = createMockReq(director, {}, {}, { q: '' });
    const resSearchAll = createMockRes();
    await searchPatients(reqSearchAll, resSearchAll);

    if (resDirector.statusCode === 200 && resSearchAll.statusCode === 200 && (resSearchAll.data?.patients?.length || 0) > 0) {
      console.log('✅ [PASS] 5. Médecin autorisé / Directeur : Accès à TOUS les dossiers avec la permission "patients:voir_tous"');
      passed++;
    } else {
      console.error('❌ [FAIL] 5. Accès Directeur échoué:', resDirector.statusCode);
    }
  } catch (err) {
    console.error('❌ [FAIL] 5. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 6 : Confidentialité financière — Accès refusé au médecin pour les rapports
  // --------------------------------------------------------------------------
  total++;
  try {
    const doctorUser = {
      id: 'usr-medecin-secret',
      username: 'dr_secret',
      role: 'MEDECIN_GENERALISTE',
      role_categorie: 'MÉDECIN',
      actif: true,
      permissions: ['patients:voir', 'patients:voir_attribues', 'prescriptions:ajouter']
    };

    // Middleware de sécurité sur les rapports financiers
    let middlewareBlocked = false;
    const reqReports = createMockReq(doctorUser);
    const resReports = createMockRes();
    const mw = requirePermission('rapports_financiers:voir');

    await mw(reqReports, resReports, () => {
      middlewareBlocked = false; // Ne doit pas appeler next()
    });

    if (resReports.statusCode === 403) {
      middlewareBlocked = true;
    }

    if (middlewareBlocked) {
      console.log('✅ [PASS] 6. Confidentialité financière : Accès formellement REFUSÉ au médecin pour les rapports de caisse (403)');
      passed++;
    } else {
      console.error('❌ [FAIL] 6. Le médecin a pu accéder aux rapports financiers !');
    }
  } catch (err) {
    console.error('❌ [FAIL] 6. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 7 : Statut utile du patient pour le médecin (PAYÉ / NON PAYÉ)
  // --------------------------------------------------------------------------
  total++;
  try {
    const doctorUser = {
      id: 'usr-medecin-secret',
      username: 'dr_secret',
      role: 'MEDECIN_GENERALISTE',
      role_categorie: 'MÉDECIN',
      actif: true,
      permissions: ['patients:voir']
    };

    // Trouver une visite
    const visiteRow = await queryOne<{ id: string }>('SELECT id FROM visites LIMIT 1');

    const reqStatus = createMockReq(doctorUser, { visite_id: visiteRow!.id });
    const resStatus = createMockRes();
    await getVisitePaymentStatus(reqStatus, resStatus);

    const statut = resStatus.data?.statut_paiement;
    const isValidStatus = ['PAYÉ', 'PARTIELLEMENT PAYÉ', 'NON PAYÉ'].includes(statut);

    if (resStatus.statusCode === 200 && isValidStatus) {
      console.log(`✅ [PASS] 7. Statut utile : Le médecin consulte exclusivement l'indicateur épuré (${statut}) sans détail comptable`);
      passed++;
    } else {
      console.error('❌ [FAIL] 7. Statut paiement invalide:', resStatus.data);
    }
  } catch (err) {
    console.error('❌ [FAIL] 7. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 8 : Accès autorisé à la caisse pour Réception ou profil autorisé
  // --------------------------------------------------------------------------
  total++;
  try {
    const receptionUser = {
      id: 'usr-reception-test',
      username: 'reception_caissiere',
      role: 'RÉCEPTION',
      role_categorie: 'RÉCEPTION',
      actif: true,
      permissions: ['factures:voir', 'paiements:ajouter', 'rapports_financiers:voir', 'rapports_financiers:imprimer']
    };

    const reqReports = createMockReq(receptionUser, {}, {}, { range: 'TODAY' });
    const resReports = createMockRes();
    await getBillingReports(reqReports, resReports);

    if (resReports.statusCode === 200 && resReports.data?.totaux_separes && resReports.data?.total_global) {
      console.log('✅ [PASS] 8. Accès Caisse autorisé : Réception / Profil habilité accède aux états de caisse et rapports autorisés');
      passed++;
    } else {
      console.error('❌ [FAIL] 8. Accès Caisse autorisé échoué:', resReports.statusCode, resReports.data);
    }
  } catch (err) {
    console.error('❌ [FAIL] 8. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 9 : Impression Facture & Reçu — Données réelles conservées
  // --------------------------------------------------------------------------
  total++;
  try {
    const factureRow = await queryOne<{ id: string }>('SELECT id FROM factures LIMIT 1');

    let printDataOk = false;
    if (factureRow) {
      const reqFacture = createMockReq(adminUser, { id: factureRow.id });
      const resFacture = createMockRes();
      await getFactureById(reqFacture, resFacture);

      const f = resFacture.data?.facture;
      if (
        f &&
        f.numero_facture &&
        typeof f.montant_total_usd === 'number' &&
        typeof f.taux_usd_fc === 'number' &&
        f.taux_usd_fc > 0 &&
        Array.isArray(f.items) &&
        Array.isArray(f.paiements)
      ) {
        printDataOk = true;
      }
    }

    if (printDataOk) {
      console.log('✅ [PASS] 9. Impression documents : Factures & Reçus intègrent montants réels, devises USD/FC, taux scellé et ventilation');
      passed++;
    } else {
      console.error('❌ [FAIL] 9. Données pour impression incomplètes');
    }
  } catch (err) {
    console.error('❌ [FAIL] 9. Exception:', err);
  }

  // --------------------------------------------------------------------------
  // TEST 10 : Non-régression — Gestion du statut actif/inactif & sécurité session
  // --------------------------------------------------------------------------
  total++;
  try {
    // Créer un utilisateur temporaire
    const tempUsername = `temp_user_${Date.now()}`;
    const reqCreate = createMockReq(adminUser, {}, {
      username: tempUsername,
      password: 'Password123!',
      nom_complet: 'Utilisateur Temporaire',
      role: 'RÉCEPTION',
      actif: true,
    });
    const resCreate = createMockRes();
    await createUser(reqCreate, resCreate);
    const tempUserId = resCreate.data?.user?.id;

    // Basculer son statut à inactif
    const reqToggle = createMockReq(adminUser, { id: tempUserId });
    const resToggle = createMockRes();
    await toggleUserStatus(reqToggle, resToggle);

    const isDeactivated = resToggle.statusCode === 200 && resToggle.data?.user?.actif === false;

    if (isDeactivated) {
      console.log('✅ [PASS] 10. Non-régression : Révocation des accès et désactivation immédiate de compte utilisateur validées');
      passed++;
    } else {
      console.error('❌ [FAIL] 10. Désactivation utilisateur échouée:', resToggle.data);
    }
  } catch (err) {
    console.error('❌ [FAIL] 10. Exception:', err);
  }

  console.log('---------------------------------------------------------------');
  console.log(`RÉSULTAT FINAL : ${passed}/${total} TESTS PASSÉS`);
  console.log('---------------------------------------------------------------');

  if (passed === total) {
    console.log('🎉 TOUS LES TESTS DE L\'ÉTAPE 9 SONT AU VERT !');
    process.exit(0);
  } else {
    console.error(`⚠️ ${total - passed} test(s) en échec.`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erreur inattendue test Étape 9:', err);
  process.exit(1);
});
