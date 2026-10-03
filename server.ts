import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { runMigrations } from './server/db/migrations.js';
import { seedDatabase } from './server/db/seed.js';
import { backupDatabase } from './server/db/database.js';
import { authenticateToken, requireAuth, requireRole, requirePermission, AuthenticatedRequest } from './server/middleware/auth.js';
import * as authCtrl from './server/controllers/authController.js';
import * as userCtrl from './server/controllers/userController.js';
import * as auditCtrl from './server/controllers/auditController.js';
import * as patientCtrl from './server/controllers/patientController.js';
import * as visiteCtrl from './server/controllers/visiteController.js';
import * as medicalCtrl from './server/controllers/medicalController.js';
import * as appointmentCtrl from './server/controllers/appointmentController.js';
import * as billingCtrl from './server/controllers/billingController.js';

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
  app.put('/api/users/:id', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.updateUser);
  app.patch('/api/users/:id/toggle-active', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.toggleUserStatus);

  // --- ROUTES API RÔLES & PERMISSIONS (Strictement réservées à l'ADMINISTRATEUR) ---
  app.get('/api/roles', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.listRoles);
  app.get('/api/roles/:id', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.getRoleById);
  app.post('/api/roles', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.createRole);
  app.put('/api/roles/:id', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.updateRole);
  app.delete('/api/roles/:id', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.deleteRole);
  app.get('/api/permissions', requireAuth, requireRole(['ADMINISTRATEUR']), userCtrl.listPermissions);

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
  app.get('/api/patients', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), patientCtrl.searchPatients);
  app.get('/api/patients/search', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), patientCtrl.searchPatients);
  app.get('/api/patients/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), patientCtrl.getPatientById);
  app.get('/api/patients/:id/vitals-history', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.getPatientVitalsHistory);
  app.post('/api/patients', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), patientCtrl.createPatient);
  app.put('/api/patients/:id', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), patientCtrl.updatePatient);

  // --- ROUTES API PHASE 2A : VISITES, SIGNES VITAUX & AFFECTATION MÉDECIN ---
  app.get('/api/visites', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR', 'LABORATOIRE']), visiteCtrl.getVisites);
  app.get('/api/visites/dashboard-stats', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.getReceptionStats);
  app.get('/api/visites/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR', 'LABORATOIRE']), visiteCtrl.getVisiteById);
  app.post('/api/visites', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.createVisite);
  app.get('/api/visites/patient/:id/interpretation-dossiers', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.getPatientDossiersForInterpretation);
  app.post('/api/visites/interpretation', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.createInterpretationVisite);
  app.post('/api/visites/:id/vitals', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.recordVitals);
  app.patch('/api/visites/:id/assign-doctor', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), visiteCtrl.assignDoctor);
  app.patch('/api/visites/:id/status', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.updateVisiteStatus);
  app.get('/api/doctors', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), visiteCtrl.getActiveDoctors);

  // --- ROUTES API RENDEZ-VOUS & SIGNAUX RÉCEPTION/MÉDECIN (ÉTAPE 7 - CALENDRIER PARTAGÉ) ---
  app.get('/api/rendez-vous', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.getAppointments);
  app.post('/api/rendez-vous', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.createAppointment);
  app.patch('/api/rendez-vous/:id/status', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.updateAppointmentStatus);
  app.patch('/api/rendez-vous/:id/rappel', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.updateAppointmentReminder);
  app.patch('/api/rendez-vous/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.updateAppointment);
  app.delete('/api/rendez-vous/:id', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.cancelAppointment);
  app.get('/api/signaux-reception', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.getSignals);
  app.post('/api/signaux-reception', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.createSignal);
  app.patch('/api/signaux-reception/:id/traiter', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), appointmentCtrl.treatSignal);

  // --- ROUTES API ÉTAPE 8 : TARIFS, TAUX USD/FC, FACTURATION MULTI-PRESTATIONS & RAPPORTS ---
  // Tarifs & Prestations
  app.get('/api/tarifs', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR', 'LABORATOIRE', 'DIRECTEUR']), billingCtrl.getTarifs);
  app.post('/api/tarifs', requireAuth, requireRole(['ADMINISTRATEUR']), billingCtrl.createTarif);
  app.put('/api/tarifs/:id', requireAuth, requireRole(['ADMINISTRATEUR']), billingCtrl.updateTarif);
  app.patch('/api/tarifs/:id/toggle-actif', requireAuth, requireRole(['ADMINISTRATEUR']), billingCtrl.toggleTarifActif);

  // Taux de change 1 USD = X FC (accessible sous /api/billing/exchange-rate et /api/settings/exchange-rate)
  app.get('/api/billing/exchange-rate', requireAuth, billingCtrl.getExchangeRate);
  app.get('/api/settings/exchange-rate', requireAuth, billingCtrl.getExchangeRate);
  app.put('/api/billing/exchange-rate', requireAuth, requireRole(['ADMINISTRATEUR']), billingCtrl.updateExchangeRate);
  app.put('/api/settings/exchange-rate', requireAuth, requireRole(['ADMINISTRATEUR']), billingCtrl.updateExchangeRate);

  // Factures & Règlements
  app.get('/api/factures', requireAuth, requirePermission('factures:voir'), billingCtrl.getFactures);
  app.get('/api/factures/:id', requireAuth, requirePermission('factures:voir'), billingCtrl.getFactureById);
  app.post('/api/factures', requireAuth, requirePermission('factures:ajouter'), billingCtrl.createFacture);
  app.post('/api/factures/:id/paiements', requireAuth, requirePermission('paiements:ajouter'), billingCtrl.recordPaiement);

  // Rapports comptables et de caisse (par défaut en FC, consultable en USD)
  // Strictement restreint aux utilisateurs autorisés (permission 'rapports_financiers:voir')
  // Le médecin ne voit pas la caisse ni les rapports financiers
  app.get('/api/billing/reports', requireAuth, requirePermission('rapports_financiers:voir'), billingCtrl.getBillingReports);

  // Statut de paiement d'une visite pour Médecin et Laboratoire
  app.get('/api/visites/:visite_id/payment-status', requireAuth, requireRole(['MÉDECIN', 'LABORATOIRE', 'RÉCEPTION', 'ADMINISTRATEUR']), billingCtrl.getVisitePaymentStatus);

  // Encaissement des examens de laboratoire par la Réception (agissant comme Caisse)
  app.get('/api/billing/lab-orders-to-collect', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR', 'MÉDECIN']), billingCtrl.getLabOrdersToCollect);
  app.post('/api/billing/lab-orders/:id/collect', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), billingCtrl.collectLabOrderPayment);
  app.post('/api/billing/lab-orders-to-collect/:id/pay', requireAuth, requireRole(['RÉCEPTION', 'ADMINISTRATEUR']), billingCtrl.collectLabOrderPayment);

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

  // --- ROUTES API PHASE 2C-1 & ÉTAPE 6 : PRESCRIPTIONS MÉDICALES & WORKFLOW IMPRESSION ---
  app.post('/api/medical/prescriptions', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.createPrescription);
  app.get('/api/medical/prescriptions/:id', requireAuth, requireRole(['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR']), medicalCtrl.getPrescriptionById);
  app.get('/api/reception/prescriptions', requireAuth, requireRole(['RÉCEPTION', 'MÉDECIN', 'ADMINISTRATEUR']), medicalCtrl.getPrescriptionsForReception);
  app.get('/api/medical/consultations/:id/prescriptions', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getPrescriptionsByConsultation);
  app.patch('/api/medical/prescriptions/:id', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.updatePrescription);
  app.post('/api/medical/prescriptions/:id/finalize', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.finalizePrescription);
  app.post('/api/medical/prescriptions/:id/validate', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.validatePrescriptionWorkflow);
  app.post('/api/medical/prescriptions/:id/print', requireAuth, requireRole(['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR']), medicalCtrl.printPrescriptionWorkflow);
  app.post('/api/medical/prescriptions/:id/deliver', requireAuth, requireRole(['MÉDECIN', 'RÉCEPTION', 'ADMINISTRATEUR']), medicalCtrl.deliverPrescriptionWorkflow);

  // --- ROUTES API PHASE 2C-2 : DEMANDES D'ANALYSES DE LABORATOIRE ---
  app.post('/api/medical/lab-orders', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.createLabOrder);
  app.get('/api/medical/lab-orders/:id', requireAuth, requireRole(['MÉDECIN', 'LABORATOIRE']), medicalCtrl.getLabOrderById);
  app.get('/api/medical/consultations/:id/lab-orders', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.getLabOrdersByConsultation);
  app.patch('/api/medical/lab-orders/:id', requireAuth, requireRole(['MÉDECIN']), medicalCtrl.updateLabOrder);

  // --- ROUTES API PHASE 2C-3 : ATTRIBUTION & FILE DE TRAVAIL LABORATOIRE ---
  app.get('/api/laborantins', requireAuth, requireRole(['MÉDECIN', 'LABORATOIRE', 'ADMINISTRATEUR']), medicalCtrl.getActiveLaborantins);
  app.get('/api/laboratory/queue', requireAuth, requireRole(['LABORATOIRE', 'MÉDECIN', 'ADMINISTRATEUR']), medicalCtrl.getLaboratoryQueue);
  app.post('/api/laboratory/orders/:id/claim', requireAuth, requireRole(['LABORATOIRE']), medicalCtrl.claimLabOrder);
  app.patch('/api/laboratory/orders/:id/assign', requireAuth, requireRole(['MÉDECIN', 'LABORATOIRE', 'ADMINISTRATEUR']), medicalCtrl.assignLabOrder);

  // --- ROUTES API PHASE 2C-4 : RÉSULTATS, VALIDATION, NOTIFICATIONS & AMENDEMENTS ---
  app.post('/api/laboratory/orders/:id/prelevement', requireAuth, requireRole(['LABORATOIRE']), medicalCtrl.recordLabPrelevement);
  app.post('/api/laboratory/orders/:id/results', requireAuth, requireRole(['LABORATOIRE']), medicalCtrl.saveLabResults);
  app.post('/api/laboratory/orders/:id/validate', requireAuth, requireRole(['LABORATOIRE']), medicalCtrl.validateLabResults);
  app.post('/api/laboratory/orders/:id/amend', requireAuth, requireRole(['LABORATOIRE']), medicalCtrl.amendLabResults);
  app.get('/api/medical/lab-orders/:id/bulletin', requireAuth, requireRole(['MÉDECIN', 'LABORATOIRE', 'ADMINISTRATEUR']), medicalCtrl.getLabBulletin);

  // --- NOTIFICATIONS SYSTÈME ---
  app.get('/api/notifications', requireAuth, medicalCtrl.getUserNotifications);
  app.patch('/api/notifications/:id/read', requireAuth, medicalCtrl.markNotificationRead);
  app.patch('/api/notifications/read-all', requireAuth, medicalCtrl.markAllNotificationsRead);
  app.post('/api/notifications/read-all', requireAuth, medicalCtrl.markAllNotificationsRead);

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

  // --- PROTECTION ABSOLUE DES ROUTES API : Réponse JSON 404 stricte (évite de renvoyer l'index.html de Vite) ---
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.originalUrl}` });
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
