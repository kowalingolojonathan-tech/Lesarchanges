import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, CheckCircle, XCircle, Shield, AlertCircle, 
  RefreshCw, Edit3, Key, Phone, Mail, Briefcase, Search, Filter, 
  Lock, Check, Trash2, Sliders, ChevronRight, X
} from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { User, RoleDefinition, PermissionDefinition } from '../../types/index.js';

export const UserManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');

  // Données
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtres utilisateurs
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modale Création / Édition Utilisateur
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formPrenom, setFormPrenom] = useState('');
  const [formFonction, setFormFonction] = useState('');
  const [formTelephone, setFormTelephone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formActif, setFormActif] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);

  // Modale Rôle & Permissions
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleNom, setRoleNom] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleCategorie, setRoleCategorie] = useState('AUTRE');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleSelectedPerms, setRoleSelectedPerms] = useState<string[]>([]);
  const [submittingRole, setSubmittingRole] = useState(false);

  // Chargement des données
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/roles'),
        apiFetch('/api/permissions'),
      ]);

      if (!usersRes.ok) throw new Error('Erreur lors du chargement des utilisateurs.');
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }

      if (permsRes.ok) {
        const permsData = await permsRes.json();
        setAvailablePermissions(permsData.permissions || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Ouvrir modal création utilisateur
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setFormNom('');
    setFormPrenom('');
    setFormFonction('');
    setFormTelephone('');
    setFormEmail('');
    setFormUsername('');
    setFormPassword('');
    // Sélectionne le rôle Réception par défaut si disponible
    const defaultRole = roles.find(r => r.code === 'RECEPTION' || r.code === 'RÉCEPTION') || roles[0];
    setFormRoleId(defaultRole?.id || '');
    setFormActif(true);
    setShowUserModal(true);
  };

  // Ouvrir modal édition utilisateur
  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setFormNom(u.nom || '');
    setFormPrenom(u.prenom || u.post_nom || '');
    setFormFonction(u.fonction || '');
    setFormTelephone(u.telephone || '');
    setFormEmail(u.email || '');
    setFormUsername(u.username);
    setFormPassword(''); // Laissé vide sauf si on souhaite changer
    setFormRoleId(u.role_id || '');
    setFormActif(u.actif);
    setShowUserModal(true);
  };

  // Soumission utilisateur
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmittingUser(true);

    try {
      const payload: any = {
        nom: formNom.trim(),
        prenom: formPrenom.trim(),
        fonction: formFonction.trim(),
        telephone: formTelephone.trim(),
        email: formEmail.trim(),
        role_id: formRoleId,
        actif: formActif,
      };

      if (!editingUser) {
        // Création
        if (!formUsername.trim()) throw new Error("L'identifiant est obligatoire.");
        if (!formPassword || formPassword.length < 6) throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
        payload.username = formUsername.trim();
        payload.password = formPassword;

        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création.');
        setSuccess(`Utilisateur "${payload.username}" créé avec succès.`);
      } else {
        // Modification
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }
        const res = await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification.');
        setSuccess(`Utilisateur "${editingUser.username}" mis à jour.`);
      }

      setShowUserModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSubmittingUser(false);
    }
  };

  // Bascule actif / inactif
  const handleToggleStatus = async (user: User) => {
    try {
      const res = await apiFetch(`/api/users/${user.id}/toggle-active`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action impossible.');
      setSuccess(`Statut de "${user.username}" modifié avec succès.`);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Ouvrir modal rôle (Création ou Édition)
  const handleOpenRoleModal = (role?: RoleDefinition) => {
    if (role) {
      setEditingRole(role);
      setRoleNom(role.nom);
      setRoleCode(role.code);
      setRoleCategorie(role.categorie);
      setRoleDescription(role.description || '');
      setRoleSelectedPerms(role.permissions || []);
    } else {
      setEditingRole(null);
      setRoleNom('');
      setRoleCode('');
      setRoleCategorie('MÉDECIN');
      setRoleDescription('');
      setRoleSelectedPerms([]);
    }
    setShowRoleModal(true);
  };

  // Soumission rôle
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmittingRole(true);

    try {
      const payload = {
        nom: roleNom.trim(),
        code: roleCode.trim().toUpperCase(),
        categorie: roleCategorie,
        description: roleDescription.trim(),
        permissions: roleSelectedPerms,
      };

      if (!editingRole) {
        const res = await apiFetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur création rôle.');
        setSuccess(`Rôle "${payload.nom}" créé avec succès.`);
      } else {
        const res = await apiFetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur mise à jour rôle.');
        setSuccess(`Rôle "${payload.nom}" mis à jour.`);
      }

      setShowRoleModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du rôle.');
    } finally {
      setSubmittingRole(false);
    }
  };

  // Supprimer rôle personnalisé
  const handleDeleteRole = async (r: RoleDefinition) => {
    if (!window.confirm(`Confirmez-vous la suppression du rôle "${r.nom}" ?`)) return;
    try {
      const res = await apiFetch(`/api/roles/${r.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suppression impossible.');
      setSuccess(`Rôle "${r.nom}" supprimé.`);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle permission dans la modale
  const togglePermission = (code: string) => {
    setRoleSelectedPerms(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  // Sélectionner / désélectionner tout
  const selectAllPerms = () => {
    setRoleSelectedPerms(availablePermissions.map(p => p.code));
  };
  const unselectAllPerms = () => {
    setRoleSelectedPerms([]);
  };

  // Filtrage des utilisateurs
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      !userSearch.trim() ||
      u.nom_complet.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fonction && u.fonction.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.telephone && u.telephone.includes(userSearch)) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter || u.role_id === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Groupement des permissions disponibles par catégorie
  const groupedPermissions = availablePermissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, PermissionDefinition[]>);

  // Badge couleur rôle
  const getRoleBadgeClass = (cat?: string, code?: string) => {
    const key = cat || code || '';
    if (key.includes('ADMIN')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (key.includes('DIRECTEUR')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (key.includes('MED') || key.includes('MÉD')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (key.includes('RECEP') || key.includes('RÉCEP')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (key.includes('LAB')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center">
            <Users className="w-6 h-6 mr-2 text-purple-600" />
            Administration : Utilisateurs, Rôles & Autorisations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion centralisée des comptes praticiens, directeurs et caissiers avec contrôle strict des accès par permissions RBAC.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'USERS' ? (
            <button
              onClick={handleOpenCreateUser}
              className="flex items-center space-x-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer Utilisateur</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenRoleModal()}
              className="flex items-center space-x-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Créer Rôle Personnalisé</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Onglets de navigation */}
      <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center space-x-2 cursor-pointer ${
            activeTab === 'USERS'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Comptes Utilisateurs ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROLES')}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center space-x-2 cursor-pointer ${
            activeTab === 'ROLES'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Rôles & Autorisations Configurables ({roles.length})</span>
        </button>
      </div>

      {/* ONGLET 1 : COMPTES UTILISATEURS */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-xs overflow-hidden">
          {/* Barre de filtres et recherche */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher par nom, identifiant, téléphone, email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-semibold">Rôle :</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">Tous les rôles ({users.length})</option>
                {roles.map(r => (
                  <option key={r.id} value={r.code}>{r.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tableau des utilisateurs Desktop (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Identité & Prénom</th>
                  <th className="px-4 py-3">Poste / Fonction</th>
                  <th className="px-4 py-3">Coordonnées</th>
                  <th className="px-4 py-3">Rôle Assigné</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucun utilisateur trouvé pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleBadge = getRoleBadgeClass(u.role_categorie, u.role);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 text-xs">
                            {u.nom_complet || `${u.nom || ''} ${u.prenom || ''}`}
                          </div>
                          <div className="text-[11px] text-purple-700 font-mono">
                            @{u.username}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">
                            {u.fonction || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 space-y-0.5">
                          <div className="flex items-center text-slate-600 font-mono text-[11px]">
                            <Phone className="w-3 h-3 mr-1 text-slate-400" />
                            <span>{u.telephone || '—'}</span>
                          </div>
                          {u.email && (
                            <div className="flex items-center text-slate-500 text-[10px]">
                              <Mail className="w-3 h-3 mr-1 text-slate-400" />
                              <span className="truncate max-w-[160px]">{u.email}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${roleBadge}`}>
                            {u.role_nom || u.role}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          {u.actif ? (
                            <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactif
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-semibold text-xs inline-flex items-center space-x-1 transition-colors cursor-pointer"
                            title="Modifier l'utilisateur"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded font-semibold text-xs border transition-colors cursor-pointer ${
                              u.actif
                                ? 'border-red-200 text-red-700 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                          >
                            {u.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Présentation Cartes Mobile (md:hidden - Règle 5 & 11) */}
          <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Aucun utilisateur trouvé pour ces critères.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const roleBadge = getRoleBadgeClass(u.role_categorie, u.role);
                return (
                  <div key={u.id} className="pt-3 first:pt-0 space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {u.nom_complet || `${u.nom || ''} ${u.prenom || ''}`}
                        </div>
                        <div className="text-xs text-purple-700 font-mono">
                          @{u.username}
                        </div>
                        {u.fonction && (
                          <div className="text-xs text-slate-600 mt-0.5">
                            {u.fonction}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${roleBadge}`}>
                          {u.role_nom || u.role}
                        </span>
                        {u.actif ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            Inactif
                          </span>
                        )}
                      </div>
                    </div>

                    {(u.telephone || u.email) && (
                      <div className="text-xs text-slate-500 space-y-1 bg-white p-2 rounded-lg border border-slate-200/60">
                        {u.telephone && (
                          <div className="flex items-center font-mono">
                            <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                            <span>{u.telephone}</span>
                          </div>
                        )}
                        {u.email && (
                          <div className="flex items-center">
                            <Mail className="w-3 h-3 mr-1.5 text-slate-400" />
                            <span className="truncate">{u.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(u)}
                        className="flex-1 py-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1 min-h-[44px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`flex-1 py-2 rounded-lg font-semibold text-xs border min-h-[44px] flex items-center justify-center ${
                          u.actif
                            ? 'border-red-200 text-red-700 bg-red-50/50'
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50/50'
                        }`}
                      >
                        {u.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ONGLET 2 : RÔLES & PERMISSIONS CONFIGURABLES */}
      {activeTab === 'ROLES' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>Rôles & Fonctions Configurables</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contrôle précis des habilitations : factures, paiements, caisse, et cloisonnement des dossiers patients.
              </p>
            </div>
            <button
              onClick={() => handleOpenRoleModal()}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Shield className="w-4 h-4" />
              <span>Nouveau Rôle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((r) => {
              const badgeClass = getRoleBadgeClass(r.categorie, r.code);
              return (
                <div key={r.id} className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 transition-all bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${badgeClass}`}>
                          {r.nom}
                        </span>
                        {r.is_system && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                            Système
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1">Code : {r.code} • Catégorie : {r.categorie}</div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenRoleModal(r)}
                        className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                        title="Configurer les permissions"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                      {!r.is_system && (
                        <button
                          onClick={() => handleDeleteRole(r)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer ce rôle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {r.description || 'Aucune description spécifique.'}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    <div>
                      <strong>{r.permissions.length}</strong> permission(s) accordée(s)
                    </div>
                    <div>
                      <strong>{r.user_count || 0}</strong> utilisateur(s) rattaché(s)
                    </div>
                  </div>

                  {/* Badges d'accès clés */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {r.permissions.includes('patients:voir_tous') && (
                      <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                        Voir TOUS les patients
                      </span>
                    )}
                    {r.permissions.includes('patients:voir_attribues') && !r.permissions.includes('patients:voir_tous') && (
                      <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                        Patients attribués uniquement
                      </span>
                    )}
                    {r.permissions.includes('rapports_financiers:voir') && (
                      <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-1.5 py-0.5 rounded">
                        Rapports Financiers / Caisse
                      </span>
                    )}
                    {r.permissions.includes('factures:ajouter') && (
                      <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                        Facturation
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALE CRÉATION / MODIFICATION UTILISATEUR */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>{editingUser ? `Modifier l'utilisateur @${editingUser.username}` : 'Créer un nouvel utilisateur'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Banza"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prénom / Post-nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Éric"
                    value={formPrenom}
                    onChange={(e) => setFormPrenom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Poste / Fonction *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Médecin Généraliste, Caissière Principale, Biologiste..."
                  value={formFonction}
                  onChange={(e) => setFormFonction(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de téléphone *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: +243 81 000 0000"
                    value={formTelephone}
                    onChange={(e) => setFormTelephone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adresse Email</label>
                  <input
                    type="email"
                    placeholder="ex: agent@lesarchanges.cd"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Identifiant unique * {editingUser && '(Fixe)'}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    placeholder="ex: dr.kabeya"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe initial *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={editingUser ? 'Laisser vide pour conserver' : 'Au moins 6 caractères'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle & Permissions *</label>
                  <select
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.nom} ({r.categorie})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statut du compte *</label>
                  <select
                    value={formActif ? '1' : '0'}
                    onChange={(e) => setFormActif(e.target.value === '1')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                  >
                    <option value="1">Actif (Accès autorisé)</option>
                    <option value="0">Inactif (Compte suspendu)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submittingUser ? 'Enregistrement...' : editingUser ? 'Sauvegarder les modifications' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CRÉATION / CONFIGURATION DU RÔLE ET DE SES PERMISSIONS */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>{editingRole ? `Configurer le rôle : ${editingRole.nom}` : 'Nouveau Rôle Personnalisé'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom officiel du rôle *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Médecin Pédiatre de Garde"
                    value={roleNom}
                    onChange={(e) => setRoleNom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie fonctionnelle *</label>
                  <select
                    value={roleCategorie}
                    onChange={(e) => setRoleCategorie(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                  >
                    <option value="MÉDECIN">MÉDECIN</option>
                    <option value="DIRECTEUR">DIRECTEUR</option>
                    <option value="RÉCEPTION">RÉCEPTION</option>
                    <option value="LABORATOIRE">LABORATOIRE</option>
                    <option value="ADMINISTRATEUR">ADMINISTRATEUR</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code Système</label>
                  <input
                    type="text"
                    placeholder="ex: MEDECIN_PEDIATRE"
                    value={roleCode}
                    disabled={Boolean(editingRole && editingRole.is_system)}
                    onChange={(e) => setRoleCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase disabled:bg-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description des prérogatives</label>
                  <input
                    type="text"
                    placeholder="Description succincte de ce profil d'accès"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Matrice de permissions fines */}
              <div className="pt-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase text-slate-800">
                    Permissions et habilitations autorisées ({roleSelectedPerms.length} actives)
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={selectAllPerms}
                      className="text-[11px] text-purple-700 hover:underline font-semibold cursor-pointer"
                    >
                      Tout cocher
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={unselectAllPerms}
                      className="text-[11px] text-slate-500 hover:underline font-semibold cursor-pointer"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase text-purple-900 tracking-wide">
                        {category}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((p) => {
                          const isChecked = roleSelectedPerms.includes(p.code);
                          return (
                            <label
                              key={p.code}
                              onClick={() => togglePermission(p.code)}
                              className={`flex items-start space-x-2 p-2 rounded border text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'bg-purple-50/80 border-purple-300 text-purple-950 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Géré par onClick parent
                                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="text-[11px] leading-tight">{p.label}</div>
                                <div className="text-[9px] font-mono text-slate-400 mt-0.5">{p.code}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingRole}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submittingRole ? 'Enregistrement...' : editingRole ? 'Enregistrer les autorisations' : 'Créer le rôle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
