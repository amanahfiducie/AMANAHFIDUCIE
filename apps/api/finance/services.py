from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from finance.models import (
    DEBIT_TYPES,
    FinancialMovement,
    FiduciaryAccount,
    MovementStatus,
    MovementType,
)


def compute_account_balance(account: FiduciaryAccount) -> Decimal:
    """Solde = solde d’ouverture + mouvements approuvés (signés selon le type)."""
    balance = account.opening_balance
    movements = FinancialMovement.objects.filter(
        account=account,
        status=MovementStatus.APPROVED,
    )
    for movement in movements:
        balance += movement.signed_amount
    return balance


def get_account_financial_summary(account: FiduciaryAccount) -> dict:
    balance = compute_account_balance(account)
    approved = FinancialMovement.objects.filter(
        account=account,
        status=MovementStatus.APPROVED,
    )
    income_total = Decimal("0")
    expense_total = Decimal("0")
    for movement in approved:
        if movement.movement_type in DEBIT_TYPES:
            expense_total += abs(movement.amount)
        elif movement.movement_type in (MovementType.INCOME,):
            income_total += abs(movement.amount)
        elif movement.movement_type == MovementType.ADJUSTMENT:
            if movement.signed_amount >= 0:
                income_total += movement.signed_amount
            else:
                expense_total += abs(movement.signed_amount)

    return {
        "account_id": account.pk,
        "account_name": account.name,
        "currency": account.currency,
        "opening_balance": str(account.opening_balance),
        "current_balance": str(balance),
        "approved_income_total": str(income_total),
        "approved_expense_total": str(expense_total),
        "movement_count": account.movements.count(),
        "pending_validation_count": account.movements.filter(
            status=MovementStatus.PENDING_VALIDATION
        ).count(),
    }


def get_case_financial_summary(case) -> dict:
    accounts = FiduciaryAccount.objects.filter(case=case, is_active=True)
    account_summaries = [get_account_financial_summary(account) for account in accounts]
    total_balance = sum(Decimal(a["current_balance"]) for a in account_summaries)

    return {
        "case_id": case.pk,
        "case_reference": case.reference,
        "currency": account_summaries[0]["currency"] if account_summaries else "XOF",
        "account_count": len(account_summaries),
        "total_balance": str(total_balance),
        "accounts": account_summaries,
    }
