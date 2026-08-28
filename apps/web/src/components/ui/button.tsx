import Link from "next/link";

type Variant = "primary" | "secondary" | "gold";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "sf-btn-primary",
  secondary: "sf-btn-secondary",
  gold: "sf-btn-gold",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${VARIANT_CLASS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
