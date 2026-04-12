/** Stable keys for `FeatureFlag.key` (DB + admin). */
export const FEATURE_FLAG_PAYMENTS_ENABLED = "payments_enabled" as const;

export type KnownFeatureFlagKey = typeof FEATURE_FLAG_PAYMENTS_ENABLED;
