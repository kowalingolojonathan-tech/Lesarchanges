import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

export const AVAILABLE_PERMISSIONS = [
  // Factures
  { code: 'factures:voir', label: 'Voir les factures', category: 'Facturation' },
  { code: 'factures:ajouter', label: 'Créer des factures', category: 'Facturation' },
  { code: 'factures:modifier', label: 'Modifier les factures', category: 'Facturation' },
  { code: 'factures:supprimer', label: 'Supprimer les factures', category: 'Facturation' },
  { code: 'factures:imprimer', label: 'Imprimer les factures', category: 'Facturation' },

  // Paiements
  { code: 'paiements:voir', label: 'Voir les paiements', category: 'Paiements & Caisse' },
  { code: 'paiements:ajouter', label: 'Encaisser des règlements', category: 'Paiements & Caisse' },
  { code: 'paiements:modifier', label: 'Modifier des règlements', category: 'Paiements & Caisse' },
  { code: 'paiements:annuler', label: 'Annuler des règlements', category: 'Paiements & Caisse' },
  { code: 'paiements:imprimer', label: 'Imprimer les reçus de paiement', category: 'Paiements & Caisse' },

  // Rapports financiers / caisse
  { code: 'rapports_financiers:voir', label: 'Voir les rapports financiers et de caisse', category: 'Rapports & Caisse' },
  { code: 'rapports_financiers:ajouter', label: 'Générer des états de caisse et financiers', category: 'Rapports & Caisse' },
  { code: 'rapports_financiers:modifier', label: 'Modifier les états financiers', category: 'Rapports & Caisse' },
  { code: 'rapports_financiers:supprimer', label: 'Supprimer les états financiers', category: 'Rapports & Caisse' },
  { code: 'rapports_financiers:imprimer', label: 'Imprimer les états de caisse et rapports financiers', category: 'Rapports & Caisse' },

  // Dossiers patients
  { code: 'patients:voir', label: 'Consulter les dossiers patients', category: 'Dossiers Patients' },
  { code: 'patients:ajouter', label: 'Créer de nouveaux patients', category: 'Dossiers Patients' },
  { code: 'patients:modifier', label: 'Modifier les informations patients', category: 'Dossiers Patients' },
  { code: 'patients:supprimer', label: 'Désactiver des dossiers patients', category: 'Dossiers Patients' },
  { code: 'patients:voir_tous', label: 'Voir TOUS les dossiers patients (Directeur / Superviseur)', category: 'Dossiers Patients' },
  { code: 'patients:voir_attribues', label: 'Voir UNIQUEMENT les patients attribués (Médecin par défaut)', category: 'Dossiers Patients' },

  // Prescriptions
  { code: 'prescriptions:voir', label: 'Consulter les prescriptions', category: 'Prescriptions Médicales' },
  { code: 'prescriptions:ajouter', label: 'Créer des prescriptions', category: 'Prescriptions Médicales' },
  { code: 'prescriptions:modifier', label: 'Modifier des prescriptions', category: 'Prescriptions Médicales' },
  { code: 'prescriptions:valider', label: 'Valider des prescriptions', category: 'Prescriptions Médicales' },
  { code: 'prescriptions:imprimer', label: 'Imprimer les ordonnances médicales', category: 'Prescriptions Médicales' },

  // Laboratoire
  { code: 'laboratoire:voir', label: 'Consulter les demandes d\'analyses', category: 'Laboratoire' },
  { code: 'laboratoire:demander', label: 'Prescrire des examens de laboratoire', category: 'Laboratoire' },
  { code: 'laboratoire:traiter', label: 'Réaliser les analyses biologiques', category: 'Laboratoire' },
  { code: 'laboratoire:valider', label: 'Valider les résultats d\'analyses', category: 'Laboratoire' },
  { code: 'laboratoire:imprimer', label: 'Imprimer les bulletins d\'analyses', category: 'Laboratoire' },

  // Administration
  { code: 'utilisateurs:gerer', label: 'Gérer les comptes utilisateurs', category: 'Administration' },
  { code: 'roles:gerer', label: 'Gérer les rôles et permissions', category: 'Administration' },
  { code: 'tarifs:gerer', label: 'Gérer les tarifs et taux de change', category: 'Administration' }
];

