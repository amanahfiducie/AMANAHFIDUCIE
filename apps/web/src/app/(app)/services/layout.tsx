import { ServicesAccessGuard } from "@/components/services/services-access-guard";

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ServicesAccessGuard>{children}</ServicesAccessGuard>;
}
