import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  UserPlus, 
  Stethoscope, 
  CreditCard, 
  FlaskConical, 
  Users, 
  HeartPulse, 
  Menu,
  Clock,
  Printer
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMenu,
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const isDoctor = ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE'].includes(user.role) || user.role_categorie === 'MÉDECIN';
  const isAdmin = ['ADMINISTRATEUR', 'ADMIN'].includes(user.role) || user.role_categorie === 'ADMINISTRATEUR';
  const isReception = ['RÉCEPTION', 'RECEPTION'].includes(user.role) || user.role_categorie === 'RÉCEPTION';
  const isLab = ['LABORATOIRE', 'LABO'].includes(user.role) || user.role_categorie === 'LABORATOIRE';
  const isDirector = user.role === 'DIRECTEUR' || user.role_categorie === 'DIRECTEUR';

  // Items rapides selon le profil
  const getNavItems = () => {
    if (isDoctor && !isAdmin && !isDirector) {
      return [
        { id: 'dashboard', label: 'Consultations', icon: Stethoscope },
        { id: 'reception-patients', label: 'Patients', icon: UserPlus },
        { id: 'doctor-lab-orders', label: 'Analyses', icon: FlaskConical },
      ];
    }
    if (isReception) {
      return [
        { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
        { id: 'reception-patients', label: 'Patients', icon: UserPlus },
        { id: 'reception-vitals', label: 'Triage', icon: HeartPulse },
        { id: 'reception-cashier', label: 'Caisse', icon: CreditCard },
      ];
    }
    if (isLab) {
      return [
        { id: 'dashboard', label: 'Analyses', icon: FlaskConical },
        { id: 'lab-sampling', label: 'Prélèvements', icon: HeartPulse },
      ];
    }
    if (isAdmin || isDirector) {
      return [
        { id: 'dashboard', label: 'Bord', icon: LayoutDashboard },
        { id: 'admin-users', label: 'Équipe', icon: Users },
        { id: 'reception-cashier', label: 'Caisse', icon: CreditCard },
        { id: 'reception-patients', label: 'Patients', icon: UserPlus },
      ];
    }
    return [
      { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav 
      aria-label="Navigation mobile principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 min-h-[48px] rounded-lg transition-colors ${
              isActive 
                ? 'text-emerald-700 font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-full transition-transform ${isActive ? 'bg-emerald-100 scale-105' : ''}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight mt-0.5 truncate max-w-[70px]">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Bouton d'ouverture du menu latéral complet */}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 min-h-[48px] rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
        aria-label="Ouvrir le menu complet"
      >
        <div className="p-1 rounded-full bg-slate-100">
          <Menu className="w-5 h-5 text-slate-700" />
        </div>
        <span className="text-[11px] tracking-tight mt-0.5 text-slate-600 font-medium">
          Menu
        </span>
      </button>
    </nav>
  );
};
