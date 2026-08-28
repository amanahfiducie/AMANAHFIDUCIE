"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
    APP_SIDEBAR_OFFSET_CLASS,
    APP_SIDEBAR_WIDTH,
    AppSidebar,
    SidebarMenuButton,
} from "@/components/app-sidebar";
import { PORTAL_ID } from "@/components/case/case-header-portal";
import { UserAccountMenu } from "@/components/user-account-menu";
import { navConfigForUser, shellSubtitleForUser } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

function isCaseDetailPath(pathname: string): boolean {
  return /^\/dossiers\/\d+(\/|$)/.test(pathname);
}

function isNavActive(pathname: string, href: string, homeHref: string): boolean {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navConfig = navConfigForUser(user);
  const { items: nav, homeHref, groupNav } = navConfig;
  const shellSubtitle = shellSubtitleForUser(user);
  const caseDetailView = isCaseDetailPath(pathname);
  const pageTitle =
    nav.find((item) => isNavActive(pathname, item.href, homeHref))?.label ?? "SOFIGEPAM Connect";

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
      homeHref={homeHref}
      groupNav={groupNav}
      navSubtitle={shellSubtitle}
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
          className="sticky top-0 z-30 border-b border-[var(--sf-cream-dark)] bg-white/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 sm:py-4 lg:px-8"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 lg:hidden">
              <SidebarMenuButton onClick={() => setMobileOpen(true)} open={mobileOpen} />
            </div>
            <div className="min-w-0 flex-1">
              {caseDetailView ? (
                <div id={PORTAL_ID} className="min-w-0" />
              ) : (
                <>
                  <p className="text-xs font-medium tracking-wide text-[var(--sf-green)]/50 uppercase">
                    {shellSubtitle}
                  </p>
                  <p className="sf-display truncate text-lg font-semibold text-[var(--sf-green-deep)]">
                    {pageTitle}
                  </p>
                </>
              )}
            </div>
            <UserAccountMenu className="mt-0.5" accountHref="/compte" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer
          data-no-print
          className="border-t border-[var(--sf-cream-dark)] bg-white/60 py-4"
        >
          <p className="text-center text-xs text-[var(--sf-green)]/45">
            AMANAH FIDUCIE — SOFIGEPAM Connect · Plateforme fiduciaire sécurisée
          </p>
        </footer>
      </div>
    </div>
  );
}
