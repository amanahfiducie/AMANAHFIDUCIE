# SOFIGEPAM Connect (AMANAH FIDUCIE)

Plateforme numérique en construction : API Django REST, application web Next.js et application mobile Expo, selon [`BACK_AMANAH_FIDUCIE/CURSOR_PROMPT_SOFIGEPAM_CONNECT_DJANGO.md`](BACK_AMANAH_FIDUCIE/CURSOR_PROMPT_SOFIGEPAM_CONNECT_DJANGO.md).

## Arborescence

| Dossier | Rôle |
|--------|------|
| `apps/api` | API Django REST (source de vérité métier) |
| `apps/web` | Interface web Next.js |
| `apps/mobile` | Application mobile Expo (React Native) |
| `packages/api-client` | Client API généré / partagé (à densifier aux prochaines étapes) |
| `packages/shared-types` | Types partagés web / mobile (à densifier aux prochaines étapes) |
| `infra` | PostgreSQL, Redis, MinIO (développement) |
| `docs` | Notes d’architecture et de sécurité |

Le site marketing existant (`WEB_PUBLIC_AMANAH_FIDUCIE ` avec espace dans le nom) reste à part ; cette zone `apps/*` correspond au périmètre « SOFIGEPAM Connect » du document maître.

## Prérequis

- Python 3.12+
- Docker + Docker Compose
- Node.js 20+ et npm

## Démarrer l’infra locale

À la racine du dépôt :

```bash
npm install
docker compose -f infra/docker-compose.yml up -d
```

Si **PostgreSQL ne démarre pas** (« address already in use » sur **5432**), créez **`infra/.env`** à partir de **`infra/.env.example`**, posez **`POSTGRES_PORT=5433`** dedans et relancez avec :

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

Mettez le **même** `POSTGRES_PORT` dans **`apps/api/.env`**.

Sur macOS, si `docker` est introuvable, ajoutez au `PATH` : `/Applications/Docker.app/Contents/Resources/bin`.

Pour tester l’API sans Docker : dans `apps/api/.env`, posez `USE_SQLITE=1` pour des migrations locales sur SQLite.

## API Django (`apps/api`)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # puis ajuster si besoin
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Santé (critère Étape 1 du document maître) : [http://127.0.0.1:8000/api/v1/health/](http://127.0.0.1:8000/api/v1/health/)

Schéma OpenAPI : [http://127.0.0.1:8000/api/v1/schema/swagger/](http://127.0.0.1:8000/api/v1/schema/swagger/)

## Web Next.js (`apps/web`)

```bash
npm run dev --workspace apps/web
```

## Mobile Expo (`apps/mobile`)

Le monorepo npm (`package.json` racine) regroupe `apps/web`, `apps/mobile` et `packages/*` : un seul `package-lock.json` à la racine.

```bash
cd apps/mobile
npx expo start
```

## Déploiement production

### Backend — Render (API Django + Postgres)

Services : `amanah-api` + `amanah-db`.

- API : https://amanah-api-9prx.onrender.com  
- Santé : https://amanah-api-9prx.onrender.com/api/v1/health/

Après le déploiement du front Vercel, sur **amanah-api** → Environment :

- `CORS_ALLOWED_ORIGINS` = URL Vercel (sans slash final)
- `CSRF_TRUSTED_ORIGINS` = même URL
- SMTP pour l’OTP (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`)

### Frontend — Vercel (Next.js uniquement)

Fichier [`vercel.json`](vercel.json) à la racine.

1. [vercel.com/new](https://vercel.com/new) → importer **amanahfiducie/AMANAHFIDUCIE**
2. Framework : Next.js (détecté)
3. Variable d’environnement :
   - `NEXT_PUBLIC_API_URL` = `https://amanah-api-9prx.onrender.com`
4. Deploy

## Prochaines étapes

Suivre la roadmap étape par étape dans `BACK_AMANAH_FIDUCIE/CURSOR_PROMPT_SOFIGEPAM_CONNECT_DJANGO.md` (Étape 3 : dossiers fiduciaires, etc.).

### Authentification JWT (Étape 2)

1. Obtenir les tokens (réponse inclut un bloc `user` avec `roles`) :

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"<user>","password":"<pass>"}'
```

2. Appeler une route protégée :

```bash
curl -s http://127.0.0.1:8000/api/v1/me/ \
  -H "Authorization: Bearer <access>"
```

Modèles métier : profils et rôles dans l’app Django `accounts` (`UserProfile`, `RoleAssignment`, …). Un compte avec le rôle `SUPER_ADMIN` (ou un superuser Django) peut lister et créer des utilisateurs via `GET/POST /api/v1/users/`.

### Dossiers fiduciaires (Étape 3)

Endpoints (JWT requis) :

- `GET/POST /api/v1/cases/`
- `GET/PATCH /api/v1/cases/{id}/`
- `POST /api/v1/cases/{id}/submit/` — brouillon → en revue
- `POST /api/v1/cases/{id}/close/` — clôture
- `GET /api/v1/cases/{id}/timeline/`

Création réservée aux rôles internes (`AGENT_FIDUCIAIRE`, `DIRECTION`, `SUPER_ADMIN`). Les comptes externes (`FAMILLE_TUTEUR`, etc.) ne voient que les dossiers où ils sont parties prenantes.

### Mandats, bénéficiaires, tuteurs (Étape 4)

| Méthode | Route |
|--------|--------|
| `GET/POST` | `/api/v1/cases/{case_id}/mandates/` |
| `PATCH` | `/api/v1/mandates/{id}/` |
| `POST` | `/api/v1/mandates/{id}/validate/` — `JURIDIQUE_CONFORMITE`, `DIRECTION`, `SUPER_ADMIN` |
| `GET/POST` | `/api/v1/cases/{case_id}/beneficiaries/` |
| `PATCH` | `/api/v1/beneficiaries/{id}/` |
| `GET/POST` | `/api/v1/cases/{case_id}/guardians/` |
| `PATCH` | `/api/v1/guardians/{id}/` |

Le détail d’un dossier (`GET /api/v1/cases/{id}/`) inclut désormais `mandates`, `beneficiaries` et `guardians`.

### Patrimoine & actifs (Étape 5)

| Méthode | Route |
|--------|--------|
| `GET/POST` | `/api/v1/cases/{case_id}/assets/` |
| `GET` | `/api/v1/cases/{case_id}/patrimony-summary/` |
| `GET/PATCH` | `/api/v1/assets/{id}/` |
| `POST` | `/api/v1/assets/{id}/valuations/` |
| `POST` | `/api/v1/assets/{id}/risks/` |

Types d’actifs : immobilier, foncier, liquidités, or, parts sociales, agriculture, waqf, etc.

### Documents & MinIO (Étape 6)

| Méthode | Route |
|--------|--------|
| `POST` | `/api/v1/documents/upload/` — multipart (`case_id`, `category`, `title`, `file`) |
| `GET` | `/api/v1/cases/{case_id}/documents/` |
| `GET` | `/api/v1/documents/{id}/` |
| `GET` | `/api/v1/documents/{id}/download-url/` — URL signée (MinIO ou token local) |
| `POST` | `/api/v1/documents/{id}/share/` |

Dans `apps/api/.env` : `USE_S3=0` pour stockage local (`media/`), `USE_S3=1` + MinIO (`docker compose`) pour S3. Créer le bucket `sofigepam-documents` dans MinIO si besoin.
