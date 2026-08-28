import type { ButtonHTMLAttributes, ReactNode } from "react";

const iconClass = "h-[18px] w-[18px]";

function Svg({ children, className = iconClass }: { children: ReactNode; className?: string }) {
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

export function EditUserIcon() {
  return (
    <Svg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function LockUserIcon() {
  return (
    <Svg>
      <rect width="14" height="10" x="5" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function UnlockUserIcon() {
  return (
    <Svg>
      <rect width="14" height="10" x="5" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0" />
    </Svg>
  );
}

export function ResetPasswordIcon() {
  return (
    <Svg>
      <path d="M21 2l-2 2" />
      <path d="M7.5 10.5a4.95 4.95 0 0 0 5.5 5.5l4-4a4.95 4.95 0 0 0-5.5-5.5Z" />
      <path d="m14 6 4 4" />
      <path d="M3 21h6" />
      <path d="M6 18v3" />
    </Svg>
  );
}

export function DeleteUserIcon() {
  return (
    <Svg>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

export function ViewUserDetailIcon() {
  return (
    <Svg>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "default" | "danger";
};

export function IconActionButton({
  label,
  variant = "default",
  className = "",
  children,
  ...props
}: IconActionButtonProps) {
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const styles =
    variant === "danger"
      ? "border-red-200/80 text-red-800 hover:bg-red-50"
      : "border-[var(--sf-cream-dark)] text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]/60";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`${base} ${styles} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
