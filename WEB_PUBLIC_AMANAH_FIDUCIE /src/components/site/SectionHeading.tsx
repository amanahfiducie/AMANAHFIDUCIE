import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  align?: "left" | "center";
  invert?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  invert = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <div
          className={cn(
            "text-[10px] sm:text-xs font-semibold uppercase tracking-[0.22em] sm:tracking-[0.25em] mb-3",
            invert ? "text-gold" : "text-primary",
          )}
        >
          {eyebrow}
        </div>
      )}
      <div
        className={cn(
          "h-px w-14 bg-gold-gradient mb-5",
          align === "center" && "mx-auto",
        )}
      />
      <h2
        className={cn(
          "font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] sm:leading-tight text-balance",
          invert ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 sm:mt-5 text-sm sm:text-base md:text-lg leading-relaxed text-balance",
            invert ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