// ============================================================================
// GESTION DES UTILISATEURS
// ============================================================================

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await query<{
      id: string;
      username: string;
      nom_complet: string;
      nom: string | null;
      prenom: string | null;
      fonction: string | null;
      telephone: string | null;
      email: string | null;
      role: string;
      role_id: string | null;
      role_nom: string | null;
      role_code: string | null;
      actif: number;
      created_at: string;
      updated_at: string;
    }>(`
      SELECT 
        u.id, u.username, u.nom_complet, u.nom, u.prenom, u.fonction, u.telephone, u.email,
        u.role, u.role_id,
        r.nom as role_nom, r.code as role_code,
        u.actif, u.created_at, u.updated_at 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id OR u.role = r.code
      ORDER BY u.created_at ASC
    `);

    // Récupérer les permissions de chaque rôle pour enrichir les utilisateurs
    const rolesPermissions = await query<{ role_id: string; permission: string }>(
      'SELECT role_id, permission FROM role_permissions'
    );
    const permMap: Record<string, string[]> = {};
    for (const rp of rolesPermissions) {
      if (!permMap[rp.role_id]) permMap[rp.role_id] = [];
      permMap[rp.role_id].push(rp.permission);
    }

    res.json({
      users: users.map(u => ({
        ...u,
        nom: u.nom || '',
        prenom: u.prenom || '',
        fonction: u.fonction || '',
        telephone: u.telephone || '',
        email: u.email || '',
        role_nom: u.role_nom || u.role,
        permissions: u.role_id && permMap[u.role_id] ? permMap[u.role_id] : (u.role === 'ADMINISTRATEUR' ? AVAILABLE_PERMISSIONS.map(p => p.code) : []),
        actif: Boolean(u.actif),
      })),
    });
  } catch (err: any) {
    console.error('[UserController] Erreur listing utilisateurs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { 
    username, 
    password, 
    nom, 
    prenom, 
    post_nom, 
    fonction, 
    telephone, 
    email, 
    role_id, 
    role, 
    nom_complet 
  } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'L\'identifiant (username) et le mot de passe sont obligatoires.' });
    return;
  }

  // Déterminer le rôle
  let resolvedRoleId: string | null = null;
  let resolvedRoleCode = 'RÉCEPTION';
  let resolvedRoleNom = 'Réception';

  if (role_id) {
    const roleRow = await queryOne<{ id: string; code: string; nom: string }>(
      'SELECT id, code, nom FROM roles WHERE id = ? OR code = ?',
      [role_id, role_id]
    );
    if (roleRow) {
      resolvedRoleId = roleRow.id;
      resolvedRoleCode = roleRow.code;
      resolvedRoleNom = roleRow.nom;
    }
  } else if (role) {
    const roleRow = await queryOne<{ id: string; code: string; nom: string }>(
      'SELECT id, code, nom FROM roles WHERE code = ? OR id = ?',
      [role, role]
    );
    if (roleRow) {
      resolvedRoleId = roleRow.id;
      resolvedRoleCode = roleRow.code;
      resolvedRoleNom = roleRow.nom;
    } else {
      resolvedRoleCode = role;
    }
  }

  // Nom complet
  const finalNom = (nom || '').trim();
  const finalPrenom = (prenom || post_nom || '').trim();
  let finalNomComplet = (nom_complet || '').trim();
  if (!finalNomComplet && (finalNom || finalPrenom)) {
    finalNomComplet = `${finalNom} ${finalPrenom}`.trim();
  }
  if (!finalNomComplet) {
    finalNomComplet = username.trim();
  }

  try {
    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) {
      res.status(409).json({ error: 'Cet identifiant est déjà utilisé.' });
      return;
    }

    const id = 'usr-' + crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const isActif = (req.body.actif === false || req.body.actif === 0) ? 0 : 1;

    await execute(`
      INSERT INTO users (
        id, username, password_hash, nom_complet, nom, prenom, fonction, telephone, email, role_id, role, actif, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      username.trim(),
      hash,
      finalNomComplet,
      finalNom,
      finalPrenom,
      (fonction || '').trim(),
      (telephone || '').trim(),
      (email || '').trim(),
      resolvedRoleId,
      resolvedRoleCode,
      isActif,
      now,
      now
    ]);

    await logAudit({
      userId: req.user?.id,
      action: 'USER_CREATED',
      ressourceType: 'USERS',
      ressourceId: id,
      details: `Création de l'utilisateur "${username}" (${finalNomComplet}) avec rôle ${resolvedRoleNom} (${resolvedRoleCode})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      user: {
        id,
        username: username.trim(),
        nom_complet: finalNomComplet,
        nom: finalNom,
        prenom: finalPrenom,
        fonction: (fonction || '').trim(),
        telephone: (telephone || '').trim(),
        email: (email || '').trim(),
        role: resolvedRoleCode,
        role_id: resolvedRoleId,
        role_nom: resolvedRoleNom,
        actif: true,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (err: any) {
    console.error('[UserController] Erreur création utilisateur:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la création de l\'utilisateur.' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { 
    nom, 
    prenom, 
    post_nom, 
    fonction, 
    telephone, 
    email, 
    role_id, 
    role, 
    nom_complet, 
    password, 
    actif 
  } = req.body;

  try {
    const existing = await queryOne<{ id: string; username: string; role: string; password_hash: string }>(
      'SELECT id, username, role, password_hash FROM users WHERE id = ?',
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Utilisateur non trouvé.' });
      return;
    }

    // Résolution du rôle
    let resolvedRoleId: string | null = null;
    let resolvedRoleCode = existing.role;

    if (role_id) {
      const roleRow = await queryOne<{ id: string; code: string }>(
        'SELECT id, code FROM roles WHERE id = ? OR code = ?',
        [role_id, role_id]
      );
      if (roleRow) {
        resolvedRoleId = roleRow.id;
        resolvedRoleCode = roleRow.code;
      }
    } else if (role) {
      const roleRow = await queryOne<{ id: string; code: string }>(
        'SELECT id, code FROM roles WHERE code = ? OR id = ?',
        [role, role]
      );
      if (roleRow) {
        resolvedRoleId = roleRow.id;
        resolvedRoleCode = roleRow.code;
      } else {
        resolvedRoleCode = role;
      }
    }

    const finalNom = nom !== undefined ? nom.trim() : null;
    const finalPrenom = prenom !== undefined ? prenom.trim() : (post_nom !== undefined ? post_nom.trim() : null);
    let finalNomComplet = nom_complet !== undefined ? nom_complet.trim() : null;

    if (!finalNomComplet && (finalNom || finalPrenom)) {
      finalNomComplet = `${finalNom || ''} ${finalPrenom || ''}`.trim();
    }

    const now = new Date().toISOString();
    let newHash = existing.password_hash;
    if (password && password.trim().length > 0) {
      newHash = await bcrypt.hash(password.trim(), 10);
    }

    await execute(`
      UPDATE users SET 
        nom_complet = COALESCE(?, nom_complet),
        nom = COALESCE(?, nom),
        prenom = COALESCE(?, prenom),
        fonction = COALESCE(?, fonction),
        telephone = COALESCE(?, telephone),
        email = COALESCE(?, email),
        role_id = COALESCE(?, role_id),
        role = COALESCE(?, role),
        password_hash = ?,
        actif = COALESCE(?, actif),
        updated_at = ?
      WHERE id = ?
    `, [
      finalNomComplet,
      finalNom,
      finalPrenom,
      fonction !== undefined ? fonction.trim() : null,
      telephone !== undefined ? telephone.trim() : null,
      email !== undefined ? email.trim() : null,
      resolvedRoleId,
      resolvedRoleCode,
      newHash,
      actif !== undefined ? (actif ? 1 : 0) : null,
      now,
      id
    ]);

    if (actif === false || actif === 0) {
      await execute('DELETE FROM sessions WHERE user_id = ?', [id]);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'USER_UPDATED',
      ressourceType: 'USERS',
      ressourceId: id,
      details: `Mise à jour du profil utilisateur "${existing.username}"`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Utilisateur mis à jour avec succès.' });
  } catch (err: any) {
    console.error('[UserController] Erreur mise à jour utilisateur:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'utilisateur.' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const user = await queryOne<{ id: string; username: string; actif: number; role: string }>(
      'SELECT id, username, actif, role FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé.' });
      return;
    }

    // Protection : empêcher la désactivation du compte admin courant si c'est le seul
    if (user.id === req.user?.id) {
      res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.' });
      return;
    }

    const nextStatus = user.actif ? 0 : 1;
    const now = new Date().toISOString();

    await execute('UPDATE users SET actif = ?, updated_at = ? WHERE id = ?', [nextStatus, now, id]);

    // Si on désactive, on révoque immédiatement ses sessions actives
    if (nextStatus === 0) {
      await execute('DELETE FROM sessions WHERE user_id = ?', [id]);
    }

    await logAudit({
      userId: req.user?.id,
      action: nextStatus === 1 ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      ressourceType: 'USERS',
      ressourceId: id,
      details: `Statut utilisateur "${user.username}" passé à ${nextStatus === 1 ? 'ACTIF' : 'DÉSACTIVÉ'}`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        actif: Boolean(nextStatus),
      },
    });
  } catch (err: any) {
    console.error('[UserController] Erreur toggle status:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut.' });
  }
}

