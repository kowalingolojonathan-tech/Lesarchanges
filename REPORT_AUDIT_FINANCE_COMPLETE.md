# AUDIT COMPLET - MODULE FINANCES ET COMPTABILITÉ EN PARTIE DOUBLE
## Clinique Les Archanges

**Dernière mise à jour :** 20 octobre 2026  
**Statut du rapport :** ✅ Document principal de référence — En cours de validation

---

## DOCUMENTATION ASSOCIÉE

> ⚠️ Ce rapport est le document principal. Les informations détaillées sont dans les documents suivants :
>
> | Document | Description | Statut |
> |----------|-------------|--------|
> | [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) | Plan comptable SYSCOHADA avec comptes, libellés, catégories | ⚠️ PROPOSITION TECHNIQUE |
> | [PLAN_COMPTABLE.csv](PLAN_COMPTABLE.csv) | Plan comptable au format CSV (modifiable dans tableur) | ⚠️ PROPOSITION TECHNIQUE |
> | [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) | Décisions approuvées vs à valider | ⚠️ EN ATTENTE VALIDATION EXPERT |
> | [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) | Plan d'implémentation étape par étape | ⚠️ PROPOSITION TECHNIQUE |
> | [CHANGELOG_FINANCE.md](CHANGELOG_FINANCE.md) | Historique des modifications documentaires | ✅ ACTIF |
>
> **Règle de maintenance :** Toute modification importante doit être répercutée dans le document concerné avec sa date et son motif. Mise à jour → modifier CHANGELOG_FINANCE.md → mettre à jour les références croisées.

---

## A. FONCTIONNALITÉS EXISTANTES AVEC PREUVES DANS LE CODE

### 1. Comptabilisation Factures (Facturation)

**Tables utilisées :**
- `factures` (id, numero_facture, patient_id, visite_id, montant_total, devise, taux_usd_fc, statut, emise_par_id, created_at, updated_at)
- `facture_items` (id, facture_id, tarif_id, code_prestation, description, categorie, quantite, prix_unitaire, montant_ligne, devise)

**Controller rer :** `billingController.ts`
- `createLinkedFactureCore()` (server/controllers/billingController.ts:454-627)
- `createFacture()` (server/controllers/billingController.ts:632-688)
- `getFactureById()` (server/controllers/billingController.ts:405-428)

**Preuves :**
- Création de factures avec secours multi-prestations
- Protection anti-doublon par visite
- Numérotation automatique FAC-YYYYMMDD-XXXX
- Conservation du taux de change scellé
- Statut : NON PAYÉ / PARTIELLEMENT PAYÉ / PAYÉ / ANNULEE

