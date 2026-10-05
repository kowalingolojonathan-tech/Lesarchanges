import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Header } from './components/layout/Header.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { LoginView } from './components/auth/LoginView.js';
import { RoleDashboard } from './components/dashboard/RoleDashboard.js';
import { UserManagementView } from './components/admin/UserManagementView.js';
import { AuditLogsView } from './components/admin/AuditLogsView.js';
import { ClinicSettingsView } from './components/admin/ClinicSettingsView.js';
import { TarifsManagementView } from './components/admin/TarifsManagementView.js';
import { RbacTester } from './components/common/RbacTester.js';
import { Phase2Placeholder } from './components/common/Phase2Placeholder.js';
import { ReceptionDashboardView } from './components/reception/ReceptionDashboardView.js';
import { PatientSearchView } from './components/reception/PatientSearchView.js';
import { BillingCashierView } from './components/reception/BillingCashierView.js';
import { TriageVitalsModal } from './components/reception/TriageVitalsModal.js';
import { AssignDoctorModal } from './components/reception/AssignDoctorModal.js';
import { DoctorDashboardView } from './components/medical/DoctorDashboardView.js';
import { LaboratoryQueueView } from './components/medical/LaboratoryQueueView.js';
import { MobileBottomNav } from './components/layout/MobileBottomNav.js';
import { Visite } from './types/index.js';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeTriageVisite, setActiveTriageVisite] = useState<Visite | null>(null);
  const [activeDoctorVisite, setActiveDoctorVisite] = useState<Visite | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('archanges_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('archanges_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

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
        if (user.role === 'RÉCEPTION' || user.role_categorie === 'RÉCEPTION') {
          return (
            <ReceptionDashboardView 
              onGoToSearch={() => setCurrentTab('reception-patients')} 
              onGoToCashier={() => setCurrentTab('reception-cashier')}
            />
          );
        }
        if (
          ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR'].includes(user.role) ||
          user.role_categorie === 'MÉDECIN' || user.role_categorie === 'DIRECTEUR'
        ) {
          return <DoctorDashboardView onNavigate={setCurrentTab} />;
        }
        if (user.role === 'LABORATOIRE' || user.role_categorie === 'LABORATOIRE') {
          return <LaboratoryQueueView />;
        }
        return <RoleDashboard onNavigate={setCurrentTab} />;

      // Espace Administrateur
      case 'admin-users':
        return <UserManagementView />;
      case 'admin-audit':
        return <AuditLogsView />;
      case 'admin-settings':
        return <ClinicSettingsView onNavigateToTarifs={() => setCurrentTab('admin-tarifs')} />;
      case 'admin-tarifs':
        return <TarifsManagementView />;

      // Outil de test RBAC réservé exclusivement à l'ADMINISTRATEUR
      case 'rbac-tester':
        if (user.role !== 'ADMINISTRATEUR' && user.role_categorie !== 'ADMINISTRATEUR') {
          return <RoleDashboard onNavigate={setCurrentTab} />;
        }
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
        return <BillingCashierView />;

      // Menus Médecin (Phase 2B Opérationnelle)
      case 'doctor-consultations':
        return <DoctorDashboardView onNavigate={setCurrentTab} />;

      // Menus Laboratoire (Phase 2C-3 Opérationnelle)
      case 'lab-worklist':
        return <LaboratoryQueueView />;

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

      case 'doctor-reports':
        return (
          <Phase2Placeholder
            moduleName="Rapports / Historique des Dossiers"
            roleRequired="MÉDECIN"
            description="Espace de recherche, de suivi et d'historique des consultations, dossiers, orientations et comptes-rendus."
            workflowSteps={[
              "Recherche par patient, date, type de dossier ou statut.",
              "Consultation des dossiers finalisés et comptes-rendus externes.",
              "Suivi des orientations en attente et dossiers nécessitant une action.",
              "Accès rapide à l'activité médicale du médecin."
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
      <Header 
        isSidebarCollapsed={isSidebarCollapsed} 
        onToggleSidebar={toggleSidebar} 
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          currentTab={currentTab} 
          onSelectTab={setCurrentTab} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto pb-24 md:pb-8">
          {renderContent()}
        </main>
      </div>

      {/* Barre d'accès rapide mobile native (Android / Touch) */}
      <MobileBottomNav 
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
      />

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
