import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, Plus, Trash2, 
  RefreshCw, Search, Phone, User, Stethoscope, UserCheck, ShieldCheck, 
  X, AlertTriangle, Edit3, Send, MessageSquare, PhoneCall, Check, Filter,
  ArrowRight, CreditCard, UserPlus
} from 'lucide-react';
import { RendezVous, RendezVousStatut, RappelStatut, Patient } from '../../types';
import { apiFetch } from '../../lib/api';

interface DoctorOption {
  id: string;
  nom_complet: string;
}

interface ReceptionAppointmentsModalProps {
  onClose: () => void;
  onStartPatientArrival?: (appointment: any) => void;
}

export const ReceptionAppointmentsModal: React.FC<ReceptionAppointmentsModalProps> = ({ onClose, onStartPatientArrival }) => {
  const [appointments, setAppointments] = useState<RendezVous[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtres
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedStatut, setSelectedStatut] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mode création
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isPhoneRequest, setIsPhoneRequest] = useState<boolean>(false);
  const [patientMode, setPatientMode] = useState<'EXISTANT' | 'TEMPORAIRE'>('EXISTANT');
  const [tempNom, setTempNom] = useState<string>('');
  const [tempPrenom, setTempPrenom] = useState<string>('');
  const [tempTelephone, setTempTelephone] = useState<string>('+243');
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formDoctorId, setFormDoctorId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formHeure, setFormHeure] = useState<string>('09:00');
  const [formMotif, setFormMotif] = useState<string>('Consultation générale');
  const [formNotes, setFormNotes] = useState<string>('');

  // Paiement anticipé
  const [payerAvance, setPayerAvance] = useState<boolean>(false);
  const [avanceMontant, setAvanceMontant] = useState<string>('20');
  const [avanceDevise, setAvanceDevise] = useState<'USD' | 'FC'>('USD');
  const [avanceMode, setAvanceMode] = useState<string>('ESPECES');
  const [avanceRef, setAvanceRef] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number>(2850);

  // Mode gestion du rappel
  const [selectedRdvForReminder, setSelectedRdvForReminder] = useState<RendezVous | null>(null);
  const [reminderStatus, setReminderStatus] = useState<RappelStatut>('ENVOYE');
  const [reminderNotes, setReminderNotes] = useState<string>('');

  // Mode modification / replanification
  const [selectedRdvForEdit, setSelectedRdvForEdit] = useState<RendezVous | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editHeure, setEditHeure] = useState<string>('09:00');
  const [editDoctorId, setEditDoctorId] = useState<string>('');
  const [editMotif, setEditMotif] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatut, setEditStatut] = useState<RendezVousStatut>('PLANIFIÉ');

  // Charger les médecins
  const loadDoctors = async () => {
    try {
      const res = await apiFetch('/api/doctors');
      if (res.ok) {
        const data = await res.json();
        const docs = data.doctors || [];
        setDoctors(docs);
        if (docs.length > 0 && !formDoctorId) {
          setFormDoctorId(docs[0].id);
        }
      }
    } catch (err) {
      console.error('Erreur chargement médecins:', err);
    }
  };

  useEffect(() => {
    if (doctors.length > 0 && !formDoctorId) {
      setFormDoctorId(doctors[0].id);
    }
  }, [doctors]);

  // Ouverture modale création sécurisée
  const handleOpenCreateModal = (isPhone: boolean = false) => {
    setIsPhoneRequest(isPhone);
    setPatientMode('EXISTANT');
    setTempNom('');
    setTempPrenom('');
    setTempTelephone('+243');
    setPayerAvance(false);
    setAvanceMontant('20');
    setAvanceDevise('USD');
    setAvanceMode('ESPECES');
    setAvanceRef('');
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientSearchResults([]);
    setFormDate(new Date().toLocaleDateString('en-CA'));
    setFormHeure('09:00');
    setFormMotif(isPhone ? 'Consultation (Demande téléphonique)' : 'Consultation générale');
    setFormNotes('');
    if (doctors.length > 0) {
      setFormDoctorId(doctors[0].id);
    }
    setError(null);
    setShowCreateModal(true);
  };

  // Charger les rendez-vous
  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/rendez-vous?tous=true';
      if (selectedDoctorId !== 'ALL') {
        url += `&medecin_id=${selectedDoctorId}`;
      }
      if (selectedStatut !== 'ALL') {
        url += `&statut=${selectedStatut}`;
      }
      if (dateFilter) {
        url += `&date=${dateFilter}`;
      }

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors du chargement des rendez-vous');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur chargement rendez-vous');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [selectedDoctorId, selectedStatut, dateFilter]);

  // Recherche patient dynamique pour le formulaire
  useEffect(() => {
    const searchPatients = async () => {
      if (patientSearch.trim().length < 2) {
        setPatientSearchResults([]);
        return;
      }
      try {
        const res = await apiFetch(`/api/patients/search?q=${encodeURIComponent(patientSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPatientSearchResults(data.patients || []);
        }
      } catch (err) {
        console.error('Erreur recherche patient:', err);
      }
    };

    const timer = setTimeout(searchPatients, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const isFormValid = () => {
    if (!formDoctorId || !formDate || !formHeure) return false;
    if (patientMode === 'EXISTANT') {
      return !!selectedPatient;
    } else {
      return tempNom.trim().length > 0;
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    let patientIdToSend: string | undefined = undefined;
    let tempNomToSend: string | undefined = undefined;
    let tempPrenomToSend: string | undefined = undefined;
    let tempTelToSend: string | undefined = undefined;

    if (patientMode === 'EXISTANT') {
      const patientToUse = selectedPatient || (patientSearchResults.length === 1 ? patientSearchResults[0] : null);
      if (!patientToUse) {
        setError('Veuillez rechercher et sélectionner un patient avec dossier.');
        return;
      }
      patientIdToSend = patientToUse.id;
    } else {
      if (!tempNom.trim()) {
        setError('Le nom de famille du client sans dossier est obligatoire.');
        return;
      }
      tempNomToSend = tempNom.trim().toUpperCase();
      tempPrenomToSend = tempPrenom.trim() || undefined;
      tempTelToSend = tempTelephone.trim() || undefined;
    }

    const doctorToUse = formDoctorId || (doctors.length > 0 ? doctors[0].id : '');
    if (!doctorToUse) {
      setError('Veuillez sélectionner un médecin traitant assigné.');
      return;
    }
    if (!formDate) {
      setError('Veuillez renseigner la date du rendez-vous.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: any = {
        patient_id: patientIdToSend,
        patient_nom: tempNomToSend,
        patient_prenom: tempPrenomToSend,
        patient_telephone: tempTelToSend,
        medecin_id: doctorToUse,
        date_rdv: formDate.trim().split('T')[0],
        heure_rdv: formHeure || '09:00',
        motif: formMotif.trim() || (isPhoneRequest ? 'Consultation (Demande téléphonique)' : 'Consultation générale'),
        type_rdv: 'CONSULTATION',
        source_demande: isPhoneRequest ? 'TELEPHONE' : 'ACCUEIL',
        statut: 'PLANIFIÉ',
        notes: formNotes.trim() ? (isPhoneRequest ? `[Demande téléphonique] ${formNotes.trim()}` : formNotes.trim()) : (isPhoneRequest ? '[Demande téléphonique]' : null)
      };

      if (payerAvance && parseFloat(avanceMontant) > 0) {
        payload.facturer_avance = true;
        payload.paiement_immediat = {
          montant_paye: parseFloat(avanceMontant),
          devise: avanceDevise,
          mode_paiement: avanceMode,
          reference_transaction: avanceRef.trim() || undefined
        };
      }

      const res = await apiFetch('/api/rendez-vous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la création du rendez-vous');
      }

      const clientLabel = patientIdToSend 
        ? `${selectedPatient?.nom} ${selectedPatient?.prenom}`
        : `${tempNomToSend} ${tempPrenomToSend || ''} (Client sans dossier)`;

      setSuccessMessage(`Rendez-vous planifié avec succès pour ${clientLabel}${payerAvance ? ' avec pré-règlement validé' : ''}.`);
      setShowCreateModal(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setPatientSearchResults([]);
      setTempNom('');
      setTempPrenom('');
      setTempTelephone('+243');
      setPayerAvance(false);
      setFormNotes('');
      await loadAppointments();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  // Mise à jour du statut (PLANIFIÉ -> CONFIRMÉ -> PATIENT PRÉSENT -> HONORÉ / ABSENT / ANNULÉ)
  const handleUpdateStatus = async (id: string, newStatut: RendezVousStatut) => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/rendez-vous/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la mise à jour du statut');
      }

      setSuccessMessage(`Statut du rendez-vous mis à jour : ${newStatut}.`);
      await loadAppointments();
    } catch (err: any) {
      setError(err.message || 'Erreur mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Enregistrer rappel patient
  const handleSaveReminder = async () => {
    if (!selectedRdvForReminder) return;
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/rendez-vous/${selectedRdvForReminder.id}/rappel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rappel_statut: reminderStatus,
          notes: reminderNotes.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la mise à jour du rappel');
      }

      setSuccessMessage("Suivi du rappel patient enregistré.");
      setSelectedRdvForReminder(null);
      await loadAppointments();
    } catch (err: any) {
      setError(err.message || 'Erreur rappel');
    } finally {
      setSaving(false);
    }
  };

  // Ouverture modale modification / replanification
  const handleOpenEdit = (rdv: RendezVous) => {
    setSelectedRdvForEdit(rdv);
    setEditDate(rdv.date_rdv);
    setEditHeure(rdv.heure_rdv || '09:00');
    setEditDoctorId(rdv.medecin_id || (doctors[0]?.id || ''));
    setEditMotif(rdv.motif || '');
    setEditNotes(rdv.notes || '');
    setEditStatut(rdv.statut);
  };

  // Enregistrer modification / replanification
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRdvForEdit) return;
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/api/rendez-vous/${selectedRdvForEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_rdv: editDate,
          heure_rdv: editHeure,
          medecin_id: editDoctorId,
          motif: editMotif.trim(),
          notes: editNotes.trim() || null,
          statut: editStatut
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la modification du rendez-vous');
      }

      setSuccessMessage("Rendez-vous mis à jour / replanifié avec succès.");
      setSelectedRdvForEdit(null);
      await loadAppointments();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Mode section
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'AUJOURDHUI' | 'RAPPLES' | 'EN_ATTENTE'>('ALL');

  // Filtrage local
  const filteredAppointments = appointments.filter(rdv => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nom = (rdv.patient_nom || '').toLowerCase();
    const prenom = (rdv.patient_prenom || '').toLowerCase();
    const dossier = (rdv.numero_dossier || '').toLowerCase();
    const tel = (rdv.patient_telephone || '').toLowerCase();
    const medecin = (rdv.medecin_nom || '').toLowerCase();
    const motifText = (rdv.motif || '').toLowerCase();
    return nom.includes(q) || prenom.includes(q) || dossier.includes(q) || tel.includes(q) || medecin.includes(q) || motifText.includes(q);
  });

  // Sections avec compteurs
  const today = new Date().toISOString().split('T')[0];
  const todayCount = filteredAppointments.filter(r => r.date_rdv === today && r.statut !== 'ANNULÉ').length;
  const reminderCount = filteredAppointments.filter(r =>
    r.date_rdv === today && r.statut !== 'ANNULÉ' && r.rappel_statut !== 'CONFIRME_PAR_PATIENT'
  ).length;
  const pendingCount = filteredAppointments.filter(r =>
    r.statut !== 'ANNULÉ' && r.statut !== 'HONORÉ' && r.statut !== 'PATIENT PRÉSENT'
  ).length;

  const sectionFilteredAppointments = (() => {
    switch (sectionFilter) {
      case 'AUJOURDHUI':
        return filteredAppointments.filter(r => r.date_rdv === today && r.statut !== 'ANNULÉ');
      case 'RAPPLES':
        return filteredAppointments.filter(r =>
          r.date_rdv === today && r.statut !== 'ANNULÉ' && r.rappel_statut !== 'CONFIRME_PAR_PATIENT'
        );
      case 'EN_ATTENTE':
        return filteredAppointments.filter(r =>
          r.statut !== 'ANNULÉ' && r.statut !== 'HONORÉ' && r.statut !== 'PATIENT PRÉSENT'
        );
      default:
        return filteredAppointments;
    }
  })();

  const getStatusBadge = (statut: RendezVousStatut) => {
    switch (statut) {
      case 'PLANIFIÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <Clock className="w-3 h-3 mr-1" />
            Planifié
          </span>
        );
      case 'CONFIRMÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmé
          </span>
        );
      case 'PATIENT PRÉSENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <UserCheck className="w-3 h-3 mr-1" />
            Patient présent
          </span>
        );
      case 'HONORÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Honoré
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            Absent
          </span>
        );
      case 'ANNULÉ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <X className="w-3 h-3 mr-1" />
            Annulé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {statut}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="p-2 bg-blue-800/80 rounded-lg shrink-0">
              <Calendar className="w-5 h-5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base flex items-center flex-wrap gap-1">
                Planning Général & Gestion des Rendez-vous
                <span className="ml-1 text-[10px] uppercase font-bold tracking-wider bg-blue-600/70 text-blue-100 px-2 py-0.5 rounded-full">
                  Calendrier Partagé
                </span>
              </h3>
              <p className="text-[11px] text-blue-200 hidden sm:block">
                Guichet d'accueil, demandes téléphoniques & rendez-vous de contrôle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenCreateModal(true)}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center shadow-xs"
              title="Créer un rendez-vous suite à un appel téléphonique du patient"
            >
              <PhoneCall className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">RDV par Téléphone</span>
              <span className="sm:hidden">📞</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal(false)}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Nouveau RDV</span>
              <span className="sm:hidden">+ RDV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/50 rounded-lg transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 text-rose-600 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre Médecin */}
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-slate-700">Médecin :</span>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous les médecins autorisés</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.nom_complet}</option>
                ))}
              </select>
            </div>

            {/* Filtre Date */}
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-slate-700">Date :</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-slate-400 hover:text-slate-600 text-[11px] underline"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Filtre Statut */}
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-slate-700">Statut :</span>
              <select
                value={selectedStatut}
                onChange={(e) => setSelectedStatut(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PLANIFIÉ">PLANIFIÉ</option>
                <option value="CONFIRMÉ">CONFIRMÉ</option>
                <option value="PATIENT PRÉSENT">PATIENT PRÉSENT</option>
                <option value="HONORÉ">HONORÉ</option>
                <option value="ABSENT">ABSENT</option>
                <option value="ANNULÉ">ANNULÉ</option>
              </select>
            </div>
          </div>

          {/* Recherche */}
          <div className="flex items-center space-x-2 w-full sm:w-64">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher patient, tél, Dr..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={loadAppointments}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sections avec compteurs */}
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSectionFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              sectionFilter === 'ALL'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Tous</span>
            {filteredAppointments.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                sectionFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {filteredAppointments.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSectionFilter('AUJOURDHUI')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              sectionFilter === 'AUJOURDHUI'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Aujourd'hui</span>
            {todayCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                sectionFilter === 'AUJOURDHUI' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {todayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSectionFilter('RAPPLES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              sectionFilter === 'RAPPLES'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Rappels J-1/J-2/J-3</span>
            {reminderCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                sectionFilter === 'RAPPLES' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
              }`}>
                {reminderCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSectionFilter('EN_ATTENTE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              sectionFilter === 'EN_ATTENTE'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En attente / Non honorés</span>
            {pendingCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                sectionFilter === 'EN_ATTENTE' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Tableau des rendez-vous */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && appointments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Chargement du planning des rendez-vous...</p>
            </div>
          ) : sectionFilteredAppointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Aucun rendez-vous trouvé</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Utilisez "Nouveau RDV" ou "RDV par Téléphone" pour planifier un rendez-vous pour un patient.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl bg-white overflow-x-auto max-w-full w-full">
              <table className="w-full text-left text-[9px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Date & Heure</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Patient & Contact</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Praticien</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Motif & Source</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Statut</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">Rappels</th>
                    <th className="py-2 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sectionFilteredAppointments.map((rdv) => (
                    <tr key={rdv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Heure */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">
                          {new Date(rdv.date_rdv).toLocaleDateString('fr-FR', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </span>
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                          {rdv.heure_rdv || '09:00'}
                        </span>
                      </td>

                      {/* Patient */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">
                          {rdv.patient_nom} {rdv.patient_prenom}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className={`font-mono px-1.5 py-0.2 rounded border ${
                            rdv.numero_dossier === 'SANS DOSSIER'
                              ? 'text-amber-800 bg-amber-50 border-amber-300 font-bold'
                              : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          }`}>
                            {rdv.numero_dossier === 'SANS DOSSIER' ? 'CLIENT SANS DOSSIER' : rdv.numero_dossier}
                          </span>
                          {rdv.statut_paiement === 'PAYÉ' && (
                            <span className="font-bold text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                              💰 Payé par anticipation
                            </span>
                          )}
                          {rdv.patient_telephone && (
                            <span className="flex items-center text-slate-600">
                              <Phone className="w-3 h-3 mr-1 text-slate-400" />
                              {rdv.patient_telephone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Praticien */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                          <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                          <span>Dr. {rdv.medecin_nom || 'Médecin'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-mono">{rdv.numero_rdv}</span>
                      </td>

                      {/* Motif & Source */}
                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="text-slate-800 font-medium line-clamp-1">{rdv.motif}</div>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          {rdv.source_demande === 'TELEPHONE' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <PhoneCall className="w-2.5 h-2.5 mr-1" />
                              Par téléphone
                            </span>
                          ) : rdv.source_demande === 'CONSULTATION_SUIVI' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Stethoscope className="w-2.5 h-2.5 mr-1" />
                              Suivi consultation
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              Accueil guichet
                            </span>
                          )}
                          {rdv.notes && (
                            <span className="text-[10px] text-slate-500 italic truncate max-w-[120px]" title={rdv.notes}>
                              "{rdv.notes}"
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {getStatusBadge(rdv.statut)}
                      </td>

                      {/* Rappel */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRdvForReminder(rdv);
                            setReminderStatus(rdv.rappel_statut || 'ENVOYE');
                            setReminderNotes(rdv.notes || '');
                          }}
                          className={`text-[11px] font-medium px-2 py-1 rounded-md border flex items-center space-x-1 transition-colors ${
                            rdv.rappel_statut === 'CONFIRME_PAR_PATIENT' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : rdv.rappel_statut === 'ENVOYE'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          <span>
                            {rdv.rappel_statut === 'CONFIRME_PAR_PATIENT' ? 'Patient confirmé' :
                             rdv.rappel_statut === 'ENVOYE' ? 'Rappel effectué' :
                             rdv.rappel_statut === 'SANS_REPONSE' ? 'Sans réponse' : 'Gérer rappel'}
                          </span>
                        </button>
                      </td>

                      {/* Actions rapides de statut */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Arrivée au guichet : Créer dossier permanent ou démarrer visite directe */}
                          {onStartPatientArrival && rdv.statut !== 'ANNULÉ' && rdv.statut !== 'HONORÉ' && (
                            <button
                              type="button"
                              onClick={() => onStartPatientArrival(rdv)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center space-x-1 shadow-xs"
                              title={rdv.numero_dossier === 'SANS DOSSIER' 
                                ? "Arrivée du client au guichet : Créer son dossier permanent et enchaîner visite & encaissement" 
                                : "Arrivée du patient : Enregistrer l'arrivée et enchaîner visite & encaissement"}
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>{rdv.numero_dossier === 'SANS DOSSIER' ? 'Créer dossier' : 'Démarrer Visite'}</span>
                            </button>
                          )}

                          {rdv.statut === 'PLANIFIÉ' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(rdv.id, 'CONFIRMÉ')}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold"
                                title="Marquer comme confirmé"
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(rdv.id, 'PATIENT PRÉSENT')}
                                className="px-1.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 rounded text-[11px] font-semibold"
                                title="Le patient est déjà au guichet"
                              >
                                Présent
                              </button>
                            </>
                          )}

                          {rdv.statut === 'CONFIRMÉ' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rdv.id, 'PATIENT PRÉSENT')}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold"
                              title="Le patient est arrivé au guichet"
                            >
                              Arrivé au guichet
                            </button>
                          )}

                          {rdv.statut === 'PATIENT PRÉSENT' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rdv.id, 'HONORÉ')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                              title="Consultation terminée, RDV honoré"
                            >
                              Marquer Honoré
                            </button>
                          )}

                          {rdv.statut !== 'ANNULÉ' && rdv.statut !== 'HONORÉ' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rdv.id, 'ABSENT')}
                              className="px-1.5 py-1 text-orange-600 hover:bg-orange-50 rounded text-[11px]"
                              title="Patient absent"
                            >
                              Absent
                            </button>
                          )}

                          {/* Bouton Modifier / Replanifier */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rdv)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded text-[11px] transition-colors"
                            title="Modifier / Replanifier date, heure ou praticien"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {rdv.statut !== 'ANNULÉ' && rdv.statut !== 'HONORÉ' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(rdv.id, 'ANNULÉ')}
                              className="px-1.5 py-1 text-rose-600 hover:bg-rose-50 rounded text-[11px]"
                              title="Annuler le rendez-vous"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Total rendez-vous affichés : <strong>{filteredAppointments.length}</strong></span>
          <span>Calendrier partagé en temps réel avec le corps médical (Clinique Les Archanges)</span>
        </div>
      </div>

      {/* MODALE PRISE DE RENDEZ-VOUS (ACCUEIL & TÉLÉPHONE) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden" id="modal_create_rdv_overlay">
          <div className="relative bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200" id="modal_create_rdv_container">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-lg ${isPhoneRequest ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isPhoneRequest ? <PhoneCall className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {isPhoneRequest ? 'Prise de Rendez-vous par Téléphone 📞' : 'Planification d’un Rendez-vous'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isPhoneRequest ? 'Enregistrement direct d’un appel patient' : 'Fixation de date au guichet'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_create_rdv">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Type de demande */}
              <div className="flex items-center space-x-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">Source :</span>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isPhoneRequest}
                    onChange={() => setIsPhoneRequest(false)}
                    className="text-blue-600"
                  />
                  <span>Présentiel guichet</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={isPhoneRequest}
                    onChange={() => setIsPhoneRequest(true)}
                    className="text-amber-600"
                  />
                  <span className="font-semibold text-amber-800">Appel téléphonique 📞</span>
                </label>
              </div>

              {/* Type de patient : Existant avec dossier VS Nouveau client sans dossier */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                  Type de patient pour ce rendez-vous :
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setPatientMode('EXISTANT')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      patientMode === 'EXISTANT'
                        ? 'bg-blue-50 text-blue-900 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Patient avec dossier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientMode('TEMPORAIRE')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      patientMode === 'TEMPORAIRE'
                        ? 'bg-amber-50 text-amber-900 border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Nouveau client sans dossier</span>
                  </button>
                </div>

                {patientMode === 'EXISTANT' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Rechercher le patient * (Nom, prénom, N° dossier ou tél)
                    </label>
                    {selectedPatient ? (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div>
                          <strong className="text-emerald-900 block">{selectedPatient.nom} {selectedPatient.prenom}</strong>
                          <span className="text-[11px] text-emerald-700 font-mono">Dossier : {selectedPatient.numero_dossier} • Tél : {selectedPatient.telephone || 'Non renseigné'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(null)}
                          className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (patientSearchResults.length > 0) {
                                setSelectedPatient(patientSearchResults[0]);
                                setPatientSearchResults([]);
                              }
                            }
                          }}
                          placeholder="Tapez au moins 2 lettres pour chercher (ex: Mukendi)..."
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                        {patientSearchResults.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {patientSearchResults.map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedPatient(p);
                                  setPatientSearchResults([]);
                                }}
                                className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between group transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-slate-900 group-hover:text-blue-700">{p.nom} {p.prenom}</span>
                                  <span className="text-[11px] text-slate-500 ml-2 font-mono">[{p.numero_dossier}]</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[11px] text-slate-500">{p.telephone || ''}</span>
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedPatient(p);
                                      setPatientSearchResults([]);
                                    }}
                                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer"
                                  >
                                    Choisir
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                    <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                      <User className="w-3.5 h-3.5 text-amber-700" />
                      <span>Coordonnées du client sans dossier (Temporaire)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Nom de famille *</label>
                        <input
                          type="text"
                          required
                          value={tempNom}
                          onChange={(e) => setTempNom(e.target.value)}
                          placeholder="Ex: MUKENDI"
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Prénom</label>
                        <input
                          type="text"
                          value={tempPrenom}
                          onChange={(e) => setTempPrenom(e.target.value)}
                          placeholder="Ex: Jean-Paul"
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Téléphone mobile (pour confirmation/rappel)</label>
                      <input
                        type="text"
                        value={tempTelephone}
                        onChange={(e) => setTempTelephone(e.target.value)}
                        placeholder="+243..."
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                      />
                    </div>
                    <div className="text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg leading-relaxed">
                      💡 <strong>Nouveau client :</strong> Son dossier permanent sera automatiquement créé dès son arrivée au guichet, et rattaché au rendez-vous sans rupture.
                    </div>
                  </div>
                )}
              </div>

              {/* Sélection du médecin */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Médecin traitant assigné *
                </label>
                <select
                  value={formDoctorId}
                  onChange={(e) => setFormDoctorId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                >
                  {doctors.length === 0 ? (
                    <option value="">Chargement des médecins...</option>
                  ) : (
                    doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.nom_complet}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Date & Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date du rendez-vous *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    min={new Date().toLocaleDateString('en-CA')}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Heure estimée *
                  </label>
                  <input
                    type="time"
                    value={formHeure}
                    onChange={(e) => setFormHeure(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Motif */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motif de venue
                </label>
                <input
                  type="text"
                  value={formMotif}
                  onChange={(e) => setFormMotif(e.target.value)}
                  placeholder="Ex: Consultation générale, Suivi de tension, etc."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* SECTION PAIEMENT ANTICIPÉ DE LA CONSULTATION */}
              <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-3.5 space-y-2.5">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={payerAvance}
                    onChange={(e) => setPayerAvance(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Enregistrer un paiement anticipé (Pré-règlement consultation)</span>
                  </span>
                </label>

                {payerAvance && (
                  <div className="pt-2 border-t border-emerald-200 space-y-2.5">
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Le patient règle sa consultation à l'avance et n'aura plus rien à payer le jour de son rendez-vous.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Devise perçue :</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAvanceDevise('USD');
                              setAvanceMontant('20');
                            }}
                            className={`py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                              avanceDevise === 'USD'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            USD ($)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAvanceDevise('FC');
                              setAvanceMontant(String(Math.round(20 * exchangeRate)));
                            }}
                            className={`py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                              avanceDevise === 'FC'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            FC (Franc)
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Mode de paiement :</label>
                        <select
                          value={avanceMode}
                          onChange={(e) => setAvanceMode(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="ESPECES">Espèces (Cash)</option>
                          <option value="MOBILE_MONEY">Mobile Money (M-Pesa/Airtel/Orange)</option>
                          <option value="CARTE_BANCAIRE">Carte Bancaire / TPE</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Montant perçu ({avanceDevise}) :</label>
                        <input
                          type="number"
                          value={avanceMontant}
                          onChange={(e) => setAvanceMontant(e.target.value)}
                          className="w-full p-1.5 bg-white border border-emerald-400 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Référence reçu / transaction :</label>
                        <input
                          type="text"
                          value={avanceRef}
                          placeholder="Ex: MPESA-91823"
                          onChange={(e) => setAvanceRef(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes ou observations (ex: rappel à faire la veille)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Patient prévenu par téléphone d'apporter son carnet de santé..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              </div>

              {/* Actions fixées en bas */}
              <div className="shrink-0 bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !isFormValid()}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50 min-h-[40px] cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Confirmer le Rendez-vous'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE GESTION DU RAPPEL PATIENT */}
      {selectedRdvForReminder && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900 text-sm flex items-center">
                <PhoneCall className="w-4 h-4 mr-2 text-blue-700" />
                Suivi du Rappel Patient
              </span>
              <button
                type="button"
                onClick={() => setSelectedRdvForReminder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div>Patient : <strong>{selectedRdvForReminder.patient_nom} {selectedRdvForReminder.patient_prenom}</strong></div>
                <div>Téléphone : <a href={`tel:${selectedRdvForReminder.patient_telephone}`} className="text-blue-700 font-bold underline">{selectedRdvForReminder.patient_telephone || 'Aucun'}</a></div>
                <div>Rendez-vous : <strong>{selectedRdvForReminder.date_rdv} à {selectedRdvForReminder.heure_rdv}</strong> (Dr. {selectedRdvForReminder.medecin_nom})</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Résultat du contact / rappel :
                </label>
                <select
                  value={reminderStatus}
                  onChange={(e) => setReminderStatus(e.target.value as RappelStatut)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ENVOYE">Appel / SMS effectué</option>
                  <option value="CONFIRME_PAR_PATIENT">Confirmé de vive voix par le patient</option>
                  <option value="SANS_REPONSE">Appel sans réponse / Messagerie</option>
                  <option value="NON_ENVOYE">Non encore contacté</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remarques :
                </label>
                <textarea
                  rows={2}
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  placeholder="Ex: Patient a confirmé sa venue à 09h00 précises..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedRdvForReminder(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveReminder}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer le rappel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE MODIFICATION / REPLANIFICATION */}
      {selectedRdvForEdit && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden" id="modal_edit_rdv_overlay">
          <div className="relative bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200" id="modal_edit_rdv_container">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Modifier / Replanifier le Rendez-vous
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Patient : <strong>{selectedRdvForEdit.patient_nom} {selectedRdvForEdit.patient_prenom}</strong> ({selectedRdvForEdit.numero_dossier})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRdvForEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col min-h-0 overflow-hidden" id="form_edit_rdv">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
                {/* Médecin assigné */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Médecin assigné *
                  </label>
                  <select
                    value={editDoctorId}
                    onChange={(e) => setEditDoctorId(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.nom_complet}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Heure */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Date du RDV *
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Heure du RDV *
                    </label>
                    <input
                      type="time"
                      value={editHeure}
                      onChange={(e) => setEditHeure(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Statut */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Statut du rendez-vous :
                  </label>
                  <select
                    value={editStatut}
                    onChange={(e) => setEditStatut(e.target.value as RendezVousStatut)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="PLANIFIÉ">PLANIFIÉ</option>
                    <option value="CONFIRMÉ">CONFIRMÉ</option>
                    <option value="PATIENT PRÉSENT">PATIENT PRÉSENT</option>
                    <option value="HONORÉ">HONORÉ</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="ANNULÉ">ANNULÉ</option>
                  </select>
                </div>

                {/* Motif */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motif de la venue
                  </label>
                  <input
                    type="text"
                    value={editMotif}
                    onChange={(e) => setEditMotif(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Remarques / Observations
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes complémentaires..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Actions fixées en bas */}
              <div className="shrink-0 bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRdvForEdit(null)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50 min-h-[40px] cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
