import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed bg-[var(--sf-cream)]/40 px-6 py-14 text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sf-green)]/8 text-xl text-[var(--sf-green-mid)]"
        aria-hidden
      >
        ◌
      </div>
      <h3 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
        {title}
      </h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--sf-green)]/60">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
