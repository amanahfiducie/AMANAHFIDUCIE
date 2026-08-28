# Architecture

Résumé aligné avec le document maître SOFIGEPAM Connect.

- **API-first** : le backend Django REST (`apps/api`) porte permissions, workflows, validations et audit. Les fronts consomment la même surface `/api/v1/…`.
- **Stockage objet** : MinIO en local (`infra/docker-compose.yml`), équivalent S3 en production (`django-storages` à brancher aux étapes documents).
- **Données** : PostgreSQL ; cache / files Celery à brancher avec Redis lorsque Celery sera activé.
- **Contrats** : OpenAPI via `drf-spectacular` (à activer après montée en charge du socle DRF).

Apps Django en place : `accounts`, `cases`, `mandates`, `beneficiaries`, `assets`, `documents`, `finance`, `validations`, `reports`, `notifications`, `auditlog`, `portals`. Prochaines apps : `waqf`, `zakat`, `faraid`. Erreurs API normalisées via `config.exceptions.api_exception_handler`.
