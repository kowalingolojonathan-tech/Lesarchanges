# PLAN D'IMPLÉMENTATION FINANCE — CLINIQUE LES ARCHANGES
## Phase 9 : Comptabilité en partie double

**Document :** PROPOSITION TECHNIQUE  
**Date :** 20 octobre 2026  
**Statut :** À valider par expert-comptable puis direction

---

## PRÉREQUIS DE VALIDATION

> ⚠️ **AUCUNE IMPLÉMENTATION NE PEUT COMMENCER AVANT LA VALIDATION DES DÉCISIONS SUIVANTES :**
> - [ ] D1 — Méthode valorisation des stocks
> - [ ] D2 — Traitement des écarts de change
> - [ ] D5 — Traitement TVA RDC
> - [ ] D6 — Clôture d'exercice
>
> Voir [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) pour le détail.

---

## STRUCTURE DU PLAN

| Phase | Description | Durée estimée | Dépendances | Statut |
|-------|-------------|---------------|-------------|--------|
| **9.1** | Plan comptable | 1-2 jours | D1, D2, D5, D6 | ⏸️ En attente validation |
| **9.2** | Journaux comptables | 1 jour | 9.1 | ⏸️ En attente |
| **9.3** | Écritures comptables | 2-3 jours | 9.1, 9.2 | ⏸️ En attente |
| **9.4** | Balances & Grand livre | 1 jour | 9.3 | ⏸️ En attente |
| **9.5** | Compte de résultat | 1 jour | 9.3 | ⏸️ En attente |
| **9.6** | Bilan | 1 jour | 9.3, 9.4 | ⏸️ En attente |
| **9.7** | Caisse & Banque | 1 jour | 9.2, 9.3 | ⏸️ En attente |
| **9.8** | Exercices & Clôture | 2 jours | 9.4, 9.5, 9.6 | ⏸️ En attente |
| **9.9** | Inventaires financiers | 1 jour | 9.7 | ⏸️ En attente |
| **9.10** | Interface UI | 2-3 jours | 9.2-9.9 | ⏸️ En attente |
| **9.11** | Règles & Contrôles | 1 jour | 9.1-9.10 | ⏸️ En attente |

**Total estimé :** 3-4 semaines

---

## PHASE 9.1 — PLAN COMPTABLE

### Objectif
Créer la structure de base du plan comptable SYSCOHADA.

### Tables à créer
```sql
-- Compte général SYSCOHADA
CREATE TABLE comptes_generaux (
    id TEXT PRIMARY KEY,
    compte TEXT NOT NULL UNIQUE,
    classe INTEGER CHECK(classe BETWEEN 1 AND 9),
    intitule TEXT NOT NULL,
    compte_parent TEXT,
    nature TEXT CHECK(nature IN ('ACTIF', 'CHARGE', 'PRODUIT', 'CAPITAUX_PROPRES')),
    actif INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Plan comptable par exercice
CREATE TABLE plans_comptables (
    id TEXT PRIMARY KEY,
    exercice TEXT NOT NULL,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    actif INTEGER DEFAULT 1,
    date_cloture TEXT,
    created_at TEXT NOT NULL
);

-- Sous-comptes détaillés
CREATE TABLE comptes_sous_details (
    id TEXT PRIMARY KEY,
    compte_id TEXT NOT NULL,
    compte_sub_01 TEXT,
    compte_sub_02 TEXT,
    compte_sub_03 TEXT,
    titre_fictif TEXT,
    FOREIGN KEY (compte_id) REFERENCES comptes_generaux(id)
);
```

### Données à insérer
- 50+ comptes SYSCOHADA (voir [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md))
- Comptes spécifiques pour la clinique (411, 401, 512, 513, 521, 522, 601, 706, 707)

### Validation requise
- [ ] Vérifier que chaque compte a un parent valide
- [ ] Vérifier que les classes sont correctes (1-9)
- [ ] Valider par expert-comptable

### Tests
```bash
# Test 9.1.1
# Insérer 50 comptes SYSCOHADA
# Vérifier l'intégrité référentielle
# Exécuter SELECT * FROM comptes_generaux ORDER BY compte
```

---

## PHASE 9.2 — JOURNAUX COMPTABLES

### Objectif
Créer les journaux comptables de base.

