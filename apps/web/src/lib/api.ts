import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth-storage";
import type {
  ApiErrorBody,
  CreateUserPayload,
  MeResponse,
  ProfileAccessInviteResult,
  ProfileAccessPreview,
  TokenPair,
  UserListItem,
} from "@/types/api";

export function formatApiError(status: number, body: ApiErrorBody): string {
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.message === "string") return body.message;

  if (Array.isArray(body.details)) {
    const fromDetails = body.details
      .map((item) => {
        if (item && typeof item === "object" && "message" in item) {
          const field = "field" in item && item.field ? `${String(item.field)}: ` : "";
          return `${field}${String(item.message)}`;
        }
        return String(item);
      })
      .filter(Boolean);
    if (fromDetails.length > 0) return fromDetails.join(" · ");
  }

  if (typeof body.error === "string" && body.error !== "VALIDATION_ERROR") {
    return body.error;
  }

  if (Array.isArray(body.onboarding)) {
    return body.onboarding.map(String).join(" ");
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (key === "detail" || key === "message" || key === "error") continue;
    if (Array.isArray(value)) {
      const label = key === "non_field_errors" ? "" : `${key}: `;
      parts.push(`${label}${value.map(String).join(", ")}`);
    } else if (typeof value === "string") {
      parts.push(`${key}: ${value}`);
    }
  }
  if (parts.length > 0) return parts.join(" · ");
  return `Erreur API (${status})`;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(formatApiError(status, body));
    this.status = status;
    this.body = body;
  }
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

const API_V1 = `${API_BASE}/api/v1`;

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_V1}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = (await res.json()) as { access: string };
  setTokens(data.access, refresh);
  return data.access;
}

async function parseBody(res: Response): Promise<ApiErrorBody> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_V1}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export type LoginChallengeResponse = {
  challenge_token: string;
  masked_email: string;
  expires_in_seconds: number;
  /** Dev uniquement si LOGIN_OTP_EXPOSE_DEV_CODE=1 */
  dev_code?: string;
  dev_notice?: string;
  delivery?: "email" | "display";
  delivery_notice?: string;
};

export type LoginVerifyResponse = TokenPair & {
  user: { id: number; username: string; email: string; roles: string[] };
};

export async function loginStart(
  identifier: string,
  password: string,
): Promise<LoginChallengeResponse> {
  return apiRequest<LoginChallengeResponse>("/auth/login/start/", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export async function loginVerify(
  challengeToken: string,
  code: string,
): Promise<MeResponse> {
  const data = await apiRequest<LoginVerifyResponse>("/auth/login/verify/", {
    method: "POST",
    body: JSON.stringify({ challenge_token: challengeToken, code }),
  });
  setTokens(data.access, data.refresh);
  return apiRequest<MeResponse>("/me/");
}

/** @deprecated Utiliser loginStart + loginVerify (double facteur). */
export async function login(username: string, password: string): Promise<MeResponse> {
  const tokens = await apiRequest<TokenPair>("/auth/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setTokens(tokens.access, tokens.refresh);
  return apiRequest<MeResponse>("/me/");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest<{ ok: boolean }>("/auth/change-password/", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>("/me/");
}

export type ListUsersParams = {
  q?: string;
  profile_type?: string;
  role?: string;
  scope?: "internal" | "external";
  status?: "active" | "blocked";
};

export async function listUsers(params?: ListUsersParams): Promise<UserListItem[]> {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.profile_type?.trim()) search.set("profile_type", params.profile_type.trim());
  if (params?.role?.trim()) search.set("role", params.role.trim());
  if (params?.scope) search.set("scope", params.scope);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  return apiRequest<UserListItem[]>(`/users/${qs ? `?${qs}` : ""}`);
}

export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  return apiRequest<UserListItem>("/users/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  userId: number,
  payload: import("@/types/api").UpdateUserPayload,
): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId: number): Promise<void> {
  await apiRequest<void>(`/users/${userId}/`, {
    method: "DELETE",
  });
}

export type ResetUserPasswordResult = {
  username: string;
  email: string;
  temporary_password: string;
  email_sent: boolean;
  email_error?: string | null;
  is_active: boolean;
};

export async function resetUserPassword(
  userId: number,
): Promise<ResetUserPasswordResult> {
  return apiRequest<ResetUserPasswordResult>(`/users/${userId}/reset-password/`, {
    method: "POST",
  });
}

export async function revokeUserCaseAccess(
  userId: number,
  caseId: number,
): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${userId}/revoke-case-access/`, {
    method: "POST",
    body: JSON.stringify({ case_id: caseId }),
  });
}

export async function listUserAccessRequests(
  status = "PENDING",
): Promise<import("@/types/api").ProfileUserAccessRequestItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/user-access-requests/${qs || ""}`);
}

export async function previewUserAccessRequest(
  requestId: number,
): Promise<ProfileAccessPreview> {
  return apiRequest<ProfileAccessPreview>(
    `/user-access-requests/${requestId}/preview/`,
  );
}

