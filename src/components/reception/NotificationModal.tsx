import React, { useState, useEffect } from 'react';
import {
  X, Bell, Clock, Check, CheckCheck, CreditCard, Printer, Calendar, FileText
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface NotificationModalProps {
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const sorted = [...(data.notifications || [])].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setNotifications(sorted);
        setUnreadCount(data.unread_count || sorted.filter((n: any) => !n.est_lu).length);
      }
    } catch (e) {
      console.error('Erreur chargement notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('archanges_auth_token') : null;
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
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

  const handleLabCollection = (labOrderId: string) => {
    window.dispatchEvent(new CustomEvent('open-lab-collection', { detail: { lab_order_id: labOrderId } }));
  };

  const handlePrescriptionAction = () => {
    window.dispatchEvent(new CustomEvent('open-prescriptions'));
  };

  const handleAppointmentAction = () => {
    window.dispatchEvent(new CustomEvent('open-appointments'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* En-tête */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-600 text-white rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              <p className="text-[11px] text-slate-500">
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Aucune notification'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout marquer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-slate-400">Chargement...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-500">Aucune notification</p>
              <p className="text-xs mt-1">Tout est à jour.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 hover:bg-slate-50 transition-colors ${!n.est_lu ? 'bg-amber-50/40' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${!n.est_lu ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-slate-300'}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-900 text-xs truncate">{n.titre}</span>
                        {!n.est_lu && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.25 rounded-full bg-amber-200 text-amber-900">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed break-words">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{new Date(n.created_at).toLocaleString('fr-FR')}</span>
                      </div>

                      {/* Actions adaptées au contexte */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {n.lab_order_id && (
                          n.is_lab_paid || (n as any).lab_facture_statut === 'PAYÉ' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Régler à la caisse
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLabCollection(n.lab_order_id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px] rounded-lg border border-emerald-300 transition-colors min-h-[32px] shadow-xs cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                              Encaisser au guichet
                            </button>
                          )
                        )}

                        {(n.type === 'PRESCRIPTION_READY' || n.titre?.toLowerCase().includes('ordonnance')) && (
                          <button
                            type="button"
                            onClick={handlePrescriptionAction}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-[11px] rounded-lg border border-sky-300 transition-colors min-h-[32px] shadow-xs cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-600" />
                            Imprimer ordonnance
                          </button>
                        )}

                        {(n.type === 'APPOINTMENT' || n.titre?.toLowerCase().includes('rendez-vous')) && (
                          <button
                            type="button"
                            onClick={handleAppointmentAction}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 font-bold text-[11px] rounded-lg border border-indigo-300 transition-colors min-h-[32px] shadow-xs cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            Gérer le rendez-vous
                          </button>
                        )}

                        {n.lab_order_id && (
                          <button
                            type="button"
                            onClick={() => handleLabCollection(n.lab_order_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold text-[11px] rounded-md border border-slate-200 transition-colors min-h-[32px] cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            Bon d'examen
                          </button>
                        )}
                      </div>
                    </div>

                    {!n.est_lu && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        title="Marquer comme lu"
                        className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-md transition-colors shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
