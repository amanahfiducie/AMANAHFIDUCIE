# Service 1 — Mandat fiduciaire (`MANDAT_FIDUCIAIRE`)

**Libellé métier :** Gestion fiduciaire du patrimoine  
**Description :** Mandat de gestion patrimoniale judiciaire, notarial, familial ou contractuel.

## Étapes d'enregistrement

1. Identification  
2. Donateur  
3. Personnes de confiance  
4. Mandat  
5. Bénéficiaires *(facultatif)*  
6. Patrimoine initial  
7. Pièces justificatives *(facultatif)*  
8. Synthèse & soumission  

---

## Actions par rôle sur ce type de dossier

> Matrice complète : [actions-par-role.md](./actions-par-role.md)

### Rôles internes

| Rôle | Actions principales sur un mandat fiduciaire |
|------|----------------------------------------------|
| **AGENT_FIDUCIAIRE** | Créer le dossier, enregistrer donateur / mandat / patrimoine, compléter ou reporter l'onboarding, soumettre pour revue, gérer les mouvements financiers, générer des rapports brouillon, décider l'étape « chargé du dossier » après soumission |
| **DIRECTION** | Consulter et modifier le dossier, valider l'étape « propriétaire du dossier », approuver les rapports, valider les mandats, ajouter des remarques internes, assigner le chargé de dossier |
| **JURIDIQUE_CONFORMITE** | Modifier le dossier, valider le mandat familial / contractuel, décider l'étape « juridique & conformité », approuver les rapports |
| **COMPTABLE_FIDUCIAIRE** | Consulter le dossier, enregistrer mouvements sur le compte fiduciaire du mandat, lancer / décider validations comptables, générer rapports financiers |
| **COMITE_CHARAIQUE** | Consulter le dossier, décider l'étape « comité charaïque » du circuit de revue, ajouter remarques internes, examiner observations |
| **AUDITEUR** | Lecture seule du dossier + journal d'audit, décider validations de type audit |
| **SUPER_ADMIN** | Toutes les actions ci-dessus + gestion utilisateurs |

### Rôles externes (partie prenante du dossier)

| Rôle | Actions principales |
|------|---------------------|
| **FAMILLE_TUTEUR** (famille) | Portail : consulter le mandat et le patrimoine (synthèse), télécharger rapports approuvés, déposer pièces (CNI, relevés), soumettre une observation à la direction |
| **NOTAIRE** | Portail notaire : consulter mandat et documents juridiques, déposer acte notarié, soumettre observation |
| **TUTEUR** (sous-type `FAMILLE_TUTEUR`) | Idem famille ; pertinent si un bénéficiaire mineur est rattaché au mandat |

### Scénarios de test par profil

| Profil | Dossier | Action à tester |
|--------|---------|-----------------|
| Agent fiduciaire | `MF-TEST-INCOMPLET` | Reprendre onboarding, compléter mandat, soumettre |
| Agent fiduciaire | `MF-TEST-COMPLET` | Soumettre directement → déclencher circuit `CASE_REVIEW` |
| Direction | `MF-TEST-COMPLET` (soumis) | Approuver étape « propriétaire du dossier » |
| Juridique | `MF-TEST-COMPLET` | Valider le mandat familial (`MF-DK-2025-0142`) |
| Comptable | `MF-TEST-COMPLET` (actif) | Saisir loyer Mermoz + frais de gestion sur compte fiduciaire |
| Famille (Aminata Diop) | `MF-TEST-COMPLET` | Portail : consulter patrimoine, déposer relevé bancaire |
| Comité charaïque | `MF-TEST-COMPLET` (soumis) | Valider étape charaïque ; ajouter remarque interne |

---

## Dossier complet — `MF-TEST-COMPLET`

