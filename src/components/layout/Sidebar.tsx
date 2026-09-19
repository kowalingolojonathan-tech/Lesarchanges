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
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  // Définition des items de navigation par rôle
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      roles: ['ADMINISTRATEUR', 'RÉCEPTION', 'MÉDECIN', 'LABORATOIRE'],
    },
    // Menus pour RÉCEPTION
    {
      id: 'reception-patients',
      label: 'Dossiers Patients',
      badge: 'V1 Socle',
      icon: UserPlus,
      roles: ['RÉCEPTION'],
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
      roles: ['RÉCEPTION'],
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
      id: 'admin-settings',
      label: 'Devises & Configuration',
      icon: Settings,
      roles: ['ADMINISTRATEUR'],
    },
    // Menu commun de vérification technique de la sécurité RBAC
    {
      id: 'rbac-tester',
      label: 'Vérification Sécurité RBAC',
      icon: ShieldCheck,
      roles: ['ADMINISTRATEUR', 'RÉCEPTION', 'MÉDECIN', 'LABORATOIRE'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      <div className="space-y-6">
        <div>
          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Espace {role}
          </div>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
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
      </div>

      {/* Cadre informationnel de statut */}
      <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 text-xs text-slate-400">
        <div className="flex items-center space-x-2 text-slate-300 font-medium mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Socle V1 Actif</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Base relationnelle ACID SQLite avec intégrité référentielle et séparation stricte RBAC.
        </p>
      </div>
    </aside>
  );
};
