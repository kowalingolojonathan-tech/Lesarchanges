import { Request, Response, NextFunction } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { logAudit } from '../utils/auditLogger.js';

export type Role = 'ADMINISTRATEUR' | 'DIRECTEUR' | 'MÉDECIN' | 'RÉCEPTION' | 'LABORATOIRE' | string;

export interface AuthUser {
  id: string;
  username: string;
  nom_complet: string;
  nom?: string;
  prenom?: string;
  fonction?: string;
  telephone?: string;
  email?: string;
  role: Role;
  role_id?: string;
  role_nom?: string;
  role_categorie?: string;
  permissions: string[];
  actif: number;
  must_change_password: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  token?: string;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const cookieToken = req.cookies?.archanges_session;
  
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : cookieToken;

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const session = await queryOne<{
      user_id: string;
      expires_at: string;
      username: string;
      nom_complet: string;
      nom?: string;
      prenom?: string;
      fonction?: string;
      telephone?: string;
      email?: string;
      role: string;
      role_id?: string;
      actif: number;
      must_change_password?: number;
    }>(`
      SELECT 
        s.user_id, s.expires_at, 
        u.username, u.nom_complet, u.nom, u.prenom, u.fonction, u.telephone, u.email,
        u.role, u.role_id, u.actif,
        COALESCE(u.must_change_password, 0) as must_change_password
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [token]);

    if (!session) {
      req.user = undefined;
      return next();
    }

    // Vérifier l'expiration
    if (new Date(session.expires_at) < new Date()) {
      await execute('DELETE FROM sessions WHERE id = ?', [token]);
      req.user = undefined;
      return next();
    }

    // Vérifier si l'utilisateur est toujours actif : si désactivé, révoque immédiatement ses sessions
    if (!session.actif) {
      await execute('DELETE FROM sessions WHERE user_id = ?', [session.user_id]);
      req.user = undefined;
      return next();
    }

    // Récupérer les permissions du rôle de l'utilisateur
    let permissions: string[] = [];
    let roleNom = session.role;
    let roleCat = session.role;

    if (session.role_id) {
      const roleRow = await queryOne<{ nom: string; categorie: string }>(
        'SELECT nom, categorie FROM roles WHERE id = ?',
        [session.role_id]
      );
      if (roleRow) {
        roleNom = roleRow.nom;
        roleCat = roleRow.categorie;
      }
      const permRows = await query<{ permission: string }>(
        'SELECT permission FROM role_permissions WHERE role_id = ?',
        [session.role_id]
      );
      permissions = permRows.map(p => p.permission);
    } else {
      // Fallback par code de rôle
      const roleRow = await queryOne<{ id: string; nom: string; categorie: string }>(
        'SELECT id, nom, categorie FROM roles WHERE code = ?',
        [session.role]
      );
      if (roleRow) {
        roleNom = roleRow.nom;
        roleCat = roleRow.categorie;
        const permRows = await query<{ permission: string }>(
          'SELECT permission FROM role_permissions WHERE role_id = ?',
          [roleRow.id]
        );
        permissions = permRows.map(p => p.permission);
      }
    }

    // Si administrateur système, octroyer toutes les permissions
    if (session.role === 'ADMINISTRATEUR' || roleCat === 'ADMINISTRATEUR') {
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

    req.user = {
      id: session.user_id,
      username: session.username,
      nom_complet: session.nom_complet,
      nom: session.nom || '',
      prenom: session.prenom || '',
      fonction: session.fonction || '',
      telephone: session.telephone || '',
      email: session.email || '',
      role: session.role,
      role_id: session.role_id || '',
      role_nom: roleNom,
      role_categorie: roleCat,
      permissions,
      actif: session.actif,
      must_change_password: session.must_change_password ?? 0,
    };
    req.token = token;

    next();
  } catch (err) {
    console.error('[AuthMiddleware] Erreur vérification session:', err);
    next();
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Session non authentifiée ou expirée. Veuillez vous connecter.' });
    return;
  }
  next();
}

/**
 * Vérifie si un utilisateur dispose d'une permission donnée
 */
export function hasPermission(user: AuthUser | undefined, permission: string): boolean {
  if (!user || !user.actif) return false;
  if (user.role === 'ADMINISTRATEUR' || user.role_categorie === 'ADMINISTRATEUR') return true;
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Middleware vérifiant une permission fine RBAC
 */
export function requirePermission(permission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    if (!hasPermission(req.user, permission)) {
      await logAudit({
        userId: req.user.id,
        action: 'ACCESS_DENIED_PERMISSION',
        ressourceType: 'API_ENDPOINT',
        ressourceId: req.originalUrl,
        details: `Utilisateur "${req.user.username}" (${req.user.role}) a tenté une action requérant la permission "${permission}"`,
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(403).json({ 
        error: `Accès refusé. Cette action requiert la permission : "${permission}".` 
      });
      return;
    }

    next();
  };
}

export function isDoctorRole(user: AuthUser | undefined | { role?: string; role_categorie?: string }): boolean {
  if (!user) return false;
  const role = user.role || '';
  const cat = user.role_categorie || role;
  return (
    ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR'].includes(role) ||
    cat === 'MÉDECIN' || cat === 'DIRECTEUR'
  );
}

export function requireRole(allowedRoles: (Role | string)[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    const uRole = req.user.role;
    const uCat = req.user.role_categorie || uRole;

    // Correspondance directe
    const directMatch = allowedRoles.includes(uRole) || allowedRoles.includes(uCat);
    
    // Catégorie médicale (Directeur, Médecin généraliste, pédiatre, externe)
    const isMedCategory = allowedRoles.includes('MÉDECIN') && (
      ['MÉDECIN', 'MEDECIN', 'MEDECIN_GENERALISTE', 'MEDECIN_PEDIATRE', 'MEDECIN_EXTERNE', 'DIRECTEUR'].includes(uRole) ||
      uCat === 'MÉDECIN' || uCat === 'DIRECTEUR'
    );

    // Catégorie réception
    const isRecepCategory = (allowedRoles.includes('RÉCEPTION') || allowedRoles.includes('RECEPTION')) && (
      ['RÉCEPTION', 'RECEPTION'].includes(uRole) || uCat === 'RÉCEPTION'
    );

    // Catégorie laboratoire
    const isLabCategory = allowedRoles.includes('LABORATOIRE') && (
      ['LABORATOIRE', 'LABO'].includes(uRole) || uCat === 'LABORATOIRE'
    );

    // Administrateur système
    const isAdmin = uRole === 'ADMINISTRATEUR' || uCat === 'ADMINISTRATEUR';

    if (directMatch || isMedCategory || isRecepCategory || isLabCategory || isAdmin) {
      return next();
    }

    // Trace la tentative d'accès non autorisé
    await logAudit({
      userId: req.user.id,
      action: 'ACCESS_DENIED_RBAC',
      ressourceType: 'API_ENDPOINT',
      ressourceId: req.originalUrl,
      details: `Rôle ${req.user.role} a tenté d'accéder à une ressource restreinte aux rôles: ${allowedRoles.join(', ')}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(403).json({ 
      error: `Accès refusé. Cette action requiert l'un des rôles suivants : ${allowedRoles.join(', ')}. Votre rôle actuel est : ${req.user.role}.` 
    });
  };
}
