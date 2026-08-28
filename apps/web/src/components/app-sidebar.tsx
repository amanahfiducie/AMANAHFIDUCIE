"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { NavIcon } from "@/components/nav-icon";
import { ROLE_LABELS } from "@/lib/labels";
import type { NavItem } from "@/lib/role-access";
import { getUserDisplayName, getUserInitials } from "@/lib/user-display";
import type { MeResponse } from "@/types/api";

const SIDEBAR_WIDTH = "288px";

const METIER_HREFS = new Set([
  "/juridique",
  "/charia",
  "/comptable",
  "/audit",
]);

const PRINCIPAL_HREFS = new Set([
  "/dashboard",
  "/dossiers",
  "/investissements",
  "/validations",
  "/factures",
  "/services",
]);

type NavGroup = {
  title: string;
  items: NavItem[];
};

function isMetierHref(href: string): boolean {
  return [...METIER_HREFS].some(
    (base) => href === base || href.startsWith(`${base}/`),
  );
}

function groupNavItems(nav: NavItem[], homeHref: string): NavGroup[] {
  const withoutCompte = nav.filter((item) => item.href !== "/compte");
  const principal = withoutCompte.filter(
    (item) =>
      PRINCIPAL_HREFS.has(item.href)
      || item.href === homeHref
      || (homeHref !== "/dashboard" && item.href.startsWith(`${homeHref}/`)),
  );
  const metiers = withoutCompte.filter(
    (item) =>
      isMetierHref(item.href)
      && item.href !== homeHref
      && !item.href.startsWith(`${homeHref}/`)
      && !PRINCIPAL_HREFS.has(item.href),
  );
  const admin = withoutCompte.filter((item) => item.href.startsWith("/admin"));

  const grouped = new Set([
    ...principal.map((i) => i.href),
    ...metiers.map((i) => i.href),
    ...admin.map((i) => i.href),
  ]);
  const leftover = withoutCompte.filter((item) => !grouped.has(item.href));
  if (leftover.length > 0) {
    principal.push(...leftover);
  }

  const groups: NavGroup[] = [];
  if (principal.length > 0) {
    groups.push({ title: "Principal", items: principal });
  }
  if (metiers.length > 0) {
    groups.push({ title: "Pôles métier", items: metiers });
  }
  if (admin.length > 0) {
    groups.push({ title: "Administration", items: admin });
  }
  return groups;
}

function isNavActive(pathname: string, href: string, homeHref: string): boolean {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`sf-sidebar-nav-link group ${active ? "sf-sidebar-nav-link--active" : ""}`}
      >
        <span className="sf-sidebar-nav-icon" aria-hidden>
          <NavIcon name={item.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
        </span>
        {active ? (
          <span className="sf-sidebar-nav-chevron" aria-hidden>
            ›
          </span>
        ) : (
          <span
            className="text-white/0 transition group-hover:text-white/25"
            aria-hidden
          >
            ›
          </span>
        )}
      </Link>
    </li>
  );
}

function SidebarBrand({
  homeHref,
  subtitle,
  title,
  onNavigate,
}: {
  homeHref: string;
  subtitle: string;
  title: string;
  onNavigate?: () => void;
}) {
  return (
    <Link href={homeHref} onClick={onNavigate} className="sf-sidebar-brand group">
      <div className="sf-sidebar-brand-seal">
        <Image
          src="/brand/logo-icon.png"
          alt="AMANAH FIDUCIE"
          fill
          className="object-cover"
          sizes="52px"
          priority
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="sf-sidebar-brand-eyebrow">{subtitle}</p>
        <p className="sf-sidebar-brand-title sf-display">{title}</p>
      </div>
    </Link>
  );
}