> Statut cible : `DRAFT` → soumission possible → `UNDER_REVIEW`

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Mandat familial — patrimoine Diop |
| `case_type` | `MANDAT_FIDUCIAIRE` |
| `case_origin` | `FAMILY_REQUEST` |
| `description` | Gestion fiduciaire d'un patrimoine mixte (immobilier locatif + liquidités) pour le compte de M. Ibrahima Diop, à la demande de la famille. |
| `status` | `DRAFT` |

### Donateur

| Champ | Valeur |
|-------|--------|
| `first_name` | Ibrahima |
| `last_name` | Diop |
| `date_of_birth` | 1962-04-15 |
| `nationality` | SN |
| `identification_number` | 1 962 0415 00042 |
| `email` | ibrahima.diop@example.sn |
| `phone` | +221 77 123 45 67 |
| `address` | Villa 12, Cité Keur Gorgui, Dakar |
| `notes` | Donateur majeur, en pleine capacité. Mandat familial signé devant notaire. |

### Personnes de confiance

| Champ | Valeur |
|-------|--------|
| `first_name` | Aminata |
| `last_name` | Diop |
| `phone` | +221 78 234 56 78 |
| `email` | aminata.diop@example.sn |
| `relationship_label` | Épouse |

| Champ | Valeur |
|-------|--------|
| `first_name` | Cheikh |
| `last_name` | Ndiaye |
| `phone` | +221 76 345 67 89 |
| `email` | cheikh.ndiaye@example.sn |
| `relationship_label` | Notaire de famille |

### Mandat

| Champ | Valeur |
|-------|--------|
| `mandate_type` | `FAMILY` |
| `title` | Mandat de gestion patrimoniale familiale |
| `reference_number` | MF-DK-2025-0142 |
| `issuing_authority` | Étude Ndiaye & Associés, Dakar |
| `signed_at` | 2025-11-20 |
| `effective_from` | 2025-12-01 |
| `effective_to` | *(vide — mandat à durée indéterminée)* |
| `notes` | Périmètre : gestion locative, placement prudentiel, reporting trimestriel à la famille. |
| Document joint | `MANDATE` — mandat-familial-diop.pdf |

### Bénéficiaires *(facultatif — renseigné)*

| Prénom | Nom | Lien | Mineur | Part patrimoine |
|--------|-----|------|--------|-----------------|
| Aminata | Diop | `SPOUSE` | Non | 25 % |
| Moussa | Diop | `CHILD` | Non | 37,5 % |
| Fatou | Diop | `CHILD` | Oui | 37,5 % |

**Tuteur de Fatou Diop (mineure)**

| Champ | Valeur |
|-------|--------|
| `first_name` | Aminata |
| `last_name` | Diop |
| `phone` | +221 78 234 56 78 |
| `relationship_label` | Mère |

### Patrimoine initial

| Type | Libellé | Localisation | Valeur estimée (XOF) | Fréquence réévaluation |
|------|---------|--------------|----------------------|------------------------|
| `REAL_ESTATE` | Immeuble R+2 — Mermoz | Dakar, Mermoz | 185 000 000 | `ANNUAL` |
| `BANK_ACCOUNT` | Compte courant BIS | Dakar | 42 500 000 | `QUARTERLY` |
| `CASH` | Liquidités de gestion | Dakar | 8 000 000 | `QUARTERLY` |

**Total patrimoine brut estimé :** 235 500 000 XOF

### Pièces justificatives

| Catégorie | Fichier |
|-----------|---------|
| `IDENTITY` | cni-ibrahima-diop.pdf |
| `MANDATE` | mandat-familial-diop.pdf |
| `PROPERTY_TITLE` | titre-mermoz-immeuble.pdf |
| `BANK_STATEMENT` | releve-bis-dec2025.pdf |

### Progression onboarding

| Étape | Statut |
|-------|--------|
| identification | `completed` |
| donor | `completed` |
| donor_trusted | `completed` |
| mandate | `completed` |
| beneficiaries | `completed` |
| patrimoine | `completed` |
| documents | `completed` |
| review | `completed` |

**`can_submit` :** `true`  
**`pending_tasks` :** aucune

---

