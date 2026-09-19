import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Header } from './components/layout/Header.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { LoginView } from './components/auth/LoginView.js';
import { RoleDashboard } from './components/dashboard/RoleDashboard.js';
import { UserManagementView } from './components/admin/UserManagementView.js';
import { AuditLogsView } from './components/admin/AuditLogsView.js';
import { ClinicSettingsView } from './components/admin/ClinicSettingsView.js';
import { RbacTester } from './components/common/RbacTester.js';
import { Phase2Placeholder } from './components/common/Phase2Placeholder.js';
import { ReceptionDashboardView } from './components/reception/ReceptionDashboardView.js';
import { PatientSearchView } from './components/reception/PatientSearchView.js';
import { TriageVitalsModal } from './components/reception/TriageVitalsModal.js';
import { AssignDoctorModal } from './components/reception/AssignDoctorModal.js';
import { DoctorDashboardView } from './components/medical/DoctorDashboardView.js';
import { Visite } from './types/index.js';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeTriageVisite, setActiveTriageVisite] = useState<Visite | null>(null);
  const [activeDoctorVisite, setActiveDoctorVisite] = useState<Visite | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Chargement de la Clinique Les Archanges...</p>
        <p className="text-xs text-slate-400 mt-1">Vérification de session & initialisation de la base relationnelle</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        if (user.role === 'RÉCEPTION') {
          return <ReceptionDashboardView onGoToSearch={() => setCurrentTab('reception-patients')} />;
        }
        if (user.role === 'MÉDECIN') {
          return <DoctorDashboardView />;
        }
        return <RoleDashboard onNavigate={setCurrentTab} />;

      // Espace Administrateur
      case 'admin-users':
        return <UserManagementView />;
      case 'admin-audit':
        return <AuditLogsView />;
      case 'admin-settings':
        return <ClinicSettingsView />;

      // Outil de test commun
      case 'rbac-tester':
        return <RbacTester />;

      // Menus Réception — Phase 2A Opérationnelle
      case 'reception-patients':
        return (
          <PatientSearchView
            onVisiteCreated={(visite) => {
              setActiveTriageVisite(visite);
            }}
            onTriageRequested={(visite) => {
              setActiveTriageVisite(visite);
            }}
          />
        );

      case 'reception-vitals':
        return <ReceptionDashboardView onGoToSearch={() => setCurrentTab('reception-patients')} />;

      case 'reception-cashier':
        return (
          <Phase2Placeholder
            moduleName="Caisse Unique & Encaissements"
            roleRequired="RÉCEPTION"
            description="Gestion centralisée de toutes les factures et encaissements de la clinique."
            workflowSteps={[
              "Visualisation des factures émises en attente de paiement (Consultations, Laboratoire, Orientations).",
              "Enregistrement du règlement (Espèces, Mobile Money, Carte) en USD ou CDF.",
              "Génération d'un reçu de caisse numéroté unique.",
              "Déblocage instantané de l'autorisation au Laboratoire ou au Médecin."
            ]}
            onBack={() => setCurrentTab('dashboard')}
          />
        );

      // Menus Médecin (Phase 2B Opérationnelle)
      case 'doctor-consultations':
        return <DoctorDashboardView />;

      case 'doctor-lab-orders':
        return (
          <Phase2Placeholder
            moduleName="Prescriptions d'Examens de Laboratoire"
            roleRequired="MÉDECIN"
            description="Sélection des analyses biologiques (NFS, Glycémie, Urines, Selles) et émission de facture."
            workflowSteps={[
              "Sélection des analyses requises par le médecin traitant.",
              "Génération automatique de la facture d'analyses transmise à la caisse de Réception.",
              "Mise en attente du traitement laboratoire jusqu'à validation de paiement.",
              "Affichage automatique des résultats validés sur l'écran du médecin."
            ]}
            onBack={() => setCurrentTab('dashboard')}
          />
        );

      case 'doctor-referrals':
        return (
          <Phase2Placeholder
            moduleName="Orientations vers Spécialistes Externes"
            roleRequired="MÉDECIN"
            description="Émission de fiche de référence sans compte externe, et réintégration du compte-rendu."
            workflowSteps={[
              "Création de la fiche d'orientation : Spécialité, établissement, praticien, motif, urgence.",
              "Impression du bon de liaison remis au patient.",
              "Réception ultérieure du compte-rendu papier/externe du spécialiste.",
              "Enregistrement des conclusions dans le dossier permanent et finalisation de la visite."
            ]}
            onBack={() => setCurrentTab('dashboard')}
          />
        );

      // Menus Laboratoire (Phase 2)
      case 'lab-worklist':
        return (
          <Phase2Placeholder
            moduleName="Paillasse des Analyses Autorisées"
            roleRequired="LABORATOIRE"
            description="File des examens ayant fait l'objet d'un paiement préalable validé à la Réception."
            workflowSteps={[
              "Affichage exclusif des demandes au statut 'AUTORISÉ À PRÉLEVER' (payées).",
              "Saisie paillasse des valeurs mesurées, unités et intervalles de référence.",
              "Validation biologique par le responsable de laboratoire.",
              "Mise à disposition immédiate des résultats pour le médecin traitant."
            ]}
            onBack={() => setCurrentTab('dashboard')}
          />
        );

      case 'lab-sampling':
        return (
          <Phase2Placeholder
            moduleName="Prélèvements & Gestion des Échantillons"
            roleRequired="LABORATOIRE"
            description="Enregistrement des tubes, flacons et conformité des prélèvements."
            workflowSteps={[
              "Nature des prélèvements : Sang, Urine, Selles, Autres.",
              "Association possible d'un même échantillon à plusieurs analyses compatibles (ex: NFS + Glycémie).",
              "Attribution d'un code-barres / identifiant unique par tube.",
              "Contrôle de conformité (rejet avec motif en cas d'échantillon non conforme)."
            ]}
            onBack={() => setCurrentTab('dashboard')}
          />
        );

      default:
        return <RoleDashboard onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header />
      <div className="flex-1 flex">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {activeTriageVisite && (
        <TriageVitalsModal
          visite={activeTriageVisite}
          onClose={() => setActiveTriageVisite(null)}
          onSuccess={(updated) => {
            setActiveTriageVisite(null);
            setActiveDoctorVisite(updated);
          }}
        />
      )}

      {activeDoctorVisite && (
        <AssignDoctorModal
          visite={activeDoctorVisite}
          onClose={() => setActiveDoctorVisite(null)}
          onSuccess={() => {
            setActiveDoctorVisite(null);
            setCurrentTab('reception-vitals');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