### Tables à créer
```sql
-- Journal général
CREATE TABLE journaux_comptables (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    nature TEXT CHECK(nature IN ('GENERAL', 'VENTES', 'ACHATS', 'CAISSE', 'BANQUE', 'DIVERS')),
    date_ouverture TEXT,
    date_cloture TEXT,
    actif INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- Journal clients (sui-ventes)
CREATE TABLE journal_clients (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    facture_id TEXT,
    date_ecriture TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    solde REAL DEFAULT 0,
    libelle TEXT,
    created_at TEXT NOT NULL
);

-- Journal fournisseurs (suivi-achats)
CREATE TABLE journal_fournisseurs (
    id TEXT PRIMARY KEY,
    fournisseur_id TEXT NOT NULL,
    facture_id TEXT,
    date_ecriture TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    solde REAL DEFAULT 0,
    libelle TEXT,
    created_at TEXT NOT NULL
);

-- Journal caisse (suivi-trésorerie)
CREATE TABLE journal_caisses (
    id TEXT PRIMARY KEY,
    caisse_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('ENTREE', 'SORTIE')),
    montant REAL NOT NULL,
    devise TEXT CHECK(devise IN ('USD', 'FC')),
    taux_usd_fc REAL,
    compte_comptable TEXT,
    libelle TEXT,
    created_at TEXT NOT NULL
);
```

### Codes journaux suggérés
| Code | Libellé | Usage |
|------|---------|-------|
| J001 | Journal général | Tous les mouvements |
| J002 | Journal des ventes | Factures clients |
| J003 | Journal des achats | Achats fournisseurs |
| J004 | Journal de caisse | Mouvements caisse |
| J005 | Journal de banque | Mouvements bancaire |

### Validation requise
- [ ] Les codes sont uniques
- [ ] Les relationsFK sont cohérentes

### Tests
```bash
# Test 9.2.1
# Créer 5 journaux avec codes uniques
# Vérifier insertions et lectures
```

---

## PHASE 9.3 — ÉCRITURES COMPTABLES

### Objectif
Créer le moteur de saisie des écritures en partie double.

### Tables à créer
```sql
-- Écritures comptables (skeleton)
CREATE TABLE ecritures_comptables (
    id TEXT PRIMARY KEY,
    numero_ecriture TEXT NOT NULL UNIQUE,
    journal_id TEXT NOT NULL,
    date_comptable TEXT NOT NULL,
    reference TEXT,
    libelle TEXT NOT NULL,
    compte TEXT NOT NULL,
    compte_sous_detail TEXT,
    sens TEXT CHECK(sens IN ('DEBIT', 'CREDIT')),
    montant_usd REAL DEFAULT 0,
    montant_fc REAL DEFAULT 0,
    taux_usd_fc REAL,
    devise TEXT CHECK(devise IN ('USD', 'FC')),
    user_create TEXT,
    user_validate TEXT,
    statut TEXT CHECK(statut IN ('PROVISOIRE', 'VALIDEE', 'ANNULEE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (journal_id) REFERENCES journaux_comptables(id)
);

-- Lignes d'écriture (une écriture = plusieurs lignes)
CREATE TABLE lignes_ecritures (
    id TEXT PRIMARY KEY,
    ecriture_id TEXT NOT NULL,
    compte TEXT NOT NULL,
    compte_sous_detail TEXT,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    montant REAL DEFAULT 0,
    devise TEXT CHECK(devise IN ('USD', 'FC')),
    FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id) ON DELETE CASCADE
);
```

### Règles métier
1. **Équilibre :** Somme des débits = Somme des crédits pour chaque écriture
2. **Numérotation :** Format `YYYY-NNNNNN` (ex: 2026-000001)
3. **Validation :** Écriture provisoire → validée → annulable (contre-passation)
4. **Traçabilité :** Impossible de supprimer une écriture validée

### Triggers SQL (proposition)
```sql
-- Trigger vérification équilibre
CREATE TRIGGER verify_ebalance
AFTER INSERT ON lignes_ecritures
FOR EACH ROW
BEGIN
    -- Vérifier que le total debit = total credit
    -- Rejeter si déséquilibre
END;
```

### Tests
```bash
# Test 9.3.1 — Écriture équilibrée
# Débit 411: 100 USD
# Crédit 706: 100 USD
# Résultat: ✓ Équilibrée

# Test 9.3.2 — Écriture déséquilibrée
# Débit 411: 100 USD
# Crédit 706: 80 USD
# Résultat: ✗ Rejetée
```

---

## PHASE 9.4 — BALANCES & GRAND LIVRE

### Objectif
Générer automatiquement les états financiers.

