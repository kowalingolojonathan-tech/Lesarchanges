import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { 
  Shield, User, LogOut, RefreshCw, KeyRound, Sparkles, PanelLeftClose, PanelLeftOpen,
  Bell, Check, FileText, CheckCheck, FlaskConical, Clock, X, Menu, CreditCard, Printer, Calendar
} from 'lucide-react';
import { Role } from '../../types/index.js';
import { apiFetch } from '../../lib/api';
import { LabReportModal } from '../medical/LabReportModal';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  isSidebarCollapsed = false, 
  onToggleSidebar,
  onToggleMobileMenu,
  isMobileMenuOpen = false
}) => {
  const { user, logout, quickLogin } = useAuth();
  const [switching, setSwitching] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [selectedBulletinOrderId, setSelectedBulletinOrderId] = useState<string | null>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      // Ignorer silencieusement en arrière-plan
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Rafraîchir les notifications lorsque l'utilisateur revient sur l'onglet / focale
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  // Écouteur d'événement global pour ouvrir les notifications depuis n'importe quel composant
  useEffect(() => {
    const handleOpenNotifEvent = () => {
      setShowNotifications(true);
      fetchNotifications();
    };
    window.addEventListener('open-notifications', handleOpenNotifEvent);
    return () => window.removeEventListener('open-notifications', handleOpenNotifEvent);
  }, [user]);

  // Fermer dropdown si clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      await fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadgeColor = (role?: Role) => {
    switch (role) {
      case 'ADMINISTRATEUR':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RÉCEPTION':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'MÉDECIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'LABORATOIRE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleQuickSwitch = async (username: string) => {
    setSwitching(true);
    try {
      await quickLogin(username);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Boutons menu & Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Bouton Hamburger sur mobile (< md) */}
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                title="Menu"
                className="md:hidden p-2 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
                aria-label="Ouvrir le menu mobile"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-slate-700" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-700" />
                )}
              </button>
            )}

            {/* Bouton Desktop Toggle (md+) */}
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title={isSidebarCollapsed ? "Afficher le menu latéral" : "Réduire le menu latéral"}
                className="hidden md:flex p-2 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors items-center justify-center shadow-2xs min-w-[40px] min-h-[40px]"
                aria-label={isSidebarCollapsed ? "Afficher le menu latéral" : "Réduire le menu latéral"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-slate-700" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-slate-700" />
                )}
              </button>
            )}

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold text-lg sm:text-xl tracking-tight shrink-0">
              ✝
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                  Clinique Les Archanges
                </span>
                <span className="hidden xs:inline-block text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200 shrink-0">
                  RDC
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden xs:block">
                Système Hospitalier & Circuit Patient
              </p>
            </div>
          </div>

          {/* Sélecteur de test rapide des 4 Rôles (Desktop) */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 flex items-center px-1.5">
              <KeyRound className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Rôle :
            </span>
            <button
              onClick={() => handleQuickSwitch('admin')}
              disabled={switching || user?.role === 'ADMINISTRATEUR'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'ADMINISTRATEUR'
                  ? 'bg-purple-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickSwitch('reception')}
              disabled={switching || user?.role === 'RÉCEPTION'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'RÉCEPTION'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Réception
            </button>
            <button
              onClick={() => handleQuickSwitch('dr.sawadogo')}
              disabled={switching || user?.role === 'MÉDECIN'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'MÉDECIN'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Médecin
            </button>
            <button
              onClick={() => handleQuickSwitch('labo.biologiste')}
              disabled={switching || user?.role === 'LABORATOIRE'}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                user?.role === 'LABORATOIRE'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Laboratoire
            </button>
          </div>

          {/* Utilisateur connecté & Déconnexion & Notifications */}
          {user && (
            <div className="flex items-center space-x-2 sm:space-x-3">
              
              {/* Cloche de Notifications */}
              <div className="relative" ref={notifDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 rounded-lg border transition-colors relative flex items-center justify-center min-w-[44px] min-h-[44px] ${
                    unreadCount > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Notifications cliniques et résultats"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center px-1 shadow-xs animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown des notifications - mobile responsive */}
                {showNotifications && (
                  <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-left max-w-sm sm:max-w-none mx-auto">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-900">Notifications Médicales</span>
                        {unreadCount > 0 && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Tout marquer
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="sm:hidden p-1 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          Aucune notification pour le moment.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 text-xs transition-colors hover:bg-slate-50 flex items-start justify-between gap-2 ${
                              !n.est_lu ? 'bg-amber-50/50' : 'bg-white'
                            }`}
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${!n.est_lu ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-slate-300'}`} />
                                <span className="font-bold text-slate-900 truncate">{n.titre}</span>
                              </div>
                              <p className="text-slate-600 text-[11px] leading-relaxed break-words">
                                {n.message}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{new Date(n.created_at).toLocaleString('fr-FR')}</span>
                              </div>

                              {/* Action directe adaptée au rôle de l'utilisateur connecté */}
                              {user?.role === 'RÉCEPTION' && n.lab_order_id && (
                                n.is_lab_paid || (n as any).lab_facture_statut === 'PAYÉ' ? (
                                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>✓ Réglé à la caisse</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('open-lab-collection', { detail: { lab_order_id: n.lab_order_id } }));
                                      setShowNotifications(false);
                                    }}
                                    className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px] rounded-lg border border-emerald-300 transition-colors min-h-[36px] shadow-xs cursor-pointer"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Encaisser au guichet (Caisse)</span>
                                  </button>
                                )
                              )}

                              {(n.type === 'PRESCRIPTION_READY' || n.titre?.toLowerCase().includes('ordonnance')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-prescriptions'));
                                    setShowNotifications(false);
                                  }}
                                  className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-[11px] rounded-lg border border-sky-300 transition-colors min-h-[36px] shadow-xs cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Imprimer ordonnance</span>
                                </button>
                              )}

                              {(n.type === 'APPOINTMENT' || n.titre?.toLowerCase().includes('rendez-vous')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-appointments'));
                                    setShowNotifications(false);
                                  }}
                                  className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 font-bold text-[11px] rounded-lg border border-indigo-300 transition-colors min-h-[36px] shadow-xs cursor-pointer"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Gérer le rendez-vous</span>
                                </button>
                              )}

                              {user?.role !== 'RÉCEPTION' && n.lab_order_id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBulletinOrderId(n.lab_order_id);
                                    setShowNotifications(false);
                                  }}
                                  className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] rounded-md border border-indigo-200 transition-colors min-h-[36px]"
                                >
                                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Ouvrir bulletin officiel</span>
                                </button>
                              )}
                            </div>

                            {!n.est_lu && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                title="Marquer comme lu"
                                className="p-2 text-slate-400 hover:text-emerald-700 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Info utilisateur sur desktop */}
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">{user.nom_complet}</div>
                <div className="flex items-center justify-end space-x-1">
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md border font-semibold ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </div>

              {/* Bouton déconnexion avec touch target */}
              <button
                onClick={() => logout()}
                title="Déconnexion"
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4 text-slate-600 hover:text-red-600" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* MODALE DU BULLETIN OFFICIEL DEPUIS NOTIFICATION */}
      {selectedBulletinOrderId && (
        <LabReportModal
          orderId={selectedBulletinOrderId}
          onClose={() => setSelectedBulletinOrderId(null)}
        />
      )}
    </header>
  );
};

