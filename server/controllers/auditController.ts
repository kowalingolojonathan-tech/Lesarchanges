import { Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const logs = await query<{
      id: string;
      user_id: string | null;
      username: string | null;
      nom_complet: string | null;
      role: string | null;
      action: string;
      ressource_type: string;
      ressource_id: string | null;
      details: string | null;
      ip_address: string | null;
      timestamp: string;
    }>(`
      SELECT 
        a.id, a.user_id, a.action, a.ressource_type, a.ressource_id, 
        a.details, a.ip_address, a.timestamp,
        u.username, u.nom_complet, u.role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 200
    `);

    res.json({ logs });
  } catch (err: any) {
    console.error('[AuditController] Erreur listing logs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des journaux d\'audit.' });
  }
}

export async function getSystemStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const usersCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const logsCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs');
    const activeSessions = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?', [new Date().toISOString()]);
    
    const settings = await query<{ key: string; value: string; description: string }>('SELECT key, value, description FROM clinic_settings');

    res.json({
      status: 'OPERATIONAL',
      database: 'SQLite 3 (ACID Relational Engine with Foreign Keys enabled)',
      stats: {
        totalUsers: usersCount?.count || 0,
        totalAuditLogs: logsCount?.count || 0,
        activeSessions: activeSessions?.count || 0,
      },
      settings: settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
      currencies: {
        primary: 'USD',
        secondary: 'CDF',
        exchangeRateUsdCdf: 2850,
      },
    });
  } catch (err: any) {
    console.error('[AuditController] Erreur récupération stats:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques système.' });
  }
}
