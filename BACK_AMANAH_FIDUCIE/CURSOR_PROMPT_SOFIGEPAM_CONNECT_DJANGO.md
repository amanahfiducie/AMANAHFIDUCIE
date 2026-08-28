# CURSOR MASTER PROMPT — SOFIGEPAM Connect
## Stack finale : Django REST API + Next.js Web + React Native Mobile

## 1. Rôle de Cursor

Tu es Cursor, assistant de développement chargé de construire progressivement SOFIGEPAM Connect, la plateforme numérique d’AMANAH FIDUCIE / SOFIGEPAM.

Tu dois travailler étape par étape, sans tout coder d’un coup. À chaque étape :
1. lis ce fichier ;
2. comprends le périmètre de l’étape ;
3. propose brièvement ton plan ;
4. implémente uniquement l’étape demandée ;
5. vérifie la cohérence entre backend Django, frontend web Next.js et futur mobile React Native ;
6. mets à jour API, types, routes, documentation et tests ;
7. termine par un résumé clair des fichiers créés/modifiés et de la prochaine étape.

Principe central : API-first. Le backend Django REST API est la source de vérité. Le web et le mobile consomment les mêmes API, permissions, statuts, workflows et règles métier.

---

## 2. Vision produit

SOFIGEPAM Connect est une plateforme de gestion fiduciaire, patrimoniale, documentaire et charaïque.

Elle doit gérer :
- dossiers fiduciaires ;
- mandats judiciaires, notariaux, familiaux ou contractuels ;
- bénéficiaires, mineurs, héritiers et ayants droit ;
- tuteurs et représentants légaux ;
- patrimoines confiés ;
- actifs : immobilier, foncier, liquidités, commerce, or, parts sociales, agriculture, élevage, waqf ;
- comptes fiduciaires séparés ;
- recettes et dépenses ;
- pièces justificatives ;
- validations juridiques, comptables, hiérarchiques et charaïques ;
- rapports de gestion, rapports d’impact et rapports charaïques ;
- notifications et journaux d’audit ;
- futurs modules : zakat, farā’iḍ, waqf, reporting avancé, application mobile.

Objectif : plateforme sécurisée, fluide, sérieuse, auditable et évolutive.

---

## 3. Stack technique finale

### Backend
- Python 3.12+
- Django 5+
- Django REST Framework
- PostgreSQL
- Redis
- Celery
- django-filter
- drf-spectacular pour OpenAPI / Swagger
- django-storages pour S3 / MinIO
- MinIO en local, S3-compatible en production
- Simple JWT au MVP, puis Keycloak / OIDC en phase avancée si nécessaire
- django-guardian ou permissions objet personnalisées
- pytest + pytest-django
- ruff / black / isort
- Docker Compose

API versionnée : `/api/v1/...`

Le backend gère : logique métier, permissions, workflows, validations, sécurité, audit, reporting, documents, séparation des patrimoines, contrôles d’accès par utilisateur et dossier.

### Web
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- Client API généré depuis OpenAPI

Le web sert à l’interface interne et aux portails familles/tuteurs, notaires et juges.

### Mobile futur
- React Native
- Expo
- TypeScript
- même API Django REST
- même authentification
- même client API généré depuis OpenAPI si possible

Le mobile V1 servira surtout à consulter les dossiers, consulter les rapports, recevoir les notifications, déposer des pièces et suivre l’état d’un dossier. Ne pas mettre les validations sensibles sur mobile au début.

---

## 4. Architecture du dépôt

Créer un monorepo :

```txt
sofigepam-connect/
  apps/
    api/        # Django REST API
    web/        # Next.js
    mobile/     # React Native / Expo
  packages/
    api-client/
    shared-types/
    ui/
  infra/
    docker-compose.yml
    postgres/
    redis/
    minio/
    keycloak/
  docs/
    architecture.md
    roles-permissions.md
    workflows.md
    api.md
    security.md
    mobile-roadmap.md
    reporting.md
  README.md
```

Ne jamais dupliquer la logique métier dans les frontends. Les frontends affichent et soumettent. Le backend décide, valide et journalise.

---

## 5. Principes métier obligatoires

### Dossier fiduciaire
Chaque prise en charge commence par un dossier fiduciaire lié à bénéficiaires, tuteurs, mandat, actifs, comptes, documents, mouvements, validations et rapports.

