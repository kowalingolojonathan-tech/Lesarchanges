import { execute } from '../db/database.js';

export interface LogAuditParams {
  userId?: string | null;
  action: string;
  ressourceType: string;
  ressourceId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}

export async function logAudit({
  userId = null,
  action,
  ressourceType,
  ressourceId = null,
  details = null,
  ipAddress = null,
}: LogAuditParams): Promise<void> {
  try {
    const id = 'aud-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO audit_logs (id, user_id, action, ressource_type, ressource_id, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, action, ressourceType, ressourceId, details, ipAddress, now]);
  } catch (err) {
    console.error('[AuditLog] Erreur enregistrement log:', err);
  }
}

export const auditLogger = {
  log: logAudit,
};
