import { Request, Response, NextFunction } from 'express';
import { queryOne, execute } from '../db/database.js';
import { logAudit } from '../utils/auditLogger.js';

export type Role = 'ADMINISTRATEUR' | 'RÉCEPTION' | 'MÉDECIN' | 'LABORATOIRE';

export interface AuthUser {
  id: string;
  username: string;
  nom_complet: string;
  role: Role;
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
      role: Role;
      actif: number;
      must_change_password?: number;
    }>(`
      SELECT 
        s.user_id, s.expires_at, 
        u.username, u.nom_complet, u.role, u.actif,
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

    req.user = {
      id: session.user_id,
      username: session.username,
      nom_complet: session.nom_complet,
      role: session.role,
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

export function requireRole(allowedRoles: Role[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
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
      return;
    }

    next();
  };
}
