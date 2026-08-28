import { SfSealSpinner } from "@/components/ui/sf-seal-spinner";

export function LoadingState({
  label = "Chargement…",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  const sealSize = fullScreen ? 120 : 96;

  return (
    <div
      className={
        fullScreen
          ? "flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-[var(--sf-green)]/60"
          : "flex flex-col items-center justify-center gap-4 py-16 text-[var(--sf-green)]/60"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SfSealSpinner size={sealSize} />
      <p className="sf-display text-sm font-medium tracking-wide text-[var(--sf-green-deep)]/80">
        {label}
      </p>
    </div>
  );
}

/** Overlay plein écran pour transitions de navigation. */
export function LoadingOverlay({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-[var(--background)]/85 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SfSealSpinner size={112} />
      <p className="sf-display text-sm font-medium text-[var(--sf-green-deep)]/80">{label}</p>
    </div>
  );
}