### Tables dérivées
```sql
-- Grand livre (vue)
CREATE VIEW grand_livre AS
SELECT 
    compte,
    compte_sous_detail,
    SUM(debit) as total_debit,
    SUM(credit) as total_credit,
    SUM(debit) - SUM(credit) as solde
FROM lignes_ecritures
GROUP BY compte, compte_sous_detail;

-- Balance générale (vue)
CREATE VIEW balance_generale AS
SELECT 
    e.date_comptable,
    e.compte,
    SUM(e.debit) as debit,
    SUM(e.credit) as credit,
    SUM(e.debit) - SUM(e.credit) as solde
FROM ecritures_comptables e
WHERE e.statut = 'VALIDEE'
GROUP BY e.date_comptable, e.compte;
```

### Tests
```bash
# Test 9.4.1
# Créer des écritures de test
# Générer la balance
# Vérifier: total debit = total credit
```

---

## PHASE 9.5 — COMPTE DE RÉSULTAT

### Objectif
Calculer automatiquement le résultat net.

### Vue SQL
```sql
CREATE VIEW compte_resultat AS
SELECT 
    'CHARGES' as categorie,
    SUM(debit) as montant,
    SUM(credit) as credit
FROM ecritures_comptables
WHERE statut = 'VALIDEE' AND compte LIKE '6%'

UNION ALL

SELECT 
    'PRODUITS' as categorie,
    SUM(debit) as montant,
    SUM(credit) as credit
FROM ecritures_comptables
WHERE statut = 'VALIDEE' AND compte LIKE '7%';
```

### Calcul
```
Résultat net = Total Produits - Total Charges
```

### Tests
```bash
# Test 9.5.1
# Facture 100 USD → Crédit 706: 100
# Paiement 100 USD → Débit 512: 100, Crédit 411: 100
# Résultat: 0 (facture payée)
```

---

## PHASE 9.6 — BILAN

### Objectif
Générer le bilan actif/passif.

### Vues SQL
```sql
-- Bilan actif
CREATE VIEW bilan_actif AS
SELECT 'ACTIF IMMOBILISE' as section, compte, SUM(montant) as valeur
FROM ecritures_comptables
WHERE compte IN ('1%', '2%', '3%') AND statut = 'VALIDEE'
GROUP BY compte

UNION ALL

SELECT 'ACTIF CIRCULANT' as section, compte, SUM(montant) as valeur
FROM ecritures_comptables
WHERE compte IN ('4%', '5%') AND statut = 'VALIDEE'
GROUP BY compte;

-- Bilan passif
CREATE VIEW bilan_passif AS
SELECT 'CAPITAUX PROPRES' as section, compte, SUM(montant) as valeur
FROM ecritures_comptables
WHERE compte LIKE '8%' AND statut = 'VALIDEE'
GROUP BY compte

UNION ALL

SELECT 'PASSIF' as section, compte, SUM(montant) as valeur
FROM ecritures_comptables
WHERE compte LIKE '4%' AND statut = 'VALIDEE'
GROUP BY compte;
```

### Validation
```
Total Actif = Total Passif + Capitaux Propres
```

---

## PHASE 9.7 — CAISSE & BANQUE

### Objectif
Suivre la trésorerie par devise et par type.

### Tables
```sql
CREATE TABLE caisses (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    devise TEXT CHECK(devise IN ('USD', 'FC')),
    solde_initial REAL DEFAULT 0,
    solde_actuel REAL DEFAULT 0,
    actif INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE mouvements_caisses (
    id TEXT PRIMARY KEY,
    caisse_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('ENTREE', 'SORTIE')),
    montant REAL NOT NULL,
    devise TEXT CHECK(devise IN ('USD', 'FC')),
    taux_usd_fc REAL,
    ecriture_id TEXT,
    libelle TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (caisse_id) REFERENCES caisses(id),
    FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id)
);
```

### Tests
```bash
# Test 9.7.1
# Créer caisse USD avec solde initial 1000
# Encaisser 500 USD → solde = 1500
# Vérifier écriture comptable correspondante
```

---

## PHASE 9.8 — EXERCICES & CLÔTURE

### Objectif
Gérer les exercices comptables et la clôture.

### Tables
```sql
CREATE TABLE exercices_comptables (
    id TEXT PRIMARY KEY,
    exercice TEXT NOT NULL UNIQUE,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    cloture INTEGER DEFAULT 0,
    date_cloture TEXT,
    user_cloture TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE ecritures_exercice (
    id TEXT PRIMARY KEY,
    exercice TEXT NOT NULL,
    ecriture_id TEXT NOT NULL,
    FOREIGN KEY (exercice) REFERENCES exercices_comptables(exercice),
    FOREIGN KEY (ecriture_id) REFERENCES ecritures_comptables(id)
);
```