// ============================================================================
// GESTION DES RÔLES & PERMISSIONS
// ============================================================================

export async function listRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const roles = await query<{
      id: string;
      code: string;
      nom: string;
      description: string | null;
      categorie: string;
      is_system: number;
      actif: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM roles ORDER BY is_system DESC, nom ASC');

    const rolePerms = await query<{ role_id: string; permission: string }>(
      'SELECT role_id, permission FROM role_permissions'
    );
    const permMap: Record<string, string[]> = {};
    for (const rp of rolePerms) {
      if (!permMap[rp.role_id]) permMap[rp.role_id] = [];
      permMap[rp.role_id].push(rp.permission);
    }

    // Compter les utilisateurs associés à chaque rôle
    const userCounts = await query<{ role_id: string; role: string; count: number }>(`
      SELECT role_id, role, count(*) as count 
      FROM users 
      GROUP BY role_id, role
    `);
    const countMap: Record<string, number> = {};
    for (const uc of userCounts) {
      if (uc.role_id) {
        countMap[uc.role_id] = (countMap[uc.role_id] || 0) + Number(uc.count);
      }
      if (uc.role) {
        countMap[uc.role] = (countMap[uc.role] || 0) + Number(uc.count);
      }
    }

    res.json({
      roles: roles.map(r => ({
        ...r,
        is_system: Boolean(r.is_system),
        actif: Boolean(r.actif),
        permissions: permMap[r.id] || (r.code === 'ADMINISTRATEUR' ? AVAILABLE_PERMISSIONS.map(p => p.code) : []),
        user_count: countMap[r.id] || countMap[r.code] || 0,
      })),
      available_permissions: AVAILABLE_PERMISSIONS,
    });
  } catch (err: any) {
    console.error('[UserController] Erreur listRoles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des rôles.' });
  }
}

