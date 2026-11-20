import type { MobileUser } from "./types";

/** Sunucunun `/admin/users/:id/impersonate` yaniti. */
export type ImpersonationResponse = {
  accessToken: string;
  expiresAt: string;
  user: MobileUser;
};

/** Oturumun bitmesine kalan sure; gecersiz ya da gecmis tarih 0 (hemen cik). */
export function msUntilExpiry(expiresAt: string, now: number = Date.now()): number {
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - now);
}

/** Bannerda gorunen kimlik: ad, yoksa e-posta, yoksa telefon. */
export function impersonationLabel(user: Pick<MobileUser, "name" | "email" | "phone">): string {
  return user.name?.trim() || user.email || user.phone || "";
}
