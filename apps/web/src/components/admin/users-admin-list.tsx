"use client";

import { useCallback, useEffect, useState } from "react";

import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { UserDetailDialog } from "@/components/admin/user-detail-dialog";
import {
  DeleteUserIcon,
  EditUserIcon,
  IconActionButton,
  LockUserIcon,
  ResetPasswordIcon,
  UnlockUserIcon,
  ViewUserDetailIcon,
} from "@/components/admin/user-account-action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import {
  ApiError,
  deleteUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type ListUsersParams,
} from "@/lib/api";
import {
  PROFILE_TYPE_FILTER_OPTIONS,
  ROLE_LABELS,
  USER_EXTERNAL_ROLE_FILTER_OPTIONS,
  USER_INTERNAL_ROLE_FILTER_OPTIONS,
  USER_ROLE_FILTER_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
} from "@/lib/labels";
import { userCanManageUsers } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { UserListItem } from "@/types/api";

export type UsersListPreset = {
  title: string;
  description?: string;
  fixedParams?: ListUsersParams;
  roleOptions?: "all" | "internal" | "external";
  showProfileTypeFilter?: boolean;
  showStatusFilter?: boolean;
};

function userDisplayName(u: UserListItem): string {
  return (
    u.profile?.display_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.username
  );
}

function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <span className="text-[var(--sf-green)]/45">Aucun rôle</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span
          key={role}
          className="inline-flex rounded-md bg-[var(--sf-green)]/8 px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]"
        >
          {ROLE_LABELS[role] ?? role}
        </span>
      ))}
    </div>
  );
}

const ROLE_OPTIONS_BY_KIND = {
  all: USER_ROLE_FILTER_OPTIONS,
  internal: USER_INTERNAL_ROLE_FILTER_OPTIONS,
  external: USER_EXTERNAL_ROLE_FILTER_OPTIONS,
} as const;

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3 py-2.5 text-sm text-[var(--sf-green-deep)] outline-none focus:border-[var(--sf-green-mid)] focus:ring-2 focus:ring-[var(--sf-green-mid)]/20";

