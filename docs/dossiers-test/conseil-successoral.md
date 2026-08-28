# Service 3 — Conseil successoral islamique (`SUCCESSION`)

**Libellé métier :** Conseil successoral islamique  
**Description :** Évaluation du patrimoine à partager, puis accompagnement au partage des héritages selon les parts successorales (farāʾiḍ).

## Étapes d'enregistrement

1. Identification  
2. Le défunt (de cujus)  
3. Témoins *(au moins un)*  
4. Mandat / cadre juridique  
5. Arbre généalogique  
6. Évaluation du patrimoine  
7. Pièces justificatives *(facultatif)*  
8. Synthèse & soumission  

---

## Actions par rôle sur ce type de dossier

> Matrice complète : [actions-par-role.md](./actions-par-role.md)

### Rôles internes

| Rôle | Actions principales sur un dossier succession |
|------|-----------------------------------------------|
| **AGENT_FIDUCIAIRE** | Créer le dossier, enregistrer le défunt, témoins, arbre généalogique, évaluer le patrimoine (avec PDF par actif), soumettre pour revue, saisir héritiers farāʾiḍ |
| **DIRECTION** | Superviser le dossier, valider étape « propriétaire », **examiner et finaliser le partage farāʾiḍ**, approuver rapports |
| **JURIDIQUE_CONFORMITE** | Vérifier certificat d'hérédité / cadre juridique, valider mandat notarial, décider étape juridique, approuver rapports |
| **COMPTABLE_FIDUCIAIRE** | Évaluer impact patrimonial, enregistrer dettes déduites, mouvements liés au partage |
| **COMITE_CHARAIQUE** | **Rôle central** : revue farāʾiḍ, validation des parts successorales, finalisation du partage, remarques internes, étape charaïque du circuit dossier |
| **AUDITEUR** | Audit du dossier et traçabilité des décisions de partage |

### Rôles externes (partie prenante)

| Rôle | Actions principales |
|------|---------------------|
| **FAMILLE_TUTEUR** (héritier — ex. Pape Ndiaye) | Portail : consulter patrimoine net successoral, rapports approuvés, déposer pièces, soumettre observation |
| **NOTAIRE** | Portail notaire : consulter certificat d'hérédité `CH-DK-2025-0891`, mandat, documents notariaux, soumettre observation |
| **FAMILLE_TUTEUR** (témoin — ex. Ibrahima Lo) | Portail : consulter dossier si rattaché, soumettre observation |

### Spécificités succession

- L'étape **bénéficiaires** correspond à l'**arbre généalogique** (liens père/mère/conjoint).
- L'étape **patrimoine** exige une **évaluation par actif** avec justificatif PDF.
- Le module **farāʾiḍ** est réservé aux dossiers `SUCCESSION` :
  - **Saisie** : agent, juridique, direction
  - **Revue / finalisation** : comité charaïque, direction, super admin uniquement
- L'onglet **Partage** (interface charaïque) n'est accessible qu'au **COMITE_CHARAIQUE** sur les dossiers succession.

### Scénarios de test par profil

| Profil | Dossier | Action à tester |
|--------|---------|-----------------|
| Agent fiduciaire | `SU-TEST-INCOMPLET` | Compléter arbre généalogique, lever report patrimoine |
| Agent fiduciaire | `SU-TEST-COMPLET` | Soumettre → saisir farāʾiḍ → soumettre pour revue charaïque |
| Comité charaïque | `SU-TEST-COMPLET` | Examiner farāʾiḍ, valider parts, finaliser partage |
| Direction | `SU-TEST-COMPLET` | Co-valider partage farāʾiḍ, approuver étape propriétaire |
| Notaire | `SU-TEST-COMPLET` | Portail : consulter certificat hérédité, déposer pièce |
| Famille (Pape Ndiaye) | `SU-TEST-COMPLET` | Portail : consulter patrimoine net, soumettre observation |
| Juridique | `SU-TEST-COMPLET` | Valider mandat notarial, étape juridique finale |

---

## Dossier complet — `SU-TEST-COMPLET`

> Statut cible : `DRAFT` → soumission possible → `UNDER_REVIEW`

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Succession islamique — feu Mamadou Ndiaye |
| `case_type` | `SUCCESSION` |
| `case_origin` | `NOTARY` |
| `description` | Conseil successoral et évaluation patrimoniale pour le partage selon les règles du farāʾiḍ, à la demande de l'étude notariale référente. |
| `status` | `DRAFT` |

### Le défunt (de cujus)