### Séparation des patrimoines
Aucun patrimoine confié ne doit être mélangé avec un autre dossier ou les fonds propres de la société. Chaque dossier possède ses propres actifs, comptes, mouvements, justificatifs, validations et rapports.

### Traçabilité totale
Créer un audit log pour : connexion, création/modification dossier, changement de statut, ajout document, téléchargement, mouvement financier, validation, rejet, rapport, partage, consultation sensible, clôture.

### Validation multicouche
Certaines opérations passent par validation juridique, comptable, direction, charaïque ou audit : sortie de fonds, placement, arbitrage d’actif, vente, contrat, création de waqf, clôture, rapport final, opération à risque.

### API-first et mobile-ready
Toutes les API doivent prévoir pagination, filtres, recherche, tri, erreurs JSON normalisées, permissions strictes, DTO stables et versionnement `/api/v1`.

---

## 6. Rôles utilisateurs

Créer les rôles :
```txt
SUPER_ADMIN
DIRECTION
AGENT_FIDUCIAIRE
JURIDIQUE_CONFORMITE
COMPTABLE_FIDUCIAIRE
COMITE_CHARAIQUE
AUDITEUR
FAMILLE_TUTEUR
NOTAIRE
JUGE
```

Types de partie externe :
```txt
FAMILLE
TUTEUR
NOTAIRE
JURIDICTION
PARTENAIRE
INSTITUTION
```

---

## 7. Fonctionnalités par utilisateur

### SUPER_ADMIN
Fonctions : gérer utilisateurs, rôles, permissions, paramètres système, logs, référentiels, activation/désactivation comptes.
Pages : `/admin/users`, `/admin/roles`, `/admin/settings`, `/admin/audit-logs`.

### DIRECTION
Fonctions : dashboard global, dossiers actifs, alertes, validations importantes, rapports, risques, impact social, performance.
Pages : `/dashboard`, `/direction/overview`, `/direction/approvals`, `/direction/reports`, `/direction/impact`, `/direction/risks`.

### AGENT_FIDUCIAIRE
Fonctions : créer dossier, enregistrer mandat, ajouter bénéficiaire/tuteur, inventorier actifs, ajouter documents, notes, soumettre validation, préparer clôture.
Pages : `/dossiers`, `/dossiers/new`, `/dossiers/[id]`, `/dossiers/[id]/mandat`, `/dossiers/[id]/beneficiaires`, `/dossiers/[id]/patrimoine`, `/dossiers/[id]/documents`, `/dossiers/[id]/validations`, `/dossiers/[id]/timeline`.

### JURIDIQUE_CONFORMITE
Fonctions : vérifier mandats, documents, contrats, valider ouverture dossier, demander pièces, bloquer dossier risqué.
Pages : `/juridique/queue`, `/juridique/dossiers/[id]`, `/juridique/validations`, `/juridique/risks`.

### COMPTABLE_FIDUCIAIRE
Fonctions : créer comptes fiduciaires, enregistrer recettes/dépenses, rattacher justificatifs, suivre soldes, rapprocher, préparer rapports financiers.
Pages : `/finance/comptes`, `/finance/mouvements`, `/finance/rapprochements`, `/dossiers/[id]/finance`, `/finance/reports`.

### COMITE_CHARAIQUE
Fonctions : consulter opérations soumises, vérifier licéité, valider/rejeter placements, émettre avis, demander correction, rapport charaïque.
Pages : `/charia/queue`, `/charia/avis`, `/charia/dossiers/[id]`, `/charia/reports`.

### AUDITEUR
Fonctions : consulter dossiers autorisés, logs, historique, justificatifs, exports d’audit.
Pages : `/audit`, `/audit/logs`, `/audit/dossiers`, `/audit/exports`.

### FAMILLE_TUTEUR
Fonctions : consulter ses dossiers, résumé patrimonial, rapports, documents partagés, notifications, dépôt de pièces, demandes.
Pages : `/portal`, `/portal/dossiers`, `/portal/dossiers/[id]`, `/portal/rapports`, `/portal/documents`, `/portal/messages`, `/portal/notifications`.
Mobile V1 : `LoginScreen`, `HomeScreen`, `CasesScreen`, `CaseDetailScreen`, `ReportsScreen`, `DocumentsScreen`, `NotificationsScreen`, `ProfileScreen`.