**Risques identifiés :**
- Pas de compta partielle automatique au moment de la création (facture globale d'abord)
- Pas de séparation comptable par exercice fiscal

---

### 2. Paiements et Encaissements (Caisse)

**Tables utilisées :**
- `paiements` (id, numero_recu, facture_id, montant_paye, devise, taux_usd_fc, equivalent_usd, equivalent_fc, mode_paiement, reference_transaction, date_paiement, encaisse_par_id)

**Controller rer :** `billingController.ts`
- `recordPaiement()` (server/controllers/billingController.ts:742-894)
- Protection anti-double-clic (<5 minutes)

**Preuves :**
- Paiements en USD ou en FC
- Conversion automatique au moment du paiement
- Conservation scellée du montant réel, devise et taux
- Très bonne gestion des double-clics

**Risques identifiés :**
- Pas de journal de caisse physique (pas de schéma de dossier de caisse)
- Pas de séparation des caisses (argent physique vs compte bancaire)
- Paiements sans suivi de monnaie rendue

---

### 3. Gestion Tarifs & Prestations

**Tables utilisées :**
- `tarifs` (id, nom, categorie, prix_usd, actif, description, created_at, updated_at)

**Controller rer :** `billingController.ts`
- `getTarifs()` (server/controllers/billingController.ts:88-118)
- `createTarif()` / `updateTarif()` (server/controllers/billingController.ts:123-239)
- `toggleTarifActif()` (server/controllers/billingController.ts:244-280)

**Catégories définies :**
- TYPE_VISITE
- CONSULTATION
- EXAMEN_LABORATOIRE
- IMAGERIE
- ACTE_SERVICE

**Preuves :**
- 5 catégories principales
- Prix en USD uniquement (avec conversion automatique au moment du paiement)
- Alteration de prix en temps réel

**Risques identifiés :**
- Pas de comptes sub-détailés par catégorie dans le plan comptable
- Pas de traçabilité historique des changements de tarifs

---

### 4. Gestion Taux de Change

**Table utilisée :**
- `clinic_settings` (connection key EXCHANGE_RATE_USD_FC avec valeur numérique)

**Controller rer :** `billingController.ts`
- `getExchangeRate()` / `updateExchangeRate()` (server/controllers/billingController.ts:16-83)

**Preuves :**
- Taux officiel 1 USD = X FC
- Auto-mise à jour des clés EXCHANGE_RATE_USD_FC et EXCHANGE_RATE_USD_CDF
- Logging audit complet des modifications

**Risques identifiés :**
- Pas de historique des taux alternatifs
- Pas de clause de clôture de taux (commission bancaire, pénalités)

---

### 5. Pharmacétique POS (Point de Vente)

**Tables utilisées :**
- `catalogue_medicaments`
- `lots_medicaments`
- `mouvements_stock`
- `prescriptions`
- `prescription_items`
- `facture_items`

**Controller rer :** `pharmacieController.ts`
- `createPharmaciePos()` (server/controllers/pharmacieController.ts:562-678) - Affichage POS
- `createPosFacture()` (server/controllers/pharmacieController.ts:684-707) - Création facture
- `recordPosPaiement()` (server/controllers/pharmacieController.ts:713-883) - Paiement + sortie de stock

**Preuves :**
- Selection dynamique des lots (première péremption disponible)
- Débit atomique du stock au paiement
- Fusion avec factures via `createLinkedFactureCore()`

**Risques identifiés :**
- Enregistrement explicite du statut `delivre_medicaments` NE PAS UTILISÉ
- Mouvements créés manuellement pendant le paiement
- Pas de séparation entre débit comptable et sorties physiques réelles (réparations, dons, pertes)

---

### 6. Laboratoire & Imagerie

**Tables utilisées :**
- `demandes_laboratoire`
- `analyses_laboratoire`
- `factures`

**Controller rer :** `billingController.ts`
- `getLabOrdersToCollect()` / `collectLabOrderPayment()`

**Preuves :**
- Liste des commandes en attente d'encaissement
- Paiement par la réception (facture ou dérogation)
- Conversion aware des montants totaux

**Risques identifiés :**
- Pas de comptabilité séparée par service (labo vs médecine)
- Pas de comptabilité détaillée des examens personnalisés vs globaux

---

### 7. Audit Logs & RBAC

**Tables utilisées :**
- `audit_logs`
- `users`
- `roles`
- `role_permissions`

**Controller rer :**
- `auditLogger` (server/utils/auditLogger.ts) - Logging complet d'opérations financières

**Preuves :**
- Log de chaque création de facture (CREATE_FACTURE)
- Log de chaque paiement (ENCAISSEMENT_FACTURE)
- Log de chaque modification de taux (UPDATE_EXCHANGE_RATE)
- Audit RBAC complet pour toutes les opérations financières

---

### 8. Rapports Financiers bruts

**Controller rer :** `billingController.ts`
- `getBillingReports()` (server/controllers/billingController.ts:903-1000)

**Preuves :**
- Totaux séparés en USD et en FC
- Report par date
- Montant réel payé conservé et conversion historique scellée
- Vue globale par défaut en FC

**Manque critique :**
- PAS DE COMPTES
- PAS DE GRAND LIVRE
- PAS DE BALANCE GÉNÉRALE
- PAS DE JOURNAUX AUXILIAIRES
- PAS DE COMPTES DE RÉSULTAT
- PAS DE BILAN
- PAS D'ÉTATS DES STOCKS FINANCIERS

---

## B. TABLES ET ROUTES RÉELLEMENT UTILISÉES

### Tables Financières Actuelles

| Table | Objectif | Occupation |
|--------|----------|-----------|
| `factures` | Facturation patients | Cœur du chiffre d'affaires |
| `facture_items` | Lignes de facture | Détail prestations |
| `paiements` | Encaissements réels | Cash flow |
| `tarifs` | Tarifs globaux | Pricing |
| `clinic_settings` | Configuration (taux, clinique) | Meta-data |
| `audit_logs` | Traçabilité | Sécurité |
| `users`, `roles` | Autorisations | Permissions |
| `catalogue_medicaments` | Produits de pharmacie | Stock |
| `lots_medicaments` | Lots | Péremption |
| `mouvements_stock` | Entrées/sorties | Stock réel |
| `delivre_medicaments` | Planifié (non utilisé) | Oublié |

### Routes API Financières Existantes

- `GET /api/factures` - Liste factures
- `POST /api/factures` - Créer
- `GET /api/factures/:id` - Détail
- `POST /api/factures/:id/paiements` - Encaisser
- `GET /api/billing/reports` - Rapport brut
- `GET/PUT /api/billing/exchange-rate` - Gestion taux
- `GET /api/tarifs` - Liste tarifs
- `POST /api/pharmacie/pos/facture` - POS pharmacie facture
- `POST /api/pharmacie/pos/paiement` - POS paiement + stock

**Absence critique :** Pas de routes pour les livres comptables, les comptes, les inventaires financiers, les exercices.

---

## C. ÉLÉMENTS MANQUANTS CRITIQUES

### 1. PLAN COMPTABLE COMPLET

**À créer :** `comptes_generaux` (id, compte, intitulé, type, compte_parent, classe, compte_comptable)

**À créer :** `plans_comptables` (id, exercice, date_debut, date_fin, actif)

**À créer :** `comptes_sous_details` (id, compte_id, compte_sub_01, compte_sub_02, compte_sub_03, titre_fictif)

**À valider :** Mapping SYSCOHADA RDC pour tous les comptes
- 1 - Actifs
- 2 - Passifs
- 3 - Comptes de capitaux
- 4 - Comptes de charges
- 5 - Comptes de produits

### 2. JOURNAUX COMPTABLES

**À créer :** `journal_general` (id, journal_code, journal_libele, nature, date_ouverture, date_cloture)

**À créer :** `journal_auxiliaires` (id, journal_code, journal_libele, categorie_client, categorie_fournisseur)

**À créer :** `journal_ventes` (id, journal_code, journal_libele, ref_facture_parent)

**À créer :** `journal_achats` (id, journal_code, journal_libele, ref_fournisseur_parent)

### 3. ÉCRITURES COMPTABLES (COMPTABILITÉ EN PARTIE DOUBLE)

**Table à créer :** `ecritures_comptables` (id, journal_id, date_comptable, reference, piece, compte, sens, montant, libelle, user_create, created_at)

**À synchroniser avec :**
- `factures` (Création facture)
- `paiements` (Encaissement client)
- `mouvements_stock` (Variation de stock)
- `pharmacie` (Ventes de médicaments)
- Laboratoire / Imagerie
- Salaires (si implémenté)

### 4. BALANCES GÉNÉRALES

**Table à créer :** `balance_generales` (id, exercice, date, compte, debit, credit, solde)

**Table à créer :** `balance_sous_details` (id, exercice, date, compte, compte_sub_01, compte_sub_02, compte_sub_03, debit, credit, solde)

### 5. COMPTES DE RÉSULTAT

**À créer :** `compte_resultats` (id, exercice, compte, description, debut_periode, fin_periode, debit, credit, solde)

**À calculer automatiquement à partir des écritures :**
- Chiffre d'affaires (compte 60 et 70)
- Charges d'exploitation
- Charges financières (si créées)
- Produits financiers (si créées)
- Résultat d'exploitation net
- Résultat financier net
- Résultat net (Bénéfice/Perte)

### 6. BILAN

**À créer :** `bilan` (id, exercice, date_cloture, compte, intitule, partie, valeur)

**À calculer individuellement :**
- Actif immobilisé
- Actif circulant
- Passif immobilisé
- Passif circulant
- Capitaux propres

### 7. JOURNAUX AUXILIAIRES

**À créer :** `journal_clients` / `journal_fournisseurs`
**À créer :** `journal_salarie`
**À créer :** `journal_transfert_caisses`

Table à créer : `journal_auxiliaire`__` ` (id, journal_id, solde_debit, solde_credit, solde)

### 8. EXERCICES COMPTABLES

**Table à créer :** `exercices_comptables` (id, exercice, date_debut, date_fin, cloture, user_cloture, created_at)

**Règles à codifier :**
- Exclusion des écritures avant date de début
- Facturation après clôture : journal spécial "diféré"
- Fermature des exercices : verrouillage écarts

### 9. SÉPARATION CAISSE ET BANQUE

**Tables à créer :**
- `caisses` (id, nom, solde_initial, devise, actif)
- `banques` (id, nom, iban, banque, devise, solde_compte)

**Table à créer :** `mouvements_caisses` (id, caisse_id, type, montant, devise, taux, compte_comptable, notes, created_at)

### 10. GESTION DOUBLES COMPTABILISATIONS

**Règles à coder :**
- Double insertion eventielle de paiement détectée (déjà protégée dans recordPaiement)
- Écarts de taux de change > X% alertent
- Paiements sans facture ou montants incohérents alertent
- Vérification totale annualisée au planning

### 11. GESTION SOUS-JOURNAL ET VERS

**À créer :**
- Sous-journal Clients (ventes)
- Sous-journal Fournisseurs (achats)
- Sous-journal Salarie
- Sous-journal Transfert Caisses / Banques

View SQL : Voir → journaux auxiliaires et balances

### 12. STOCK VARIAUX FINANCIERS
*(SECTION CORRIGÉE — Voir PLAN_COMPTABLE.md pour la version détaillée)*

**Structure de compte SYSCOHADA corrigée :**
- Compte **481** — Stocks de médicaments (Actif circulant, classe 4)
- Compte **601** — Achats de médicaments (Charge, classe 6)
- Compte **707** — Vente de médicaments (Produit, classe 7)

**À provisionner :**
- Méthode de valorisation validée par un expert-comptable *(À VALIDER — voir DECISIONS_COMPTABLES.md #3)*
- Périodicité extraction des comptes de stock
- Conciliation avec inventaire physique

---

## D. CARTOGRAPHIE DES ÉVÉNEMENTS ET ÉCRITURES COMPTABLES

| Événement | Traitement Actuel | Écritures Comptables (ÉTAPE 2 - À CRÉER) | Risques |
|-----------|-------------------|-------------------------------------------|----------|
| **Facture créée** | `CREATE` facture | • Débit **411** - Patients<br>• Crédit **706** - Prestations (ou 707 pharmacie) | Aucun | ✅ CORRIGÉ |
| **Paiement reçu** | `CREATE` paiement | • Débit **512/521** - Caisse USD / Banque<br>• Crédit **411** - Patients | Écarts de change | ✅ CORRIGÉ |
| **Paiement partiel** | Mise à jour statut | • Même écriture, solde client restant dû | Traçabilité | ✅ CORRIGÉ |
| **Remboursement** | Non implémenté | • Débit **512/521** - Caisse<br>• Crédit **411** - Patients | À implémenter | ⚠️ À IMPLÉMENTER |
| **Dérogation** | Field `notes_facture` | À valider par expert *(voir DECISIONS #11)* | À valider | ⚠️ À VALIDER |
| **Facture annulée** | Mise à jour `statut` | • Contre-passation intégrale | Traçabilité | ✅ CORRIGÉ |
| **Stock entrée (pharma)** | `CREATE` mouvement `ENTREE` | • Débit **481** - Stocks<br>• Crédit **601** ou **401** - Achats/Fournisseurs | Coût d'acquisition | ✅ CORRIGÉ |
| **Stock sortie (POS)** | `CREATE` `SORTIE` + paiement | • Débit **601** - Coût des ventes<br>• Crédit **481** - Stocks | Double comptage si manuel | ✅ PROTÉGÉ |
| **Achat à crédit** | Non implémenté | • Débit **601** - Achats<br>• Crédit **401** - Fournisseurs | Créer dette | ⚠️ À IMPLÉMENTER |
| **Règlement dette** | Non implémenté | • Débit **401** - Fournisseurs<br>• Crédit **512/521** - Caisse | À valider | ⚠️ À IMPLÉMENTER |
| **Virement interne** | Non implémenté | • Débit **512** → Crédit **521** (USD) | Éviter écarts | ⚠️ À IMPLÉMENTER |
| **Salaires / Charges** | Non implémenté | • Débit **621** - Salaires<br>• Crédit **512/521** - Caisse | À valider | ⚠️ À IMPLÉMENTER |
| **Conversion USD/FC** | Conservation simple | • Taux scellé<br>• Écarts → **665/765** | À valider | ⚠️ À VALIDER (#5) |

> **Note :** Les numéros de comptes sont basés sur le SYSCOHADA/OHADA standard. Chaque numéro doit être validé par un expert-comptable avant l'implémentation.

---

## E. RISQUES DE DOUBLE COMPTABILISATION ET DE RÉGRESSION

### 1. Sources de Risques

| Risque | Localisation | Probabilité | Impact |
|--------|-------------|-------------|--------|
| Double paiement manuel (évité par système) | `recordPaiement()` | Faible | Moyen |
| Sortie de stock sans facture POS | Auto dans `recordPosPaiement()` | Nul | Moyen |
| Entrées de stock nominales sans entrée réel | `ENTREE` mouvement | Faible | Faible |
| Dérogations sans comptes correspondants | `notes_facture` | Moyenne | Moyen |
| Achats à crédit sans facture fournisseur | Non implémenté | Nul | N/A |
| Annulation de facture sans contre-passation | Mise à jour `statut` | Moyenne | Élevé |

### 2. À Valider Par Planning
- Vérification complète si travaux avec contrôle 4 ans
- Vérification écarts > 1% taux sanglante
- Vérification période systêmatique annuelle : Aucune écarts et simulation
- Vérification emploi de livres pour toutes les catégories de charges (pseudo 1 + 34)

### 3. Dépendances Régressions
- `factures.table` - Interruption facturation globale
- `facture_items.table` - Livraison MEDICAL ne plus produire facture
- `paiements.table` - Caisse ne plus fonctionner
- `catalogue_medicaments.table` - Stock pharmaceutique éloigné
- `lots_medicaments.table` - Péremption de stock avec mauvaise santé
- `consultation_medicals.table` - Stockage chiffré des résultats

---

## F. PLAN D'IMPLÉMENTATION - ÉTAPES MINIATURÉES ET TESTABLES

### 📅 ÉTAPE 9.1 : PLAN COMPTABLE (1-2 JOURS)

**Travail :** Créer les tables principaux

```sql
— Table des Comptes Généraux
CREATE TABLE comptes_generaux (
  id TEXT PRIMARY KEY,
  compte TEXT NOT NULL UNIQUE,
  classe INTEGER,
  intitule TEXT,
  compte_parent TEXT,
  type TEXT CHECK(type IN ('DEBIT', 'CREDIT'))
);

— Table des Plans Comptables par exercice
CREATE TABLE plans_comptables (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  date_debut TEXT,
  date_fin TEXT,
  actif INTEGER DEFAULT 1,
  date_cloture TEXT
);

— Table de liens (compte ↔ sous-détails)
CREATE TABLE comptes_sous_details (
  id TEXT PRIMARY KEY,
  compte_id TEXT,
  compte_sub_01 TEXT,
  compte_sub_02 TEXT,
  compte_sub_03 TEXT,
  titre_fictif TEXT
);
```

**Tests :**
- Insertion complète SYSCOHADA RDC (5 classes)
- Vérification références croisés
- Migration sécurisée sans perte de données

---

### 📅 ÉTAPE 9.2 : JOURNAUX COMPTABLES (1 JOUR)

**Travail :** Tables journal

```sql
— Journal Général
CREATE TABLE journal_general (
  id TEXT PRIMARY KEY,
  journal_code TEXT UNIQUE NOT NULL,
  journal_libele TEXT,
  nature TEXT CHECK(nature IN ('DEBIT', 'CREDIT')),
  date_ouverture TEXT,
  date_cloture TEXT
);

— Journal Auxiliaires Clients / Fournisseurs
CREATE TABLE journal_auxiliaires (
  id TEXT PRIMARY KEY,
  journal_code TEXT UNIQUE NOT NULL,
  journal_libele TEXT,
  categorie TEXT CHECK(categorie IN ('CLIENT', 'FOURNISSEUR', 'SALARIE'))
);
```

**Tests :**
- Application des codes journal
- Vérification des doublons de clôture
- Validation des entêtes

---

### 📅 ÉTAPE 9.3 : ÉCRITURES COMPTABLES (1-2 JOURS)

**Travail :** Synchroniser `factures` et `paiements`

```sql
CREATE TABLE ecritures_comptables (
  id TEXT PRIMARY KEY,
  journal_id TEXT,
  date_comptable TEXT,
  reference TEXT,
  libelle TEXT NOT NULL,
  compte TEXT NOT NULL,
  sens TEXT CHECK(sens IN ('DEBIT', 'CREDIT')),
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  user_create TEXT,
  created_at TEXT,
  FOREIGN KEY (journal_id) REFERENCES journal_general(id)
);

— Trigger crée automatiquement au développement de la facture
CREATE TRIGGER trigger_ecriture_facture_facture
AFTER INSERT ON facture_items
FOR EACH ROW
— (LOGIQUE À DÉVELOPPER)
```

**Tests :**
- Double-check comptabilité automatique au `facture_items`, `paiements`
- Validation de partiellement crédité et des montants
- Vérification DB complète

---

### 📅 ÉTAPE 9.4 : BALANCES (1 JOUR)

**Travail :** Balances

```sql
CREATE TABLE balance_generales (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  date TEXT,
  compte TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  solde REAL DEFAULT 0
);

CREATE TABLE balance_sous_details (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  date TEXT,
  compte TEXT,
  compte_sub_01 TEXT,
  compte_sub_02 TEXT,
  compte_sub_03 TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  solde REAL DEFAULT 0
);
```

**Tests :**
- Calcul automatique des balances et vérification
- Idempotence (recalcul gaze)

---

### 📅 ÉTAPE 9.5 : COMPTES DE RÉSULTAT (1 JOUR)

**Travail :** Table

```sql
CREATE TABLE compte_resultats (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  compte TEXT NOT NULL,
  description TEXT,
  debut_periode REAL DEFAULT 0,
  fin_periode REAL DEFAULT 0,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  solde REAL DEFAULT 0
);
```

**Tests :**
- Création résultats automatique via script de validation
- Vérification totaux

---

### 📅 ÉTAPE 9.6 : BILAN (1 JOUR)

**Travail :** Table

```sql
CREATE TABLE bilan (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  date_cloture TEXT,
  compte TEXT,
  intitule TEXT,
  partie TEXT,
  valeur REAL DEFAULT 0
);
```

**Tests :**
- Calcul automatique bilan daté
- Vérification Total Actif = Total Passif + Capitaux Propres

---

### 📅 ÉTAPE 9.7 : CAISSES / BANQUES (1 JOUR)

**Travail :** Système

```sql
CREATE TABLE caisses (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  devise TEXT NOT NULL CHECK(devise IN ('USD', 'FC')),
  solde_initial REAL DEFAULT 0,
  solde_actuel REAL DEFAULT 0,
  actif INTEGER DEFAULT 1
);

CREATE TABLE mouvements_caisses (
  id TEXT PRIMARY KEY,
  caisse_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('ENTREE', 'SORTIE')),
  mount REAL NOT NULL,
  compte_comptable TEXT,
  libelle TEXT,
  created_at TEXT
);
```

**Tests :**
- Mise à jour automatique au paiement
- Idempotence et entiers

---

### 📅 ÉTAPE 9.8 : EXERCICES & CLÔTURE (2 JOURS)

**Travail :** Logique

```sql
CREATE TABLE exercices_comptables (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL UNIQUE,
  date_debut TEXT NOT NULL,
  date_fin TEXT NOT NULL,
  cloture INTEGER DEFAULT 0,
  date_cloture TEXT
);
```

**Tests :**
- Validation de date de début, fin
- Vérification cloture
- Vérification année cadastrale (jour)

**Fonction à créer :** `closeExercise()` avec transaction ACID

---

### 📅 ÉTAPE 9.9 : INVENTAIRES FINANCIERS (1 JOUR)

**Travail :** Complete structure

```sql
CREATE TABLE inventaires_financiers (
  id TEXT PRIMARY KEY,
  exercice TEXT NOT NULL,
  date_inventaire TEXT,
  solde_comptable REAL,
  solde_reel REAL,
  ecart REAL DEFAULT 0,
  explication TEXT,
  created_at TEXT
);
```

**Tests :**
- Comparaison réelle vs comptable
- Gestion des écarts (au-delà X%, alerte critique)

---

### 📅 ÉTAPE 9.10 : INTERFACE UI (1-2 JOURS)

**Travail :** Frontend + Contrôleurs

**Modifier :** `billingController.ts`
- Ajouter méthode `generateJournal()` (journal + livres)
- Ajouter méthode `generateBalance()` (balance générale)
- Ajouter méthode `generateIncomeStatement()` (compte résultats)
- Ajouter méthode `generateBalanceSheet()` (bilan)

**Modifier :** Frontend
- Page Comptabilité > Plan Comptable
- Page Journal Général
- Page Balance Générale
- Page Compte Résultat
- Page Bilan
- Page Caisse & Bans

**Tests :**
- Données JSON récupérées
- Interface satisfaite

---

### 📅 ÉTAPE 9.11 : RÈGLES RETENUES (J-1 À J+2)

**Structure :**
```typescript
const REGLES_COMPTABLES = {
  doubleEncaissement: {
    enabled: true,
    dureeSec: 5,
  },
  ecartTauxMaxFC: 1.0, // 1%
  ecartMontantMax: 0.01,
    periode: "ANNUEL",
    showEcart: 606, // pour 34 et 678
    ecartCrit : 2.0, // 2%
  },
  inventaireFinancierSimultan: {
    enabled: true,
    periodique: "QUADRI",
    seuilAlerte: 50000,
    seuilCritique: 250000,
  },
  img_docs_inventaire: true,
};
```

**Tests :**
- Validation des paramètres
- Test avertissement période
- Test notification

---

## G. TESTS NÉCESSAIRES ET COMMANDES DE VALIDATION

### 1. Tests de la comptabilité automatique de factures

```bash
# Fichier de test à créer
# test_comp_facturable.test.ts

— Créer une CAUTIONanche facture (50 USD)
— Créer un CAUTIONanche paiement en 2x25 USD
— Vérifier comptabilité :
  • Vérif. création 2 écritures d'alerte
  • Vérif. vérification solde total
  • Vérif. vérification montant montant constant
  • Annulation et vérif. contre-passation
```

### 2. Tests de la comptabilité automatique de stock

```bash
# Phap 72b existant + tests

— Entrée 100 sachets (10 USD)
— Vérif. écriture stock (débit compta2)
— Sortie 50 sachets
— Vérif. écriture vente / stock (crédit compta1)
— Vérifie. inventaire final
— Vérif.erreur paiement en stock négatif
```

### 3. Tests de la balance générale

```sql
— Réaliser la balance automatique. avec scoped plan utilisé
— Vérif. balance_total_debit = balance_total_credit = solde_interne
— Vérif. total_compte_60 ~ total_compte_70
```

### 4. Tests de la balance effectifs (patterns)

```bash
# Créer échantillon individuel de lannée

— Créer CAJreffacture 70 / Compte 41 crédit 60 (contrôles)
— Déditer CAUTED paiement debit 51 crédit 41
— Vérif. montant. crédit solde > 0
— Vérif. calcul稳健. Comparer le montant artisanale retenu
```

### 5. Tests de la génération du compte résultats

```bash
# Compte des comptes de profits et pertes

— Créer esi compte 60 + versement 41 100 ou 70 + 41 crédit à rectifier
— Recalculer le怪的 maintenant avec recession
— Vérif solde. ex: 478
```

### 6. Tests de la génération du bilan

```bash
— Vérif. succinct des totaux (compte 1,6,5 et 2,5 + 1)
— Vérif. Totale Actif de 51xxxxx = Totale de 35xxxxx
— Vérif. Stabilité des crédits valeurs (si correction
```

### 7. Tests de la caisse & banque

```bash
— Créer échantillon 2 caisses avec soldes initiaux (USD et FC)
— Effectuer une APERSSION manuelle au solde
— Recalculer le solde comptable, vérif. correctif auto
— Soldecaisses soldeactuel calculé - soldefictif = 0
```

### 8. Tests de la clôture d'exercice

```bash
— Créer un nouveau exercice pour année septembre
— Migrer les écritures en:
  • Ecritures décalées `exercices_differes` tableau
— Vérif. écritures passé
— Clôture / Verrouillage exercice
— Tentative d'écriture future (décalée)
—invoquer `cloture_exercice()` avec simulation
```

### 9. Tests d'inventaire financier

```bash
— Générer une inventaire à date fixe
— Comparer avec le solde comptable
— Recalculer l'écart (inventaire_reel - solde_comptable)
— Vérif. pour une catégorie > seuil = alerte dans l'audit
```

### 10. Tests de régularité (gestion 12/15)

```bash
# Vérifier dans le test annualisé l'effet des régul

— Créer l'écriture compensation can_back_ruise réelle
— Vérif. pour un bilan: compte 41 est transféré -> 13 et 47
— Vérif. montant like 13/47 = montants
```

---

## 10. SYNTHÈSE - CONCLUSION

### Points positifs déjà avérés

✅ Encaissement de trésorerie très sécurisé (anti-double compte)
✅ Récupération des taux de change avec scellage des montants
✅ Contrôle très rigoureux des doublons de paiements
✅ Tracking complet des opérations financières (audit logs)
✅ Structure POS pharmacie avec sortie de stock automatisée au paiement
✅ Ample possibilité d'échéanciers et dérogations côté réception
✅ Interface comptable prévue sérieusement (exercice, clôture)
✅ Système fortement étoffé pour créations et divers types de facturation (vente directe, dérogation, commandes labs/imagerie)

### Principaux manques (Blocants)

❌ Pas de PLAN COMPTABLE original (5 classes = compte non distinct)
❌ Pas de JOURNAUX (général, auxiliaires) – pas de distinction rev./achats
❌ Pas de ÉCRITURES COMPTABLES ÉQUILIBRÉES (pas de DEBIT/CREDIT complet)
❌ Pas de COMPTES CRÉÉS AVEC équilibre total entre débits/credits VALIDÉ
❌ Pas de COMPTES DE RÉSULTAT (pas de CAF nécessaire)
❌ Pas de BILAN (pas d'actif/passif)
❌ Pas de PERIODICITÉ des balances (pas de comptabilité mensuelle trimestrielle annuelle)
❌ Pas de COMPTES D'ACTIF PASSIF pour gestion de stocks claire (valeur BOOK)
❌ Pas de CAISSE FICHE pour suivi
❌ Pas de EXERCICES & CLÔTURE
❌ Pas de CONTRÔLES DE SÉCURITÉ COMPTABLE réguliers
❌ Pas de GESTION D'OBSOLÈSSEMENT actif

### Un planning de 3-4 semaines guidées par ces étapes miniatures permettrait de raccomplir ce qui est manquant. Chaque étape est jouable individuellement, testable, et validable avant de passer à l'étape suivante.

---

## TABLEAU D'AVANCEMENT ÉTAPES PROGRAMMÉES

| Étape | Travaux Approximés | Livrable | Validation |
|-------|-------------------|----------|-----------|
| 9.1 | Plan comptable | 5 classes + 17 sous-détails | ⚠️ À VALIDER PAR EXPERT |
| 9.2 | Journaux (général, clients, fournisseurs) | 3 journaux code | ⏸️ À programmer |
| 9.3 | Écritures comptables | Synchronisation facture/paiement | ⏸️ À programmer |
| 9.4 | Balances | Tables calculées annuellement | ⏸️ À programmer |
| 9.5 | Compte résultat | Bilan intermédiaire | ⏸️ À programmer |
| 9.6 | Bilan | Compte pour revue finale | ⏸️ À programmer |
| 9.7 | Caisse / Banque | Gestion sécurisée | ⏸️ À programmer |
| 9.8 | Exercices & Clôture | Clôture avec protection | ⏸️ À programmer |
| 9.9 | Inventaires | Contrôle révèle comptable | ⏸️ À programmer |
| 9.10 | Interface UI Model | Pages complètes | ⏸️ À programmer |
| 9.11 | Règles retenues | Gestion sens | ⏸️ À programmer |

**Détails :** Voir [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) pour le plan détaillé.

---

## NOTE ÉNERGETIQUE IMPORTANT

❗ Dans le système actuel, la gestion `delivre_medicaments` existe dans la base mais ne pas utilisée. L'implémenter serait une surcharge. Pour une comptabilité solide, il vaudrait mieux se concentrer sur l'intégration des stocks via `mouvements_stock` dans un journal comptable dédié à la pharmacie, sans introduire un nouveau dic : cela supprimerait l'ambiguïté comptable.

---

## DOCUMENTS ASSOCIÉS — DÉTAILS

> Ce rapport est le document principal de référence. Les informations détaillées sont dans les documents suivants :
>
> | Document | Description | Statut |
> |----------|-------------|--------|
> | [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) | Plan comptable SYSCOHADA avec comptes, libellés, catégories | ⚠️ PROPOSITION TECHNIQUE |
> | [PLAN_COMPTABLE.csv](PLAN_COMPTABLE.csv) | Plan comptable au format CSV (modifiable dans tableur) | ⚠️ PROPOSITION TECHNIQUE |
> | [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) | Décisions approuvées vs à valider | ⚠️ EN ATTENTE VALIDATION EXPERT |
> | [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) | Plan d'implémentation étape par étape | ⚠️ PROPOSITION TECHNIQUE |
> | [CHANGELOG_FINANCE.md](CHANGELOG_FINANCE.md) | Historique des modifications documentaires | ✅ ACTIF |

**Règle de maintenance :** Toute modification importante doit être répercutée dans le document concerné avec sa date et son motif. Mise à jour → modifier CHANGELOG_FINANCE.md → mettre à jour les références croisées.

---

## DATE DU RAPPORT : 20 OCTOBRE 2026

## AUDITEUR : [PHASE 7]

## VALIDÉ PAR : EN ATTENTE D'AUTORISATION D'IMPLÉMENTATION

## STATUT FINAL : ✅ RAPPORT CORRIGÉ — EN ATTENTE DE VALIDATION COMPTABLE PAR UN EXPERT-COMPTABLE SYSCOHADA