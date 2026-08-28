# Actions par rôle — dossiers fiduciaires

Référence des actions autorisées selon le rôle utilisateur, telle qu'implémentée dans l'API (`apps/api/**/permissions.py`).

> **Règle générale :** un utilisateur **interne** voit tous les dossiers non supprimés. Un utilisateur **externe** ne voit que les dossiers où il est **partie prenante** (`CaseStakeholder`).

---

## Rôles internes SOFIGEPAM

| Rôle | Code API |
|------|----------|
| Super administration | `SUPER_ADMIN` |
| Direction | `DIRECTION` |
| Agent fiduciaire | `AGENT_FIDUCIAIRE` |
| Juridique / conformité | `JURIDIQUE_CONFORMITE` |
| Comptable fiduciaire | `COMPTABLE_FIDUCIAIRE` |
| Comité charaïque | `COMITE_CHARAIQUE` |
| Auditeur | `AUDITEUR` |

## Rôles externes (portails)

| Rôle | Code API | Portail |
|------|----------|---------|
| Famille / tuteur | `FAMILLE_TUTEUR` | `/portal` |
| Notaire | `NOTAIRE` | `/notaire` |
| Juge | `JUGE` | `/juge` |

---

## Matrice des actions — cycle de vie dossier

| Action | SUPER_ADMIN | DIRECTION | AGENT_FIDUCIAIRE | JURIDIQUE | COMPTABLE | COMITE_CHARAIQUE | AUDITEUR | Externe (partie prenante) |
|--------|:-----------:|:---------:|:----------------:|:---------:|:---------:|:----------------:|:--------:|:-------------------------:|
| Consulter un dossier | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (rattaché) |
| Créer un dossier | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modifier / onboarding | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Soumettre (`DRAFT` → `UNDER_REVIEW`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clôturer un dossier | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assigner le chargé de dossier | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gérer bénéficiaires / tuteurs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gérer patrimoine (actifs) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Déposer des documents | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (portail) |
| Télécharger documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (portail, périmètre) |

---

## Validations et revues

### Circuit de soumission dossier (`CASE_REVIEW`)

Ordre des étapes après soumission :

1. **Chargé du dossier** — `AGENT_FIDUCIAIRE` (ou agent assigné au dossier)
2. **Direction** — `DIRECTION`
3. **Comité charaïque** — `COMITE_CHARAIQUE`
4. **Juridique & conformité** — `JURIDIQUE_CONFORMITE`

| Action | Rôles autorisés |
|--------|-----------------|
| Créer une demande de validation | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE, COMPTABLE |
| Décider à son étape (approuver / refuser / demander modifications) | Le rôle assigné à l'étape en cours (+ SUPER_ADMIN) |
| Validation juridique (`LEGAL`) | JURIDIQUE_CONFORMITE |
| Validation comptable (`ACCOUNTING`) | COMPTABLE_FIDUCIAIRE |
| Validation direction (`MANAGEMENT`) | DIRECTION |
| Validation charaïque (`CHARIA`) | COMITE_CHARAIQUE |
| Validation audit (`AUDIT`) | AUDITEUR |

### Mandat

| Action | Rôles autorisés |
|--------|-----------------|
| Créer / modifier un mandat | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE |
| Valider un mandat (approbation juridique) | SUPER_ADMIN, DIRECTION, JURIDIQUE_CONFORMITE |

---

## Finance dossier

| Action | Rôles autorisés |
|--------|-----------------|
| Consulter comptes et mouvements du dossier | Tous les rôles internes + externe rattaché |
| Créer / modifier mouvements financiers | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE, COMPTABLE |
| Lancer validation comptable d'un mouvement | COMPTABLE_FIDUCIAIRE (décision), création par rôles ci-dessus |

---

## Rapports

| Action | Rôles autorisés |
|--------|-----------------|
| Générer un rapport (brouillon) | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE, COMPTABLE |
| Approuver / publier un rapport | SUPER_ADMIN, DIRECTION, JURIDIQUE |
| Télécharger un rapport approuvé | Internes + externe rattaché (si statut `APPROVED` ou `ARCHIVED`) |

---

## Observations et remarques

| Action | Rôles autorisés |
|--------|-----------------|
| Soumettre une observation partagée | JURIDIQUE, JUGE, NOTAIRE, FAMILLE_TUTEUR, externe rattaché |
| Ajouter une remarque interne | DIRECTION, COMITE_CHARAIQUE (+ SUPER_ADMIN) |
| Examiner / retenir / refuser une observation | DIRECTION, COMITE_CHARAIQUE (+ SUPER_ADMIN) |
| Voir les remarques internes | DIRECTION, COMITE_CHARAIQUE (+ SUPER_ADMIN) |

---

## Farāʾiḍ (succession uniquement)

| Action | Rôles autorisés |
|--------|-----------------|
| Saisir héritiers et parts (farāʾiḍ) | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE |
| Soumettre pour revue charaïque | SUPER_ADMIN, DIRECTION, AGENT_FIDUCIAIRE, JURIDIQUE |
| Examiner / valider / finaliser le partage | SUPER_ADMIN, DIRECTION, COMITE_CHARAIQUE |

---

## Audit

| Action | Rôles autorisés |
|--------|-----------------|
| Consulter journal d'audit d'un dossier | SUPER_ADMIN, DIRECTION, AUDITEUR, JURIDIQUE |
| Consulter journal d'audit global | SUPER_ADMIN, DIRECTION, AUDITEUR |

---

## Comptabilité entreprise (hors dossier)

| Action | Rôles autorisés |
|--------|-----------------|
| Consulter CA par service | SUPER_ADMIN, DIRECTION, COMPTABLE |
| Saisir mouvements entreprise | SUPER_ADMIN, COMPTABLE |

---

## Portails externes — périmètre

| Portail | Rôle | Actions typiques |
|---------|------|------------------|
| Famille / tuteur | `FAMILLE_TUTEUR` | Voir dossier, patrimoine synthétique, documents autorisés, déposer pièces, soumettre observations, télécharger rapports approuvés |
| Notaire | `NOTAIRE` | Idem + accès mandats et cadre juridique |
| Juge | `JUGE` | Idem + accès mandats / décisions judiciaires |

Les utilisateurs internes **n'accèdent pas** aux portails externes (et inversement).

---

## Scénarios de test recommandés par rôle

| Rôle | Scénario de test |
|------|------------------|
| `AGENT_FIDUCIAIRE` | Créer dossier incomplet → compléter onboarding → soumettre |
| `DIRECTION` | Valider étape « propriétaire » après soumission ; approuver un rapport |
| `JURIDIQUE_CONFORMITE` | Valider mandat ; décider étape juridique du circuit dossier |
| `COMPTABLE_FIDUCIAIRE` | Enregistrer mouvement sur compte fiduciaire ; validation comptable |
| `COMITE_CHARAIQUE` | Revue charaïque dossier ; revue farāʾiḍ (succession) ; remarque interne |
| `AUDITEUR` | Consulter journal audit ; validation audit |
| `FAMILLE_TUTEUR` | Portail : consulter dossier rattaché, déposer pièce, observation |
| `NOTAIRE` | Portail notaire : consulter mandat / certificat hérédité |
| `JUGE` | Portail juge : consulter décision cantonnement (tutelle) |