### NOTAIRE
Fonctions : consulter dossiers rattachés, mandat, inventaire, rapports, demander complément, partager documents.
Pages : `/notaire/dossiers`, `/notaire/dossiers/[id]`, `/notaire/rapports`, `/notaire/documents`.

### JUGE
Fonctions : consulter dossiers de son périmètre, rapports périodiques, inventaire, alertes, demandes de clarification, exports.
Pages : `/juge/dossiers`, `/juge/dossiers/[id]`, `/juge/rapports`, `/juge/alertes`.

---

## 8. Applications Django à créer

Dans `apps/api`, créer :

```txt
config/
common/
accounts/
cases/
mandates/
beneficiaries/
assets/
finance/
documents/
validations/
reports/
notifications/
auditlog/
waqf/
zakat/
faraid/
```

`waqf`, `zakat` et `faraid` peuvent être vides au départ pour préparer la roadmap.

---

## 9. Modèle de données initial

### accounts
- UserProfile
- RoleAssignment
- AccessScope
- ExternalPartyProfile

### cases
- FiduciaryCase
- CaseStakeholder
- CaseTimelineEvent
- CaseNote

Statuts :
```txt
DRAFT
UNDER_REVIEW
LEGAL_REVIEW
COMPLIANCE_REVIEW
ACTIVE
SUSPENDED
CLOSING
CLOSED
REJECTED
```

### mandates
- Mandate
- MandateValidation

Types :
```txt
JUDICIAL
NOTARIAL
FAMILY
CONTRACTUAL
WAQF
OTHER
```

### beneficiaries
- Beneficiary
- Guardian
- FamilyRelation

### assets
- Asset
- AssetValuation
- AssetRisk
- AssetIncome

Types :
```txt
REAL_ESTATE
LAND
BANK_ACCOUNT
CASH
GOLD
BUSINESS
SHARES
AGRICULTURE
LIVESTOCK
WAQF_ASSET
OTHER
```

### finance
- FiduciaryAccount
- FinancialMovement
- MovementCategory
- Reconciliation
- Fee

Types mouvements :
```txt
INCOME
EXPENSE
TRANSFER
MANAGEMENT_FEE
PERFORMANCE_FEE
ADJUSTMENT
```

### documents
- Document
- DocumentVersion
- DocumentAccessLog
- DocumentTag

Catégories :
```txt
IDENTITY
MANDATE
COURT_DECISION
NOTARIAL_ACT
PROPERTY_TITLE
BANK_STATEMENT
INVOICE
RECEIPT
CONTRACT
REPORT
CHARIA_OPINION
OTHER
```

### validations
- ValidationRequest
- ValidationStep
- ValidationDecision
- ValidationComment

Types :
```txt
LEGAL
ACCOUNTING
MANAGEMENT
CHARIA
AUDIT
```

Décisions :
```txt
PENDING
APPROVED
REJECTED
REQUEST_CHANGES
CANCELLED
```

### reports
- ReportTemplate
- Report
- ReportGenerationJob
- ReportApproval

Types rapports :
```txt
QUARTERLY_FAMILY_REPORT
SEMI_ANNUAL_NOTARY_JUDGE_REPORT
ANNUAL_MANAGEMENT_REPORT
CHARIA_COMPLIANCE_REPORT
IMPACT_REPORT
FINAL_CLOSING_REPORT
```

### notifications
- Notification
- NotificationPreference

### auditlog
- AuditLog

Champs minimum AuditLog :
```txt
actor
actor_role
action
entity_type
entity_id
case
ip_address
user_agent
timestamp
metadata_json
```

---

## 10. Endpoints API minimum

### Auth / utilisateur
```txt
GET /api/v1/me/
GET /api/v1/users/
POST /api/v1/users/
PATCH /api/v1/users/{id}/
POST /api/v1/users/{id}/roles/
```

### Dossiers
```txt
GET /api/v1/cases/
POST /api/v1/cases/
GET /api/v1/cases/{id}/
PATCH /api/v1/cases/{id}/
POST /api/v1/cases/{id}/submit/
POST /api/v1/cases/{id}/close/
GET /api/v1/cases/{id}/timeline/
```

