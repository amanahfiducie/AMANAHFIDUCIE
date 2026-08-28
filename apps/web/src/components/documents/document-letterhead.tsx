"use client";

type Props = {
  /** Classe CSS racine */
  className?: string;
  /** Affiche une variante plus compacte (aperçu étroit). */
  compact?: boolean;
};

/**
 * En-tête documents officiels Amanah Fiducie — logo horizontal officiel + claim + QR.
 * Utilise <img> (pas next/image) pour que l'impression / PDF clone le même rendu.
 */
export function DocumentLetterhead({ className = "", compact = false }: Props) {
  return (
    <header
      className={`relative overflow-hidden bg-white ${className}`}
      aria-label="En-tête Amanah Fiducie"
    >
      <div
        className="h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, #8a6d1c 0%, #c9a227 35%, #e8d5a3 50%, #c9a227 65%, #8a6d1c 100%)",
        }}
      />
      <div className="h-px w-full bg-[var(--sf-green-deep)]" />

      <div
        className={`flex items-center gap-3 sm:gap-5 ${
          compact ? "px-3 py-2.5" : "px-4 py-3.5 sm:px-5 sm:py-4"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-horizontal.png"
          alt="Amanah Fiducie"
          className={`shrink-0 object-contain object-left ${
            compact ? "h-10 w-auto max-w-[132px]" : "h-12 w-auto max-w-[168px] sm:h-14 sm:max-w-[196px]"
          }`}
        />

        <div
          className={`mx-0.5 hidden w-px shrink-0 self-stretch sm:block ${
            compact ? "my-1" : "my-1.5"
          }`}
          style={{
            background:
              "linear-gradient(180deg, transparent, #c9a227 20%, #c9a227 80%, transparent)",
          }}
        />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p
            className={`font-semibold uppercase tracking-[0.12em] text-[var(--sf-gold)] ${
              compact ? "text-[9px] leading-snug" : "text-[10px] leading-snug sm:text-[11px]"
            }`}
          >
            Première société fiduciaire islamique au Sénégal
          </p>
          <div
            className="mx-auto mt-1.5 h-px w-full max-w-[22rem] sm:mx-0"
            style={{
              background:
                "linear-gradient(90deg, #0f2418 0%, #c9a227 55%, transparent 100%)",
            }}
          />
          <p
            className={`mt-1.5 font-[family-name:var(--font-display)] italic text-[var(--sf-green-deep)] ${
              compact ? "text-[11px]" : "text-xs sm:text-sm"
            }`}
          >
            Protéger, gérer et transmettre avec confiance.
          </p>
        </div>

        <a
          href="https://amanahfiducie.sn"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex shrink-0 flex-col items-center gap-1"
          title="amanahfiducie.sn"
        >
          <div
            className={`rounded-md border border-[var(--sf-gold)]/35 bg-white p-1 shadow-sm transition group-hover:border-[var(--sf-gold)] ${
              compact ? "h-[52px] w-[52px]" : "h-[64px] w-[64px] sm:h-[72px] sm:w-[72px]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/qr-amanahfiducie.png"
              alt="QR code amanahfiducie.sn"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="hidden text-[9px] font-medium tracking-wide text-[var(--sf-green)]/45 sm:block">
            amanahfiducie.sn
          </span>
        </a>
      </div>

      <div className="h-[2px] w-full bg-[var(--sf-green-deep)]" />
      <div
        className="h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, #8a6d1c 0%, #c9a227 50%, #8a6d1c 100%)",
        }}
      />
    </header>
  );
}
