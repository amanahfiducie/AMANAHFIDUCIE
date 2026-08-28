import {
  homePathForInternalUser,
  resolvePrimaryInternalRole,
} from "@/lib/role-access";
import type { MeResponse } from "@/types/api";

const INTERNAL_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "JURIDIQUE_CONFORMITE",
  "COMPTABLE_FIDUCIAIRE",
  "COMITE_CHARAIQUE",
  "AUDITEUR",
]);

export type PortalKind = "portal" | "notaire" | "juge" | "internal";

export function resolveHomePath(user: MeResponse | null): string {
  if (!user) return "/login";
  if (user.is_superuser) return "/dashboard";

  const roles = new Set(user.roles);
  if (roles.has("FAMILLE_TUTEUR")) return "/portal";
  if (roles.has("NOTAIRE")) return "/notaire";
  if (roles.has("JUGE")) return "/juge";

  const internalRoles = [...roles].filter((r) => INTERNAL_ROLES.has(r));
  if (internalRoles.length > 0) {
    return homePathForInternalUser(user);
  }

  return "/login";
}

export function portalKindForPath(pathname: string): PortalKind | null {
  if (pathname.startsWith("/portal")) return "portal";
  if (pathname.startsWith("/notaire")) return "notaire";
  if (pathname.startsWith("/juge")) return "juge";
  if (
    pathname.startsWith("/dashboard")
    || pathname.startsWith("/dossiers")
    || pathname.startsWith("/juridique")
    || pathname.startsWith("/charia")
    || pathname.startsWith("/direction")
    || pathname.startsWith("/comptable")
    || pathname.startsWith("/audit")
    || pathname.startsWith("/admin")
    || pathname.startsWith("/compte")
    || pathname.startsWith("/validations")
    || pathname.startsWith("/factures")
    || pathname.startsWith("/investissements")
  ) {
    return "internal";
  }
  return null;
}

export function userCanAccessPortal(user: MeResponse, kind: PortalKind): boolean {
  if (kind === "internal") {
    if (user.is_superuser) return true;
    return user.roles.some((r) => INTERNAL_ROLES.has(r));
  }
  if (kind === "portal") return user.roles.includes("FAMILLE_TUTEUR");
  if (kind === "notaire") return user.roles.includes("NOTAIRE");
  if (kind === "juge") return user.roles.includes("JUGE");
  return false;
}

/** Tableau de bord agent, direction et super-admin. */
export function userUsesAgentDashboard(user: MeResponse | null): boolean {
  const primary = resolvePrimaryInternalRole(user);
  return (
    primary === "AGENT_FIDUCIAIRE" ||
    primary === "DIRECTION" ||
    primary === "SUPER_ADMIN"
  );
}
