"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ROLE_LABELS } from "@/lib/labels";
import { getUserDisplayName, getUserInitials } from "@/lib/user-display";
import { useAuth } from "@/providers/auth-provider";

type UserAccountMenuProps = {
  /** Lien « Mon compte » — omis si non fourni (ex. portails externes). */
  accountHref?: string;
  className?: string;
};

export function UserAccountMenu({ accountHref = "/compte", className = "" }: UserAccountMenuProps) {
  const { user, logout, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const primaryRole = user?.roles[0];
  const roleLabel = primaryRole ? (ROLE_LABELS[primaryRole] ?? primaryRole) : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading || !user) {
    return (
      <div
        className={`h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--sf-cream-dark)] ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[var(--sf-cream-dark)] bg-white py-1 pr-2 pl-1 shadow-sm transition hover:border-[var(--sf-green)]/25 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-green-mid)]/40"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={displayName}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--sf-green)] to-[var(--sf-green-mid)] text-sm font-semibold text-white"
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden max-w-[200px] truncate text-sm font-medium text-[var(--sf-green-deep)] sm:inline">
          {displayName}
        </span>
        <span
          className={`hidden text-[var(--sf-green)]/50 sm:inline ${open ? "rotate-180" : ""} transition-transform`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--sf-green)] to-[var(--sf-green-mid)] text-base font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--sf-green-deep)]">
                  {displayName}
                </p>
                <p className="truncate text-xs text-[var(--sf-green)]/65">{user.email}</p>
                {roleLabel ? (
                  <p className="mt-0.5 truncate text-xs text-[var(--sf-green-mid)]">{roleLabel}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-2">
            {accountHref ? (
              <Link
                href={accountHref}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sf-green-deep)] transition hover:bg-[var(--sf-cream)]"
              >
                <span className="text-base opacity-80" aria-hidden>
                  ⚙
                </span>
                Mon compte
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sf-green-deep)] transition hover:bg-[var(--sf-cream)]"
            >
              <span className="text-base opacity-80" aria-hidden>
                ⎋
              </span>
              Déconnexion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
