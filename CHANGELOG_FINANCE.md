# CHANGELOG — FINANCES & COMPTABILITÉ
## Clinique Les Archanges

---

## RÈGLE DE MAINTENANCE

> Toute modification importante doit être répercutée ici avec :
> - **Date** de la modification
> - **Auteur** (rôle)
> - **Motif** (pourquoi)
> - **Impact** (quels documents sont concernés)
> - **Référence** (phase, décision associée)

---

## HISTORIQUE DES MODIFICATIONS

### 2026-10-20 — Création de la documentation Phase 9

**Auteur :** Audit Phase 7  
**Motif :** Initialisation de la documentation comptable  
**Impact :** Création des fichiers suivants

| Document | Action | Statut |
|----------|--------|--------|
| [REPORT_AUDIT_FINANCE_COMPLETE.md](REPORT_AUDIT_FINANCE_COMPLETE.md) | **CRÉÉ** | Rapport d'audit complet |
| [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) | **CRÉÉ** | Plan SYSCOHADA détaillé |
| [PLAN_COMPTABLE.csv](PLAN_COMPTABLE.csv) | **CRÉÉ** | Export CSV modifiable |
| [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) | **CRÉÉ** | Suivi validations expert |
| [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) | **CRÉÉ** | Plan d'implémentation détaillé |
| [CHANGELOG_FINANCE.md](CHANGELOG_FINANCE.md) | **CRÉÉ** | Ce fichier |

---

### 2026-10-20 — Harmonisation documentaire Phase 9 (Phase 9.1B)

**Auteur :** Audit Phase 7  
**Motif :** Correction des incohérences identifiées par l'audit documentaire  
**Impact :** Harmonisation des 6 documents de référence

**Corrections apportées :**

