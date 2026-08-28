import type { MeResponse } from "@/types/api";

/** Initiales : 1ère lettre du prénom + 1ère lettre du nom. */
export function getUserInitials(user: MeResponse | null | undefined): string {
  if (!user) return "?";
  const first = user.first_name?.trim().charAt(0);
  const last = user.last_name?.trim().charAt(0);
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const display = user.profile?.display_name?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  const letter = user.username?.match(/^[A-Za-z]/)?.[0];
  if (letter) return letter.toUpperCase();
  return "?";
}

export function getUserDisplayName(user: MeResponse | null | undefined): string {
  if (!user) return "";
  const fullName = [user.first_name, user.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  return user.profile?.display_name?.trim() || user.username;
}