### Règles
1. **Verrouillage :** Un exercice clôturé ne peut plus recevoir d'écritures
2. **Contre-passation :** Pour corriger une écriture, créer une écriture de correction
3. **Report :** Le résultat d'un exercice est reporté au suivant (compte 841/842)

### Tests
```bash
# Test 9.8.1
# Créer exercice 2026 (01/01 - 31/12)
# Créer une écriture
# Clore l'exercice
# Tenter une nouvelle écriture → Rejet
```

---

## PHASE 9.9 — INVENTAIRES FINANCIERS

### Objectif
Contrôler les écarts entre comptabilité et réalité.

### Table
```sql
CREATE TABLE inventaires_financiers (
    id TEXT PRIMARY KEY,
    exercice TEXT NOT NULL,
    date_inventaire TEXT NOT NULL,
    type TEXT CHECK(type IN ('CAISSE', 'BANQUE', 'STOCK', 'CREANCE')),
    compte TEXT NOT NULL,
    solde_comptable REAL,
    solde_reel REAL,
    ecart REAL,
    explication TEXT,
    user_create TEXT,
    created_at TEXT NOT NULL
);
```

### Tests
```bash
# Test 9.9.1
# Inventaire caisse: comptable 1000, réel 950
# Écart: -50
# Alert si écart > seuil (à définir)
```

---

## PHASE 9.10 — INTERFACE UI

### Objectif
Créer les pages comptables dans l'interface.

### Pages à créer
1. **Tableau de bord comptable** — Vue d'ensemble
2. **Plan comptable** — Gestion des comptes
3. **Journal général** — Liste des écritures
4. **Balance générale** — Rapport par compte
5. **Compte de résultat** — Rapport charges/produits
6. **Bilan** — Actif/Passif/Capitaux propres
7. **Caisse** — Suivi trésorerie
8. **Banque** — Suivi comptes bancaires
9. **Exercices** — Gestion périodes
10. **Inventaires** — Contrôles

### Tests
```bash
# Test 9.10.1
# Chaque page doit charger sans erreur
# Les données doivent être synchronisées avec la DB
```

---

## PHASE 9.11 — RÈGLES & CONTRÔLES

### Objectif
Mettre en place les garde-fous comptables.

### Règles à implémenter
| Règle | Description | Severity |
|-------|-------------|----------|
| **R1** | Double écriture détectée | WARNING |
| **R2** | Écart de taux > 5% | ALERT |
| **R3** | Écriture non équilibrée | ERROR |
| **R4** | Tentative modification écriture clôturée | ERROR |
| **R5** | Stock négatif | ERROR |
| **R6** | Paiement > solde dû | WARNING |
| **R7** | Écart inventaire > seuil | ALERT |

### Tests
```bash
# Test 9.11.1
# Tester chaque règle
# Vérifier que les alertes sont correctement levées
```

---

## DÉPENDANCES ENTRE PHASES

```
9.1 (Plan) ──→ 9.2 (Journaux) ──→ 9.3 (Écritures) ──→ 9.4 (Balance)
                                                      │
                                                      ├──→ 9.5 (Résultat)
                                                      │
                                                      └──→ 9.6 (Bilan)
                                                      
9.2 (Journaux) ──→ 9.7 (Caisse/Banque)
9.4+9.5+9.6 ──→ 9.8 (Exercices)
9.7 ──→ 9.9 (Inventaires)
9.2-9.9 ──→ 9.10 (Interface)
9.1-9.10 ──→ 9.11 (Règles)
```

---

## CRITÈRES DE SUCCHÈS

| Critère | Validation |
|---------|------------|
| Toutes les écritures sont équilibrées | Total débit = Total crédit |
| Les contre-passations sont traçables | Aucune écriture supprimée |
| Les exercices sont verrouillés après clôture | Lecture seule |
| Les balances sont cohérentes | Total = 0 |
| Les stocks sont valorisés correctement | Méthode validée |
| Les écarts de change sont comptabilisés | 665/765 |

---

## CONCLUSION

Ce plan d'implémentation est une **PROPOSITION TECHNIQUE**. Il doit être adapté après validation par un expert-comptable SYSCOHADA.

**Prochaine étape :** Valider les décisions D1-D10 dans [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md).

**Documentation associée :**
- [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) — Comptes détaillés
- [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) — Décisions en attente
- [CHANGELOG_FINANCE.md](CHANGELOG_FINANCE.md) — Historique des modifications