/**
 * Kullanıcı analitiği — sabit olay sözlüğü.
 *
 * NEDEN SABİT LİSTE: `AnalyticsEvent.name` rastgele metin olursa hem tabloya
 * çöp veri girer hem panel sorgularında "aynı olay üç farklı yazımla" durumu
 * oluşur. `CLIENT_ANALYTICS_EVENTS`, `/api/analytics/event` ucunun kabul ettiği
 * TEK küme — istemciden gelen her şey buna karşı doğrulanır. Sunucu tarafında
 * doğrudan `analyticsService.track()` çağıran olaylar (booking oluşturma, yeni
 * kullanıcı vb.) zaten güvenilir kod yolundan geldiği için ayrı bir listede.
 */
export const CLIENT_ANALYTICS_EVENTS = ["page_view"] as const;
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const SERVER_ANALYTICS_EVENTS = [
  "search_performed",
  "shop_view",
  "checkout_started",
  "booking_created",
  "user_signed_up",
] as const;
export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[number];

export type AnalyticsEventName = ClientAnalyticsEventName | ServerAnalyticsEventName;
