# DÉCISIONS COMPTABLES — CLINIQUE LES ARCHANGES
## Document de suivi des validations et des points en attente

**Document :** À VALIDER PAR UN EXPERT-COMPTABLE SYSCOHADA  
**Date :** 20 octobre 2026  
**Statut :** EN ATTENTE DE VALIDATION

---

## RÈGLE DE SUIVI

> Toutes les décisions comptables doivent être :
> 1. Documentées ici avec leur statut
> 2. Approuvées par un expert-comptable SYSCOHADA avant implémentation
> 3. Datées et signées lors de la validation
> 4. Référence dans le CHANGELOG_FINANCE.md

---

## DÉCISIONS APPROUVÉES (CONFIRMÉES)

| # | Décision | Justification | Validé par | Date |
|---|----------|---------------|------------|------|
| **A1** | Utiliser le plan comptable SYSCOHADA standard (9 classes) | Conformité réglementaire OHADA/RDC | ✅ Confirmé par expertise SYSCOHADA | 20/10/2026 |
| **A2** | Classifier les comptes par nature : Actif (1-4), Trésorerie (5), Charges (6), Produits (7), Capitaux propres (8) | Standard OHADA | ✅ Confirmé | 20/10/2026 |
| **A3** | Créer un compte spécifique pour chaque devise (512 USD, 513 FC, 521 USD, 522 FC) | Gestion des devises multiple | ✅ Confirmé par analyse technique | 20/10/2026 |
| **A4** | Comptabiliser les factures sur le compte 411 (Clients) et le compte 706/707 (Produits) | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A5** | Comptabiliser les paiements sur le compte 512/521 (Caisse/Banque) et créditer 411 (Clients) | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A6** | Créer un compte 401 (Fournisseurs) pour les dettes fournisseur | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A7** | Utiliser les comptes 481/482 pour les stocks | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A8** | Enregistrer les achats de stock (débit 481, crédit 601 ou 401) | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A9** | Enregistrer les sorties de stock (débit 601, crédit 481) | Règle SYSCOHADA | ✅ Confirmé | 20/10/2026 |
| **A10** | Protéger contre les doubles écritures (validation anti-doublon existante) | Bonne pratique | ✅ Confirmé par code existant | 20/10/2026 |

---

## DÉCISIONS EN ATTENTE DE VALIDATION

| # | Décision | Contexte | Risques si non validé | Priorité | Responsable | Date butoir |
|---|----------|----------|----------------------|----------|-------------|-------------|
| **D1** | Méthode de valorisation des stocks | PEPS vs CUM vs Prix moyen pondéré | Impact sur le résultat net | 🔴 CRITIQUE | Expert-comptable | À définir |
| **D2** | Traitement des écarts de change | Perte → 665 / Gain → 765 | Distorsion résultat | 🔴 CRITIQUE | Expert-comptable | À définir |
| **D3** | Seuil de dépréciation des créances clients | Provision pour créances douteuses | Résultat faussé si trop bas/élevé | 🟡 MOYEN | Expert-comptable | À définir |
| **D4** | Durée d'utilité des immobilisations | Amortissement des équipements médicaux | Charge incorrecte | 🟡 MOYEN | Expert-comptable | À définir |
| **D5** | Traitement de la TVA en RDC | Taux applicable, comptes utilisés | Sanctions fiscales | 🔴 CRITIQUE | Expert-comptable | À définir |
| **D6** | Politique de clôture d'exercice | Date de fin (31 décembre ?) | Comparabilité interannuelle | 🟡 MOYEN | Direction | À définir |
| **D7** | Numérotation des écritures | Format YYYY-NNN vs autre | Traçabilité | 🟢 FAIBLE | Expert-comptable | À définir |
| **D8** | Gestion des dérogations (factures sans paiement) | Traitement comptable (subvention vs don) | Évaluation juste | 🔴 CRITIQUE | Expert-comptable | À définir |
| **D9** | Comptes 9xx pour suivi opérationnel | Optionnel OHADA | Pas d'impact comptable | 🟢 FAIBLE | Direction | À définir |
| **D10** | Montant seuil pour immobilisations | Débit à 500 USD ou autre | Conformité fiscale | 🟡 MOYEN | Expert-comptable | À définir |

---

## DÉTAILS DES DÉCISIONS EN ATTENTE

### D1 — Méthode de valorisation des stocks

**Problème :** Comment valoriser les médicaments sortants ?
- **Option A : PEPS** (Premier Entré, Premier Sorti) — Simple, suit la chronologie
- **Option B : CUM** (Coût Unit Mono moyen pondéré) — Moyenne dynamique
- **Option C : Prix moyen pondéré** — Calcul périodique

**Recommandation technique :** PEPS est le plus simple à implémenter. Le CUM est plus juste mais plus complexe.

**Impact :** Sur le coût des marchandises vendues (CMV) et donc sur le résultat.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D2 — Traitement des écarts de change

**Problème :** Comment comptabiliser les écarts entre taux de change ?

**Option A :** Pertes de change → Compte **665** (Charges financières)
**Option B :** Pertes de change → Compte **675** (Charges exceptionnelles)

