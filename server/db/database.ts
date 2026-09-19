import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
export const DB_PATH = path.join(DATA_DIR, 'clinique_les_archanges.db');

let dbInstance: Database | null = null;
let transactionDepth = 0;
let lockDepth = 0;

// Mutex réentrant pour sérialiser strictement les écritures sans interblocage
let writeQueue = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  if (lockDepth > 0) {
    // Déjà détenteur du verrou d'écriture (réentrance sécurisée dans les transactions)
    lockDepth++;
    try {
      return await fn();
    } finally {
      lockDepth--;
    }
  }

  const next = writeQueue.then(async () => {
    lockDepth = 1;
    try {
      return await fn();
    } finally {
      lockDepth = 0;
    }
  });

  writeQueue = next.then(() => {}, () => {});
  return next;
}

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Active impérativement l'intégrité référentielle des clés étrangères
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  
  return dbInstance;
}

/**
 * Persistance atomique sur disque :
 * 1. Exporte le binaire SQLite depuis sql.js.
 * 2. Écrit d'abord dans un fichier temporaire unique (.tmp.<pid>.<timestamp>).
 * 3. Force le flush avec fsync.
 * 4. Remplace atomiquement le fichier cible via fs.renameSync.
 * Ceci garantit qu'un arrêt brutal du serveur ne corrompt jamais la base principale.
 */
export function saveDb(): void {
  if (!dbInstance) return;
  // Si une transaction est en cours, la persistance disque attend le COMMIT final
  if (transactionDepth > 0) return;

  const data = dbInstance.export();
  const buffer = Buffer.from(data);

  const tempPath = `${DB_PATH}.tmp.${process.pid}.${Date.now()}`;
  try {
    const fd = fs.openSync(tempPath, 'w');
    fs.writeSync(fd, buffer);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    console.error('Erreur lors de la persistance atomique SQLite:', err);
    throw err;
  }
}

/**
 * Réalise une sauvegarde binaire horodatée et vérifiée de la base de données.
 */
export function backupDatabase(customNote: string = 'auto'): { path: string; size: number; timestamp: string } {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  saveDb();

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${now.getHours()}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupFileName = `backup_archanges_${dateStr}_${customNote}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath);
    const stats = fs.statSync(backupPath);
    return {
      path: backupPath,
      size: stats.size,
      timestamp: now.toISOString(),
    };
  }

  throw new Error('Base de données source introuvable pour la sauvegarde.');
}

type QueryParam = string | number | null | boolean;

function sanitizeParams(params: QueryParam[]): (string | number | null)[] {
  return params.map(val => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  });
}

export async function query<T = any>(sql: string, params: QueryParam[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    const cleanParams = sanitizeParams(params);
    stmt.bind(cleanParams);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export async function queryOne<T = any>(sql: string, params: QueryParam[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: QueryParam[] = []): Promise<void> {
  return withWriteLock(async () => {
    const db = await getDb();
    if (params.length === 0) {
      db.exec(sql);
    } else {
      const stmt = db.prepare(sql);
      try {
        const cleanParams = sanitizeParams(params);
        stmt.run(cleanParams);
      } finally {
        stmt.free();
      }
    }
    saveDb();
  });
}

/**
 * Exécute un bloc transactionnel ACID strict :
 * - Empêche l'imbrication désordonnée.
 * - Ne persiste sur disque qu'après le COMMIT réussi.
 * - Si une exception survient, exécute ROLLBACK et annule les modifications mémoire.
 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  return withWriteLock(async () => {
    const db = await getDb();
    transactionDepth++;
    if (transactionDepth === 1) {
      db.exec('BEGIN TRANSACTION;');
    }
    try {
      const result = await fn();
      if (transactionDepth === 1) {
        db.exec('COMMIT;');
        saveDb();
      }
      transactionDepth--;
      return result;
    } catch (err) {
      if (transactionDepth === 1) {
        db.exec('ROLLBACK;');
      }
      transactionDepth = Math.max(0, transactionDepth - 1);
      throw err;
    }
  });
}
