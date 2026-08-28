import Image from "next/image";

type SfSealSpinnerProps = {
  /** Taille en pixels (carré). */
  size?: number;
  /** Rotation lente (décoratif, comme le site public). */
  slow?: boolean;
  className?: string;
};

export function SfSealSpinner({
  size = 96,
  slow = false,
  className = "",
}: SfSealSpinnerProps) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="presentation"
      aria-hidden
    >
      <Image
        src="/brand/logo-seal.png"
        alt=""
        width={size}
        height={size}
        className={`h-full w-full object-contain drop-shadow-[0_8px_24px_rgb(15_36_24_/_0.18)] ${
          slow ? "sf-seal-spin-slow" : "sf-seal-spin"
        }`}
        priority
      />
    </div>
  );
}
