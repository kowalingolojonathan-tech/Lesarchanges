export type Role = 
  | 'ADMINISTRATEUR' 
  | 'DIRECTEUR' 
  | 'MÉDECIN' 
  | 'MEDECIN'
  | 'MEDECIN_GENERALISTE' 
  | 'MEDECIN_PEDIATRE' 
  | 'MEDECIN_EXTERNE' 
  | 'RÉCEPTION' 
  | 'LABORATOIRE' 
  | string;

export interface PermissionDefinition {
  code: string;
  label: string;
  category: string;
}

export interface RoleDefinition {
  id: string;
  code: string;
  nom: string;
  description?: string | null;
  categorie: string;
  is_system?: boolean;
  actif: boolean;
  permissions: string[];
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  username: string;
  nom_complet: string;
  nom?: string;
  prenom?: string;
  post_nom?: string;
  fonction?: string;
  telephone?: string;
  email?: string;
  role: Role;
  role_id?: string | null;
  role_nom?: string | null;
  role_code?: string | null;
  role_categorie?: string;
  permissions?: string[];
  actif: boolean;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SessionInfo {
  user: User;
  token: string;
  expires_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  nom_complet?: string;
  username?: string;
  role?: Role;
  action: string;
  ressource_type: string;
  ressource_id: string | null;
  details: string | null;
  ip_address: string | null;
  timestamp: string;
}

export interface RolePermissions {
  role: Role;
  description: string;
  canManageUsers: boolean;
  canViewTechnicalAudit: boolean;
  canManagePatientsReception: boolean;
  canRecordVitals: boolean;
  canProcessPayments: boolean;
  canAccessConsultations: boolean;
  canPrescribeMedicines: boolean;
  canOrderLabTests: boolean;
  canReferExternal: boolean;
  canProcessLabSamples: boolean;
  canValidateLabResults: boolean;
}

export interface ClinicStatsSummary {
  totalUsers: number;
  totalAuditLogs: number;
  dbStatus: string;
  activeRole: Role;
  supportedCurrencies: string[];
}

export interface Patient {
  id: string;
  numero_dossier: string;
  nom: string;
  post_nom: string;
  prenom: string;
  date_naissance: string;
  sexe: 'M' | 'F';
  lieu_naissance: string;
  pays_naissance: string;
  profession?: string | null;
  etat_civil?: string | null;
  telephone: string;
  adresse?: string | null;
  contact_urgence_nom?: string | null;
  contact_urgence_telephone?: string | null;
  groupe_sanguin?: string | null;
  allergies?: string | null;
  antecedents?: string | null;
  actif: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export type VisiteStatut = 
  | 'ATTENTE_TRIAGE'
  | 'TRIAGE_TERMINE'
  | 'ATTENTE_PAIEMENT_CONSULTATION'
  | 'ATTENTE_MEDECIN'
  | 'EN_CONSULTATION'
  | 'ATTENTE_EXAMENS'
  | 'ATTENTE_SPECIALISTE'
  | 'CLOTUREE'
  | 'ANNULEE';

export type VisiteType = 'STANDARD' | 'URGENCE' | 'CONTROLE' | 'INTERPRETATION_RESULTATS';

export interface Visite {
  id: string;
  numero_visite: string;
  patient_id: string;
  medecin_id?: string | null;
  date_arrivee: string;
  statut: VisiteStatut;
  motif_venue?: string | null;
  type_visite: VisiteType;
  cloturee_le?: string | null;
  heure_orientation?: string | null;
  heure_prise_en_charge?: string | null;
  heure_debut_consultation?: string | null;
  heure_fin_consultation?: string | null;
  consultation_origine_id?: string | null;
  elements_a_interpreter?: string | null;
  created_at: string;
  // Données jointes
  numero_dossier?: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_date_naissance?: string;
  patient_sexe?: 'M' | 'F';
  patient_telephone?: string;
  medecin_nom?: string | null;
  statut_paiement?: 'NON PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'PAYÉ';
  // Dernières constantes biométriques
  temperature?: number | null;
  tension_systolique?: number | null;
  tension_diastolique?: number | null;
  pouls?: number | null;
  spo2?: number | null;
  frequence_respiratoire?: number | null;
  poids?: number | null;
  taille?: number | null;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  douleur?: number | null;
}

export interface SignesVitaux {
  id: string;
  visite_id: string;
  patient_id: string;
  agent_id: string;
  temperature?: number | null;
  tension_systolique?: number | null;
  tension_diastolique?: number | null;
  pouls?: number | null;
  frequence_respiratoire?: number | null;
  spo2?: number | null;
  poids?: number | null;
  taille?: number | null;
  glycemie_mesuree?: number | null;
  douleur?: number | null;
  age_calcule?: number | null;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  surface_corporelle?: number | null;
  pression_pulsee?: number | null;
  alertes_constantes?: string | null;
  date_prise: string;
  agent_nom?: string;
}

export interface Doctor {
  id: string;
  username: string;
  nom_complet: string;
  role: Role;
}

export interface ReceptionDashboardStats {
  total_visites_jour: number;
  attente_triage: number;
  triage_termine: number;
  attente_medecin: number;
  nouveaux_patients_jour: number;
  total_patients_clinique: number;
}

export type ConsultationStatut = 'BROUILLON' | 'EN_COURS' | 'FINALISEE' | 'SUSPENDUE_EXAMENS' | 'SUSPENDUE_ORIENTATION' | 'TERMINEE';

export type StatutHypothese = 'SUSPECTE' | 'EN_ATTENTE_EXAMENS' | 'EN_ATTENTE_LABO' | 'EN_ATTENTE_IMAGERIE' | 'NON_RETENU';

export interface HypotheseDiagnostique {
  id: string;
  libelle: string;
  statut?: StatutHypothese;
  attente_details?: string | null;
  certitude?: 'FAIBLE' | 'MOYENNE' | 'FORTE';
  created_at: string;
}

export type StatutDiagnosticRetenu = 'RETENU' | 'CONFIRME';

export interface DiagnosticRetenu {
  id: string;
  libelle: string;
  statut: StatutDiagnosticRetenu; // 'RETENU' ou 'CONFIRME'
  is_principal?: boolean;
  precision?: string | null;
  created_at: string;
}

export interface Consultation {
  id: string;
  visite_id: string;
  patient_id: string;
  medecin_id: string;
  date_consultation: string;
  motif_consultation?: string | null;
  histoire_maladie?: string | null;
  examen_physique?: string | null;
  diagnostic_principal?: string | null;
  diagnostics_associes?: string | null;
  hypotheses_diagnostiques?: string | HypotheseDiagnostique[] | null;
  diagnostics_retenus?: string | DiagnosticRetenu[] | null;
  conduite_a_tenir?: string | null;
  notes_confidentielles?: string | null;
  statut: ConsultationStatut;
  finalisee_le?: string | null;
  amendement_motif?: string | null;
  created_at: string;
  updated_at: string;
  // Données jointes
  numero_visite?: string;
  date_arrivee?: string;
  visite_statut?: string;
  type_visite?: string;
  numero_dossier?: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_date_naissance?: string;
  patient_age?: number | null;
  patient_sexe?: 'M' | 'F';
  patient_telephone?: string;
  allergies?: string | null;
  antecedents?: string | null;
  groupe_sanguin?: string | null;
  medecin_nom?: string;
  // Signes vitaux de la visite
  temperature?: number | null;
  tension_systolique?: number | null;
  tension_diastolique?: number | null;
  pouls?: number | null;
  spo2?: number | null;
  frequence_respiratoire?: number | null;
  poids?: number | null;
  taille?: number | null;
  glycemie_mesuree?: number | null;
  douleur?: number | null;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  surface_corporelle?: number | null;
  pression_pulsee?: number | null;
  alertes_constantes?: string | null;
  triage_date_prise?: string | null;
  triage_agent_nom?: string | null;
  heure_orientation?: string | null;
  heure_prise_en_charge?: string | null;
  heure_debut_consultation?: string | null;
  heure_fin_consultation?: string | null;
  consultation_origine_id?: string | null;
  elements_a_interpreter?: string | null;
  interpretation_context?: {
    consultation_origine?: any;
    lab_orders?: any[];
    elements_selectionnes?: string[];
  } | null;
  prescriptions?: Prescription[];
  lab_orders?: DemandeLaboratoire[];
}

export interface DoctorQueueStats {
  attente: number;
  en_cours: number;
  a_finaliser: number;
  terminees_jour: number;
}

export interface DoctorQueueData {
  doctor: {
    id: string;
    nom_complet: string;
    username: string;
    role: Role;
  };
  stats: DoctorQueueStats;
  quickAccess?: {
    patients: number;
    rdv: number;
    rdvPlanifies: number;
    ordonnances: number;
    labResults: number;
    bulletins: number;
    arriveesJour: number;
    demandesLabo: number;
    orientations: number;
  };
  quickAccessLists?: {
    patientsReçusAujourdhui: any[];
    rdvAujourdhui: any[];
    rdvPlanifiesFuturs: any[];
    ordonnancesList: any[];
    labResultsNonLus: any[];
    bulletinsDispo: any[];
    demandesLaboNonTraitees: any[];
    orientationsEnAttente: any[];
  };
  queue: {
    attente: Visite[];
    en_cours: Consultation[];
    a_finaliser: Consultation[];
    terminees_jour: Consultation[];
    dernieres_consultations: Consultation[];
  };
}

export interface MedicalHistoryItem {
  id: string;
  visite_id: string;
  patient_id: string;
  medecin_id: string;
  date_consultation: string;
  motif_consultation?: string | null;
  histoire_maladie?: string | null;
  examen_physique?: string | null;
  diagnostic_principal?: string | null;
  diagnostics_associes?: string | null;
  hypotheses_diagnostiques?: string | HypotheseDiagnostique[] | null;
  diagnostics_retenus?: string | DiagnosticRetenu[] | null;
  conduite_a_tenir?: string | null;
  statut: ConsultationStatut;
  finalisee_le?: string | null;
  created_at: string;
  numero_visite: string;
  date_arrivee: string;
  type_visite: string;
  medecin_nom: string;
  temperature?: number | null;
  tension_systolique?: number | null;
  tension_diastolique?: number | null;
  pouls?: number | null;
  spo2?: number | null;
  frequence_respiratoire?: number | null;
  poids?: number | null;
  taille?: number | null;
  glycemie_mesuree?: number | null;
  douleur?: number | null;
  imc?: number | null;
  categorie_imc?: string | null;
  pam?: number | null;
  surface_corporelle?: number | null;
  pression_pulsee?: number | null;
  alertes_constantes?: string | null;
  triage_date_prise?: string | null;
  triage_agent_nom?: string | null;
  heure_orientation?: string | null;
  heure_prise_en_charge?: string | null;
  heure_debut_consultation?: string | null;
  heure_fin_consultation?: string | null;
  prescriptions?: Prescription[];
  lab_orders?: DemandeLaboratoire[];
}

export type PrescriptionStatut = 'BROUILLON' | 'VALIDEE' | 'IMPRIMEE' | 'REMISE' | 'ACTIVE' | 'TERMINEE' | 'ANNULEE';

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  nom_medicament: string;
  dosage?: string | null;
  forme?: string | null;
  voie_administration?: string | null;
  frequence?: string | null;
  duree?: string | null;
  quantite?: number | null;
  instructions?: string | null;
  ordre: number;
  created_at?: string;
  updated_at?: string;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  patient_id: string;
  visite_id: string;
  medecin_id: string;
  date_prescription: string;
  statut: PrescriptionStatut;
  observations?: string | null;
  amendement_motif?: string | null;
  validee_le?: string | null;
  validee_par?: string | null;
  imprimee_le?: string | null;
  imprimee_par?: string | null;
  imprimee_par_id?: string | null;
  remise_le?: string | null;
  remise_par?: string | null;
  remise_par_id?: string | null;
  created_at: string;
  updated_at: string;
  items?: PrescriptionItem[];
  medecin_nom?: string;
  numero_visite?: string;
  numero_dossier?: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_date_naissance?: string;
  patient_sexe?: string;
  patient_telephone?: string;
}

// ==========================================
// TYPES ANALYSES DE LABORATOIRE (PHASE 2C-2 & 2C-3)
// ==========================================

export type LabOrderStatut = 
  | 'DEMANDE_CREEE'
  | 'PRISE_EN_CHARGE'
  | 'EN_ATTENTE_PRELEVEMENT'
  | 'PRELEVEMENT_EFFECTUE'
  | 'ECHANTILLON_RECU'
  | 'ECHANTILLON_NON_CONFORME'
  | 'EN_ANALYSE'
  | 'RESULTATS_A_SAISIR'
  | 'RESULTATS_SAISIS'
  | 'RESULTAT_A_VALIDER'
  | 'RESULTATS_VALIDES'
  | 'RESULTAT_VALIDE'
  | 'TRANSMIS_AU_MEDECIN'
  | 'TERMINEE'
  | 'ANNULEE';

export type LabOrderUrgence = 'NORMALE' | 'URGENTE';

export type EchantillonType = 'SANG' | 'URINE' | 'SELLES' | 'AUTRE';

export interface AnalyseLaboratoire {
  id: string;
  demande_laboratoire_id: string;
  nom_analyse: string;
  type_echantillon: EchantillonType;
  statut: string;
  instructions?: string | null;
  ordre: number;
  echantillon_id?: string | null;
  valeur_mesuree?: string | null;
  valeur_resultat?: string | null;
  unite?: string | null;
  unite_mesure?: string | null;
  valeurs_reference?: string | null;
  normes_reference?: string | null;
  flag_anomalie?: 'NORMAL' | 'ANORMAL' | 'PATHOLOGIQUE' | 'CRITIQUE' | string | null;
  interpretation?: 'NORMAL' | 'ANORMAL' | 'CRITIQUE' | string | null;
  resultats_detailles?: string | null;
  observation?: string | null;
  commentaire_technique?: string | null;
  technicien_id?: string | null;
  valide_par_id?: string | null;
  date_analyse?: string | null;
  date_validation?: string | null;
  created_at?: string;
  updated_at?: string;
  // Phase 2C-5 Catalogue fields
  examen_id?: string | null;
  mode?: ModePrescription;
  parametre_id?: string | null;
  sous_parametre_id?: string | null;
  selection_details?: { parametre_id?: string; sous_parametre_id?: string }[] | null;
  prix_usd?: number | null;
}

export type LabAnalyse = AnalyseLaboratoire;

export interface LabResultAmendment {
  id: string;
  demande_laboratoire_id: string;
  analyse_laboratoire_id?: string | null;
  ancien_resultat: string;
  nouveau_resultat: string;
  motif: string;
  amende_par_id: string;
  amende_par_nom?: string;
  created_at: string;
}

export interface DemandeLaboratoire {
  id: string;
  numero_demande?: string | null;
  consultation_id: string;
  patient_id: string;
  visite_id: string;
  medecin_id: string;
  laborantin_id?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  date_demande: string;
  statut: LabOrderStatut;
  urgence: LabOrderUrgence;
  indication_clinique?: string | null;
  commentaire?: string | null;
  amendement_motif?: string | null;
  facture_id?: string | null;
  result_entered_by?: string | null;
  result_entered_at?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  result_entered_by_nom?: string | null;
  validated_by_nom?: string | null;
  date_prelevement?: string | null;
  preleve_par_id?: string | null;
  preleve_par_nom?: string | null;
  date_validation?: string | null;
  valide_par_nom?: string | null;
  conclusion_globale?: string | null;
  conclusion_generale?: string | null;
  remarques_techniques?: string | null;
  document_url?: string | null;
  document_nom?: string | null;
  created_at: string;
  updated_at: string;
  analyses?: AnalyseLaboratoire[];
  amendements?: LabResultAmendment[];
  medecin_nom?: string;
  laborantin_nom?: string | null;
  assigned_by_nom?: string | null;
  numero_visite?: string;
  numero_dossier?: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_date_naissance?: string;
  patient_sexe?: 'M' | 'F';
  statut_paiement?: 'NON PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'PAYÉ';
  bloque_caisse?: boolean;
  statut_paiement_labo?: string;
  has_derogation?: boolean;
}

export type LabOrder = DemandeLaboratoire;

export interface LaborantinUser {
  id: string;
  username: string;
  nom_complet: string;
  role: Role;
  actif: number;
}

export interface LaboratoryQueueData {
  general_orders: DemandeLaboratoire[];
  my_orders: DemandeLaboratoire[];
  other_assigned_orders: DemandeLaboratoire[];
  completed_orders?: DemandeLaboratoire[];
  total_count: number;
}

// ==========================================
// TYPES CATALOGUE LABORATOIRE (Phase 2C-5)
// ==========================================

export type TypeResultat = 'NUMERIQUE' | 'TEXTE' | 'CHOIX';
export type ModePrescription = 'GLOBAL' | 'PERSONNALISE';

export interface CatalogueExam {
  id: string;
  nom: string;
  code: string;
  description?: string | null;
  actif: number | boolean;
  ordre_affichage: number;
  prix_global_usd?: number | null;
  created_at?: string;
  updated_at?: string;
  parametres?: CatalogueParametre[];
}

export interface CatalogueParametre {
  id: string;
  examen_id: string;
  nom: string;
  code: string;
  unite?: string | null;
  type_resultat: TypeResultat;
  obligatoire: number | boolean;
  ordre_affichage: number;
  actif: number | boolean;
  prix_usd?: number | null;
  created_at?: string;
  updated_at?: string;
  sous_parametres?: CatalogueSousParametre[];
}

export interface CatalogueSousParametre {
  id: string;
  parametre_id: string;
  nom: string;
  code: string;
  unite?: string | null;
  type_resultat: TypeResultat;
  obligatoire: number | boolean;
  ordre_affichage: number;
  actif: number | boolean;
  prix_usd?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface LabOrderPrescription {
  id?: string;
  nom_analyse: string;
  type_echantillon: EchantillonType;
  instructions?: string;
  ordre?: number;
  // Champs nouveau catalogue
  examen_id?: string | null;
  mode?: ModePrescription;
  parametre_id?: string | null;
  sous_parametre_id?: string | null;
  selection_details?: { parametre_id?: string; sous_parametre_id?: string }[] | null;
  prix_usd?: number | null;
  tarif_id?: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  titre: string;
  message: string;
  type: 'LAB_RESULTS_READY' | 'INFO' | 'URGENT';
  patient_id?: string | null;
  consultation_id?: string | null;
  visite_id?: string | null;
  lab_order_id?: string | null;
  lu: number;
  created_at: string;
}

// ==========================================
// TYPES RENDEZ-VOUS (ÉTAPE 7 - SYSTÈME PARTAGÉ)
// ==========================================

export type RendezVousStatut = 
  | 'PLANIFIÉ'
  | 'CONFIRMÉ'
  | 'PATIENT PRÉSENT'
  | 'HONORÉ'
  | 'ABSENT'
  | 'ANNULÉ';

export type RappelStatut = 'NON_ENVOYE' | 'ENVOYE' | 'CONFIRME_PAR_PATIENT' | 'SANS_REPONSE';

export interface RendezVous {
  id: string;
  numero_rdv: string;
  patient_id: string;
  medecin_id?: string | null;
  date_rdv: string; // YYYY-MM-DD
  heure_rdv?: string | null; // HH:MM
  motif: string;
  type_rdv?: string | null; // 'CONSULTATION', 'CONTROLE', 'SUIVI', etc.
  statut: RendezVousStatut;
  cree_par_id: string;
  notes?: string | null;
  visite_id?: string | null;
  rappel_statut?: RappelStatut;
  rappel_date?: string | null;
  source_demande?: string | null; // 'TELEPHONE', 'ACCUEIL', 'CONSULTATION_SUIVI', etc.
  actif?: number;
  created_at: string;
  updated_at: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_post_nom?: string;
  numero_dossier?: string;
  patient_telephone?: string;
  medecin_nom?: string;
  cree_par_nom?: string;
  patient_nom_temp?: string | null;
  patient_prenom_temp?: string | null;
  patient_telephone_temp?: string | null;
  facture_id?: string | null;
  numero_facture?: string | null;
  facture_montant_usd?: number | null;
  statut_paiement?: string | null;
}

// ========================================================
// TYPES FACTURATION, TARIFS, PAIEMENTS & DEVISES (ÉTAPE 8)
// ========================================================

export type PrestationCategorie = 
  | 'TYPE_VISITE'
  | 'CONSULTATION'
  | 'EXAMEN_LABORATOIRE'
  | 'IMAGERIE'
  | 'ACTE_SERVICE';

export interface PrestationTarif {
  id: string;
  nom: string;
  categorie: PrestationCategorie;
  prix_usd: number;
  actif: number | boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type FactureStatut = 'NON PAYÉ' | 'PARTIELLEMENT PAYÉ' | 'PAYÉ';

export interface FactureItem {
  id: string;
  facture_id: string;
  tarif_id?: string | null;
  code_prestation?: string | null;
  description: string;
  categorie?: PrestationCategorie | string | null;
  quantite: number;
  prix_unitaire: number; // en USD
  montant_ligne: number; // en USD
  devise: string;
}

export interface Paiement {
  id: string;
  numero_recu: string;
  facture_id: string;
  montant_paye: number; // Montant réellement payé
  devise: 'USD' | 'FC'; // Devise du paiement
  taux_usd_fc: number;  // Taux scellé au moment précis de ce paiement
  equivalent_usd: number;
  equivalent_fc: number;
  mode_paiement: 'ESPECES' | 'MOBILE_MONEY' | 'CARTE_BANCAIRE';
  reference_transaction?: string | null;
  notes?: string | null;
  date_paiement: string;
  encaisse_par_id?: string;
  encaisse_par_nom?: string;
  numero_facture?: string;
  patient_nom?: string;
  patient_prenom?: string;
  numero_dossier?: string;
}

export interface Facture {
  id: string;
  numero_facture: string;
  patient_id: string;
  visite_id?: string | null;
  type_prestation: string;
  montant_total: number; // en USD
  montant_total_usd: number;
  montant_total_fc: number;
  devise: string;
  taux_usd_fc: number; // Taux au moment de la facturation
  statut: FactureStatut;
  emise_par_id: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Calculs dynamiques
  total_paye_usd: number;
  total_paye_fc: number;
  solde_usd: number;
  solde_fc: number;
  // Données enrichies
  patient_nom?: string;
  patient_prenom?: string;
  numero_dossier?: string;
  patient_telephone?: string;
  emise_par_nom?: string;
  numero_visite?: string;
  items?: FactureItem[];
  paiements?: Paiement[];
}

export interface ExchangeRateInfo {
  rate: number;
  currency_from: 'USD';
  currency_to: 'FC';
  updated_at: string;
}

export interface BillingReportsData {
  devise_vue_par_defaut: 'FC';
  devise_vue_actuelle: 'FC' | 'USD';
  totaux_separes: {
    total_paye_usd: number;
    total_paye_fc: number;
    nb_paiements_usd: number;
    nb_paiements_fc: number;
  };
  total_global: {
    montant_fc: number;
    montant_usd: number;
    valeur_affichee: number;
    devise_affichee: 'FC' | 'USD';
  };
  paiements: Paiement[];
}