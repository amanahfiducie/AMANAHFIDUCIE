from __future__ import annotations

import uuid

from django.utils.text import slugify

from finance.models import CategoryScope, MovementCategory, MovementType

SCOPE_MOVEMENT_TYPE: dict[str, str] = {
    CategoryScope.REVENUE: MovementType.INCOME,
    CategoryScope.EXPENSE: MovementType.EXPENSE,
    CategoryScope.NEUTRAL: MovementType.TRANSFER,
}

SCOPE_SLUG_PREFIX: dict[str, str] = {
    CategoryScope.REVENUE: "recette-",
    CategoryScope.EXPENSE: "depense-",
    CategoryScope.NEUTRAL: "neutre-",
}


def make_unique_category_slug(label: str, scope: str) -> str:
    prefix = SCOPE_SLUG_PREFIX.get(scope, "cat-")
    base = slugify(label)[:60] or "categorie"
    candidate = f"{prefix}{base}"
    if not MovementCategory.objects.filter(slug=candidate).exists():
        return candidate
    return f"{candidate}-{uuid.uuid4().hex[:6]}"


def next_category_sort_order(scope: str) -> int:
    last = (
        MovementCategory.objects.filter(scope=scope)
        .order_by("-sort_order")
        .values_list("sort_order", flat=True)
        .first()
    )
    return (last or 0) + 10
