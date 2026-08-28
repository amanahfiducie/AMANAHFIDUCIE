# Workflows

Principales boucles métier décrites dans le prompt maître :

1. Création d’un dossier fiduciaire (brouillon → revues légales / conformité → actif ou rejet).
2. Rattachement mandat, bénéficiaires, tuteurs, inventaire patrimoine.
3. Mouvements financiers sur comptes séparés par dossier, avec validations multicouche quand nécessaire.
4. Documents : dépôt, versions, traces d’accès, URL signées.
5. Rapports : brouillon → revue → approbation → archivage / partage (aucune diffusion sensible automatique sans validation humaine).

Les transitions de statut et files de validation sont implémentées côté API ; les écrans ne font qu’orchestre utilisateur et affichage d’erreurs JSON normalisées.
