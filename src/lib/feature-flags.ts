/**
 * Özellik bayrakları: `FeatureFlag` tablosu + acil durum için `PAYMENTS_ENABLED=false` env.
 */

import { FEATURE_FLAG_PAYMENTS_ENABLED } from "@/lib/feature-flag-keys";
import {
  featureFlagService,
  type FeatureFlagContext,
} from "@/services/FeatureFlagService";

export type { FeatureFlagContext };

/** Deploy anında ödemeleri kesmek: env `false` her zaman kazanır. */
export function isPaymentsEnvKillSwitch(): boolean {
  return process.env.PAYMENTS_ENABLED?.trim() === "false";
}

/**
 * Ödeme yolları (iyzico/Stripe init, webhook, iade) açık mı.
 * Env kill switch kapalıyken `payments_enabled` feature flag’e bakılır (varsayılan: açık).
 * Misafir ödeme UI’si için `userId` verin; rollout / allowlist sadece tanımlı kullanıcıda uygulanır.
 */
export async function isPaymentsEnabled(
  ctx?: FeatureFlagContext
): Promise<boolean> {
  if (isPaymentsEnvKillSwitch()) return false;
  return featureFlagService.isEnabled(
    FEATURE_FLAG_PAYMENTS_ENABLED,
    ctx ?? {}
  );
}
