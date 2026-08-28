"""Types de profil dossier (partagé API + e-mails)."""

PROFILE_TYPES = frozenset({"donor", "beneficiary", "guardian", "trusted_person"})

PROFILE_TYPE_LABELS = {
    "beneficiary": "Héritier / bénéficiaire",
    "guardian": "Tuteur",
    "trusted_person": "Personne de confiance",
    "donor": "Donateur",
}
