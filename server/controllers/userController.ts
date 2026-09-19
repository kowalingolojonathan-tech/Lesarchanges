import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/database.js';
import { AuthenticatedRequest, Role } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await query<{
      id: string;
      username: string;
      nom_complet: string;
      role: Role;
      actif: number;
      created_at: string;
      updated_at: string;
    }>(`
      SELECT id, username, nom_complet, role, actif, created_at, updated_at 
      FROM users 
      ORDER BY created_at ASC
    `);

    res.json({
      users: users.map(u => ({
        ...u,
        actif: Boolean(u.actif),
      })),
    });
  } catch (err: any) {
    console.error('[UserController] Erreur listing utilisateurs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { username, password, nom_complet, role } = req.body;

  if (!username || !password || !nom_complet || !role) {
    res.status(400).json({ error: 'Tous les champs sont obligatoires (username, password, nom_complet, role).' });
    return;
  }

  const validRoles: Role[] = ['ADMINISTRATEUR', 'RÉCEPTION', 'MÉDECIN', 'LABORATOIRE'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Rôle invalide. Rôles autorisés: ${validRoles.join(', ')}` });
    return;
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

    await execute(`
      INSERT INTO users (id, username, password_hash, nom_complet, role, actif, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `, [id, username.trim(), hash, nom_complet.trim(), role, now, now]);

    await logAudit({
      userId: req.user?.id,
      action: 'USER_CREATED',
      ressourceType: 'USERS',
      ressourceId: id,
      details: `Création du compte utilisateur "${username}" avec le rôle ${role}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      user: {
        id,
        username: username.trim(),
        nom_complet: nom_complet.trim(),
        role,
        actif: true,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (err: any) {
    console.error('[UserController] Erreur création utilisateur:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur.' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const user = await queryOne<{ id: string; username: string; actif: number; role: Role }>(
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
    console.error('[UserController] Erreur modification statut:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut utilisateur.' });
  }
}