| Fichier | Correction | Détail |
|---------|------------|--------|
| `PLAN_COMPTABLE.md` | Fournisseurs | Remplacement du compte **421** par **401** et **404** dans le tableau principal. Note explicative sur l'obsolescence du 421. |
| `PLAN_COMPTABLE.md` | Comptes produits | Harmonisation de l'affectation **701/706/707**. Section dédiée avec note de validation expert. |
| `PLAN_COMPTABLE.md` | Synthèse | Mise à jour des comptes fournisseurs (401/404) dans le tableau de synthèse. |
| `PLAN_COMPTABLE.csv` | Complet | Ajout des **comptes parents** manquants (41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53, 61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77, 78, 81, 82, 83, 84). Ajout des comptes à 3 chiffres manquants (**531**, **653**, **99**, **423**, **493**, **496**, **486**, **487**, **488**, **602**, **604**, **606**, **607**, **643**, **651**, **652**, **661**, **667**, **671**, **672**, **675**, **681**, **683**, **702**, **703**, **704**, **708**, **711**, **712**, **713**, **721**, **722**, **723**, **731**, **732**, **741**, **742**, **743**, **751**, **752**, **761**, **767**, **771**, **772**, **773**, **775**, **781**, **783**, **812**, **821**, **822**, **823**, **824**, **825**, **831**, **832**, **841**, **842**, **91**, **92**, **93**, **94**, **95**, **96**). Ajout colonne `type_compte` (PARENT / DÉTAILLÉ / OBSOLÈTE). Ajout ligne **421 OBSOLÈTE** avec mention "À VALIDER PAR EXPERT". |
| `REPORT_AUDIT_FINANCE_COMPLETE.md` | Cartographie paiements | Ajout des comptes **513** (Caisse FC) et **522** (Banque FC) dans toutes les écritures de paiement. Correction référence DECISIONS (#D8 au lieu de #11). |
| `REPORT_AUDIT_FINANCE_COMPLETE.md` | Architecture | Harmonisation de l'architecture comptable (sections F à G) avec la proposition de PLAN_IMPLEMENTATION_FINANCE.md. Uniformisation des schémas de tables. |
| `DECISIONS_COMPTABLES.md` | A6 | Mise à jour de la justification A6 avec mention de l'ancien compte 421. |

**Incohérences corrigées :**
1. ✅ Compte Fournisseurs : 421 → 401/404 (harmonisé)
2. ✅ Comptes Produits : 701/706/707 (affectation clarifiée avec note de validation)
3. ✅ CSV complété avec comptes parents et sous-comptes manquants
4. ✅ Cartographie des paiements USD et FC (512/513/521/522)
5. ✅ Architecture comptable harmonisée (REPORT + PLAN_IMPLEMENTATION)

**Points encore en attente :**
- ⏳ D1 à D10 : Toutes les décisions conservées comme EN ATTENTE
- ⏳ Validation expert-comptable pour la numérotation exacte des comptes (notamment 401 vs 421)

**Sources consultées :**
- Plan comptable OHADA/SYSCOHADA standard (documentation interne du projet)
- Aucun référentiel externe officiel n'a été consulté — les numéros de comptes restent à valider par un expert-comptable diplômé.

---

## DÉCISIONS EN ATTENTE (D1-D10)

| # | Décision | Statut | Validé par | Date butoir |
|---|----------|--------|------------|-------------|
| D1 | Méthode valorisation stocks | ⏳ En attente | Expert-comptable | À définir |
| D2 | Traitement écarts de change | ⏳ En attente | Expert-comptable | À définir |
| D3 | Provision créances douteuses | ⏳ En attente | Expert-comptable | À définir |
| D4 | Durée amortissement immob. | ⏳ En attente | Expert-comptable | À définir |
| D5 | TVA RDC | ⏳ En attente | Expert-comptable | À définir |
| D6 | Clôture exercice | ⏳ En attente | Direction | À définir |
| D7 | Numérotation écritures | ⏳ En attente | Expert-comptable | À définir |
| D8 | Dérogations | ⏳ En attente | Expert-comptable | À définir |
| D9 | Comptes 9xx | ⏳ En attente | Direction | À définir |
| D10 | Seuil immobilisation | ⏳ En attente | Expert-comptable | À définir |

---

## DOCUMENTS DE RÉFÉRENCE

| Document | Description | Lien |
|----------|-------------|------|
| Rapport d'audit complet | Vue d'ensemble du système financier | [REPORT_AUDIT_FINANCE_COMPLETE.md](REPORT_AUDIT_FINANCE_COMPLETE.md) |
| Plan comptable détaillé | Comptes SYSCOHADA avec libellés | [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) |
| Export CSV plan comptable | Données pour tableur | [PLAN_COMPTABLE.csv](PLAN_COMPTABLE.csv) |
| Décisions en attente | Suivi validations | [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) |
| Plan d'implémentation | Étapes techniques | [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) |

---

## PROCHAINES ÉTAPES

1. **Sélectionner un expert-comptable SYSCOHADA** pour la validation des décisions D1-D10
2. **Programmer une séance de validation** (durée estimée : 2-4 heures)
3. **Valider les décisions critiques** (D1, D2, D5, D6) avant toute implémentation
4. **Mettre à jour ce changelog** après chaque validation
5. **Commencer l'implémentation** uniquement après validation complète

---

## NOTICE LÉGALE

> ⚠️ **CE DOCUMENT EST UNE PROPOSITION TECHNIQUE.**  
> Les comptes, règles et méthodes comptables proposés ici sont basés sur le SYSCOHADA/OHADA standard mais **ne sont PAS officiellement validés** par un expert-comptable diplômé.  
> 
> **Toute implémentation doit être précédée de la validation écrite d'un expert-comptable SYSCOHADA.**  
> 
> Aucun test ne doit être marqué comme « exécuté » sans preuve observable (commande + résultat).

---

**Dernière mise à jour :** 20 octobre 2026  
**Prochaine révision :** Après validation expert-comptable