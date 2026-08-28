"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, revokeUserCaseAccess } from "@/lib/api";
import {
  PROFILE_TYPE_LABELS,
  ROLE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
} from "@/lib/labels";
import type { UserCaseLink, UserListItem } from "@/types/api";

function userDisplayName(u: UserListItem): string {
  return (
    u.profile?.display_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.username
  );
}

function hasGlobalAccess(user: UserListItem): boolean {
  if (user.has_global_case_access) return true;
  if (user.is_superuser) return true;
  const roles = new Set(user.roles);
  return (
    roles.has("SUPER_ADMIN") ||
    roles.has("DIRECTION") ||
    roles.has("COMITE_CHARAIQUE")
  );
}

function linkRoleLabels(link: UserCaseLink): string[] {
  const labels = [
    ...(link.is_case_manager ? ["Chargé de dossier"] : []),
    ...(link.stakeholder_roles ?? []).map(
      (r) => STAKEHOLDER_ROLE_LABELS[r] ?? r,
    ),
    ...link.profile_types.map((t) => PROFILE_TYPE_LABELS[t] ?? t),
  ];
  return [...new Set(labels)];
}

type Props = {
  user: UserListItem;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  canManageAccess?: boolean;
  onUserUpdated?: (user: UserListItem) => void;
};

