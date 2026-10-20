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
| [REPORT_AUDIT_FINANCE_COMPLETE.md](REPORT_AUDIT_FINANCE_COMPLETE.md) | **MODIFIÉ** | Correction erreurs comptables, ajouts références |
| [PLAN_COMPTABLE.md](PLAN_COMPTABLE.md) | **CRÉÉ** | Plan SYSCOHADA détaillé |
| [PLAN_COMPTABLE.csv](PLAN_COMPTABLE.csv) | **CRÉÉ** | Export CSV modifiable |
| [DECISIONS_COMPTABLES.md](DECISIONS_COMPTABLES.md) | **CRÉÉ** | Suivi validations expert |
| [PLAN_IMPLEMENTATION_FINANCE.md](PLAN_IMPLEMENTATION_FINANCE.md) | **CRÉÉ** | Plan d'implémentation détaillé |
| [CHANGELOG_FINANCE.md](CHANGELOG_FINANCE.md) | **CRÉÉ** | Ce fichier |

**Corrections apportées au REPORT_AUDIT_FINANCE_COMPLETE.md :**
1. Correction numéros de comptes erronés (603→481, 703→707, etc.)
2. Ajout section « Documentation Associée » avec références croisées
3. Mise à jour tableau cartographie événements avec comptes valides
4. Ajout statuts de validation (✅ CORRIGÉ, ⚠️ À VALIDER)
5. Ajout note sur l'importance de la validation expert-comptable

**Décisions non corrigées (restent à valider) :**
- D1 : Méthode valorisation stocks (PEPS/CUM/autre)
- D2 : Traitement écarts de change (665/765)
- D3 : Provision créances douteuses (seuils)
- D4 : Durée amortissement immobilisations
- D5 : TVA RDC (taux, comptes)
- D6 : Date clôture exercice
- D7 : Numérotation écritures
- D8 : Gestion dérogations
- D9 : Comptes 9xx optionnels
- D10 : Seuil immobilisation

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