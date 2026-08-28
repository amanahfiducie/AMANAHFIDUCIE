"use client";

import { useRouter } from "next/navigation";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ApiError,
    logout as apiLogout,
    fetchMe,
    loginStart,
    loginVerify,
} from "@/lib/api";
import { resolveHomePath } from "@/lib/auth-routing";
import { getAccessToken } from "@/lib/auth-storage";
import type { MeResponse } from "@/types/api";

export type LoginChallengeInfo = {
  challengeToken: string;
  maskedEmail: string;
  expiresInSeconds: number;
  devCode?: string;
  devNotice?: string;
  deliveryNotice?: string;
};

type AuthContextValue = {
  user: MeResponse | null;
  loading: boolean;
  startLogin: (identifier: string, password: string) => Promise<LoginChallengeInfo>;
  completeLogin: (
    challengeToken: string,
    code: string,
    redirectTo?: string,
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        apiLogout();
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const startLogin = useCallback(async (identifier: string, password: string) => {
    const challenge = await loginStart(identifier, password);
    return {
      challengeToken: challenge.challenge_token,
      maskedEmail: challenge.masked_email,
      expiresInSeconds: challenge.expires_in_seconds,
      devCode: challenge.dev_code,
      devNotice: challenge.dev_notice,
      deliveryNotice: challenge.delivery_notice,
    };
  }, []);

  const completeLogin = useCallback(
    async (challengeToken: string, code: string, redirectTo?: string) => {
      const me = await loginVerify(challengeToken, code);
      setUser(me);
      router.push(redirectTo || resolveHomePath(me));
    },
    [router],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, startLogin, completeLogin, logout, refreshUser }),
    [user, loading, startLogin, completeLogin, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }
  return ctx;
}
