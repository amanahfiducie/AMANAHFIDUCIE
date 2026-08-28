export function WizardSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--sf-cream-dark)] bg-white/70 p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 border-b border-[var(--sf-cream-dark)]/90 pb-4">
        <h3 className="text-base font-semibold text-[var(--sf-green-deep)]">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--sf-green)]/60">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-[var(--sf-green-deep)]"
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-[var(--sf-green-mid)]" aria-hidden>
          *
        </span>
      ) : null}
      {required ? <span className="sr-only"> (obligatoire)</span> : null}
    </label>
  );
}