| Champ | Valeur |
|-------|--------|
| `first_name` | Mamadou |
| `last_name` | Ndiaye |
| `date_of_birth` | 1955-01-20 |
| `nationality` | SN |
| `identification_number` | 1 955 0120 00007 |
| `address` | Sicap Liberté 3, Villa 8, Dakar |
| `notes` | Décès le 2025-08-30. Marié (polygamie : 2 épouses). Pas de testament enregistré. |

### Témoins

| Champ | Valeur |
|-------|--------|
| `first_name` | Pape |
| `last_name` | Ndiaye |
| `phone` | +221 77 678 90 12 |
| `email` | pape.ndiaye@example.sn |
| `relationship_label` | Fils aîné |

| Champ | Valeur |
|-------|--------|
| `first_name` | Ibrahima |
| `last_name` | Lo |
| `phone` | +221 76 789 01 23 |
| `email` | ibrahima.lo@example.sn |
| `relationship_label` | Imam de quartier |

### Mandat / cadre juridique

| Champ | Valeur |
|-------|--------|
| `mandate_type` | `NOTARIAL` |
| `title` | Certificat d'hérédité et mandat de conseil successoral |
| `reference_number` | CH-DK-2025-0891 |
| `issuing_authority` | Étude Diallo & Fils, Dakar |
| `signed_at` | 2025-10-05 |
| `effective_from` | 2025-10-05 |
| `notes` | Mandat confiant à SOFIGEPAM l'évaluation patrimoniale et l'accompagnement au partage charaïque. |
| Document joint | `NOTARIAL_ACT` — certificat-heredite-ndiaye.pdf |

### Arbre généalogique

**Épouses**

| Prénom | Nom | Sexe | Lien avec le défunt |
|--------|-----|------|---------------------|
| Awa | Ndiaye | F | `SPOUSE` (1ʳᵉ épouse) |
| Maimouna | Ndiaye | F | `SPOUSE` (2ᵉ épouse) |

**Enfants**

| Prénom | Nom | Sexe | Date naissance | Père | Mère | Lien |
|--------|-----|------|----------------|------|------|------|
| Pape | Ndiaye | M | 1982-06-10 | Mamadou | Awa | `CHILD` |
| Coumba | Ndiaye | F | 1985-11-25 | Mamadou | Awa | `CHILD` |
| Oumar | Ndiaye | M | 1990-04-18 | Mamadou | Maimouna | `CHILD` |
| Dieynaba | Ndiaye | F | 1993-09-02 | Mamadou | Maimouna | `CHILD` |
| Aliou | Ndiaye | M | 1998-12-30 | Mamadou | Maimouna | `CHILD` |

**Parents du défunt (présumés décédés avant lui — à confirmer pour le farāʾiḍ)**

| Prénom | Nom | Sexe | Notes |
|--------|-----|------|-------|
| Mor | Ndiaye | M | Père — décédé avant le défunt |
| Rokhaya | Ndiaye | F | Mère — décédée avant le défunt |

### Évaluation du patrimoine

| Type | Libellé | Localisation | Valeur estimée (XOF) | Justificatif PDF |
|------|---------|--------------|----------------------|------------------|
| `REAL_ESTATE` | Villa Sicap Liberté 3 | Dakar | 120 000 000 | estimation-villa-sicap.pdf |
| `REAL_ESTATE` | Appartement location Almadies | Dakar | 85 000 000 | estimation-almadies.pdf |
| `BANK_ACCOUNT` | Comptes BIS + CDG | Dakar | 34 600 000 | releves-bancaires-ndiaye.pdf |
| `BUSINESS` | Garage Ndiaye Auto | Dakar | 22 000 000 | estimation-garage.pdf |
| `GOLD` | Or de famille (750 g estimés) | Conservation banque | 52 500 000 | attestation-or.pdf |

**Dettes et charges déduites**

| Libellé | Montant (XOF) |
|---------|---------------|
| Frais funéraires | 3 200 000 |
| Emprunt restant — villa Sicap | 18 000 000 |

**Patrimoine net successoral estimé :** 292 900 000 XOF

### Pièces justificatives

| Catégorie | Fichier |
|-----------|---------|
| `IDENTITY` | cni-mamadou-ndiaye.pdf |
| `NOTARIAL_ACT` | certificat-heredite-ndiaye.pdf |
| `OTHER` | certificat-deces-mamadou-ndiaye.pdf |
| `PROPERTY_TITLE` | titre-villa-sicap.pdf |
| `BANK_STATEMENT` | releves-bancaires-ndiaye.pdf |

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

## Dossier incomplet — `SU-TEST-INCOMPLET`