export function UsersAdminList({
  preset,
  onSuccess,
}: {
  preset: UsersListPreset;
  onSuccess?: (message: string) => void;
}) {
  const { user } = useAuth();
  const canManage = userCanManageUsers(user);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [detailUser, setDetailUser] = useState<UserListItem | null>(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(preset.fixedParams?.status ?? "");

  const roleOptions = ROLE_OPTIONS_BY_KIND[preset.roleOptions ?? "all"];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({
        ...preset.fixedParams,
        q: debouncedSearch || undefined,
        profile_type:
          preset.showProfileTypeFilter === false
            ? undefined
            : profileTypeFilter || undefined,
        role: roleFilter || undefined,
        status:
          preset.showStatusFilter === false
            ? preset.fixedParams?.status
            : (statusFilter as ListUsersParams["status"]) || undefined,
      });
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger la liste des utilisateurs.",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, profileTypeFilter, roleFilter, statusFilter, preset]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function handleUserSaved(updated: UserListItem) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === updated.id
          ? { ...updated, case_links: updated.case_links ?? u.case_links }
          : u,
      ),
    );
    onSuccess?.(`Compte ${updated.username} mis à jour.`);
  }

  async function handleResetPassword(target: UserListItem) {
    if (!target.email) return;
    if (
      !window.confirm(
        `Réinitialiser le mot de passe de ${target.username} ? Un e-mail sera envoyé à ${target.email}.`,
      )
    ) {
      return;
    }
    setActionUserId(target.id);
    setError(null);
    try {
      const result = await resetUserPassword(target.id);
      const note = result.email_sent
        ? `E-mail envoyé à ${result.email}.`
        : result.email_error
          ? `Mot de passe réinitialisé (${result.email_error}).`
          : "Mot de passe réinitialisé.";
      onSuccess?.(`Compte ${target.username} : ${note}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de réinitialiser le mot de passe.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function handleToggleBlock(target: UserListItem) {
    const label = target.is_active ? "bloquer" : "débloquer";
    if (
      !window.confirm(
        `${target.is_active ? "Bloquer" : "Débloquer"} le compte ${target.username} ?`,
      )
    ) {
      return;
    }
    setActionUserId(target.id);
    setError(null);
    try {
      const updated = await updateUser(target.id, { is_active: !target.is_active });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updated.id
            ? { ...updated, case_links: updated.case_links ?? u.case_links }
            : u,
        ),
      );
      onSuccess?.(`Compte ${updated.username} ${label === "bloquer" ? "bloqué" : "débloqué"}.`);
      if (preset.fixedParams?.status === "blocked" && updated.is_active) {
        setUsers((prev) => prev.filter((u) => u.id !== updated.id));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Impossible de ${label} ce compte.`,
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function handleDelete(target: UserListItem) {
    if (
      !window.confirm(
        `Supprimer définitivement le compte ${target.username} ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setActionUserId(target.id);
    setError(null);
    try {
      await deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      onSuccess?.(`Compte ${target.username} supprimé.`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de supprimer ce compte.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  const hasActiveFilters =
    Boolean(searchQuery)
    || Boolean(roleFilter)
    || Boolean(profileTypeFilter)
    || Boolean(statusFilter);

  return (
    <>
      {error ? <ErrorAlert message={error} /> : null}

      {editingUser ? (
        <EditUserDialog
          user={editingUser}
          open={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      ) : null}

      {detailUser ? (
        <UserDetailDialog
          user={detailUser}
          open={Boolean(detailUser)}
          onClose={() => setDetailUser(null)}
          canManageAccess={canManage}
          onUserUpdated={(updated) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === updated.id ? updated : u)),
            );
            setDetailUser(updated);
          }}
          onEdit={
            canManage
              ? () => {
                  setEditingUser(detailUser);
                  setDetailUser(null);
                }
              : undefined
          }
        />
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="space-y-4 border-b border-[var(--sf-cream-dark)] px-6 py-4">
          <div>
            <h2 className="font-semibold text-[var(--sf-green-deep)]">
              {preset.title} ({users.length})
            </h2>
            {preset.description ? (
              <p className="mt-1 text-sm text-[var(--sf-green)]/60">{preset.description}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[220px] flex-1">
              <label
                htmlFor="user-search"
                className="text-xs font-medium tracking-wide text-[var(--sf-green)]/60 uppercase"
              >
                Recherche
              </label>
              <input
                id="user-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Identifiant, nom, e-mail, téléphone, dossier…"
                className={inputClass}
              />
            </div>
            <div className="w-full sm:w-52">
              <label
                htmlFor="role-filter"
                className="text-xs font-medium tracking-wide text-[var(--sf-green)]/60 uppercase"
              >
                Rôle métier
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={inputClass}
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {preset.showProfileTypeFilter !== false ? (
              <div className="w-full sm:w-52">
                <label
                  htmlFor="profile-type-filter"
                  className="text-xs font-medium tracking-wide text-[var(--sf-green)]/60 uppercase"
                >
                  Profil dossier
                </label>
                <select
                  id="profile-type-filter"
                  value={profileTypeFilter}
                  onChange={(e) => setProfileTypeFilter(e.target.value)}
                  className={inputClass}
                >
                  {PROFILE_TYPE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {preset.showStatusFilter ? (
              <div className="w-full sm:w-44">
                <label
                  htmlFor="status-filter"
                  className="text-xs font-medium tracking-wide text-[var(--sf-green)]/60 uppercase"
                >
                  Statut compte
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={inputClass}
                >
                  {USER_STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("");
                  setProfileTypeFilter("");
                  setStatusFilter(preset.fixedParams?.status ?? "");
                }}
              >
                Réinitialiser
              </Button>
            ) : null}
          </div>
        </div>
        {loading ? (
          <div className="p-8">
            <LoadingState label="Chargement des utilisateurs…" />
          </div>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--sf-green)]/60">
            {hasActiveFilters
              ? "Aucun compte ne correspond à ces critères."
              : "Aucun utilisateur pour le moment."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 text-xs tracking-wide text-[var(--sf-green)]/60 uppercase">
                  <th className="px-6 py-3 font-medium">Identifiant</th>
                  <th className="px-6 py-3 font-medium">Nom</th>
                  <th className="px-6 py-3 font-medium">Téléphone</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                  <th className="px-6 py-3 font-medium">Rôles</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = user?.id === u.id;
                  const busy = actionUserId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-[var(--sf-cream-dark)]/80 last:border-0 ${
                        !u.is_active ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <p className="font-mono text-base font-bold tracking-wider text-[var(--sf-green-deep)]">
                          {u.username}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--sf-green-deep)]">
                          {userDisplayName(u)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-[var(--sf-green)]/80">
                        {u.profile?.phone || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {u.is_active ? (
                          <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                            Bloqué
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadges roles={u.roles} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <IconActionButton
                            label="Voir le détail"
                            disabled={busy}
                            onClick={() => setDetailUser(u)}
                          >
                            <ViewUserDetailIcon />
                          </IconActionButton>
                          {canManage ? (
                            <>
                              <IconActionButton
                                label="Modifier le compte"
                                disabled={busy}
                                onClick={() => setEditingUser(u)}
                              >
                                <EditUserIcon />
                              </IconActionButton>
                              <IconActionButton
                                label={
                                  !u.email
                                    ? "Ajoutez un e-mail pour réinitialiser le mot de passe"
                                    : "Réinitialiser le mot de passe"
                                }
                                disabled={busy || !u.email}
                                onClick={() => void handleResetPassword(u)}
                              >
                                <ResetPasswordIcon />
                              </IconActionButton>
                              <IconActionButton
                                label={
                                  isSelf
                                    ? "Vous ne pouvez pas bloquer votre propre compte"
                                    : u.is_active
                                      ? "Bloquer le compte"
                                      : "Débloquer le compte"
                                }
                                disabled={busy || isSelf}
                                onClick={() => void handleToggleBlock(u)}
                              >
                                {u.is_active ? <LockUserIcon /> : <UnlockUserIcon />}
                              </IconActionButton>
                              <IconActionButton
                                label={
                                  isSelf
                                    ? "Vous ne pouvez pas supprimer votre propre compte"
                                    : "Supprimer le compte"
                                }
                                variant="danger"
                                disabled={busy || isSelf}
                                onClick={() => void handleDelete(u)}
                              >
                                <DeleteUserIcon />
                              </IconActionButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
