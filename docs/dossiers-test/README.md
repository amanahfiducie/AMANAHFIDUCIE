# Dossiers de test — 3 premiers services SOFIGEPAM

Jeux de données fictives pour tester l'enregistrement, la reprise d'onboarding et la soumission des dossiers.

| Service | Fichier | Type API (`case_type`) |
|---------|---------|------------------------|
| 1. Gestion fiduciaire du patrimoine | [mandat-fiduciaire.md](./mandat-fiduciaire.md) | `MANDAT_FIDUCIAIRE` |
| 2. Sécurisation des héritages des mineurs | [tutelle-cantonnement.md](./tutelle-cantonnement.md) | `TUTELLE_CANTONNEMENT` |
| 3. Conseil successoral islamique | [conseil-successoral.md](./conseil-successoral.md) | `SUCCESSION` |

Chaque fichier contient :

- **Actions par rôle** — ce que chaque profil peut faire sur ce type de dossier.
- **Dossier complet** — toutes les étapes obligatoires renseignées, prêt pour soumission (`can_submit: true`).
- **Dossier incomplet** — structure présente dans le dossier, champs manquants marqués `[À COMPLÉTER]`, certaines étapes reportées (`skipped`) pour tester la reprise.

## Référence transversale

- [Actions par rôle (matrice complète)](./actions-par-role.md) — permissions API, validations, portails, farāʾiḍ.

## Convention

- Les montants sont en **XOF**.
- Les dates au format **AAAA-MM-JJ**.
- Les champs `[À COMPLÉTER]` doivent être remplis au fur et à mesure des tests.
- Les pièces jointes sont listées par catégorie document ; les fichiers PDF réels peuvent être ajoutés dans le dossier applicatif lors des tests manuels.