> Statut cible : `DRAFT` — arbre généalogique amorcé, patrimoine et cadre juridique à compléter

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Succession — famille Sy |
| `case_type` | `SUCCESSION` |
| `case_origin` | `FAMILY_REQUEST` |
| `description` | [À COMPLÉTER] |
| `status` | `DRAFT` |

### Le défunt (de cujus)

| Champ | Valeur |
|-------|--------|
| `first_name` | Amadou |
| `last_name` | Sy |
| `date_of_birth` | [À COMPLÉTER] |
| `nationality` | SN |
| `identification_number` | [À COMPLÉTER] |
| `address` | Thiès |
| `notes` | Décès récent — date exacte [À COMPLÉTER] |

### Témoins

| Champ | Valeur |
|-------|--------|
| `first_name` | Fatou |
| `last_name` | Sy |
| `phone` | +221 77 111 22 33 |
| `email` | [À COMPLÉTER] |
| `relationship_label` | Fille |

> **Manquant :** second témoin recommandé (imam, notaire ou proche).

### Mandat / cadre juridique

| Champ | Valeur |
|-------|--------|
| `mandate_type` | [À COMPLÉTER] — `NOTARIAL` ou `JUDICIAL` |
| `title` | [À COMPLÉTER] |
| `reference_number` | [À COMPLÉTER] |
| `issuing_authority` | [À COMPLÉTER] |
| `signed_at` | [À COMPLÉTER] |
| `effective_from` | [À COMPLÉTER] |
| Document joint | [À COMPLÉTER] |

### Arbre généalogique

**Épouse connue**

| Prénom | Nom | Sexe | Lien |
|--------|-----|------|------|
| Ndeye | Sy | F | `SPOUSE` |

**Enfants enregistrés**

| Prénom | Nom | Sexe | Date naissance | Mère | Statut |
|--------|-----|------|----------------|------|--------|
| Moussa | Sy | M | 1988-05-12 | Ndeye | Enregistré |
| Khady | Sy | F | [À COMPLÉTER] | Ndeye | Partiel |
| [À COMPLÉTER] | [À COMPLÉTER] | [À COMPLÉTER] | [À COMPLÉTER] | [À COMPLÉTER] | Enfant présumé — à confirmer |

> **Manquant :** liens père/mère pour certains membres, situation matrimoniale complète du défunt, parents du défunt si vivants.

### Évaluation du patrimoine

**Étape reportée (`skipped`)** — évaluation à reprendre depuis le dossier.

| Type | Libellé | Valeur estimée (XOF) | Statut |
|------|---------|----------------------|--------|
| `REAL_ESTATE` | Maison familiale — Thiès | [À COMPLÉTER] | À estimer + PDF |
| `AGRICULTURE` | Parcelle agricole | [À COMPLÉTER] | À estimer + PDF |
| `BANK_ACCOUNT` | [À COMPLÉTER] | [À COMPLÉTER] | À inventorier |

**Dettes connues**

| Libellé | Montant (XOF) | Statut |
|---------|---------------|--------|
| [À COMPLÉTER] | [À COMPLÉTER] | Non chiffré |

### Pièces justificatives

| Catégorie | Fichier | Statut |
|-----------|---------|--------|
| `IDENTITY` | [À COMPLÉTER] | Manquant |
| `OTHER` | [À COMPLÉTER] — certificat de décès | Manquant |
| `NOTARIAL_ACT` | [À COMPLÉTER] | Manquant |

### Progression onboarding

| Étape | Statut |
|-------|--------|
| identification | `completed` |
| donor | `completed` *(fiche partielle)* |
| donor_trusted | `completed` *(1 témoin)* |
| mandate | `pending` |
| beneficiaries | `completed` *(arbre partiel)* |
| patrimoine | `skipped` |
| documents | `pending` |
| review | `pending` |

**`can_submit` :** `false`  
**`pending_tasks` attendues :**

- Mandat / cadre juridique — `pending`
- Évaluation du patrimoine — `skipped`
- Arbre généalogique — membres et liens à compléter (données métier incomplètes)

### Checklist de reprise

- [ ] Compléter la fiche du défunt (date de naissance, CNI, date de décès)
- [ ] Ajouter un second témoin
- [ ] Enregistrer le certificat d'hérédité ou la décision autorisant l'intervention
- [ ] Compléter l'arbre (Khady Sy, autres enfants éventuels, parents du défunt)
- [ ] Lever le report `patrimoine` : estimer chaque bien avec justificatif PDF
- [ ] Saisir les dettes et charges à déduire
- [ ] Déposer certificat de décès, pièce d'identité du défunt, titres de propriété
- [ ] Valider la synthèse et soumettre
