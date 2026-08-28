import type { ReactNode } from "react";

import { assetTypeUi } from "@/lib/patrimony/asset-type-ui";

function Svg({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, () => ReactNode> = {
  REAL_ESTATE: () => (
    <Svg>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  ),
  LAND: () => (
    <Svg>
      <path d="M2 20h20" />
      <path d="M5 20c4-8 10-8 14 0" />
      <path d="M9 12l2-3 2 3 2-4" />
    </Svg>
  ),
  BANK_ACCOUNT: () => (
    <Svg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </Svg>
  ),
  CASH: () => (
    <Svg>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10h.01M18 14h.01" />
    </Svg>
  ),
  BUSINESS: () => (
    <Svg>
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      <path d="M3 9l2-5h14l2 5" />
      <path d="M10 14h4" />
    </Svg>
  ),
  AGRICULTURE: () => (
    <Svg>
      <path d="M12 22V12" />
      <path d="M12 12c-3-4-7-4-7-8 3 0 5 2 7 4 2-2 4-4 7-4-0 4-4 4-7 8z" />
    </Svg>
  ),
  LIVESTOCK: () => (
    <Svg>
      <path d="M7 8c-1.8-1.2-3.2-.6-3.5 1.2" />
      <path d="M17 8c1.8-1.2 3.2-.6 3.5 1.2" />
      <path d="M6 12c0-2.8 2.2-5 6-5s6 2.2 6 5v5a2 2 0 0 1-2 2h-1.5v-2.5h-3V19H8.5a2 2 0 0 1-2-2v-5z" />
      <circle cx="9.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.5 15.5h3" />
      <path d="M4 20h16" />
    </Svg>
  ),
  SHARES: () => (
    <Svg>
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-6" />
    </Svg>
  ),
  GOLD: () => (
    <Svg>
      <path d="M6 16l3-8h6l3 8H6z" />
      <path d="M9 8l1.5-3h3L15 8" />
    </Svg>
  ),
  WAQF_ASSET: () => (
    <Svg>
      <path d="M12 3l8 4v6c0 5-3.5 8-8 8s-8-3-8-8V7l8-4z" />
      <path d="M12 11v5" />
      <path d="M9 13h6" />
    </Svg>
  ),
  OTHER: () => (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </Svg>
  ),
};

export function AssetTypeIcon({
  assetType,
  size = "md",
  variant = "boxed",
  className = "",
}: {
  assetType: string;
  size?: "sm" | "md" | "lg";
  /** boxed = pastille colorée ; inline = icône seule (à côté d'un champ) */
  variant?: "boxed" | "inline";
  className?: string;
}) {
  const ui = assetTypeUi(assetType);
  const sizeClass =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const boxClass =
    size === "lg"
      ? "h-14 w-14 rounded-2xl border-2"
      : size === "sm"
        ? "h-8 w-8 rounded-lg border"
        : "h-10 w-10 rounded-xl border";

  const render = ICONS[assetType] ?? ICONS.OTHER;

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${ui.accent} ${className}`}
        aria-hidden
      >
        <span className={sizeClass}>{render()}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${boxClass} ${ui.iconBg} ${ui.accent} ${className}`}
      aria-hidden
    >
      <span className={sizeClass}>{render()}</span>
    </span>
  );
}
