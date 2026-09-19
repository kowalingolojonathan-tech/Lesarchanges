export type Role = 'ADMINISTRATEUR' | 'RÉCEPTION' | 'MÉDECIN' | 'LABORATOIRE';

export interface User {
  id: string;
  username: string;
  nom_complet: string;
  role: Role;
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
  prenom: string;
  date_naissance: string;
  sexe: 'M' | 'F';
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

export type VisiteType = 'STANDARD' | 'URGENCE' | 'CONTROLE';

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
  created_at: string;
  // Données jointes
  numero_dossier?: string;
  patient_nom?: string;
  patient_prenom?: string;
  patient_date_naissance?: string;
  patient_sexe?: 'M' | 'F';
  patient_telephone?: string;
  medecin_nom?: string | null;
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
  triage_date_prise?: string | null;
  triage_agent_nom?: string | null;
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
  imc?: number | null;
  pam?: number | null;
}


