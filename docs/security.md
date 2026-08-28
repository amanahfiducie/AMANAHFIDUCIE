# Sécurité

- **Authentification MVP** : **JWT** avec `djangorestframework-simplejwt` dans `apps/api`. Les routes métier utilisent par défaut `IsAuthenticated`. Les endpoints de santé (`/api/v1/health/`), d’obtention de token (`/api/v1/auth/token/`, refresh) et la doc OpenAPI (`/api/v1/schema/…`) restent accessibles sans Bearer.
- **Profils & rôles** : app Django `accounts` — `UserProfile`, `RoleAssignment` (rôles `SUPER_ADMIN`, `AGENT_FIDUCIAIRE`, etc.). La gestion centralisée des comptes (`list` / `create` sur `/api/v1/users/`, `POST …/users/<id>/roles/`) est réservée aux **`SUPER_ADMIN`** (rôle métier) ou aux **superusers** Django.
- **Autorisation** : vérifier systématiquement côté serveur rôle, périmètre dossier et statut dossier (pour les prochaines étapes).
- **Journalisation** : journal d’audit pour les actions critiques (`AuditLog`, à brancher avec les modules dossiers / documents).
- **Documents** : pas d’URLs publiques directes ; téléchargements via URL signées temporaires et logs de consultation.

Données sensibles : éviter suppressions définitives ; prévoir `soft_delete`, `deleted_at`, `deleted_by`.
