import Link from "next/link";

export function PageHeader({
  title,
  description,
  action,
  backHref,
  badge,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  badge?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--sf-green-mid)] transition hover:text-[var(--sf-green)]"
          >
            <span aria-hidden>←</span> Retour
          </Link>
        ) : null}
        {badge ? (
          <p className="mb-1 text-xs font-medium tracking-[0.15em] text-[var(--sf-gold)] uppercase">
            {badge}
          </p>
        ) : null}
        <h1 className="sf-display text-2xl font-semibold tracking-tight text-[var(--sf-green-deep)] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--sf-green)]/65">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
