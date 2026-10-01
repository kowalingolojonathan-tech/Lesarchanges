import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiFetch } from '../../lib/api';
import { 
  Users, 
  ShieldAlert, 
  Database, 
  Coins, 
  HeartPulse, 
  CreditCard, 
  Stethoscope, 
  FlaskConical, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

interface RoleDashboardProps {
  onNavigate: (tab: string) => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { user, permissions } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/system/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err));
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      
      {/* Bannière de Bienvenue */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
              Socle V1 — Phase 1 Validée
            </span>
            <span className="text-xs text-slate-400">RDC (USD / CDF)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-2">
            Bienvenue, {user.nom_complet}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Poste opérationnel : <strong className="text-slate-900 font-semibold">{user.role}</strong>. Système de gestion clinique et traçabilité médicale.
          </p>
        </div>

        {user.role === 'ADMINISTRATEUR' && (
          <button
            onClick={() => onNavigate('rbac-tester')}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl hover:bg-emerald-100 text-xs font-bold transition-all shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Vérification Sécurité RBAC</span>
          </button>
        )}
      </div>

      {/* DASHBOARD SPÉCIFIQUE ADMINISTRATEUR */}
      {user.role === 'ADMINISTRATEUR' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase">Utilisateurs V1</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {stats?.stats?.totalUsers || 4}
              </div>
              <p className="text-xs text-slate-500 mt-1">4 rôles opérationnels configurés</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase">Logs d'audit</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {stats?.stats?.totalAuditLogs || 1}
              </div>
              <p className="text-xs text-slate-500 mt-1">Traçabilité immuable active</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase">Base Relationnelle</span>
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-sm font-bold text-slate-900">SQLite 3 (ACID)</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Clés étrangères activées</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase">Devises RDC</span>
                <Coins className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-sm font-bold text-slate-900">USD & CDF</div>
              <p className="text-xs text-slate-500 mt-1">1 USD = 2 850 CDF</p>
            </div>

          </div>

          {/* Règle de sécurité Administrateur */}
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl text-sm text-purple-900 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-purple-950">Séparation stricte : Administration Technique vs Secret Médical</h3>
              <p className="text-xs text-purple-900 mt-1 leading-relaxed">
                Votre profil ADMINISTRATEUR vous permet de créer des comptes, de modifier le statut des agents, d'ajuster les taux de devise et de superviser les journaux d'audit de sécurité. <strong>Cependant, le backend vous refuse l'accès aux notes cliniques privées des médecins</strong> conformément à vos exigences de confidentialité.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD SPÉCIFIQUE RÉCEPTION */}
      {user.role === 'RÉCEPTION' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">1. Dossier Unique Patient</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Recherche par nom, prénom ou téléphone. Règle absolue V1 : <strong>aucun nouveau dossier n'est créé pour un patient déjà enregistré</strong> ; une nouvelle visite est rattachée à son dossier permanent.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">2. Triage & Signes Vitaux</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Saisie des 8 constantes vitales (PAS/PAD séparées, température, pouls, FR, SpO2, poids, taille, douleur). La glycémie est réservée au laboratoire. Calculs automatiques de l'âge, IMC, catégorie OMS et PAM (indicateurs physiologiques).
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">3. Caisse & Encaissements Uniques</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Centralisation de tous les paiements (Consultations, Examens laboratoire, Orientations). Validation du paiement avant autorisation au laboratoire. Reçus générés en USD ou CDF.
              </p>
            </div>

          </div>

          <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl text-sm text-blue-900 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-950">Confidentialité médicale garantie (Backend)</h3>
              <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                Le rôle RÉCEPTION est restreint aux données administratives, de triage et financières. L'API refuse tout accès aux diagnostics médicaux, hypothèses et notes confidentielles du médecin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD SPÉCIFIQUE MÉDECIN */}
      {user.role === 'MÉDECIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">1. Consultation Médicale</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prise en charge du patient après validation du paiement à la réception. Consultation clinique complète : motif, anamnèse, examen physique, diagnostics et notes médicales privées.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">2. Prescriptions & Examens Labo</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Émission d'ordonnances thérapeutiques et prescription d'analyses (NFS, Glycémie, Urines, Selles). Facturation automatique envoyée à la caisse Réception.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <ExternalLink className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">3. Spécialistes Externes</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Orientation vers un confrère externe (fiche de liaison avec degré d'urgence, motif, données cliniques). Intégration du compte-rendu retour dans le dossier permanent.
              </p>
            </div>

          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl text-sm text-emerald-900 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-emerald-950">Accès exclusif aux dossiers médicaux</h3>
              <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                Seul le rôle MÉDECIN dispose des droits de saisie, consultation et modification sur les notes cliniques, diagnostics et prescriptions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD SPÉCIFIQUE LABORATOIRE */}
      {user.role === 'LABORATOIRE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">1. Autorisation après Paiement</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Règle V1 : <strong>Aucune analyse n'est traitée sans paiement préalable validé à la Réception</strong>. Les demandes payées apparaissent automatiquement dans la file paillasse.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">2. Échantillonnage & Tubes</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gestion des types de prélèvement (Sang, Urines, Selles, Autres). Un même tube peut être partagé entre plusieurs analyses compatibles (ex: NFS + Glycémie).
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">3. Saisie & Validation Biologique</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Saisie des valeurs chiffrées, comparaison aux normes de référence. Validation officielle rendant le résultat disponible instantanément dans la consultation du médecin.
              </p>
            </div>

          </div>

          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl text-sm text-amber-900 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-950">Confidentialité médicale respectée</h3>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                Le personnel de laboratoire n'a accès qu'aux renseignements cliniques pertinents pour la réalisation de l'analyse, et ne voit pas les notes intimes ou diagnostics non liés du médecin.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