## Dossier incomplet — `MF-TEST-INCOMPLET`

> Statut cible : `DRAFT` — reprise d'enregistrement, soumission possible avec tâches en attente

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Mandat fiduciaire — famille Sow |
| `case_type` | `MANDAT_FIDUCIAIRE` |
| `case_origin` | `DIRECT_CONTACT` |
| `description` | [À COMPLÉTER] — préciser le contexte et l'objectif du mandat |
| `status` | `DRAFT` |

### Donateur

| Champ | Valeur |
|-------|--------|
| `first_name` | Ousmane |
| `last_name` | Sow |
| `date_of_birth` | [À COMPLÉTER] |
| `nationality` | SN |
| `identification_number` | [À COMPLÉTER] |
| `email` | [À COMPLÉTER] |
| `phone` | +221 77 000 00 01 |
| `address` | [À COMPLÉTER] |
| `notes` | Contact initial par téléphone — pièce d'identité non encore transmise |

### Personnes de confiance

| Champ | Valeur |
|-------|--------|
| `first_name` | Mariama |
| `last_name` | Sow |
| `phone` | +221 78 000 00 02 |
| `email` | [À COMPLÉTER] |
| `relationship_label` | [À COMPLÉTER] — préciser le lien avec le donateur |

> **Manquant :** deuxième personne de confiance recommandée (notaire ou mandataire familial).

### Mandat

| Champ | Valeur |
|-------|--------|
| `mandate_type` | `FAMILY` |
| `title` | [À COMPLÉTER] |
| `reference_number` | [À COMPLÉTER] |
| `issuing_authority` | [À COMPLÉTER] |
| `signed_at` | [À COMPLÉTER] |
| `effective_from` | [À COMPLÉTER] |
| `effective_to` | [À COMPLÉTER] |
| `notes` | Projet de mandat en cours de rédaction chez le notaire |
| Document joint | [À COMPLÉTER] — PDF du mandat signé |

### Bénéficiaires

*(Non renseigné — étape facultative, laissée vide)*

### Patrimoine initial

**Étape reportée (`skipped`)** — à compléter ultérieurement depuis le dossier.

| Type | Libellé | Valeur estimée (XOF) | Statut |
|------|---------|----------------------|--------|
| `REAL_ESTATE` | [À COMPLÉTER] — bien immobilier principal | [À COMPLÉTER] | À inventorier |
| `BANK_ACCOUNT` | [À COMPLÉTER] | [À COMPLÉTER] | À inventorier |

### Pièces justificatives

| Catégorie | Fichier | Statut |
|-----------|---------|--------|
| `IDENTITY` | [À COMPLÉTER] | Manquant |
| `MANDATE` | [À COMPLÉTER] | Manquant |
| `PROPERTY_TITLE` | [À COMPLÉTER] | Manquant |

### Progression onboarding

| Étape | Statut |
|-------|--------|
| identification | `completed` *(titre renseigné)* |
| donor | `completed` *(donateur créé, fiche partielle)* |
| donor_trusted | `completed` *(1 personne, coordonnées incomplètes)* |
| mandate | `pending` |
| beneficiaries | `pending` *(facultatif)* |
| patrimoine | `skipped` |
| documents | `pending` *(facultatif)* |
| review | `pending` |

**`can_submit` :** `false` *(mandat obligatoire non satisfait)*  
**`pending_tasks` attendues après complétion partielle :**

- Mandat — `pending`
- Patrimoine initial — `skipped`
- Pièces justificatives — `pending` *(si non déposées)*

### Checklist de reprise

- [ ] Compléter la fiche donateur (date de naissance, CNI, e-mail, adresse)
- [ ] Ajouter e-mail et lien de la personne de confiance
- [ ] Enregistrer le mandat signé + PDF
- [ ] Inventorier le patrimoine (lever le report `patrimoine`)
- [ ] Déposer les pièces d'identité et titres de propriété
- [ ] Valider la synthèse et soumettre
