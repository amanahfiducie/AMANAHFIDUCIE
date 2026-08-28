"use client";

type FilterOption = { value: string; label: string };

export function ValidationsListFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher par dossier (référence, titre)…",
  status,
  onStatusChange,
  statusOptions,
  secondary,
  onSecondaryChange,
  secondaryLabel,
  secondaryOptions,
  actionableOnly,
  onActionableOnlyChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: FilterOption[];
  secondary?: string;
  onSecondaryChange?: (value: string) => void;
  secondaryLabel?: string;
  secondaryOptions?: FilterOption[];
  actionableOnly: boolean;
  onActionableOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
      <label className="min-w-[14rem] flex-1 text-xs font-medium text-[var(--sf-green)]/55">
        Recherche dossier
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="sf-input mt-1 w-full text-sm"
        />
      </label>

      <label className="text-xs font-medium text-[var(--sf-green)]/55">
        Statut
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="sf-input mt-1 block min-w-[10rem] text-sm"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {secondaryOptions && onSecondaryChange ? (
        <label className="text-xs font-medium text-[var(--sf-green)]/55">
          {secondaryLabel ?? "Type"}
          <select
            value={secondary ?? ""}
            onChange={(e) => onSecondaryChange(e.target.value)}
            className="sf-input mt-1 block min-w-[10rem] text-sm"
          >
            {secondaryOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-center gap-2 pb-2 text-sm text-[var(--sf-green-deep)]">
        <input
          type="checkbox"
          checked={actionableOnly}
          onChange={(e) => onActionableOnlyChange(e.target.checked)}
          className="rounded border-[var(--sf-cream-dark)]"
        />
        À traiter seulement
      </label>
    </div>
  );
}
