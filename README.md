# AMANAH FIDUCIE · Site web SOFIGEPAM

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-Router_%2B_SSR-ff4154?logo=react&logoColor=white)](https://tanstack.com/start)

Site vitrine **AMANAH FIDUCIE SARL** (**SOFIGEPAM** — *Société Fiduciaire Islamique de Gestion du Patrimoine des Mineurs*) : mandats fiduciaires, sécurisation des héritages des mineurs, conseil successoral islamique, waqf, zakat, conformité charaïque et reporting — au Sénégal, dans un cadre aligné sur le droit et la **Charia**.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Scripts npm](#scripts-npm)
- [Stack technique](#stack-technique)
- [Structure du dépôt](#structure-du-dépôt)
- [Pages & routes](#pages--routes)
- [Déploiement](#déploiement)
- [Qualité de code](#qualité-de-code)

---

## Démarrage rapide

**Prérequis** : Node.js **20+** (LTS recommandé), npm.

```bash
git clone https://github.com/amadyfsy/AMANAHFIDUCIE.git
cd AMANAHFIDUCIE
npm install
npm run dev
```

Le serveur de développement Vite démarre (port **8080** par défaut avec la config Lovable / TanStack). Ouvrez l’URL affichée dans le terminal.

---

## Scripts npm

| Commande        | Rôle |
|-----------------|------|
| `npm run dev`   | Serveur de dev avec HMR |
| `npm run build` | Build production (voir [Déploiement](#déploiement)) |
| `npm run preview` | Prévisualisation du build client |
| `npm run lint`  | ESLint sur le projet |
| `npm run format` | Prettier (écriture sur les fichiers) |

---

## Stack technique

| Couche | Technologies |
|--------|----------------|
| **Framework** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (SSR, file-based routes) |
| **UI** | React 19, [Tailwind CSS](https://tailwindcss.com/) v4, [Radix UI](https://www.radix-ui.com/), [Lucide](https://lucide.dev/) |
| **Build** | [Vite](https://vitejs.dev/) 7, config [@lovable.dev/vite-tanstack-config](https://www.npmjs.com/package/@lovable.dev/vite-tanstack-config) |
| **Edge (optionnel)** | [Cloudflare Workers](https://workers.cloudflare.com/) via `@cloudflare/vite-plugin` + `wrangler` |
| **Hébergement Vercel** | [Nitro](https://nitro.build/) (preset `vercel`) activé **uniquement** quand `VERCEL=1` |

Les alias TypeScript `@/*` pointent vers `src/`.

---

## Structure du dépôt

```
├── src/
│   ├── routes/           # Pages (file-based routing TanStack)
│   ├── components/       # UI site + composants shadcn/ui
│   ├── assets/           # Images, logos
│   ├── styles.css        # Design tokens & Tailwind
│   ├── router.tsx
│   └── routeTree.gen.ts  # Généré au build — ne pas éditer à la main
├── vite.config.ts
├── wrangler.jsonc        # Déploiement Cloudflare Workers
├── vercel.json           # Commandes build Vercel
├── tsconfig.json
└── package.json
```

---

## Pages & routes

| Route | Contenu |
|-------|---------|
| `/` | Accueil |
| `/a-propos` | Mission, valeurs, gouvernance |
| `/services` | Vue d’ensemble des services |
| `/impact` | Impact & indicateurs |
| `/contact` | Formulaire de contact |
| `/service-mandat-fiduciaire` | Gestion fiduciaire du patrimoine |
| `/service-cantonnement-actifs` | Sécurisation des héritages des mineurs |
| `/service-conseil-successoral-islamique` | Conseil successoral islamique |
| `/service-waqf-familial` | Waqf familial & productif |
| `/service-zakat-faraid` | Zakat & structuration |
| `/service-conformite-charaique` | Conformité charaïque |
| `/service-reporting` | Reporting |
| `/service-protection-familiale` | Protection familiale |
| `/comite-charaique` | Comité charaïque |

---

## Déploiement

### Vercel (recommandé pour ce dépôt)

1. [Importer le projet](https://vercel.com/new) depuis GitHub (`amadyfsy/AMANAHFIDUCIE`).
2. Laisser **Install** : `npm install` et **Build** : `npm run build` (déjà dans `vercel.json`).
3. Vercel définit **`VERCEL=1`** pendant le build : le `vite.config.ts` désactive le bundle Cloudflare et active **Nitro** (sortie `.vercel/output/`, compatible Serverless / Fluid Compute).

Aucune variable d’environnement obligatoire pour un site vitrine statique + SSR par défaut.

### Cloudflare Workers (alternatif)

Build **sans** `VERCEL=1` :

```bash
npm run build
npx wrangler deploy
```

Configuration : `wrangler.jsonc` (entrée `@tanstack/react-start/server-entry`). Ne pas committer de secrets (`.dev.vars` est ignoré).

---

## Qualité de code

```bash
npm run lint
```

Avant une PR : build OK + lint propre.

---

## Licence & mentions

Projet **privé** — droits réservés **AMANAH FIDUCIE SARL**.  
Le fichier `Business_Plan_SOFIGEPAM.txt` à la racine sert de référence métier ; il ne constitue pas une offre contractuelle sur ce dépôt.

**Questions** : [Issues GitHub](https://github.com/amadyfsy/AMANAHFIDUCIE/issues) ou l’équipe projet.
