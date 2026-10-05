import React, { useState, useEffect } from 'react';
import {
  Search, Calendar, FileText, User, AlertCircle, Loader2, ArrowLeft,
  ClipboardList, Stethoscope, Eye
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ConsultationWorkspaceView } from './ConsultationWorkspaceView';

interface SearchFilters {
  q: string;
  patient_id: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  nom_patient: string;
  numero_dossier: string;
}

interface SearchReport {
  id: string;
  visite_id: string;
  patient_id: string;
  medecin_id: string;
  date_consultation: string;
  motif_consultation?: string | null;
  diagnostic_principal?: string | null;
  statut: string;
  finalisee_le?: string | null;
  numero_visite?: string;
  date_arrivee?: string;
  patient_nom?: string;
  patient_prenom?: string;
  numero_dossier?: string;
  medecin_nom?: string;
  type_visite?: string;
}

interface DoctorReportsViewProps {
  onBack?: () => void;
}

export const DoctorReportsView: React.FC<DoctorReportsViewProps> = ({ onBack }) => {
  const [filters, setFilters] = useState<SearchFilters>({
    q: '',
    patient_id: '',
    date_debut: '',
    date_fin: '',
    statut: '',
    nom_patient: '',
    numero_dossier: '',
  });
  const [reports, setReports] = useState<SearchReport[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.patient_id) params.set('patient_id', filters.patient_id);
      if (filters.nom_patient) params.set('nom_patient', filters.nom_patient);
      if (filters.numero_dossier) params.set('numero_dossier', filters.numero_dossier);
      if (filters.date_debut) params.set('date_debut', filters.date_debut);
      if (filters.date_fin) params.set('date_fin', filters.date_fin);
      if (filters.statut) params.set('statut', filters.statut);

      const res = await apiFetch(`/api/medical/reports/search?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || `Erreur HTTP ${res.status}`);
      }
      const data = await res.json();
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Impossible de récupérer les rapports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedConsultationId) {
      fetchReports();
    }
  }, [selectedConsultationId]);

  const handleSearch = () => {
    fetchReports();
  };

  const handleReset = () => {
    setFilters({
      q: '',
      patient_id: '',
      date_debut: '',
      date_fin: '',
      statut: '',
      nom_patient: '',
      numero_dossier: '',
    });
  };

  const handleOpenConsultation = (consultationId: string) => {
    setSelectedConsultationId(consultationId);
  };

  const handleBack = () => {
    setSelectedConsultationId(null);
  };

  if (selectedConsultationId) {
    return (
      <div className="pb-8">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux rapports</span>
        </button>
        <ConsultationWorkspaceView
          consultationId={selectedConsultationId}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* En-tête */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">Rapports Médicaux</h1>
            <p className="text-xs text-slate-500">Recherchez et consultez les dossiers et consultations</p>
          </div>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />
          Critères de recherche
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Recherche texte */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Recherche (diagnostic, motif, conduite)
            </label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: grippe, diabète, maux de tête..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            />
          </div>

          {/* Numéro de dossier */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              N° Dossier
            </label>
            <input
              type="text"
              value={filters.numero_dossier}
              onChange={(e) => setFilters(prev => ({ ...prev, numero_dossier: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: DOSS-1234"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            />
          </div>

          {/* Nom patient */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              Nom patient
            </label>
            <input
              type="text"
              value={filters.nom_patient}
              onChange={(e) => setFilters(prev => ({ ...prev, nom_patient: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: Dupont, Martin..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            />
          </div>

          {/* Patient ID (caché mais fonctionnel) */}
          <input
            type="hidden"
            value={filters.patient_id}
            onChange={(e) => setFilters(prev => ({ ...prev, patient_id: e.target.value }))}
          />

          {/* Date début */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Du
            </label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => setFilters(prev => ({ ...prev, date_debut: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            />
          </div>

          {/* Date fin */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Au
            </label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => setFilters(prev => ({ ...prev, date_fin: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            />
          </div>

          {/* Statut */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Stethoscope className="w-3 h-3" />
              Statut de la consultation
            </label>
            <select
              value={filters.statut}
              onChange={(e) => setFilters(prev => ({ ...prev, statut: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50"
            >
              <option value="">Tous les statuts</option>
              <option value="FINALISEE">Finalisée</option>
              <option value="EN_COURS">En cours</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="SUSPENDUE_EXAMENS">Suspendue examens</option>
            </select>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{loading ? 'Recherche...' : 'Rechercher'}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Résultats */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Erreur de recherche</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-2">
            {total > 0
              ? `${total} rapport${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`
              : 'Aucun rapport trouvé'}
          </div>
        </div>
      )}

      {loading && (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Recherche en cours...</p>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Aucun rapport trouvé</p>
          <p className="text-xs text-slate-400 mt-1">Modifiez vos critères et réessayez</p>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-slate-900">
                      {r.patient_nom} {r.patient_prenom}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.numero_dossier || '—'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        r.statut === 'FINALISEE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.statut === 'EN_COURS'
                          ? 'bg-blue-100 text-blue-800'
                          : r.statut === 'BROUILLON'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {r.statut.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {r.date_consultation
                        ? new Date(r.date_consultation).toLocaleDateString('fr-FR')
                        : '—'}
                    </span>
                    {r.medecin_nom && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Dr. {r.medecin_nom}
                      </span>
                    )}
                    {r.type_visite && (
                      <span className="text-slate-400">• {r.type_visite}</span>
                    )}
                  </div>
                  {r.diagnostic_principal && (
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                      <strong className="text-slate-700">Diagnostic :</strong> {r.diagnostic_principal}
                    </p>
                  )}
                  {r.motif_consultation && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      <strong className="text-slate-600">Motif :</strong> {r.motif_consultation}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenConsultation(r.id)}
                  disabled={r.statut !== 'FINALISEE'}
                  className="flex-shrink-0 flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
                  title="Consulter le rapport en lecture seule"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="sm:hidden">Voir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