### Mandats
```txt
POST /api/v1/cases/{case_id}/mandates/
GET /api/v1/cases/{case_id}/mandates/
PATCH /api/v1/mandates/{id}/
POST /api/v1/mandates/{id}/validate/
```

### Bénéficiaires et tuteurs
```txt
POST /api/v1/cases/{case_id}/beneficiaries/
GET /api/v1/cases/{case_id}/beneficiaries/
PATCH /api/v1/beneficiaries/{id}/
POST /api/v1/cases/{case_id}/guardians/
GET /api/v1/cases/{case_id}/guardians/
PATCH /api/v1/guardians/{id}/
```

### Actifs
```txt
GET /api/v1/cases/{case_id}/assets/
POST /api/v1/cases/{case_id}/assets/
GET /api/v1/assets/{id}/
PATCH /api/v1/assets/{id}/
POST /api/v1/assets/{id}/valuations/
POST /api/v1/assets/{id}/risks/
```

### Finance
```txt
GET /api/v1/cases/{case_id}/accounts/
POST /api/v1/cases/{case_id}/accounts/
GET /api/v1/accounts/{id}/movements/
POST /api/v1/accounts/{id}/movements/
POST /api/v1/movements/{id}/submit-validation/
GET /api/v1/cases/{case_id}/financial-summary/
```

### Documents
```txt
POST /api/v1/documents/upload/
GET /api/v1/documents/{id}/
GET /api/v1/cases/{case_id}/documents/
POST /api/v1/documents/{id}/share/
GET /api/v1/documents/{id}/download-url/
```

### Validations
```txt
POST /api/v1/validations/
GET /api/v1/validations/my-queue/
GET /api/v1/validations/{id}/
POST /api/v1/validations/{id}/approve/
POST /api/v1/validations/{id}/reject/
POST /api/v1/validations/{id}/request-changes/
```

### Rapports
```txt
POST /api/v1/reports/generate/
GET /api/v1/cases/{case_id}/reports/
GET /api/v1/reports/{id}/
POST /api/v1/reports/{id}/approve/
GET /api/v1/reports/{id}/download-url/
```

### Notifications
```txt
GET /api/v1/notifications/
POST /api/v1/notifications/{id}/read/
PATCH /api/v1/notification-preferences/
```

### Audit
```txt
GET /api/v1/audit-logs/
GET /api/v1/cases/{case_id}/audit-logs/
```

---

## 11. Format standard des erreurs API

```json
{
  "timestamp": "2026-01-01T10:00:00Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Le mandat est obligatoire.",
  "path": "/api/v1/cases/",
  "details": [
    {
      "field": "mandate_id",
      "message": "Champ obligatoire"
    }
  ]
}
```

---

## 12. Reporting automatique

Prévoir le module dès la conception.

Workflow :
```txt
Generate draft -> Internal review -> Approval -> Archive -> Share
```

Ne jamais publier automatiquement un rapport sensible sans validation humaine.

Rapports à prévoir :
- trimestriel famille / tuteur ;
- semestriel juge / notaire ;
- annuel de gestion ;
- charaïque ;
- impact ;
- final de clôture.

Outils Python possibles :
- WeasyPrint ;
- ReportLab ;
- openpyxl ;
- pandas ;
- Celery beat.

---

## 13. Sécurité

### Authentification
MVP : JWT avec Simple JWT.  
Phase avancée : Keycloak / OIDC + MFA pour rôles sensibles.

### Autorisation
Toujours vérifier côté backend :
- rôle ;
- périmètre ;
- rattachement au dossier ;
- statut du dossier ;
- action demandée.

Une famille ne voit que ses propres dossiers. Un notaire ne voit que les dossiers rattachés. Un juge ne voit que les dossiers de son périmètre.

### Documents
- stockage MinIO/S3 ;
- URL signée temporaire ;
- journalisation consultation ;
- journalisation téléchargement ;
- aucun accès public direct.

### Suppression
Ne pas supprimer physiquement les données sensibles.
Utiliser :
```txt
soft_delete
deleted_at
deleted_by
```

---

## 14. Roadmap étape par étape

### Étape 0 — Initialisation monorepo
Créer :
```txt
apps/api
apps/web
apps/mobile
packages/api-client
packages/shared-types
infra
docs
```
Créer README, Docker Compose, PostgreSQL, Redis, MinIO, Django minimal, Next minimal, Expo minimal.