export async function getRoleById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const role = await queryOne<{
      id: string;
      code: string;
      nom: string;
      description: string | null;
      categorie: string;
      is_system: number;
      actif: number;
    }>('SELECT * FROM roles WHERE id = ? OR code = ?', [id, id]);

    if (!role) {
      res.status(404).json({ error: 'Rôle introuvable.' });
      return;
    }

    const perms = await query<{ permission: string }>(
      'SELECT permission FROM role_permissions WHERE role_id = ?',
      [role.id]
    );

    res.json({
      role: {
        ...role,
        is_system: Boolean(role.is_system),
        actif: Boolean(role.actif),
        permissions: perms.map(p => p.permission),
      }
    });
  } catch (err: any) {
    console.error('[UserController] Erreur getRoleById:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du rôle.' });
  }
}

export async function createRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { nom, code, description, categorie, permissions } = req.body;

    if (!nom || !nom.trim()) {
      res.status(400).json({ error: 'Le nom du rôle est obligatoire.' });
      return;
    }

    const cleanCode = (code || nom.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')).trim();
    const existing = await queryOne('SELECT id FROM roles WHERE code = ?', [cleanCode]);
    if (existing) {
      res.status(409).json({ error: `Le code de rôle "${cleanCode}" est déjà utilisé.` });
      return;
    }

    const id = 'role-' + crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    const cat = (categorie || 'AUTRE').trim();

    await execute(`
      INSERT INTO roles (id, code, nom, description, categorie, is_system, actif, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `, [id, cleanCode, nom.trim(), (description || '').trim(), cat, now, now]);

    // Permissions
    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        if (typeof p === 'string' && p.trim()) {
          await execute(
            'INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)',
            [id, p.trim()]
          );
        }
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'ROLE_CREATED',
      ressourceType: 'ROLES',
      ressourceId: id,
      details: `Création du rôle personnalisé "${nom}" (${cleanCode}) avec ${Array.isArray(permissions) ? permissions.length : 0} permissions`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      role: {
        id,
        code: cleanCode,
        nom: nom.trim(),
        description: (description || '').trim(),
        categorie: cat,
        is_system: false,
        actif: true,
        permissions: Array.isArray(permissions) ? permissions : [],
        created_at: now,
        updated_at: now,
      }
    });
  } catch (err: any) {
    console.error('[UserController] Erreur createRole:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la création du rôle.' });
  }
}