export function UserDetailDialog({
  user: initialUser,
  open,
  onClose,
  onEdit,
  canManageAccess = false,
  onUserUpdated,
}: Props) {
  const [user, setUser] = useState(initialUser);
  const [revokingCaseId, setRevokingCaseId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [caseQuery, setCaseQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setUser(initialUser);
    setActionError(null);
    setRevokingCaseId(null);
    setCaseQuery("");
    setRoleFilter("");
  }, [open, initialUser]);

  const globalAccess = hasGlobalAccess(user);
  const caseLinks = user.case_links ?? [];

  const filterOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const link of caseLinks) {
      if (link.is_case_manager) {
        options.set("manager", "Chargé de dossier");
      }
      for (const role of link.stakeholder_roles ?? []) {
        options.set(`role:${role}`, STAKEHOLDER_ROLE_LABELS[role] ?? role);
      }
      for (const profile of link.profile_types) {
        options.set(
          `profile:${profile}`,
          PROFILE_TYPE_LABELS[profile] ?? profile,
        );
      }
    }
    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [caseLinks]);

  const filteredLinks = useMemo(() => {
    const q = caseQuery.trim().toLowerCase();
    return caseLinks.filter((link) => {
      if (q) {
        const haystack = `${link.reference} ${link.title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (!roleFilter) return true;
      if (roleFilter === "manager") return Boolean(link.is_case_manager);
      if (roleFilter.startsWith("role:")) {
        const role = roleFilter.slice("role:".length);
        return (link.stakeholder_roles ?? []).includes(role);
      }
      if (roleFilter.startsWith("profile:")) {
        const profile = roleFilter.slice("profile:".length);
        return link.profile_types.includes(
          profile as UserCaseLink["profile_types"][number],
        );
      }
      return true;
    });
  }, [caseLinks, caseQuery, roleFilter]);

  if (!open) return null;

  async function handleRevoke(caseId: number, reference: string) {
    if (
      !window.confirm(
        `Suspendre l'accès de ${user.username} au dossier ${reference} ?\n\nLa personne ne pourra plus consulter ce dossier.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setRevokingCaseId(caseId);
    try {
      const updated = await revokeUserCaseAccess(user.id, caseId);
      setUser(updated);
      onUserUpdated?.(updated);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Impossible de suspendre l'accès à ce dossier.",
      );
    } finally {
      setRevokingCaseId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-3 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
          <div>
            <h3
              id="user-detail-title"
              className="text-lg font-semibold text-[var(--sf-green-deep)]"
            >
              Détail du compte
            </h3>
            <p className="mt-0.5 font-mono text-sm text-[var(--sf-green-mid)]">
              {user.username}
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-[var(--sf-green-mid)] hover:underline"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        {actionError ? (
          <p className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-6">
            {actionError}
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          {/* Colonne gauche — identité */}
          <aside className="space-y-5 overflow-y-auto border-b border-[var(--sf-cream-dark)] px-5 py-5 text-sm lg:border-b-0 lg:border-r sm:px-6">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
                Identité
              </h4>
              <dl className="mt-2 space-y-2.5">
                <div>
                  <dt className="text-xs text-[var(--sf-green)]/55">Nom affiché</dt>
                  <dd className="mt-0.5 font-medium text-[var(--sf-green-deep)]">
                    {userDisplayName(user)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--sf-green)]/55">Statut</dt>
                  <dd className="mt-1">
                    {user.is_active ? (
                      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                        Bloqué
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
                Contact
              </h4>
              <dl className="mt-2 space-y-2.5">
                <div>
                  <dt className="text-xs text-[var(--sf-green)]/55">E-mail</dt>
                  <dd className="mt-0.5 break-all text-[var(--sf-green-deep)]">
                    {user.email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--sf-green)]/55">Téléphone</dt>
                  <dd className="mt-0.5 text-[var(--sf-green-deep)]">
                    {user.profile?.phone || "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
                Rôles métier
              </h4>
              {user.roles.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <li
                      key={role}
                      className="inline-flex rounded-md bg-[var(--sf-green)]/8 px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[var(--sf-green)]/50">Aucun rôle attribué.</p>
              )}
            </section>
          </aside>

          {/* Colonne droite — dossiers */}
          <section className="flex min-h-0 flex-col px-5 py-5 text-sm sm:px-6">
            <div className="shrink-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
                    Accès aux dossiers
                  </h4>
                  {!globalAccess ? (
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      {caseLinks.length} dossier
                      {caseLinks.length > 1 ? "s" : ""} rattaché
                      {caseLinks.length > 1 ? "s" : ""}
                      {caseQuery || roleFilter
                        ? ` · ${filteredLinks.length} affiché${filteredLinks.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              {!globalAccess && caseLinks.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Rechercher un dossier</span>
                    <input
                      type="search"
                      value={caseQuery}
                      onChange={(e) => setCaseQuery(e.target.value)}
                      placeholder="Rechercher par référence ou titre…"
                      className="sf-input w-full text-sm"
                    />
                  </label>
                  <label className="sm:w-56">
                    <span className="sr-only">Filtrer par rôle</span>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="sf-input w-full text-sm"
                    >
                      <option value="">Tous les rattachements</option>
                      {filterOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {globalAccess ? (
                <div className="rounded-xl border border-[var(--sf-gold)]/40 bg-[var(--sf-cream)]/60 px-4 py-4">
                  <p className="font-medium text-[var(--sf-green-deep)]">
                    Accès à tous les dossiers
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--sf-green)]/65">
                    Direction, administrateur et comité charaïque consultent
                    l&apos;ensemble du portefeuille. Aucun rattachement
                    individuel n&apos;est nécessaire.
                  </p>
                </div>
              ) : caseLinks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] px-4 py-8 text-center text-[var(--sf-green)]/50">
                  Aucun dossier lié à ce compte.
                </p>
              ) : filteredLinks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] px-4 py-8 text-center text-[var(--sf-green)]/50">
                  Aucun dossier ne correspond à votre recherche.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {filteredLinks.map((link) => {
                    const labels = linkRoleLabels(link);
                    return (
                      <li
                        key={link.case_id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dossiers/${link.case_id}`}
                            className="font-mono text-sm font-semibold text-[var(--sf-green-deep)] hover:underline"
                            onClick={onClose}
                          >
                            {link.reference}
                          </Link>
                          <p className="mt-0.5 text-[var(--sf-green)]/75">
                            {link.title}
                          </p>
                          {labels.length > 0 ? (
                            <p className="mt-1.5 text-xs text-[var(--sf-green)]/50">
                              {labels.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {canManageAccess ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="shrink-0 text-xs text-red-800 hover:bg-red-50"
                            disabled={revokingCaseId === link.case_id}
                            onClick={() =>
                              void handleRevoke(link.case_id, link.reference)
                            }
                          >
                            {revokingCaseId === link.case_id
                              ? "Suspension…"
                              : "Suspendre l'accès"}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
          {onEdit ? (
            <Button type="button" variant="gold" onClick={onEdit}>
              Modifier
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