Critère : Docker démarre, API démarre, Web démarre, Mobile démarre.

### Étape 1 — Backend Django socle
Créer Django, DRF, PostgreSQL, settings par environnement, drf-spectacular, pytest, health endpoint.
Critère : `GET /api/v1/health/` retourne OK.

### Étape 2 — Auth et utilisateurs
Créer UserProfile, rôles, permissions, JWT, `/api/v1/me/`.
Critère : login possible, rôle récupéré, endpoint protégé.

### Étape 3 — Dossiers fiduciaires
Créer FiduciaryCase, CaseStakeholder, CaseTimelineEvent, CRUD, statuts, audit log.
Critère : créer/lister dossier selon rôle, timeline générée.

### Étape 4 — Mandats, bénéficiaires, tuteurs
Créer Mandate, Beneficiary, Guardian, endpoints, rattachement dossier.
Critère : dossier complet avec mandat, bénéficiaire et tuteur.

### Étape 5 — Patrimoine et actifs
Créer Asset, AssetValuation, AssetRisk, types d’actifs, résumé patrimoine.
Critère : inventaire par dossier.

### Étape 6 — Documents et MinIO
Créer upload, stockage MinIO, métadonnées, URL signée, audit document.
Critère : upload et téléchargement sécurisés.

### Étape 7 — Comptabilité fiduciaire
Créer FiduciaryAccount, FinancialMovement, MovementCategory, solde, résumé financier.
Critère : recettes/dépenses par compte, justificatifs, solde calculé.

### Étape 8 — Workflow de validation
Créer ValidationRequest, ValidationStep, queue par rôle, approve/reject/request changes.
Critère : opération sensible validée/rejetée avec audit.

### Étape 9 — Web interne
Créer layout, dashboard, liste dossiers, création dossier, détail dossier, onglets métier.
Critère : Web consomme API, formulaires validés, loading/error/empty states.

### Étape 10 — Portail externe
Créer portail famille/tuteur, portail notaire, portail juge, consultation limitée.
Critère : accès strict par périmètre, aucune fuite de données.

### Étape 11 — Reporting V1
Créer génération rapport brouillon, validation, archivage, téléchargement.
Critère : rapport PDF généré et accessible aux habilités.

### Étape 12 — Mobile scaffold
Créer Expo, auth, client API, liste dossiers, détail dossier, rapports, notifications.
Critère : mobile se connecte et affiche dossiers autorisés.

### Étape 13 — Modules avancés
Plus tard :
- zakat ;
- farā’iḍ ;
- waqf ;
- impact social ;
- scoring charaïque ;
- signature électronique ;
- messagerie ;
- notifications push ;
- offline mobile limité.

---

## 15. Instructions finales pour Cursor

Commence par l’Étape 0.

Ne passe pas à l’étape suivante sans :
1. vérifier que le projet compile ;
2. vérifier que les tests passent ;
3. mettre à jour les docs ;
4. expliquer les fichiers modifiés ;
5. donner les commandes à lancer.

À chaque API :
- serializer ;
- viewset ;
- permission ;
- test ;
- OpenAPI ;
- audit log si sensible.

À chaque écran web :
- client API ;
- loading ;
- error ;
- empty state ;
- validation formulaire ;
- permissions.

À chaque future fonction mobile :
- même API ;
- pas de logique métier dupliquée ;
- permissions respectées ;
- compatibilité iOS/Android.

---

## 16. Première tâche exacte à exécuter

Créer le squelette :
```txt
sofigepam-connect/
  apps/api
  apps/web
  apps/mobile
  packages/api-client
  packages/shared-types
  infra
  docs
```

Créer :
```txt
README.md
docs/architecture.md
docs/roles-permissions.md
docs/workflows.md
docs/security.md
docs/mobile-roadmap.md
infra/docker-compose.yml
```

Initialiser :
- Django backend minimal dans `apps/api` ;
- Next.js minimal dans `apps/web` ;
- Expo minimal dans `apps/mobile`.

Commandes attendues :
```bash
docker compose up -d
cd apps/api && python manage.py runserver
cd apps/web && npm run dev
cd apps/mobile && npx expo start
```

Fin du master prompt.
“