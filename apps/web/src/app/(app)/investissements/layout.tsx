import { InvestmentsGuard } from "@/components/investments/investments-guard";
import { InvestmentsSubNav } from "@/components/investments/investments-sub-nav";

export default function InvestissementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InvestmentsGuard>
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Investissements PIGFI
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Suivi global des placements des mandats (S1) et tutelles (S2). Les
          versements clients se gèrent dans chaque dossier.
        </p>
        <InvestmentsSubNav />
        <div className="mt-6">{children}</div>
      </div>
    </InvestmentsGuard>
  );
}
