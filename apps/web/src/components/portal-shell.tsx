"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  APP_SIDEBAR_OFFSET_CLASS,
  APP_SIDEBAR_WIDTH,
  AppSidebar,
  SidebarMenuButton,
} from "@/components/app-sidebar";
import { PortalCaseSwitcher } from "@/components/portal-case-switcher";
import { UserAccountMenu } from "@/components/user-account-menu";
import type { NavIconId } from "@/components/nav-icon";
import { CASE_TYPE_LABELS } from "@/lib/labels";
import type { PortalKind } from "@/lib/portal-api";
import type { NavItem } from "@/lib/role-access";
import {
  PortalCasesProvider,
  usePortalCases,
} from "@/providers/portal-cases-provider";
import { useAuth } from "@/providers/auth-provider";

const PORTAL_META: Record<
  PortalKind,
  {
    title: string;
    subtitle: string;
    home: string;
    nav: { href: string; label: string; icon: NavIconId }[];
  }
> = {
  portal: {
    title: "Espace famille / tuteur",
    subtitle: "Consultation de vos dossiers et pièces partagées",
    home: "/portal",
    nav: [
      { href: "/portal", label: "Tableau de bord", icon: "dashboard" },
      { href: "/portal/dossiers", label: "Mes dossiers", icon: "dossiers" },
    ],
  },
  notaire: {
    title: "Espace notaire",
    subtitle: "Dossiers rattachés, mandats et pièces notariales",
    home: "/notaire",
    nav: [
      { href: "/notaire", label: "Tableau de bord", icon: "dashboard" },
      { href: "/notaire/dossiers", label: "Dossiers", icon: "dossiers" },
    ],
  },
  juge: {
    title: "Espace juridiction",
    subtitle: "Suivi des dossiers de votre périmètre",
    home: "/juge",
    nav: [
      { href: "/juge", label: "Tableau de bord", icon: "dashboard" },
      { href: "/juge/dossiers", label: "Dossiers", icon: "dossiers" },
    ],
  },
};

/** Sections dossier portail (pas de timeline / finance). */
const CASE_SECTIONS: { slug: string; label: string; icon: NavIconId }[] = [
  { slug: "", label: "Vue d'ensemble", icon: "dashboard" },
  { slug: "mandat", label: "Mandat", icon: "dossiers" },
  { slug: "beneficiaires", label: "Bénéficiaires", icon: "dossiers" },
  { slug: "patrimoine", label: "Patrimoine", icon: "dossiers" },
  { slug: "observations", label: "Observations", icon: "dossiers" },
  { slug: "rapports", label: "Rapports", icon: "dossiers" },
];

function portalNavToItems(
  nav: { href: string; label: string; icon: NavIconId }[],
): NavItem[] {
  return nav.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
  }));
}

function parseCaseRoute(
  pathname: string,
  kind: PortalKind,
): { caseId: number; navBase: string } | null {
  const home =
    kind === "portal" ? "/portal" : kind === "notaire" ? "/notaire" : "/juge";
  const match = pathname.match(
    new RegExp(`^${home}/dossiers/(\\d+)(?:/|$)`),
  );
  if (!match) return null;
  const caseId = Number(match[1]);
  if (!Number.isFinite(caseId)) return null;
  return { caseId, navBase: `${home}/dossiers/${caseId}` };
}

function isPortalNavActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PortalShellInner({
  kind,
  children,
}: {
  kind: PortalKind;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { cases } = usePortalCases();
  const meta = PORTAL_META[kind];
  const [mobileOpen, setMobileOpen] = useState(false);
  const multiCases = cases.length > 1;

  const caseRoute = useMemo(
    () => parseCaseRoute(pathname, kind),
    [pathname, kind],
  );

  const activeCase = useMemo(() => {
    if (!caseRoute) return null;
    return cases.find((c) => c.id === caseRoute.caseId) ?? null;
  }, [cases, caseRoute]);

  const nav = useMemo(() => {
    if (!caseRoute) return portalNavToItems(meta.nav);
    return CASE_SECTIONS.map((section) => ({
      href: section.slug
        ? `${caseRoute.navBase}/${section.slug}`
        : caseRoute.navBase,
      label: section.label,
      icon: section.icon,
    }));
  }, [caseRoute, meta.nav]);

  const headerTitle = useMemo(() => {
    if (activeCase && caseRoute) {
      const typeLabel =
        CASE_TYPE_LABELS[activeCase.case_type || ""] ||
        activeCase.case_type ||
        "Dossier";
      return {
        reference: activeCase.reference,
        subtitle: `${typeLabel} — ${activeCase.title}`,
      };
    }
    const pageLabel =
      meta.nav.find((item) =>
        isPortalNavActive(pathname, item.href, meta.home),
      )?.label ?? meta.title;
    return { reference: null as string | null, subtitle: pageLabel };
  }, [activeCase, caseRoute, meta, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const sidebar = (
    <AppSidebar
      nav={nav}
      user={user}
      onLogout={logout}
      onNavigate={() => setMobileOpen(false)}
      homeHref={caseRoute ? caseRoute.navBase : meta.home}
      brandTitle={meta.title}
      navSubtitle={
        activeCase
          ? activeCase.reference
          : meta.subtitle
      }
      accountHref={undefined}
      groupNav={false}
      beforeNav={
        caseRoute ? <PortalCaseSwitcher variant="sidebar" /> : undefined
      }
      navAriaLabel={
        activeCase
          ? `Navigation dossier ${activeCase.reference}`
          : `Navigation ${meta.title}`
      }
    />
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        data-no-print
        className="sf-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen flex-col lg:flex"
        style={{ width: APP_SIDEBAR_WIDTH }}
      >
        {sidebar}
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          data-no-print
          className="fixed inset-0 z-40 bg-[var(--sf-green-deep)]/45 backdrop-blur-sm lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        data-no-print
        className={`sf-sidebar fixed inset-y-0 left-0 z-50 flex h-screen flex-col transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "min(300px, 92vw)" }}
        aria-hidden={!mobileOpen}
      >
        {sidebar}
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${APP_SIDEBAR_OFFSET_CLASS}`}>
        <header
          data-no-print
          className="sticky top-0 z-30 border-b border-[var(--sf-cream-dark)] bg-white/90 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
            <div className="lg:hidden">
              <SidebarMenuButton onClick={() => setMobileOpen(true)} open={mobileOpen} />
            </div>
            <div className="min-w-0 flex-1">
              {headerTitle.reference ? (
                <>
                  <p className="font-mono text-xs text-[var(--sf-green)]/50">
                    {headerTitle.reference}
                  </p>
                  <p className="sf-display truncate text-base font-semibold text-[var(--sf-green-deep)] sm:text-lg">
                    {headerTitle.subtitle}
                  </p>
                </>
              ) : (
                <p className="sf-display truncate text-base font-semibold text-[var(--sf-green-deep)] sm:text-lg">
                  {headerTitle.subtitle}
                </p>
              )}
            </div>
            {multiCases && caseRoute ? (
              <div className="hidden shrink-0 sm:block">
                <PortalCaseSwitcher variant="header" />
              </div>
            ) : (
              <PortalCaseSwitcher variant="header" />
            )}
            <UserAccountMenu accountHref={undefined} />
          </div>

          {caseRoute && multiCases ? (
            <div className="border-t border-[var(--sf-gold)]/35 bg-gradient-to-r from-[var(--sf-cream)]/80 via-[var(--sf-cream)]/50 to-white px-3 py-3 sm:px-6 sm:py-3.5">
              <PortalCaseSwitcher variant="banner" />
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer
          data-no-print
          className="border-t border-[var(--sf-cream-dark)] bg-white/60 py-4"
        >
          <p className="text-center text-xs text-[var(--sf-green)]/45">
            AMANAH FIDUCIE — {meta.title}
          </p>
        </footer>
      </div>
    </div>
  );
}

export function PortalShell({
  kind,
  children,
}: {
  kind: PortalKind;
  children: React.ReactNode;
}) {
  return (
    <PortalCasesProvider kind={kind}>
      <PortalShellInner kind={kind}>{children}</PortalShellInner>
    </PortalCasesProvider>
  );
}
