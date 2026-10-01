import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ShieldAlert, 
  UserPlus, 
  HeartPulse, 
  CreditCard, 
  Stethoscope, 
  FlaskConical, 
  Settings, 
  Tag,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;
  const isDoctor = ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE'].includes(user.role) || user.role_categorie === 'MÉDECIN';
  const isDirector = user.role === 'DIRECTEUR' || user.role_categorie === 'DIRECTEUR';
  const isAdmin = ['ADMINISTRATEUR', 'ADMIN'].includes(user.role) || user.role_categorie === 'ADMINISTRATEUR';
  const isReception = ['RÉCEPTION', 'RECEPTION'].includes(user.role) || user.role_categorie === 'RÉCEPTION';
  const isLab = ['LABORATOIRE', 'LABO'].includes(user.role) || user.role_categorie === 'LABORATOIRE';

  // Définition des items de navigation par rôle
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      roles: ['ADMINISTRATEUR', 'RÉCEPTION', 'MÉDECIN', 'LABORATOIRE'],
    },
    // Menus pour RÉCEPTION & DOSSIERS
    {
      id: 'reception-patients',
      label: 'Dossiers Patients',
      badge: 'V1 Socle',
      icon: UserPlus,
      roles: ['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR'],
    },
    {
      id: 'reception-vitals',
      label: 'Triage & Constantes',
      badge: 'V1 Socle',
      icon: HeartPulse,
      roles: ['RÉCEPTION'],
    },
    {
      id: 'reception-cashier',
      label: 'Caisse & Paiements',
      badge: 'V1 Socle',
      icon: CreditCard,
      roles: ['RÉCEPTION', 'ADMINISTRATEUR'],
    },
    // Menus pour MÉDECIN
    {
      id: 'doctor-consultations',
      label: 'Consultations & Actes',
      badge: 'V1 Socle',
      icon: Stethoscope,
      roles: ['MÉDECIN'],
    },
    {
      id: 'doctor-lab-orders',
      label: 'Prescriptions d\'Analyses',
      badge: 'V1 Socle',
      icon: FlaskConical,
      roles: ['MÉDECIN'],
    },
    {
      id: 'doctor-referrals',
      label: 'Orientations Spécialistes',
      badge: 'V1 Socle',
      icon: ExternalLink,
      roles: ['MÉDECIN'],
    },
    // Menus pour LABORATOIRE
    {
      id: 'lab-worklist',
      label: 'Analyses Autorisées',
      badge: 'Payées',
      icon: FlaskConical,
      roles: ['LABORATOIRE'],
    },
    {
      id: 'lab-sampling',
      label: 'Prélèvements & Tubes',
      badge: 'V1 Socle',
      icon: HeartPulse,
      roles: ['LABORATOIRE'],
    },
    // Menus pour ADMINISTRATEUR
    {
      id: 'admin-users',
      label: 'Gestion Utilisateurs',
      icon: Users,
      roles: ['ADMINISTRATEUR'],
    },
    {
      id: 'admin-audit',
      label: 'Journal d\'Audit Sécurisé',
      icon: ShieldAlert,
      roles: ['ADMINISTRATEUR'],
    },
    {
      id: 'admin-tarifs',
      label: 'Tarifs & Taux USD/FC',
      icon: Tag,
      roles: ['ADMINISTRATEUR'],
    },
    {
      id: 'admin-settings',
      label: 'Devises & Configuration',
      icon: Settings,
      roles: ['ADMINISTRATEUR'],
    },
    // Menu de vérification technique de la sécurité RBAC (réservé strictement à l'ADMINISTRATEUR)
    {
      id: 'rbac-tester',
      label: 'Vérification Sécurité RBAC',
      icon: ShieldCheck,
      roles: ['ADMINISTRATEUR'],
    },
  ];

  const visibleItems = navItems.filter((item) => {
    // Règle stricte : la vérification de sécurité RBAC est visible UNIQUEMENT par l'administrateur
    if (item.id === 'rbac-tester' && !isAdmin) {
      return false;
    }

    // Règle absolue de confidentialité : Le médecin ne voit pas la caisse ni les tarifs financiers
    if (isDoctor && !isAdmin && !isDirector && (item.id === 'reception-cashier' || item.id === 'admin-tarifs' || item.id === 'admin-settings')) {
      return false;
    }

    if (isAdmin && (item.roles.includes('ADMINISTRATEUR') || item.id === 'dashboard' || item.id === 'rbac-tester')) return true;
    if (isDirector && (item.roles.includes('MÉDECIN') || item.id === 'reception-patients' || item.id === 'admin-users' || item.id === 'dashboard')) return true;
    if (isDoctor && (item.roles.includes('MÉDECIN') || item.id === 'dashboard' || item.id === 'reception-patients')) return true;
    if (isReception && (item.roles.includes('RÉCEPTION') || item.id === 'dashboard')) return true;
    if (isLab && (item.roles.includes('LABORATOIRE') || item.id === 'dashboard')) return true;

    return item.roles.includes(user.role) || (user.role_categorie ? item.roles.includes(user.role_categorie) : false);
  });

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (isMobileView: boolean) => (
    <div className="flex flex-col justify-between h-full space-y-4">
      <div className="space-y-4">
        {/* En-tête du volet */}
        <div className={`flex items-center ${!isMobileView && isCollapsed ? 'justify-center' : 'justify-between px-2'} pt-1 pb-2 border-b border-slate-800`}>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
            Espace {role}
          </div>
          
          {isMobileView ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 text-slate-400 hover:text-white rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5 text-slate-300" />
            </button>
          ) : (
            onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={isCollapsed ? "Déplier le menu latéral (Afficher)" : "Réduire le menu latéral"}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                aria-label={isCollapsed ? "Afficher le menu" : "Réduire le menu"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-emerald-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-white" />
                )}
              </button>
            )
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                className={`w-full flex items-center ${
                  !isMobileView && isCollapsed ? 'justify-center py-3' : 'justify-between px-3 py-3 min-h-[44px]'
                } text-sm font-medium rounded-xl transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className={`flex items-center ${!isMobileView && isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                  <Icon className={`${!isMobileView && isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {(!isCollapsed || isMobileView) && <span className="truncate">{item.label}</span>}
                </div>

                {(!isCollapsed || isMobileView) && item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                      isActive
                        ? 'bg-emerald-700 text-emerald-100'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bas du volet */}
      <div className="space-y-2 pt-3 border-t border-slate-800">
        {!isMobileView && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? "Déplier le menu complet" : "Réduire le menu"}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
            } text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer min-h-[44px]`}
          >
            <div className="flex items-center space-x-2">
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                  <span>Réduire le volet</span>
                </>
              )}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] text-slate-500 font-mono">◄</span>
            )}
          </button>
        )}

        {/* Cadre informationnel de statut */}
        {(!isCollapsed || isMobileView) && (
          <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700 text-xs text-slate-400">
            <div className="flex items-center space-x-2 text-slate-300 font-medium mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Clinique Les Archanges</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Système Hospitalier Mobile & Desktop.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Volet Desktop / Tablette (md et supérieur) */}
      <aside 
        className={`hidden md:flex ${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex-col justify-between p-3 transition-all duration-200 shrink-0 border-r border-slate-800`}
      >
        {navContent(false)}
      </aside>

      {/* 2. Volet Mobile Slide-over Drawer (téléphone Android / petit écran) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" aria-modal="true" role="dialog">
          {/* Backdrop avec flou */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" 
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-300 h-full p-4 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 overflow-y-auto">
            {navContent(true)}
          </div>
        </div>
      )}
    </>
  );
};

