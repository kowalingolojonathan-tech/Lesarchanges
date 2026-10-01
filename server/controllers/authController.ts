import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/database.js';
import { AuthenticatedRequest, Role } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    return;
  }

  try {
    const user = await queryOne<{
      id: string;
      username: string;
      password_hash: string;
      nom_complet: string;
      nom?: string;
      prenom?: string;
      fonction?: string;
      telephone?: string;
      email?: string;
      role: Role;
      role_id?: string;
      actif: number;
      must_change_password?: number;
    }>('SELECT id, username, password_hash, nom_complet, nom, prenom, fonction, telephone, email, role, role_id, actif, COALESCE(must_change_password, 0) as must_change_password FROM users WHERE username = ?', [username.trim()]);

    if (!user) {
      await logAudit({
        action: 'LOGIN_FAILED',
        ressourceType: 'AUTH',
        ressourceId: username,
        details: 'Tentative de connexion avec un nom d\'utilisateur inconnu',
        ipAddress: req.ip,
      });
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }

    if (!user.actif) {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_INACTIVE_USER',
        ressourceType: 'AUTH',
        details: 'Tentative de connexion sur un compte désactivé',
        ipAddress: req.ip,
      });
      res.status(403).json({ error: 'Ce compte utilisateur a été désactivé. Veuillez contacter l\'administrateur.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_FAILED_PASSWORD',
        ressourceType: 'AUTH',
        details: 'Mot de passe incorrect',
        ipAddress: req.ip,
      });
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }

    // Création du token de session sécurisé
    const token = 'sess_' + crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 jours

    await execute(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [token, user.id, now.toISOString(), expiresAt.toISOString()]
    );

    // Définition du cookie HTTP sécurisé compatible Preview Iframe & HTTPS
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(req.headers['host']?.includes('run.app')) || process.env.NODE_ENV === 'production';

    res.cookie('archanges_session', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      partitioned: isHttps,
      expires: expiresAt,
      path: '/',
    });

    await logAudit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ressourceType: 'AUTH',
      details: `Connexion réussie sous le rôle ${user.role}`,
      ipAddress: req.ip,
    });

    // Résolution des permissions et libellé du rôle
    let permissions: string[] = [];
    let roleNom = user.role;
    let roleCat = user.role;

    if (user.role_id) {
      const roleRow = await queryOne<{ nom: string; categorie: string }>(
        'SELECT nom, categorie FROM roles WHERE id = ?',
        [user.role_id]
      );
      if (roleRow) {
        roleNom = roleRow.nom;
        roleCat = roleRow.categorie;
      }
      const pRows = await query<{ permission: string }>(
        'SELECT permission FROM role_permissions WHERE role_id = ?',
        [user.role_id]
      );
      permissions = pRows.map(p => p.permission);
    } else {
      const roleRow = await queryOne<{ id: string; nom: string; categorie: string }>(
        'SELECT id, nom, categorie FROM roles WHERE code = ?',
        [user.role]
      );
      if (roleRow) {
        roleNom = roleRow.nom;
        roleCat = roleRow.categorie;
        const pRows = await query<{ permission: string }>(
          'SELECT permission FROM role_permissions WHERE role_id = ?',
          [roleRow.id]
        );
        permissions = pRows.map(p => p.permission);
      }
    }

    if (user.role === 'ADMINISTRATEUR' || roleCat === 'ADMINISTRATEUR') {
      if (permissions.length === 0) {
        permissions = [
          'factures:voir', 'factures:ajouter', 'factures:modifier', 'factures:supprimer', 'factures:imprimer',
          'paiements:voir', 'paiements:ajouter', 'paiements:modifier', 'paiements:annuler', 'paiements:imprimer',
          'rapports_financiers:voir', 'rapports_financiers:ajouter', 'rapports_financiers:modifier', 'rapports_financiers:supprimer', 'rapports_financiers:imprimer',
          'patients:voir', 'patients:ajouter', 'patients:modifier', 'patients:supprimer', 'patients:voir_tous',
          'prescriptions:voir', 'prescriptions:ajouter', 'prescriptions:modifier', 'prescriptions:valider', 'prescriptions:imprimer',
          'laboratoire:voir', 'laboratoire:demander', 'laboratoire:traiter', 'laboratoire:valider', 'laboratoire:imprimer',
          'utilisateurs:gerer', 'roles:gerer', 'tarifs:gerer'
        ];
      }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nom_complet: user.nom_complet,
        nom: user.nom || '',
        prenom: user.prenom || '',
        fonction: user.fonction || '',
        telephone: user.telephone || '',
        email: user.email || '',
        role: user.role,
        role_id: user.role_id || '',
        role_nom: roleNom,
        role_categorie: roleCat,
        permissions,
        actif: Boolean(user.actif),
        must_change_password: Boolean(user.must_change_password),
      },
      expires_at: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error('[AuthController] Erreur login:', err);
    res.status(500).json({ error: 'Erreur interne lors de l\'authentification.' });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const token = req.token;
  if (token) {
    await execute('DELETE FROM sessions WHERE id = ?', [token]);
  }

  if (req.user) {
    await logAudit({
      userId: req.user.id,
      action: 'LOGOUT',
      ressourceType: 'AUTH',
      details: 'Déconnexion volontaire de session',
      ipAddress: req.ip,
    });
  }

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(req.headers['host']?.includes('run.app')) || process.env.NODE_ENV === 'production';
  res.clearCookie('archanges_session', {
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
  res.json({ success: true, message: 'Déconnexion effectuée avec succès.' });
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;

  if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
    res.status(400).json({ error: 'L\'ancien mot de passe et le nouveau mot de passe sont obligatoires.' });
    return;
  }

  if (nouveau_mot_de_passe.length < 8) {
    res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
    return;
  }

  try {
    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }

    const isValid = await bcrypt.compare(ancien_mot_de_passe, user.password_hash);
    if (!isValid) {
      await logAudit({
        userId: req.user.id,
        action: 'PASSWORD_CHANGE_FAILED',
        ressourceType: 'AUTH',
        details: 'Tentative de changement avec ancien mot de passe erroné',
        ipAddress: req.ip,
      });
      res.status(400).json({ error: 'L\'ancien mot de passe fourni est incorrect.' });
      return;
    }

    const newHash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    const now = new Date().toISOString();

    await execute(
      'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
      [newHash, now, req.user.id]
    );

    // Révocation de toutes les autres sessions de l'utilisateur pour sécurité
    if (req.token) {
      await execute('DELETE FROM sessions WHERE user_id = ? AND id != ?', [req.user.id, req.token]);
    }

    await logAudit({
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      ressourceType: 'AUTH',
      details: 'Mot de passe modifié avec succès',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) {
    console.error('[AuthController] Erreur changePassword:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  const role = req.user.role;
  
  // Matrice de permissions calculée côté backend
  const permissions = {
    role,
    canManageUsers: role === 'ADMINISTRATEUR',
    canViewTechnicalAudit: role === 'ADMINISTRATEUR',
    canManagePatientsReception: role === 'RÉCEPTION' || role === 'ADMINISTRATEUR',
    canRecordVitals: role === 'RÉCEPTION',
    canProcessPayments: role === 'RÉCEPTION',
    canAccessConsultations: role === 'MÉDECIN',
    canPrescribeMedicines: role === 'MÉDECIN',
    canOrderLabTests: role === 'MÉDECIN',
    canReferExternal: role === 'MÉDECIN',
    canProcessLabSamples: role === 'LABORATOIRE',
    canValidateLabResults: role === 'LABORATOIRE',
    canAccessPrivateMedicalNotes: role === 'MÉDECIN', // STRICT : ni Réception, ni Labo, ni Admin technique
  };

  res.json({
    user: {
      ...req.user,
      actif: Boolean(req.user.actif),
      must_change_password: Boolean(req.user.must_change_password),
    },
    permissions,
  });
}
