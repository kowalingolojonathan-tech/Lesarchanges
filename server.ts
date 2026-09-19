import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { runMigrations } from './server/db/migrations.js';
import { seedDatabase } from './server/db/seed.js';
import { backupDatabase } from './server/db/database.js';
import { authenticateToken, requireAuth, requireRole, AuthenticatedRequest } from './server/middleware/auth.js';
import * as authCtrl from './server/controllers/authController.js';
import * as userCtrl from './server/controllers/userController.js';
import * as auditCtrl from './server/controllers/auditController.js';
import * as patientCtrl from './server/controllers/patientController.js';
import * as visiteCtrl from './server/controllers/visiteController.js';
import * as medicalCtrl from './server/controllers/medicalController.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configuration proxy pour Cloud Run et environnement Preview (HTTPS)
  app.set('trust proxy', 1);

  // Middlewares de base
  app.use(express.json());
  app.use(cookieParser());

  // Initialisation de la base de données relationnelle et des migrations
  console.log('[Database] Initialisation de la base SQLite relationnelle ACID...');
  await runMigrations();
  await seedDatabase();
  console.log('[Database] Migrations et seeders exécutés avec succès.');

  // Middleware d'authentification global (attache req.user si session valide)
  app.use(authenticateToken);

  // --- ROUTES API D'AUTHENTIFICATION & SESSIONS ---
  app.post('/api/auth/login', authCtrl.login);
  app.post('/api/auth/logout', authCtrl.logout);
  app.get('/api/auth/me', requireAuth, authCtrl.getMe);
  app.post('/api/auth/change-password', requireAuth, authCtrl.changePassword);

  // --- ROUTES API UTILISATEURS (Strictement réservées à l'ADMINISTRATEUR) ---
  app.get('/api/users', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.listUsers);
  app.post('/api/users', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.createUser);
  app.patch('/api/users/:id/toggle-active', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.toggleUserStatus);

  // --- ROUTES API AUDIT, STATS & BACKUP SYSTÈME ---
  app.get('/api/audit-logs', requireAuth, requireRole(['ADMINISTRATEUR']), auditCtrl.getAuditLogs);
  app.get('/api/system/stats', requireAuth, auditCtrl.getSystemStats);
  app.post('/api/admin/backup', requireAuth, requireRole(['ADMINISTRATEUR']), (req, res) => {
    try {
      const backup = backupDatabase('manuel');
      res.json({ success: true, backup });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erreur lors de la sauvegarde.' });
    }
  });

  // --- ROUTES API PHASE 2A : PATIENTS & DOSSIERS PERMANENTS ---
  app.get('/api/patients/search', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), patientCtrl.searchPatients);
  app.get('/api/patients/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), patientCtrl.getPatientById);
  app.post('/api/patients', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), patientCtrl.createPatient);
  app.put('/api/patients/:id', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), patientCtrl.updatePatient);

  // --- ROUTES API PHASE 2A : VISITES, SIGNES VITAUX & AFFECTATION MÉDECIN ---
  app.get('/api/visites', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR', 'LABORATOIRE']), visiteCtrl.getVisites);
  app.get('/api/visites/dashboard-stats', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.getReceptionStats);
  app.get('/api/visites/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR', 'LABORATOIRE']), visiteCtrl.getVisiteById);
  app.post('/api/visites', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.createVisite);
  app.post('/api/visites/:id/vitals', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.recordVitals);
  app.patch('/api/visites/:id/assign-doctor', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.assignDoctor);
  app.patch('/api/visites/:id/status', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.updateVisiteStatus);
  app.get('/api/doctors', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.getActiveDoctors);

  // --- ROUTES API PHASE 2B : ESPACE MÉDECIN, CONSULTATIONS CLINIQUES & HISTORIQUE MÉDICAL ---
  // Protection RBAC stricte : Seul le rôle MÉDECIN peut accéder à ces données confidentielles.
  // ADMINISTRATEUR, RÉCEPTION et LABORATOIRE reçoivent un 403 Forbidden systématique.
  app.get('/api/medical/queue', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getDoctorQueue);
  app.get('/api/medical/visites/:id', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getMedicalVisiteDetails);
  app.post('/api/medical/consultations', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.startOrGetConsultation);
  app.get('/api/medical/consultations/:id', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getConsultationById);
  app.patch('/api/medical/consultations/:id', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.updateConsultation);
  app.post('/api/medical/consultations/:id/finalize', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.finalizeConsultation);
  app.get('/api/medical/patients/:patient_id/history', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getPatientMedicalHistory);

  // --- ROUTES DE VÉRIFICATION DE PROTECTION RBAC STRICTE (Backend) ---
  // Prouve que l'API bloque fermement les rôles non autorisés au niveau du serveur
  app.get('/api/medical/protected-test', requireAuth, requireRole(['MÉDECIN']), (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ message: 'Accès autorisé aux dossiers médicaux confidentiels.', role: authReq.user?.role });
  });

  app.get('/api/lab/protected-test', requireAuth, requireRole(['LABORATOIRE']), (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ message: 'Accès autorisé à la paillasse du laboratoire.', role: authReq.user?.role });
  });

  app.get('/api/reception/protected-test', requireAuth, requireRole(['RÉCEPTION']), (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ message: 'Accès autorisé au guichet de réception et caisse.', role: authReq.user?.role });
  });

  // Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      clinique: 'Clinique Les Archanges', 
      phase: 'V1 - Phase 1 Socle Technique',
      timestamp: new Date().toISOString()
    });
  });

  // --- CONFIGURATION DU SERVEUR VITE / STATIC ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Clinique Les Archanges démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erreur fatale au démarrage du serveur:', err);
  process.exit(1);
});