export async function updateRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nom, description, categorie, permissions, actif } = req.body;

    const role = await queryOne<{ id: string; code: string; is_system: number; nom: string }>(
      'SELECT id, code, is_system, nom FROM roles WHERE id = ? OR code = ?',
      [id, id]
    );

    if (!role) {
      res.status(404).json({ error: 'Rôle introuvable.' });
      return;
    }

    const now = new Date().toISOString();

    await execute(`
      UPDATE roles SET 
        nom = COALESCE(?, nom),
        description = COALESCE(?, description),
        categorie = COALESCE(?, categorie),
        actif = COALESCE(?, actif),
        updated_at = ?
      WHERE id = ?
    `, [
      nom !== undefined ? nom.trim() : null,
      description !== undefined ? description.trim() : null,
      categorie !== undefined ? categorie.trim() : null,
      actif !== undefined ? (actif ? 1 : 0) : null,
      now,
      role.id
    ]);

    // Mise à jour des permissions si transmises
    if (Array.isArray(permissions)) {
      await execute('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
      for (const p of permissions) {
        if (typeof p === 'string' && p.trim()) {
          await execute(
            'INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)',
            [role.id, p.trim()]
          );
        }
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'ROLE_UPDATED',
      ressourceType: 'ROLES',
      ressourceId: role.id,
      details: `Mise à jour des autorisations du rôle "${role.nom}" (${role.code})`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Rôle "${role.nom}" mis à jour avec succès.` });
  } catch (err: any) {
    console.error('[UserController] Erreur updateRole:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle.' });
  }
}

export async function deleteRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const role = await queryOne<{ id: string; code: string; is_system: number; nom: string }>(
      'SELECT id, code, is_system, nom FROM roles WHERE id = ? OR code = ?',
      [id, id]
    );

    if (!role) {
      res.status(404).json({ error: 'Rôle introuvable.' });
      return;
    }

    if (role.is_system) {
      res.status(400).json({ error: 'Les rôles système fondamentaux ne peuvent pas être supprimés.' });
      return;
    }

    // Vérifier si des utilisateurs sont rattachés à ce rôle
    const attachedUsers = await queryOne<{ count: number }>(
      'SELECT count(*) as count FROM users WHERE role_id = ? OR role = ?',
      [role.id, role.code]
    );

    if (attachedUsers && Number(attachedUsers.count) > 0) {
      res.status(400).json({ 
        error: `Impossible de supprimer ce rôle : ${attachedUsers.count} utilisateur(s) lui sont actuellement assigné(s). Réaffectez-les d'abord.` 
      });
      return;
    }

    await execute('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
    await execute('DELETE FROM roles WHERE id = ?', [role.id]);

    await logAudit({
      userId: req.user?.id,
      action: 'ROLE_DELETED',
      ressourceType: 'ROLES',
      ressourceId: role.id,
      details: `Suppression du rôle "${role.nom}" (${role.code})`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Rôle "${role.nom}" supprimé.` });
  } catch (err: any) {
    console.error('[UserController] Erreur deleteRole:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du rôle.' });
  }
}

export async function listPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ permissions: AVAILABLE_PERMISSIONS });
}
