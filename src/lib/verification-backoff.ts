import { getUpstashRedis } from "./rate-limit";

const BACKOFF_KEY_PREFIX = "v_backoff:";
const COOLDOWNS_SEC = [180, 360]; // 3dk, 6dk
const ATTEMPT_EXPIRY_SEC = 24 * 60 * 60; // 24 saat sonra sıfırlanır

interface BackoffState {
  count: number;
  lastAttempt: number;
}

/**
 * Kullanıcı için mevcut soğuma (cooldown) bilgisini döndürür.
 */
export async function getVerificationBackoff(email: string) {
  const redis = getUpstashRedis();
  const key = `${BACKOFF_KEY_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    // Redis yoksa (local dev) kısıtlama yapmıyoruz (veya isterseniz in-memory eklenebilir)
    return { canResend: true, waitSeconds: 0, attempts: 0, maxReached: false };
  }

  const state = await redis.get<BackoffState>(key);
  if (!state) {
    return { canResend: true, waitSeconds: 0, attempts: 0, maxReached: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - state.lastAttempt;
  
  // Eğer çok fazla deneme yapıldıysa
  if (state.count >= 3) {
    return { canResend: false, waitSeconds: -1, attempts: state.count, maxReached: true };
  }

  const requiredCooldown = COOLDOWNS_SEC[state.count - 1] || 0;
  const remaining = requiredCooldown - elapsed;

  if (remaining > 0) {
    return { canResend: false, waitSeconds: remaining, attempts: state.count, maxReached: false };
  }

  return { canResend: true, waitSeconds: 0, attempts: state.count, maxReached: false };
}

/**
 * Yeni bir deneme kaydedilir.
 */
export async function recordVerificationAttempt(email: string) {
  const redis = getUpstashRedis();
  const key = `${BACKOFF_KEY_PREFIX}${email.toLowerCase()}`;

  if (!redis) return;

  const state = (await redis.get<BackoffState>(key)) || { count: 0, lastAttempt: 0 };
  
  const newState: BackoffState = {
    count: state.count + 1,
    lastAttempt: Math.floor(Date.now() / 1000),
  };

  await redis.set(key, newState, { ex: ATTEMPT_EXPIRY_SEC });
}