export async function approveUserAccessRequest(
  requestId: number,
  payload: { email: string; confirm_add_existing?: boolean; review_notes?: string },
): Promise<{ request: import("@/types/api").ProfileUserAccessRequestItem; invite: ProfileAccessInviteResult }> {
  return apiRequest(`/user-access-requests/${requestId}/approve/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rejectUserAccessRequest(
  requestId: number,
  payload?: { review_notes?: string },
): Promise<import("@/types/api").ProfileUserAccessRequestItem> {
  return apiRequest(`/user-access-requests/${requestId}/reject/`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function fetchApiBlob(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Blob> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_V1}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return fetchApiBlob(path, options, false);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }
  return res.blob();
}

export async function verifyPassword(password: string): Promise<void> {
  await apiRequest<{ ok: boolean }>("/auth/verify-password/", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function logout(): void {
  clearTokens();
}

export async function listServiceOffers() {
  return apiRequest<import("@/types/api").ServiceOfferListItem[]>("/services/");
}

export async function getServiceOffer(caseType: string) {
  return apiRequest<import("@/types/api").ServiceOfferDetail>(
    `/services/${caseType}/`,
  );
}

export async function updateServiceOffer(
  caseType: string,
  payload: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    sort_order: number;
  }>,
) {
  return apiRequest<import("@/types/api").ServiceOfferDetail>(
    `/services/${caseType}/`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function getServicesMeta() {
  return apiRequest<import("@/types/api").ServicesMeta>("/services/meta/");
}

export async function createServiceBillingRule(
  caseType: string,
  payload: import("@/types/api").ServiceBillingRulePayload,
) {
  return apiRequest<import("@/types/api").ServiceBillingRule>(
    `/services/${caseType}/billing-rules/`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateServiceBillingRule(
  caseType: string,
  ruleId: number,
  payload: Partial<import("@/types/api").ServiceBillingRulePayload>,
) {
  return apiRequest<import("@/types/api").ServiceBillingRule>(
    `/services/${caseType}/billing-rules/${ruleId}/`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function deleteServiceBillingRule(caseType: string, ruleId: number) {
  await apiRequest<void>(`/services/${caseType}/billing-rules/${ruleId}/`, {
    method: "DELETE",
  });
}

export async function getCaseBillingOverview(caseId: string | number) {
  return apiRequest<import("@/types/api").CaseBillingOverview>(
    `/cases/${caseId}/billing/`,
  );
}

export async function previewCaseBillingCharge(
  caseId: string | number,
  payload: import("@/types/api").CaseBillingChargeCreatePayload,
) {
  return apiRequest<import("@/types/api").CaseBillingPreview>(
    `/cases/${caseId}/billing/preview/`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function createCaseBillingCharge(
  caseId: string | number,
  payload: import("@/types/api").CaseBillingChargeCreatePayload,
) {
  return apiRequest<import("@/types/api").CaseBillingOverview>(
    `/cases/${caseId}/billing/charges/`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function postCaseBillingCharge(
  caseId: string | number,
  chargeId: number,
) {
  return apiRequest<import("@/types/api").CaseBillingOverview>(
    `/cases/${caseId}/billing/charges/${chargeId}/post/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function cancelCaseBillingCharge(
  caseId: string | number,
  chargeId: number,
) {
  return apiRequest<import("@/types/api").CaseBillingOverview>(
    `/cases/${caseId}/billing/charges/${chargeId}/cancel/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function downloadCaseBillingChargePdf(
  caseId: string | number,
  chargeId: number,
) {
  return fetchApiBlob(`/cases/${caseId}/billing/charges/${chargeId}/pdf/`);
}

export async function listServiceBilledCases(caseType: string) {
  return apiRequest<import("@/types/api").ServiceBilledCasesResponse>(
    `/services/${caseType}/cases/`,
  );
}

export async function generateServicePeriodicBilling(
  caseType: string,
  payload: import("@/types/api").PeriodicBillingGeneratePayload = {},
) {
  return apiRequest<import("@/types/api").PeriodicBillingGenerateResult>(
    `/services/${caseType}/billing/generate/`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function listBillingInvoices(params?: {
  status?: string;
  case_type?: string;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.case_type) q.set("case_type", params.case_type);
  const suffix = q.toString() ? `?${q}` : "";
  return apiRequest<{ results: import("@/types/api").PeriodBillingInvoice[] }>(
    `/billing/invoices/${suffix}`,
  );
}

export async function previewBillingInvoice(params: {
  case_id: number;
  period_label?: string;
}) {
  const q = new URLSearchParams({ case_id: String(params.case_id) });
  if (params.period_label) q.set("period_label", params.period_label);
  return apiRequest<import("@/types/api").BillingInvoicePreview>(
    `/billing/invoices/preview/?${q}`,
  );
}

export async function saveBillingInvoice(payload: {
  case_id: number;
  period_label?: string;
  label?: string;
  notes?: string;
  lines: import("@/types/api").BillingInvoiceLineInput[];
}) {
  return apiRequest<import("@/types/api").PeriodBillingInvoice>(
    "/billing/invoices/",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updatePeriodBillingInvoice(
  invoiceId: number,
  payload: Partial<{
    label: string;
    notes: string;
    period_label: string;
    lines: import("@/types/api").BillingInvoiceLineInput[];
  }>,
) {
  return apiRequest<import("@/types/api").PeriodBillingInvoice>(
    `/billing/invoices/${invoiceId}/`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function postPeriodBillingInvoice(invoiceId: number) {
  return apiRequest<import("@/types/api").PeriodBillingInvoice>(
    `/billing/invoices/${invoiceId}/post/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function cancelPeriodBillingInvoice(invoiceId: number) {
  return apiRequest<import("@/types/api").PeriodBillingInvoice>(
    `/billing/invoices/${invoiceId}/cancel/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function downloadPeriodBillingInvoicePdf(invoiceId: number) {
  return fetchApiBlob(`/billing/invoices/${invoiceId}/pdf/`);
}

export { API_BASE, API_V1 };
