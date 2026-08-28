# Rôles et périmètres

Rôles internes prévus :

- SUPER_ADMIN  
- DIRECTION  
- AGENT_FIDUCIAIRE  
- JURIDIQUE_CONFORMITE  
- COMPTABLE_FIDUCIAIRE  
- COMITE_CHARAIQUE  
- AUDITEUR  

Parties externes :

- FAMILLE, TUTEUR, NOTAIRE, JURIDICTION, PARTENAIRE, INSTITUTION  

**Règle** : toute exposition de données dossier passe par une vérification backend (rôle + rattachement au dossier + statut dossier). Les portails famille / notaire / juge n’affichent que le périmètre autorisé.

Implémentation : modèles et permissions détaillés dans les étapes « Auth et utilisateurs » puis « Portail externe » du prompt maître.
