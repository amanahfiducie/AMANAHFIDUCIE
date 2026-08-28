import type { Asset, AssetEvent, AssetEventType } from "@/types/api";

const EVENT_TYPES: AssetEventType[] = ["GAIN", "EXPENSE", "ESTIMATION", "OTHER"];

function sumEventAmounts(events: AssetEvent[] | undefined, type: string): number {
  let sum = 0;
  for (const e of events ?? []) {
    if (e.status !== "ACTIVE" || e.event_type !== type || !e.amount) continue;
    const n = Number(e.amount);
    if (!Number.isNaN(n)) sum += n;
  }
  return sum;
}

/** Agrège gains / dépenses depuis les événements des actifs (repli si l’API ne les fournit pas). */
export function computePatrimonyMetricsFromAssets(assets: Asset[]): {
  totalGains: number;
  totalExpenses: number;
  netBenefit: number;
} {
  let totalGains = 0;
  let totalExpenses = 0;
  for (const asset of assets.filter((a) => a.is_active !== false)) {
    totalGains += sumEventAmounts(asset.events, "GAIN");
    totalExpenses += sumEventAmounts(asset.events, "EXPENSE");
  }
  return {
    totalGains,
    totalExpenses,
    netBenefit: totalGains - totalExpenses,
  };
}

export type AssetEventTypeMetrics = {
  count: number;
  totalAmount: number;
};

/** Totaux par type d’événement pour un seul actif (événements actifs uniquement). */
export function computeAssetEventBreakdown(
  events: AssetEvent[] | undefined,
): Record<AssetEventType, AssetEventTypeMetrics> {
  const result = {} as Record<AssetEventType, AssetEventTypeMetrics>;
  for (const type of EVENT_TYPES) {
    result[type] = { count: 0, totalAmount: 0 };
  }
  for (const e of events ?? []) {
    if (e.status !== "ACTIVE") continue;
    const bucket = result[e.event_type];
    if (!bucket) continue;
    bucket.count += 1;
    if (e.amount) {
      const n = Number(e.amount);
      if (!Number.isNaN(n)) bucket.totalAmount += n;
    }
  }
  return result;
}

function isDateInCurrentYear(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr.startsWith(String(new Date().getFullYear()));
}

function sumEventsInYear(events: AssetEvent[], type: string): number {
  let sum = 0;
  for (const e of events) {
    if (
      e.status !== "ACTIVE" ||
      e.event_type !== type ||
      !e.amount ||
      !isDateInCurrentYear(e.event_date)
    ) {
      continue;
    }
    const n = Number(e.amount);
    if (!Number.isNaN(n)) sum += n;
  }
  return sum;
}

export type EstimationSnapshot = {
  amount: string;
  date: string;
};

export type AssetFinancialSummary = {
  currency: string;
  year: number;
  estimationCurrent: string | null;
  estimationPrevious: EstimationSnapshot | null;
  caYear: number;
  expensesYear: number;
  benefitYear: number;
};

/** Cartes Estimation / CA / Dépenses / Bénéfice pour la fiche actif. */
export function computeAssetFinancialSummary(asset: Asset): AssetFinancialSummary {
  const events = asset.events ?? [];
  const currency = asset.latest_currency ?? asset.currency ?? "XOF";
  const year = new Date().getFullYear();

  const estimationEvents = events
    .filter(
      (e) =>
        e.status === "ACTIVE" &&
        e.event_type === "ESTIMATION" &&
        e.event_date &&
        e.amount,
    )
    .sort((a, b) => b.event_date!.localeCompare(a.event_date!));

  const valuations = [...(asset.valuations ?? [])].sort((a, b) =>
    b.valued_at.localeCompare(a.valued_at),
  );

  let estimationCurrent: string | null = null;
  let estimationPrevious: EstimationSnapshot | null = null;

  if (estimationEvents.length > 0) {
    estimationCurrent = estimationEvents[0].amount;
    if (estimationEvents.length > 1 && estimationEvents[1].event_date) {
      estimationPrevious = {
        amount: estimationEvents[1].amount!,
        date: estimationEvents[1].event_date!,
      };
    }
  } else if (asset.latest_value) {
    estimationCurrent = asset.latest_value;
    if (valuations.length > 1) {
      estimationPrevious = {
        amount: valuations[1].value,
        date: valuations[1].valued_at,
      };
    }
  } else if (valuations.length > 0) {
    estimationCurrent = valuations[0].value;
    if (valuations.length > 1) {
      estimationPrevious = {
        amount: valuations[1].value,
        date: valuations[1].valued_at,
      };
    }
  }

  const caYear = sumEventsInYear(events, "GAIN");
  const expensesYear = sumEventsInYear(events, "EXPENSE");
  const benefitYear = caYear - expensesYear;

  return {
    currency,
    year,
    estimationCurrent,
    estimationPrevious,
    caYear,
    expensesYear,
    benefitYear,
  };
}
