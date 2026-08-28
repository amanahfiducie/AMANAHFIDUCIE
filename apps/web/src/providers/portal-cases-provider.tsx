"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { fetchPortalCases, type PortalKind } from "@/lib/portal-api";
import type { FiduciaryCaseListItem } from "@/types/api";

type PortalCasesContextValue = {
  kind: PortalKind;
  basePath: string;
  cases: FiduciaryCaseListItem[];
  loading: boolean;
  error: string | null;
  activeCaseId: number | null;
  activeCase: FiduciaryCaseListItem | null;
  refresh: () => Promise<void>;
  selectCase: (caseId: number) => void;
  rememberCase: (caseId: number) => void;
};

const PortalCasesContext = createContext<PortalCasesContextValue | null>(null);

function storageKey(kind: PortalKind) {
  return `sf-portal-last-case:${kind}`;
}

function basePathFor(kind: PortalKind) {
  if (kind === "portal") return "/portal";
  if (kind === "notaire") return "/notaire";
  return "/juge";
}

function parseActiveCaseId(pathname: string, basePath: string): number | null {
  const match = pathname.match(
    new RegExp(`^${basePath.replace(/\//g, "\\/")}/dossiers/(\\d+)`),
  );
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function PortalCasesProvider({
  kind,
  children,
}: {
  kind: PortalKind;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = basePathFor(kind);
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPortalCases(kind);
      setCases(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger vos dossiers.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeCaseId = useMemo(
    () => parseActiveCaseId(pathname, basePath),
    [pathname, basePath],
  );

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) ?? null,
    [cases, activeCaseId],
  );

  const rememberCase = useCallback(
    (caseId: number) => {
      try {
        window.localStorage.setItem(storageKey(kind), String(caseId));
      } catch {
        /* ignore */
      }
    },
    [kind],
  );

  useEffect(() => {
    if (activeCaseId != null) rememberCase(activeCaseId);
  }, [activeCaseId, rememberCase]);

  const selectCase = useCallback(
    (caseId: number) => {
      rememberCase(caseId);
      let suffix = "";
      if (activeCaseId != null) {
        const prefix = `${basePath}/dossiers/${activeCaseId}`;
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
          suffix = pathname.slice(prefix.length);
          // Pas de timeline côté client ; rester sur la vue d'ensemble.
          if (suffix === "/timeline" || suffix.startsWith("/timeline/")) {
            suffix = "";
          }
        }
      }
      router.push(`${basePath}/dossiers/${caseId}${suffix}`);
    },
    [activeCaseId, basePath, pathname, rememberCase, router],
  );

  const value = useMemo(
    () => ({
      kind,
      basePath,
      cases,
      loading,
      error,
      activeCaseId,
      activeCase,
      refresh,
      selectCase,
      rememberCase,
    }),
    [
      kind,
      basePath,
      cases,
      loading,
      error,
      activeCaseId,
      activeCase,
      refresh,
      selectCase,
      rememberCase,
    ],
  );

  return (
    <PortalCasesContext.Provider value={value}>
      {children}
    </PortalCasesContext.Provider>
  );
}

export function usePortalCases() {
  const ctx = useContext(PortalCasesContext);
  if (!ctx) {
    throw new Error("usePortalCases must be used within PortalCasesProvider");
  }
  return ctx;
}

/** Dernier dossier mémorisé uniquement (pas de choix automatique si plusieurs). */
export function resolvePreferredCaseId(
  kind: PortalKind,
  cases: FiduciaryCaseListItem[],
): number | null {
  if (cases.length === 0) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(kind));
    const remembered = raw ? Number(raw) : NaN;
    if (Number.isFinite(remembered) && cases.some((c) => c.id === remembered)) {
      return remembered;
    }
  } catch {
    /* ignore */
  }
  return null;
}
