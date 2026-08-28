# Service 2 — Tutelle / cantonnement (`TUTELLE_CANTONNEMENT`)

**Libellé métier :** Sécurisation des héritages des mineurs  
**Description :** Protection et gestion du patrimoine de mineurs ou héritiers sous tutelle.

## Étapes d'enregistrement

1. Identification  
2. Donateur *(constituant / défunt dont l'héritage est cantonné)*  
3. Personnes de confiance  
4. Mandat *(décision judiciaire ou acte de tutelle)*  
5. Héritiers / bénéficiaires *(obligatoire — mineurs + tuteurs)*  
6. Patrimoine initial  
7. Pièces justificatives *(facultatif)*  
8. Synthèse & soumission  

---

## Actions par rôle sur ce type de dossier

> Matrice complète : [actions-par-role.md](./actions-par-role.md)

### Rôles internes

| Rôle | Actions principales sur un dossier tutelle / cantonnement |
|------|-----------------------------------------------------------|
| **AGENT_FIDUCIAIRE** | Créer le dossier, enregistrer le de cujus, les mineurs et leurs tuteurs, saisir le patrimoine cantonné, joindre la décision judiciaire, soumettre pour revue |
| **DIRECTION** | Superviser le dossier, valider étape « propriétaire », approuver rapports de gestion des biens cantonnés, assigner chargé de dossier |
| **JURIDIQUE_CONFORMITE** | Vérifier la décision de cantonnement, valider le mandat judiciaire, décider étape juridique du circuit |
| **COMPTABLE_FIDUCIAIRE** | Gérer compte fiduciaire cantonné, enregistrer revenus (loyers, commerce) et dépenses au profit des mineurs, validations comptables |
| **COMITE_CHARAIQUE** | Revue charaïque du dossier (conformité des règles de protection des mineurs), remarques internes |
| **AUDITEUR** | Audit du dossier et traçabilité des mouvements sur patrimoine cantonné |

### Rôles externes (partie prenante)

| Rôle | Actions principales |
|------|---------------------|
| **FAMILLE_TUTEUR** (tuteur — ex. Khady Fall) | Portail : suivre l'évolution du cantonnement, consulter patrimoine et rapports approuvés, déposer pièces (actes de naissance), soumettre observation |
| **FAMILLE_TUTEUR** (famille — ex. Mamadou Sarr, tuteur de Binta) | Idem ; un compte par tuteur rattaché au dossier |
| **JUGE** | Portail juge : consulter décision `RG 2024/1847`, mandat et statut du dossier, soumettre observation |
| **NOTAIRE** | Portail notaire : consulter pièces si impliqué dans l'ouverture (origine `NOTARY`) |

### Spécificités tutelle / cantonnement

- Les **bénéficiaires mineurs et leurs tuteurs** sont **obligatoires** (contrairement au mandat fiduciaire où les bénéficiaires sont facultatifs).
- Le mandat est en général de type **`JUDICIAL`** (décision de cantonnement).
- Le **juge** et les **tuteurs** sont les profils externes les plus sollicités sur ce type.

### Scénarios de test par profil

| Profil | Dossier | Action à tester |
|--------|---------|-----------------|
| Agent fiduciaire | `TC-TEST-INCOMPLET` | Compléter tuteurs manquants, mandat judiciaire, patrimoine |
| Agent fiduciaire | `TC-TEST-COMPLET` | Soumettre → circuit de revue |
| Juridique | `TC-TEST-COMPLET` | Valider mandat judiciaire + décision cantonnement |
| Comptable | `TC-TEST-COMPLET` (actif) | Enregistrer revenus « Fall Market » + répartition par parts mineurs |
| Tuteur (Khady Fall) | `TC-TEST-COMPLET` | Portail : consulter parts des enfants, déposer relevé bancaire |
| Juge | `TC-TEST-COMPLET` | Portail juge : consulter décision, soumettre observation |
| Comité charaïque | `TC-TEST-COMPLET` (soumis) | Valider étape charaïque |

---

## Dossier complet — `TC-TEST-COMPLET`

> Statut cible : `DRAFT` → soumission possible → `UNDER_REVIEW`

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Cantonnement héritage mineurs — famille Fall |
| `case_type` | `TUTELLE_CANTONNEMENT` |
| `case_origin` | `COURT` |
| `description` | Cantonnement et gestion fiduciaire de l'héritage laissé par feu Abdoulaye Fall au profit de ses trois enfants mineurs, suite à décision du tribunal de Dakar. |
| `status` | `DRAFT` |

### Donateur (de cujus / constituant)

| Champ | Valeur |
|-------|--------|
| `first_name` | Abdoulaye |
| `last_name` | Fall |
| `date_of_birth` | 1978-09-03 |
| `nationality` | SN |
| `identification_number` | 1 978 0903 00018 |
| `email` | *(vide — décédé)* |
| `phone` | *(vide — décédé)* |
| `address` | Dernière résidence : Parcelles Assainies U12, Dakar |
| `notes` | Décès survenu le 2024-06-12. Certificat de décès déposé. |

### Personnes de confiance

| Champ | Valeur |
|-------|--------|
| `first_name` | Khady |
| `last_name` | Fall |
| `phone` | +221 77 456 78 90 |
| `email` | khady.fall@example.sn |
| `relationship_label` | Épouse survivante |

| Champ | Valeur |
|-------|--------|
| `first_name` | Mamadou |
| `last_name` | Sarr |
| `phone` | +221 76 567 89 01 |
| `email` | m.sarr@example.sn |
| `relationship_label` | Oncle maternel |

### Mandat

| Champ | Valeur |
|-------|--------|
| `mandate_type` | `JUDICIAL` |
| `title` | Décision de cantonnement — Tribunal de Dakar |
| `reference_number` | RG 2024/1847 |
| `issuing_authority` | Tribunal de Grande Instance de Dakar |
| `signed_at` | 2024-10-15 |
| `effective_from` | 2024-10-15 |
| `effective_to` | *(vide — jusqu'à majorité du dernier mineur)* |
| `notes` | Cantonnement des biens successoraux au profit des enfants mineurs. SOFIGEPAM désignée gestionnaire fiduciaire. |
| Document joint | `COURT_DECISION` — decision-cantonnement-fall.pdf |

### Héritiers / bénéficiaires

| Prénom | Nom | Sexe | Date naissance | Mineur | Lien | Part | Tuteur |
|--------|-----|------|----------------|--------|------|------|--------|
| Awa | Fall | F | 2012-02-14 | Oui | `CHILD` | 33,33 % | Khady Fall |
| Modou | Fall | M | 2014-07-22 | Oui | `CHILD` | 33,33 % | Khady Fall |
| Binta | Fall | F | 2017-11-05 | Oui | `CHILD` | 33,34 % | Mamadou Sarr |

**Tuteurs enregistrés**

| Prénom | Nom | Téléphone | Lien |
|--------|-----|-----------|------|
| Khady | Fall | +221 77 456 78 90 | Mère |
| Mamadou | Sarr | +221 76 567 89 01 | Oncle maternel (tuteur de Binta) |

### Patrimoine initial

| Type | Libellé | Localisation | Valeur estimée (XOF) | Fréquence |
|------|---------|--------------|----------------------|-----------|
| `REAL_ESTATE` | Maison familiale — Parcelles Assainies | Dakar | 95 000 000 | `ANNUAL` |
| `BANK_ACCOUNT` | Compte succession — BCEAO | Dakar | 28 400 000 | `QUARTERLY` |
| `BUSINESS` | Boutique alimentaire « Fall Market » | Pikine | 15 000 000 | `SEMIANNUAL` |
| `CASH` | Caisse commerce | Pikine | 2 100 000 | `QUARTERLY` |

**Total patrimoine cantonné :** 140 500 000 XOF

### Pièces justificatives

| Catégorie | Fichier |
|-----------|---------|
| `COURT_DECISION` | decision-cantonnement-fall.pdf |
| `IDENTITY` | actes-naissance-awa-modou-binta.pdf |
| `PROPERTY_TITLE` | titre-parcelles-assainies.pdf |
| `BANK_STATEMENT` | releve-compte-succession-oct2024.pdf |
| `OTHER` | certificat-deces-abdoulaye-fall.pdf |

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

## Dossier incomplet — `TC-TEST-INCOMPLET`

> Statut cible : `DRAFT` — dossier ouvert, plusieurs blocs à compléter progressivement

### Identification

| Champ | Valeur |
|-------|--------|
| `title` | Tutelle mineurs — famille Ba |
| `case_type` | `TUTELLE_CANTONNEMENT` |
| `case_origin` | `NOTARY` |
| `description` | [À COMPLÉTER] — origine du dossier (notaire référent, contexte familial) |
| `status` | `DRAFT` |

### Donateur (de cujus)

| Champ | Valeur |
|-------|--------|
| `first_name` | Mame |
| `last_name` | Ba |
| `date_of_birth` | [À COMPLÉTER] |
| `nationality` | SN |
| `identification_number` | [À COMPLÉTER] |
| `address` | [À COMPLÉTER] |
| `notes` | Décès confirmé — certificat de décès [À COMPLÉTER] |

### Personnes de confiance

| Champ | Valeur |
|-------|--------|
| `first_name` | [À COMPLÉTER] |
| `last_name` | [À COMPLÉTER] |
| `phone` | [À COMPLÉTER] |
| `email` | [À COMPLÉTER] |
| `relationship_label` | [À COMPLÉTER] |

> **Manquant :** aucune personne de confiance enregistrée pour l'instant.

### Mandat

| Champ | Valeur |
|-------|--------|
| `mandate_type` | `JUDICIAL` |
| `title` | [À COMPLÉTER] |
| `reference_number` | [À COMPLÉTER] |
| `issuing_authority` | [À COMPLÉTER] |
| `signed_at` | [À COMPLÉTER] |
| `effective_from` | [À COMPLÉTER] |
| `notes` | Décision de tutelle attendue du tribunal |
| Document joint | [À COMPLÉTER] |

### Héritiers / bénéficiaires

| Prénom | Nom | Sexe | Date naissance | Mineur | Lien | Tuteur |
|--------|-----|------|----------------|--------|------|--------|
| Issa | Ba | M | 2015-03-10 | Oui | `CHILD` | [À COMPLÉTER] |
| Aïssatou | Ba | F | [À COMPLÉTER] | Oui | `CHILD` | [À COMPLÉTER] |

> **Manquant :** tuteurs non attribués, acte de naissance d'Aïssatou, parts patrimoniales non calculées.

### Patrimoine initial

| Type | Libellé | Valeur estimée (XOF) | Statut |
|------|---------|----------------------|--------|
| `REAL_ESTATE` | [À COMPLÉTER] — résidence familiale | [À COMPLÉTER] | À inventorier |
| `BANK_ACCOUNT` | [À COMPLÉTER] | [À COMPLÉTER] | À inventorier |

> Patrimoine partiellement connu — inventaire notarial en cours.

### Pièces justificatives

| Catégorie | Fichier | Statut |
|-----------|---------|--------|
| `COURT_DECISION` | [À COMPLÉTER] | Manquant |
| `IDENTITY` | acte-naissance-issa-ba.pdf | Partiel (1/2 enfants) |
| `PROPERTY_TITLE` | [À COMPLÉTER] | Manquant |

### Progression onboarding

| Étape | Statut |
|-------|--------|
| identification | `completed` |
| donor | `completed` *(fiche minimale)* |
| donor_trusted | `pending` |
| mandate | `pending` |
| beneficiaries | `completed` *(partiel — 2 mineurs, tuteurs manquants)* |
| patrimoine | `pending` |
| documents | `pending` |
| review | `pending` |

**`can_submit` :** `false`  
**`pending_tasks` attendues :**

- Personnes de confiance — `pending`
- Mandat — `pending`
- Patrimoine initial — `pending`
- Héritiers / bénéficiaires — tuteurs à compléter (données insuffisantes côté métier)

### Checklist de reprise

- [ ] Compléter la fiche du de cujus (date de naissance, CNI, adresse, certificat de décès)
- [ ] Enregistrer au moins une personne de confiance
- [ ] Saisir la décision judiciaire de cantonnement / tutelle + PDF
- [ ] Compléter Aïssatou Ba (date de naissance, acte de naissance)
- [ ] Attribuer un tuteur à chaque mineur
- [ ] Inventorier le patrimoine cantonné avec estimations
- [ ] Déposer les pièces manquantes
- [ ] Valider la synthèse et soumettre
