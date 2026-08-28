"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useCaseDetail } from "@/providers/case-detail-provider";

function truncateLabel(label: string, max = 28): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function PatrimoineSubNav({ caseId }: { caseId: number }) {
  const pathname = usePathname();
  const { data, navBase } = useCaseDetail();
  const base = `${navBase}/patrimoine`;
  void caseId;

  const activeAssets = useMemo(
    () => (data?.assets ?? []).filter((a) => a.is_active !== false),
    [data?.assets],
  );

  const items = useMemo(() => {
    const list: { href: string; label: string; match: (p: string) => boolean }[] = [
      {
        href: base,
        label: "Résumé global",
        match: (p) => p === base,
      },
    ];
    for (const asset of activeAssets) {
      const href = `${base}/actifs/${asset.id}`;
      list.push({
        href,
        label: truncateLabel(asset.label),
        match: (p) => p === href,
      });
    }
    return list;
  }, [base, activeAssets]);

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections patrimoine"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`relative max-w-[12rem] shrink-0 truncate border-b-2 -mb-[2px] px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "rounded-t-lg border-[var(--sf-green)] bg-[var(--sf-green)] text-[var(--sf-gold)] font-semibold"
                  : "rounded-t-md border-transparent text-[var(--sf-green)]/55 hover:border-[var(--sf-green)]/25 hover:bg-[var(--sf-cream)]/25 hover:text-[var(--sf-green-deep)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
