/**
 * Stub — faire évoluer à mesure que les endpoints `/api/v1` se stabilisent.
 */

export type HealthResponse = {
  status: string;
};

export type MeResponse = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  profile: {
    display_name: string;
    phone: string;
    timezone: string;
    locale: string;
    created_at: string;
    updated_at: string;
  };
  roles: string[];
};