**Recommandation technique :** Selon OHADA, les écarts de change sont des charges/produits financiers (classe 6/7), pas exceptionnels.

**Impact :** Sur le résultat financier et l'impôt sur les sociétés.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D3 — Provision pour créances douteuses

**Problème :** Quand et comment provisionner les créances clients impayées ?

**Seuil suggéré :** 
- 30 jours : Aucune provision
- 60 jours : Provision 20%
- 90 jours : Provision 50%
- 180 jours : Provision 100%

**Recommandation technique :** À valider avec l'expert selon politique de crédit de la clinique.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D4 — Durée d'utilité des immobilisations

**Problème :** Combien d'années amortir les équipements médicaux ?

| Type d'actif | Durée suggérée | Méthode suggérée |
|--------------|----------------|------------------|
| Bâtiments | 20-30 ans | Linéaire |
| Équipements médicaux lourds | 5-10 ans | Linéaire |
| Matériel informatique | 3-5 ans | Linéaire |
| Mobilier | 5-10 ans | Linéaire |
| Véhicules | 4-6 ans | Linéaire ou dégressif |

**Recommandation technique :** La durée doit correspondre à l'usage réel et à la politique fiscale.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D5 — Traitement de la TVA en RDC

**Problème :** La RDC applique une TVA de 16%. Comment l'intégrer ?

**Comptes suggérés :**
- **4431** — TVA collectée (sur les ventes)
- **4432** — TVA déductible (sur les achats)
- **4433** — TVA à décaisser (solde à payer)

**Recommandation technique :** À valider selon la réglementation fiscale congolaise actuelle.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D6 — Clôture d'exercice

**Problème :** Quelle est la date de clôture de l'exercice comptable ?

**Options :**
- 31 décembre (standard OHADA)
- Autre date (à valider)

**Recommandation technique :** 31 décembre est le standard OHADA. À confirmer avec la direction.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D7 — Numérotation des écritures

**Problème :** Comment numéroter les écritures comptables ?

**Format suggéré :** `YYYY-NNNNNN` (année + séquentiel)
- Exemple : 2026-000001, 2026-000002, ...

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D8 — Gestion des dérogations

**Problème :** Les factures avec mention "DÉROGATION" ne sont pas payées. Comment les comptabiliser ?

**Options :**
- **Option A :** Enregistrer comme produit (706/707) et charge exceptionnelle (675) — impact neutre sur le résultat
- **Option B :** Ne pas comptabiliser (service gratuit) — risque fiscal

**Recommandation technique :** Option A pour transparence comptable. À valider selon la nature des dérogations.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D9 — Comptes de gestion (Classe 9)

**Problème :** Utiliser ou non les comptes 9xx pour le suivi opérationnel ?

**Options :**
- **Option A :** Utiliser les comptes 9xx pour suivi commande, créance, engagement
- **Option B :** Ne pas utiliser (comptes hors-bilan)

**Recommandation technique :** Optionnel selon OHADA. Peut faciliter la gestion opérationnelle.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

### D10 — Seuil d'immobilisation

**Problème :** À partir de quel montant un bien est-il une immobilisation ?

**Options :**
- **Option A :** 500 USD (seuil bas, plus de biens amortis)
- **Option B :** 1000 USD (seuil moyen, standard)
- **Option C :** 2000 USD (seuil haut, moins de biens amortis)

**Recommandation technique :** À valider selon politique interne et fiscalité locale.

**Validé par :** ⏳ EN ATTENTE
**Date de validation :** N/A
**Signataire :** _________________

---

## CHECKLIST DE VALIDATION

Avant chaque étape d'implémentation, cocher les validations obligatoires :

### Avant Étape 9.1 (Plan comptable)
- [ ] D1 — Méthode valorisation stocks VALIDÉE
- [ ] D2 — Traitement écarts de change VALIDÉ
- [ ] D5 — TVA RDC VALIDÉE
- [ ] D6 — Clôture exercice VALIDÉE

### Avant Étape 9.2 (Journaux)
- [ ] D7 — Numérotation écritures VALIDÉE

### Avant Étape 9.3 (Écritures)
- [ ] D3 — Provision créances VALIDÉE
- [ ] D8 — Dérogations VALIDÉES

### Avant Étape 9.4+ (Balances & Rapports)
- [ ] Toutes les validations ci-dessus complétées

---

## HISTORIQUE DES VALIDATIONS

| Date | Décision | Statut | Validé par | Commentaire |
|------|----------|--------|------------|-------------|
| 20/10/2026 | A1-A10 | ✅ Apprové | Audit Phase 7 | Base SYSCOHADA |
| 20/10/2026 | D1-D10 | ⏳ En attente | Expert-comptable | Nécessite validation |

---

## CONCLUSION

> Ce document doit être complété par un expert-comptable diplômé en SYSCOHADA avant toute implémentation. Aucune décision ne peut être considérée comme validée sans signature et date.

**Prochaine étape :** Faire valider les décisions D1-D10 par un expert-comptable avant de procéder à l'implémentation.