function SidebarUserCard({
  user,
  pathname,
  accountHref,
  onNavigate,
  onLogout,
}: {
  user: MeResponse;
  pathname: string;
  accountHref?: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const primaryRole = user.roles[0];
  const roleLabel = primaryRole ? (ROLE_LABELS[primaryRole] ?? primaryRole) : null;
  const compteActive = accountHref ? pathname === accountHref : false;

  return (
    <div className="sf-sidebar-user">
      <div className="flex items-center gap-3">
        <div className="sf-sidebar-user-avatar" aria-hidden>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          {roleLabel ? (
            <p className="mt-0.5 truncate text-[11px] text-[var(--sf-gold-soft)]/80">
              {roleLabel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {accountHref ? (
          <Link
            href={accountHref}
            onClick={onNavigate}
            className={`sf-sidebar-user-action ${compteActive ? "sf-sidebar-user-action--active" : ""}`}
          >
            Mon compte
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className={`sf-sidebar-user-action sf-sidebar-user-action--muted ${!accountHref ? "col-span-2" : ""}`}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

export function AppSidebar({
  nav,
  user,
  onLogout,
  onNavigate,
  homeHref = "/dashboard",
  brandSubtitle = "AMANAH FIDUCIE",
  brandTitle = "SOFIGEPAM Connect",
  accountHref = "/compte",
  navSubtitle,
  groupNav = true,
  navAriaLabel = "Navigation principale",
  beforeNav,
}: {
  nav: NavItem[];
  user: MeResponse | null;
  onLogout: () => void;
  onNavigate?: () => void;
  homeHref?: string;
  brandSubtitle?: string;
  brandTitle?: string;
  accountHref?: string;
  /** Texte descriptif sous la marque (portails externes). */
  navSubtitle?: string;
  /** Regrouper Principal / Pôles / Admin (désactivé pour portails). */
  groupNav?: boolean;
  navAriaLabel?: string;
  /** Contenu au-dessus du menu (ex. switcher de dossier portail). */
  beforeNav?: ReactNode;
}) {
  const pathname = usePathname();
  const groups = useMemo(
    () =>
      groupNav
        ? groupNavItems(nav, homeHref)
        : [{ title: "Menu", items: nav.filter((i) => i.href !== "/compte") }],
    [nav, groupNav, homeHref],
  );

  return (
    <div className="sf-sidebar-inner flex h-full min-h-0 w-full flex-col">
      <div className="sf-sidebar-glow" aria-hidden />

      {/* En-tête fixe — marque */}
      <div className="sf-sidebar-header relative shrink-0 px-4 pt-6 pb-3">
        <SidebarBrand
          homeHref={homeHref}
          subtitle={brandSubtitle}
          title={brandTitle}
          onNavigate={onNavigate}
        />

        {navSubtitle ? (
          <p className="mt-3 px-1 text-xs leading-relaxed text-white/55">
            {navSubtitle}
          </p>
        ) : null}

        {beforeNav ? <div className="mt-4">{beforeNav}</div> : null}

        <div className="sf-sidebar-divider" aria-hidden />
      </div>

      {/* Menu défilant */}
      <nav
        className="sf-sidebar-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pr-3"
        aria-label={navAriaLabel}
      >
        {groups.map((group) => (
          <div key={group.title} className="mb-6 last:mb-3">
            {groupNav ? (
              <p className="sf-sidebar-group-label">{group.title}</p>
            ) : null}
            <ul className={groupNav ? "mt-2 space-y-1" : "space-y-1"}>
              {group.items.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href, homeHref)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pied fixe — compte / déconnexion */}
      {user ? (
        <div className="sf-sidebar-footer relative shrink-0 border-t border-white/10 px-4 pt-3 pb-5">
          <SidebarUserCard
            user={user}
            pathname={pathname}
            accountHref={accountHref}
            onNavigate={onNavigate}
            onLogout={onLogout}
          />
        </div>
      ) : null}
    </div>
  );
}

export const APP_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
export const APP_SIDEBAR_OFFSET_CLASS = "lg:pl-[288px]" as const;

export function SidebarMenuButton({
  onClick,
  open,
}: {
  onClick: () => void;
  open?: boolean;
}) {
  return (
    <button
      type="button"
      className="sf-sidebar-menu-btn"
      onClick={onClick}
      aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
      aria-expanded={open}
    >
      <span className="sf-sidebar-menu-btn-bar" />
      <span className="sf-sidebar-menu-btn-bar" />
      <span className="sf-sidebar-menu-btn-bar" />
    </button>
  );
}
