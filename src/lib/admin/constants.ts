export const DELETE_USER_BLOCKED_CODE = "ADMIN_DELETE_USER_HAS_RELATIONS";

/**
 * `deleteUserAction` bunu, kullanicinin AKTIF bir rezervasyonu oldugu icin
 * silmeyi onceden engelledigi durumda doner (DB seviyesinde foreign-key
 * ihlaline hic girmeden). `DELETE_USER_BLOCKED_CODE`'dan ayri: o, silme
 * denemesi SIRASINDA baska bir iliskili kayda (dukkan, yorum vb.) carpmayi
 * temsil eder.
 */
export const DELETE_USER_HAS_ACTIVE_BOOKING_CODE = "HAS_ACTIVE_BOOKING";
