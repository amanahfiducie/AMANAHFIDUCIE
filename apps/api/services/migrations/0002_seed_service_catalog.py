from decimal import Decimal

from django.db import migrations


def seed_forward(apps, schema_editor):
    """Seed initial (schéma sans tranches). Le reseed v1.0 est en 0005."""
    ServiceOffer = apps.get_model("services", "ServiceOffer")
    ServiceBillingRule = apps.get_model("services", "ServiceBillingRule")

    catalog = [
        (
            "TUTELLE_CANTONNEMENT",
            "Sécurisation des héritages des mineurs",
            1,
            [
                ("MANAGEMENT_FEE_AUM", "Frais de gestion fiduciaire", Decimal("2.000"), None, "ANNUAL", 1),
                ("PERFORMANCE_FEE", "Commission de performance", Decimal("15.000"), None, "ON_PROFIT", 2),
                ("OPENING_FEE", "Honoraires d'ouverture de dossier", None, None, "ONCE", 3),
            ],
        ),
        (
            "MANDAT_FIDUCIAIRE",
            "Gestion fiduciaire du patrimoine",
            2,
            [
                ("MANAGEMENT_FEE_AUM", "Frais de gestion fiduciaire", Decimal("2.000"), None, "ANNUAL", 1),
                ("PERFORMANCE_FEE", "Commission de performance", Decimal("15.000"), None, "ON_PROFIT", 2),
                ("OPENING_FEE", "Honoraires de mandat", None, None, "ONCE", 3),
            ],
        ),
        (
            "SUCCESSION",
            "Conseil successoral islamique",
            3,
            [("MISSION_FEE", "Honoraires de conseil successoral", None, None, "ONCE", 1)],
        ),
        (
            "WAQF",
            "Waqf familial & productif",
            4,
            [
                ("OPENING_FEE", "Honoraires de structuration waqf", None, None, "ONCE", 1),
                ("MANAGEMENT_FEE_AUM", "Frais d'administration du waqf", Decimal("1.500"), None, "ANNUAL", 2),
            ],
        ),
        (
            "ZAKAT_FARAID",
            "Zakat & structuration patrimoniale",
            5,
            [("MISSION_FEE", "Honoraires d'évaluation zakat / farāʾiḍ", None, None, "ONCE", 1)],
        ),
    ]

    for case_type, name, sort_order, rules in catalog:
        offer, _ = ServiceOffer.objects.get_or_create(
            case_type=case_type,
            defaults={
                "name": name,
                "description": "",
                "sort_order": sort_order,
                "is_active": True,
            },
        )
        if ServiceBillingRule.objects.filter(service_id=offer.pk).exists():
            continue
        for formula, label, rate, fixed, periodicity, rule_sort in rules:
            ServiceBillingRule.objects.create(
                service_id=offer.pk,
                formula=formula,
                label=label,
                description="",
                rate_percent=rate,
                fixed_amount=fixed,
                periodicity=periodicity,
                sort_order=rule_sort,
                is_active=True,
                currency="XOF",
            )


def seed_reverse(apps, schema_editor):
    ServiceOffer = apps.get_model("services", "ServiceOffer")
    ServiceOffer.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0001_initial_service_catalog"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_reverse),
    ]
