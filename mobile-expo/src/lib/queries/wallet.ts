import { api } from "../api";
import type { WalletLink } from "../types";
import type { WalletKind } from "../wallet";

/** Bag kisa omurlu: onbellege alinmaz, her basista yeniden istenir. */
export function fetchWalletLink(bookingId: string, kind: WalletKind): Promise<WalletLink> {
  return api<WalletLink>(`/bookings/${encodeURIComponent(bookingId)}/wallet?kind=${kind}`);
}
