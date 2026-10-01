/**
 * TEST ÉTAPE 8 — FACTURATION, TARIFS, TAUX USD/FC, MULTI-PRESTATIONS & RAPPORTS
 * 
 * Vérifie :
 * 1. TARIFS : Configuration et gestion des 5 prestations (visite, consultation, labo, imagerie, acte)
 * 2. TAUX USD -> FC : Définition du taux 1 USD = X FC et persistance
 * 3. FACTURE MULTI-PRESTATIONS : Émission d'une facture avec cumul de plusieurs prestations et prix USD
 * 4. PAIEMENT USD / FC : Choix de la devise de règlement, conservation du montant réel et du taux scellé
 * 5. PAIEMENT PARTIEL : Cycle NON PAYÉ -> PARTIELLEMENT PAYÉ -> PAYÉ avec suivi du solde restant
 * 6. RAPPORTS DE CAISSE : Totaux séparés (USD et FC), rapport global en FC (par défaut) et en USD
 * 7. VISIBILITÉ MÉDECIN & LABO : Statut lecture seule PAYÉ / PARTIELLEMENT PAYÉ / NON PAYÉ et sécurité RBAC
 */

import { getDb, saveDb } from '../db/database';
import { runMigrations } from '../db/migrations';
import { seedDatabase } from '../db/seed';
import { 
  getTarifs, 
  createTarif, 
  updateTarif, 
  toggleTarifActif, 
  getExchangeRate, 
  updateExchangeRate, 
  createFacture, 
  recordPaiement, 
  getFactures, 
  getFactureById, 
  getBillingReports, 
  getVisitePaymentStatus 
} from '../controllers/billingController';

