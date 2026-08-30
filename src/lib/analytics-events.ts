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
export const CLIENT_ANALYTICS_EVENTS = [
  "page_view",
  /*
    Talep testi noktasinda rezervasyon dugmesine basildi. Istemci tarafinda,
    cunku olay modal ACILIRKEN olusuyor -- sunucuya giden bir istek yok.
    Cerez onayina baglidir; onaysiz kullanicinin tiklamasi sayilmaz. Bu bilinen
    ve kabul edilen bir bosluk: nokta basina KOSULSUZ sayi zaten sunucu
    tarafinda var (`shop_view` ve `prelaunch_interest`).
  */
  "prelaunch_booking_attempt",
] as const;
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const SERVER_ANALYTICS_EVENTS = [
  "search_performed",
  "shop_view",
  "checkout_started",
  "booking_created",
  "user_signed_up",
  /*
    Talep testi sinyalleri. `prelaunch_booking_attempt` ASIL olculen seydir:
    kisi o noktada rezervasyon dugmesine bastı. `prelaunch_interest` ise bir
    adim otesi -- e-postasini birakti, yani niyetini beyan etti.
  */
  "prelaunch_interest",
] as const;
export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[number];

export type AnalyticsEventName = ClientAnalyticsEventName | ServerAnalyticsEventName;
