export function Card({
  children,
  className = "",
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <div className={`${elevated ? "sf-card-elevated" : "sf-card"} ${className}`}>
      {children}
    </div>
  );
}