function createMockReq(user: any, params: any = {}, body: any = {}, query: any = {}) {
  return {
    user,
    params,
    body,
    query,
    ip: '127.0.0.1',
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
  console.log('🧪 TEST ÉTAPE 8 — FACTURATION, TARIFS ET DEVISES (USD / FC)');
  console.log('===============================================================');

  const db = await getDb();
  await runMigrations();
  await seedDatabase();

  let passCount = 0;
  const totalTests = 8;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passCount++;
      console.log(`✅ [PASS] ${desc}`);
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // Utilisateurs de rôles différents
  const adminUser = { id: 'usr-admin-01', username: 'admin', nom_complet: 'Admin Test', role: 'ADMINISTRATEUR' };
  const recepUser = { id: 'usr-recep-01', username: 'reception', nom_complet: 'Réception Test', role: 'RÉCEPTION' };
  const medUser = { id: 'usr-med-01', username: 'dr.sawadogo', nom_complet: 'Dr. Sawadogo', role: 'MÉDECIN' };
  const labUser = { id: 'usr-lab-01', username: 'labo.biologiste', nom_complet: 'Dr. Kalonji', role: 'LABORATOIRE' };

  // Création d'un patient et d'une visite pour le test
  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const patientId = `pat-test-fact-${Date.now()}-${randSuffix}`;
  const dossierNum = `DOS-FAC-${Date.now()}-${randSuffix}`;
  const visiteNum = `VIS-FAC-${Date.now()}-${randSuffix}`;
  const now = new Date().toISOString();
  db.exec(`
    INSERT INTO patients (id, numero_dossier, nom, prenom, date_naissance, sexe, telephone, actif, created_at, updated_at)
    VALUES ('${patientId}', '${dossierNum}', 'KABAMBA', 'Jean-Luc', '1990-05-15', 'M', '0812345678', 1, '${now}', '${now}');
  `);

  const visiteId = `vis-test-fact-${Date.now()}-${randSuffix}`;
  db.exec(`
    INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, type_visite, actif, created_at)
    VALUES ('${visiteId}', '${visiteNum}', '${patientId}', '${medUser.id}', '${now}', 'ATTENTE_MEDECIN', 'STANDARD', 1, '${now}');
  `);
  saveDb();

  // -------------------------------------------------------------------------------------------------
  // 1. TARIFS : Configuration et ajout dans l'administration (5 catégories)
  // -------------------------------------------------------------------------------------------------
  const reqTarifs = createMockReq(recepUser);
  const resTarifs = createMockRes();
  await getTarifs(reqTarifs, resTarifs);

  const categoriesPresentes = new Set((resTarifs.data?.tarifs || []).map((t: any) => t.categorie));
  const has5Categories = ['TYPE_VISITE', 'CONSULTATION', 'EXAMEN_LABORATOIRE', 'IMAGERIE', 'ACTE_SERVICE'].every(c => categoriesPresentes.has(c));

  // Ajout d'une nouvelle prestation par l'admin
  const reqCreateTarif = createMockReq(adminUser, {}, {
    nom: 'Electrocardiogramme (ECG)',
    categorie: 'ACTE_SERVICE',
    prix_usd: 25.0,
    actif: 1,
    description: 'Enregistrement tracé 12 dérivations'
  });
  const resCreateTarif = createMockRes();
  await createTarif(reqCreateTarif, resCreateTarif);

  const newTarifId = resCreateTarif.data?.tarif?.id;

  // Modification et bascule actif/inactif
  const reqToggle = createMockReq(adminUser, { id: newTarifId });
  const resToggle = createMockRes();
  await toggleTarifActif(reqToggle, resToggle);

  assert(
    has5Categories && resCreateTarif.statusCode === 201 && resCreateTarif.data?.tarif?.prix_usd === 25 && resToggle.data?.actif === 0,
    "1. Tarifs : Configuration des 5 catégories de prestations, ajout en USD et gestion du statut actif/inactif"
  );

  // Réactivation pour les tests suivants
  await toggleTarifActif(createMockReq(adminUser, { id: newTarifId }), createMockRes());

  // -------------------------------------------------------------------------------------------------
  // 2. TAUX USD → FC : Définition du taux officiel 1 USD = X FC
  // -------------------------------------------------------------------------------------------------
  const reqRate = createMockReq(recepUser);
  const resRate = createMockRes();
  await getExchangeRate(reqRate, resRate);
  const initialRate = resRate.data?.rate;

  // Mise à jour du taux officiel à 2900 FC
  const reqUpdateRate = createMockReq(adminUser, {}, { rate: 2900 });
  const resUpdateRate = createMockRes();
  await updateExchangeRate(reqUpdateRate, resUpdateRate);

  const reqVerifyRate = createMockReq(recepUser);
  const resVerifyRate = createMockRes();
  await getExchangeRate(reqVerifyRate, resVerifyRate);

  assert(
    resUpdateRate.data?.success === true && resVerifyRate.data?.rate === 2900 && resVerifyRate.data?.currency_to === 'FC',
    `2. Taux USD → FC : Définition officielle de 1 USD = 2900 FC et persistance vérifiée`
  );

  // -------------------------------------------------------------------------------------------------
  // 3. FACTURATION MULTI-PRESTATIONS PAR LA RÉCEPTION
  // -------------------------------------------------------------------------------------------------
  // Sélection de 3 prestations :
  // - 1 Consultation médecine générale (20 USD)
  // - 1 Examen labo Goutte épaisse (10 USD)
  // - 2 Pansements simples (2 x 10 USD = 20 USD)
  // Total attendu : 50 USD (Équivalent : 50 * 2900 = 145,000 FC)
  const reqInvoice = createMockReq(recepUser, {}, {
    patient_id: patientId,
    visite_id: visiteId,
    notes: 'Facturation initiale consultation et soins d\'accueil',
    items: [
      { description: 'Consultation Médecine Générale', categorie: 'CONSULTATION', quantite: 1, prix_unitaire: 20 },
      { description: 'Goutte Épaisse & Frottis (Paludisme)', categorie: 'EXAMEN_LABORATOIRE', quantite: 1, prix_unitaire: 10 },
      { description: 'Pansement Simple & Désinfection', categorie: 'ACTE_SERVICE', quantite: 2, prix_unitaire: 10 }
    ]
  });
  const resInvoice = createMockRes();
  await createFacture(reqInvoice, resInvoice);

  const createdFacture = resInvoice.data?.facture;

  assert(
    resInvoice.statusCode === 201 &&
    createdFacture?.montant_total_usd === 50 &&
    createdFacture?.montant_total_fc === 145000 &&
    createdFacture?.taux_usd_fc === 2900 &&
    createdFacture?.statut === 'NON PAYÉ' &&
    createdFacture?.items?.length === 3,
    "3. Facturation Multi-Prestations : Cumul de 3 prestations, calcul exact en USD (50 $) et conversion FC au taux scellé (145 000 FC)"
  );

  const factureId = createdFacture.id;

  // -------------------------------------------------------------------------------------------------
  // 4. PAIEMENT PARTIEL EN USD (Statut -> PARTIELLEMENT PAYÉ)
  // -------------------------------------------------------------------------------------------------
  // Versement d'un acompte de 20 USD sur les 50 USD dus
  const reqPay1 = createMockReq(recepUser, { id: factureId }, {
    montant_paye: 20,
    devise: 'USD',
    mode_paiement: 'ESPECES',
    notes: 'Acompte espèces USD au guichet'
  });
  const resPay1 = createMockRes();
  await recordPaiement(reqPay1, resPay1);

  const afterPay1 = resPay1.data?.facture;

  assert(
    resPay1.data?.success === true &&
    afterPay1?.statut === 'PARTIELLEMENT PAYÉ' &&
    afterPay1?.total_paye_usd === 20 &&
    afterPay1?.solde_usd === 30 &&
    afterPay1?.solde_fc === 87000,
    "4. Paiement partiel USD : Acompte de 20 USD, solde restant 30 USD (87 000 FC) et statut PARTIELLEMENT PAYÉ"
  );

  // -------------------------------------------------------------------------------------------------
  // 5. PAIEMENT DU SOLDE EN FC (Statut -> PAYÉ) AVEC CONSERVATION STRICTE DE LA DEVISE RÉELLE
  // -------------------------------------------------------------------------------------------------
  // Règlement du solde restant (30 USD) en Francs Congolais : 30 * 2900 = 87 000 FC
  const reqPay2 = createMockReq(recepUser, { id: factureId }, {
    montant_paye: 87000,
    devise: 'FC',
    mode_paiement: 'MOBILE_MONEY',
    reference_transaction: 'MPESA-TX-9921',
    notes: 'Règlement final par M-Pesa en Francs Congolais'
  });
  const resPay2 = createMockRes();
  await recordPaiement(reqPay2, resPay2);

  const afterPay2 = resPay2.data?.facture;
  const paiementsHistorique = afterPay2?.paiements || [];

  const payement1 = paiementsHistorique.find((p: any) => p.devise === 'USD');
  const payement2 = paiementsHistorique.find((p: any) => p.devise === 'FC');

  assert(
    resPay2.data?.success === true &&
    afterPay2?.statut === 'PAYÉ' &&
    afterPay2?.solde_usd === 0 &&
    payement1?.montant_paye === 20 && payement1?.devise === 'USD' &&
    payement2?.montant_paye === 87000 && payement2?.devise === 'FC' && payement2?.taux_usd_fc === 2900,
    "5. Paiement en FC & Solde intégral : 87 000 FC réglés, statut PAYÉ, devises et montants réels conservés sans écrasement"
  );

  // -------------------------------------------------------------------------------------------------
  // 6. RAPPORTS DE CAISSE : TOTAUX SÉPARÉS USD / FC ET VUE GLOBALE (FC PAR DÉFAUT, USD DISPONIBLE)
  // -------------------------------------------------------------------------------------------------
  // Le rapport doit afficher séparément :
  // - Total payé en USD (20.00 USD)
  // - Total payé en FC (87 000 FC)
  // - Rapport global en FC par défaut : 20 * 2900 + 87 000 = 145 000 FC
  // - Rapport global en USD : 20 + 87000 / 2900 = 50.00 USD
  const reqReportFc = createMockReq(recepUser, {}, {}, { devise_vue: 'FC' });
  const resReportFc = createMockRes();
  await getBillingReports(reqReportFc, resReportFc);

  const reportFcData = resReportFc.data;

  const reqReportUsd = createMockReq(recepUser, {}, {}, { devise_vue: 'USD' });
  const resReportUsd = createMockRes();
  await getBillingReports(reqReportUsd, resReportUsd);

  const reportUsdData = resReportUsd.data;

  assert(
    reportFcData?.devise_vue_par_defaut === 'FC' &&
    reportFcData?.totaux_separes?.total_paye_usd >= 20 &&
    reportFcData?.totaux_separes?.total_paye_fc >= 87000 &&
    reportFcData?.total_global?.montant_fc >= 145000 &&
    reportUsdData?.total_global?.montant_usd >= 50,
    "6. Rapports de caisse : Totaux séparés USD et FC, vue globale en FC par défaut et consultable en USD avec conversion scellée"
  );

  // -------------------------------------------------------------------------------------------------
  // 7. VISIBILITÉ MÉDECIN ET LABORATOIRE : STATUT PAYÉ / PARTIELLEMENT PAYÉ / NON PAYÉ
  // -------------------------------------------------------------------------------------------------
  // Création d'une visite non facturée pour tester le statut NON PAYÉ
  const visiteNonPayeeId = `vis-nonpaye-${Date.now()}-${randSuffix}`;
  const visiteNonPayeeNum = `VIS-NONPAYE-${Date.now()}-${randSuffix}`;
  db.exec(`
    INSERT INTO visites (id, numero_visite, patient_id, medecin_id, date_arrivee, statut, type_visite, actif, created_at)
    VALUES ('${visiteNonPayeeId}', '${visiteNonPayeeNum}', '${patientId}', '${medUser.id}', '${now}', 'ATTENTE_MEDECIN', 'STANDARD', 1, '${now}');
  `);
  saveDb();

  const reqMedStatusPaye = createMockReq(medUser, { visite_id: visiteId });
  const resMedStatusPaye = createMockRes();
  await getVisitePaymentStatus(reqMedStatusPaye, resMedStatusPaye);

  const reqLabStatusNonPaye = createMockReq(labUser, { visite_id: visiteNonPayeeId });
  const resLabStatusNonPaye = createMockRes();
  await getVisitePaymentStatus(reqLabStatusNonPaye, resLabStatusNonPaye);

  assert(
    resMedStatusPaye.data?.statut_paiement === 'PAYÉ' &&
    resLabStatusNonPaye.data?.statut_paiement === 'NON PAYÉ',
    "7. Visibilité Médecin & Labo : Accès au statut PAYÉ pour la visite réglée et NON PAYÉ pour la visite non facturée"
  );

  // -------------------------------------------------------------------------------------------------
  // 8. CONTRÔLE DE SÉCURITÉ ET SÉPARATION DES RÔLES
  // -------------------------------------------------------------------------------------------------
  // Rejet d'un paiement excédant le solde dû
  const reqTropPercu = createMockReq(recepUser, { id: factureId }, {
    montant_paye: 100,
    devise: 'USD'
  });
  const resTropPercu = createMockRes();
  await recordPaiement(reqTropPercu, resTropPercu);

  assert(
    resTropPercu.statusCode === 400 && resTropPercu.data?.error?.includes('déjà intégralement payée'),
    "8. Sécurité financière : Rejet des paiements excédentaires sur une facture soldée et intégrité de caisse garantie"
  );

  console.log('---------------------------------------------------------------');
  console.log(`RÉSULTAT FINAL : ${passCount}/${totalTests} TESTS PASSÉS`);
  console.log('---------------------------------------------------------------');
  if (passCount === totalTests) {
    console.log("🎉 TOUS LES TESTS DE L'ÉTAPE 8 SONT AU VERT !");
  } else {
    console.error(`⚠️ Certains tests ont échoué : ${passCount}/${totalTests}`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erreur d'exécution des tests Étape 8 :", err);
  process.exit(1);
});
