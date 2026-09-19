/**
 * Utilitaires de calcul et de validation financière stricte pour la facturation (V1).
 * Règle d'or : Le frontend ne peut JAMAIS imposer arbitrairement le montant total d'une facture
 * ou son solde. Tous les montants, lignes, soldes et statuts sont obligatoirement calculés
 * et validés par le backend.
 */

export type DeviseClinique = 'USD' | 'CDF';

export interface FactureItemInput {
  code_prestation: string;
  description: string;
  quantite: number;
  prix_unitaire: number;
  devise: DeviseClinique;
}

export interface FactureItemCalcule extends FactureItemInput {
  montant_ligne: number;
}

export interface VerificationFactureResult {
  valide: boolean;
  erreur?: string;
  items: FactureItemCalcule[];
  montant_total: number;
  devise: DeviseClinique;
}

export interface VerificationPaiementResult {
  valide: boolean;
  erreur?: string;
  montant_total: number;
  montant_deja_paye: number;
  nouveau_paiement: number;
  total_paye: number;
  solde_restant: number;
  nouveau_statut: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';
}

/**
 * Valide et calcule les lignes d'une facture.
 * Vérifie :
 * - quantite > 0
 * - prix_unitaire >= 0
 * - montant_ligne = quantite * prix_unitaire (arrondi à 2 décimales)
 * - devise supportée (USD ou CDF exclusivement, aucune logique FCFA)
 * - cohérence de la devise sur l'ensemble des lignes
 * - montant_total = somme des montants de ligne
 */
export function validerEtCalculerFacture(
  items: FactureItemInput[],
  deviseDemandee: DeviseClinique
): VerificationFactureResult {
  if (!items || items.length === 0) {
    return {
      valide: false,
      erreur: 'Une facture doit contenir au moins une ligne de prestation.',
      items: [],
      montant_total: 0,
      devise: deviseDemandee,
    };
  }

  if (deviseDemandee !== 'USD' && deviseDemandee !== 'CDF') {
    return {
      valide: false,
      erreur: `Devise non supportée : ${deviseDemandee}. Seules les devises 'USD' et 'CDF' sont autorisées.`,
      items: [],
      montant_total: 0,
      devise: deviseDemandee,
    };
  }

  let totalCalcule = 0;
  const itemsCalcules: FactureItemCalcule[] = [];

  for (const item of items) {
    if (!item.code_prestation || !item.description) {
      return {
        valide: false,
        erreur: 'Chaque ligne de facture doit comporter un code de prestation et une description.',
        items: [],
        montant_total: 0,
        devise: deviseDemandee,
      };
    }

    if (!Number.isInteger(item.quantite) || item.quantite <= 0) {
      return {
        valide: false,
        erreur: `Quantité invalide pour la prestation ${item.code_prestation} : la quantité doit être un entier strictement positif.`,
        items: [],
        montant_total: 0,
        devise: deviseDemandee,
      };
    }

    if (typeof item.prix_unitaire !== 'number' || isNaN(item.prix_unitaire) || item.prix_unitaire < 0) {
      return {
        valide: false,
        erreur: `Prix unitaire invalide pour la prestation ${item.code_prestation} : doit être un nombre positif ou nul.`,
        items: [],
        montant_total: 0,
        devise: deviseDemandee,
      };
    }

    if (item.devise !== deviseDemandee) {
      return {
        valide: false,
        erreur: `Incohérence de devise sur la ligne ${item.code_prestation} : la ligne spécifie ${item.devise} alors que la facture est en ${deviseDemandee}.`,
        items: [],
        montant_total: 0,
        devise: deviseDemandee,
      };
    }

    // Calcul obligatoire côté backend du montant de la ligne
    const montantLigne = Math.round(item.quantite * item.prix_unitaire * 100) / 100;
    totalCalcule += montantLigne;

    itemsCalcules.push({
      ...item,
      montant_ligne: montantLigne,
    });
  }

  const montantTotalFinal = Math.round(totalCalcule * 100) / 100;

  return {
    valide: true,
    items: itemsCalcules,
    montant_total: montantTotalFinal,
    devise: deviseDemandee,
  };
}

/**
 * Valide un encaissement et calcule les soldes et le statut de la facture.
 * Vérifie :
 * - montant_paiement > 0
 * - montant_paiement <= solde_restant (pas de trop-perçu non géré)
 * - mise à jour du statut : PARTIELLEMENT_PAYEE ou PAYEE
 */
export function validerEtCalculerPaiement(
  montantTotalFacture: number,
  paiementsExistants: number[],
  nouveauPaiement: number
): VerificationPaiementResult {
  if (typeof nouveauPaiement !== 'number' || isNaN(nouveauPaiement) || nouveauPaiement <= 0) {
    return {
      valide: false,
      erreur: 'Le montant du paiement doit être un nombre strictement positif.',
      montant_total: montantTotalFacture,
      montant_deja_paye: 0,
      nouveau_paiement: 0,
      total_paye: 0,
      solde_restant: montantTotalFacture,
      nouveau_statut: 'EN_ATTENTE_PAIEMENT',
    };
  }

  const totalDejaPaye = paiementsExistants.reduce((acc, curr) => acc + curr, 0);
  const soldeAvant = Math.max(0, Math.round((montantTotalFacture - totalDejaPaye) * 100) / 100);

  if (nouveauPaiement > soldeAvant + 0.001) {
    return {
      valide: false,
      erreur: `Le montant versé (${nouveauPaiement}) excède le solde restant dû (${soldeAvant}).`,
      montant_total: montantTotalFacture,
      montant_deja_paye: totalDejaPaye,
      nouveau_paiement: nouveauPaiement,
      total_paye: totalDejaPaye,
      solde_restant: soldeAvant,
      nouveau_statut: totalDejaPaye > 0 ? 'PARTIELLEMENT_PAYEE' : 'EN_ATTENTE_PAIEMENT',
    };
  }

  const totalPaye = Math.round((totalDejaPaye + nouveauPaiement) * 100) / 100;
  const soldeRestant = Math.max(0, Math.round((montantTotalFacture - totalPaye) * 100) / 100);

  let nouveauStatut: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';
  if (soldeRestant <= 0.001) {
    nouveauStatut = 'PAYEE';
  } else if (totalPaye > 0) {
    nouveauStatut = 'PARTIELLEMENT_PAYEE';
  } else {
    nouveauStatut = 'EN_ATTENTE_PAIEMENT';
  }

  return {
    valide: true,
    montant_total: montantTotalFacture,
    montant_deja_paye: totalDejaPaye,
    nouveau_paiement: nouveauPaiement,
    total_paye: totalPaye,
    solde_restant: soldeRestant,
    nouveau_statut: nouveauStatut,
  };
}
