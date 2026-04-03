import config from "./config";

interface Feature {
  enabled: boolean;
  rollout?: number; // 0 ile 1 arası (örn: 0.5 = %50)
}

/**
 * Feature Flags - Özellik ve A/B Test Yönetimi
 * "Senior" Checklist: A/B Testing & Feature Management.
 */
export const featureFlags: Record<string, Feature> = {
  /**
   * Yeni Harita Arayüzü (A/B Testi Varyasyonu)
   */
  NEW_MAP_INTERFACE: {
    enabled: config.isDev,
    rollout: 0.5,
  },


  /**
   * Gelişmiş Filtreleme Paneli
   */
  ADVANCED_FILTERS: {
    enabled: true,
  },

  /**
   * Premium Ödeme Yöntemi (Apple Pay vb.)
   */
  PREMIUM_PAYMENTS: {
    enabled: config.isProd, // Sadece Prod'da test edilebilir.
  }
};

/**
 * Kullanıcı bazlı varyasyon kontrolü (Simple A/B Logic)
 */
export const isFeatureEnabled = (flag: keyof typeof featureFlags, userId?: string): boolean => {
  const feature = featureFlags[flag];
  if (!feature.enabled) return false;
  
  // Eğer kullanıcı ID varsa istikrarlı (stable) bir varyasyon dönelim
  if (userId && feature.rollout) {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 100) / 100 < feature.rollout;
  }
  
  return true;
};
