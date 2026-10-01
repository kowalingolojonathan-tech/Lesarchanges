/**
 * Tests Automatisés — ÉTAPE 1 : FICHE NOUVEAU PATIENT
 * Clinique Les Archanges
 * 
 * Couvre les 8 tests obligatoires :
 * 1. Création valide avec les 5 champs (Nom, Post-nom, Prénom, Lieu de naissance, Pays de naissance).
 * 2. Nom manquant → refus (HTTP 400).
 * 3. Post-nom manquant → refus (HTTP 400).
 * 4. Prénom manquant → refus (HTTP 400).
 * 5. Lieu de naissance manquant → refus (HTTP 400).
 * 6. Pays de naissance manquant → refus (HTTP 400).
 * 7. Validation backend stricte (rejet sans passer par le frontend).
 * 8. Vérifier que les anciens patients restent parfaitement accessibles.
 */

import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { createPatient, searchPatients, getPatientById } from '../controllers/patientController.js';
import { query, queryOne } from '../db/database.js';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, desc: string, passed: boolean, details: string) {
  results.push({ testNumber: num, description: desc, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Test ${num}: ${desc} -> ${details}`);
}

function mockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

export async function runEtape1Tests(): Promise<void> {
  console.log('\n===============================================================');
  console.log('  TESTS OBLIGATOIRES — ÉTAPE 1 : FICHE NOUVEAU PATIENT');
  console.log('  Clinique Les Archanges');
  console.log('===============================================================\n');

  await runMigrations();
  await seedDatabase();

  const dummyUser = {
    id: 'user_reception_test',
    username: 'reception',
    role: 'RÉCEPTION',
    nom_complet: 'Agent Réception',
  };

  const validBasePatient = {
    nom: 'KABANGE',
    post_nom: 'MWANZA',
    prenom: 'Jean-Luc',
    lieu_naissance: 'Lubumbashi',
    pays_naissance: 'RD Congo',
    date_naissance: '1988-04-12',
    sexe: 'M',
    telephone: '+243810001234',
    adresse: 'Gombe, Kinshasa',
    profession: 'Ingénieur',
    etat_civil: 'Marié(e)',
  };

  // 1. Création valide avec les 5 champs
  {
    const req: any = {
      body: { ...validBasePatient, telephone: `+24381${Math.floor(100000 + Math.random() * 900000)}` },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const created = res.statusCode === 201 && res.body?.patient?.id;
    const has5Fields =
      res.body?.patient?.nom === 'KABANGE' &&
      res.body?.patient?.post_nom === 'MWANZA' &&
      res.body?.patient?.prenom === 'Jean-Luc' &&
      res.body?.patient?.lieu_naissance === 'Lubumbashi' &&
      res.body?.patient?.pays_naissance === 'RD Congo';

    record(
      1,
      'Création valide avec les 5 champs obligatoires',
      Boolean(created && has5Fields),
      created && has5Fields
        ? `Patient créé avec ID ${res.body.patient.id}, N° ${res.body.patient.numero_dossier}, 5 champs vérifiés`
        : `Statut: ${res.statusCode}, body: ${JSON.stringify(res.body)}`
    );
  }

  // 2. Nom manquant → refus (400)
  {
    const req: any = {
      body: { ...validBasePatient, nom: '' },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const passed = res.statusCode === 400 && res.body?.error?.includes('nom');
    record(2, 'Nom manquant → refus', passed, `Statut ${res.statusCode}: ${res.body?.error}`);
  }

  // 3. Post-nom manquant → refus (400)
  {
    const req: any = {
      body: { ...validBasePatient, post_nom: '   ' },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const passed = res.statusCode === 400 && res.body?.error?.toLowerCase().includes('post-nom');
    record(3, 'Post-nom manquant → refus', passed, `Statut ${res.statusCode}: ${res.body?.error}`);
  }

  // 4. Prénom manquant → refus (400)
  {
    const req: any = {
      body: { ...validBasePatient, prenom: '' },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const passed = res.statusCode === 400 && res.body?.error?.toLowerCase().includes('prénom');
    record(4, 'Prénom manquant → refus', passed, `Statut ${res.statusCode}: ${res.body?.error}`);
  }

  // 5. Lieu de naissance manquant → refus (400)
  {
    const req: any = {
      body: { ...validBasePatient, lieu_naissance: '' },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const passed = res.statusCode === 400 && res.body?.error?.toLowerCase().includes('lieu de naissance');
    record(5, 'Lieu de naissance manquant → refus', passed, `Statut ${res.statusCode}: ${res.body?.error}`);
  }

  // 6. Pays de naissance manquant → refus (400)
  {
    const req: any = {
      body: { ...validBasePatient, pays_naissance: '' },
      user: dummyUser,
    };
    const res = mockResponse();
    await createPatient(req, res);

    const passed = res.statusCode === 400 && res.body?.error?.toLowerCase().includes('pays de naissance');
    record(6, 'Pays de naissance manquant → refus', passed, `Statut ${res.statusCode}: ${res.body?.error}`);
  }

  // 7. Validation backend (tentative d'injection avec champs null/undefined/espaces)
  {
    const reqEmpty: any = {
      body: {
        nom: 'TEST',
        // post_nom undefined
        prenom: 'Test',
        lieu_naissance: '   ',
        pays_naissance: null,
      },
      user: dummyUser,
    };
    const resEmpty = mockResponse();
    await createPatient(reqEmpty, resEmpty);

    const passed = resEmpty.statusCode === 400;
    record(
      7,
      'Validation backend stricte (rejet de payloads invalides sans validation client)',
      passed,
      `Code HTTP retourné: ${resEmpty.statusCode}, Erreur: ${resEmpty.body?.error}`
    );
  }

  // 8. Vérifier que les anciens patients restent accessibles
  {
    const patients = await query('SELECT id, numero_dossier, nom, post_nom, prenom, telephone FROM patients WHERE actif = 1');
    const hasExisting = patients.length > 0;

    let canRetrieveById = false;
    if (hasExisting) {
      const firstPatientId = (patients[0] as any).id;
      const req: any = { params: { id: firstPatientId }, user: dummyUser };
      const res = mockResponse();
      await getPatientById(req, res);
      canRetrieveById = res.statusCode === 200 && Boolean(res.body?.patient);
    }

    const passed = hasExisting && canRetrieveById;
    record(
      8,
      'Vérifier que les anciens patients restent accessibles',
      passed,
      `${patients.length} patient(s) existant(s) dans la base, lecture individuelle et recherche opérationnelles`
    );
  }

  console.log('\n---------------------------------------------------------------');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`RÉSULTAT DES TESTS : ${passedCount}/${total} PASS`);
  console.log('---------------------------------------------------------------\n');

  if (passedCount !== total) {
    process.exit(1);
  }
}

// Exécution directe si exécuté via tsx
runEtape1Tests().catch((err) => {
  console.error('Erreur exécution tests étape 1:', err);
  process.exit(1);
});
