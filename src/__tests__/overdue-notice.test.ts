import { describe, it, expect } from "vitest";
import {
  expectedOverdueNoticeCount,
  shouldSendOverdueNotice,
  OVERDUE_NOTICE_THRESHOLDS_HOURS,
} from "@/lib/overdue-notice";

/**
 * Geç teslim uyarısı. Önceki hâlde tekrar kontrolü YOKTU ve iş günde bir
 * çalıştığı için esnafa aynı valiz hakkında her gün, süresiz e-posta gidiyordu.
 */
describe("geç teslim uyarısı sayısı", () => {
  it("gecikme başlar başlamaz İLK uyarıyı ister", () => {
    // Esnaf, rafindaki valizin sahibi gelmediyse ertesi gun degil yarim saat
    // sonra bilmeli.
    expect(expectedOverdueNoticeCount(0)).toBe(0);
    expect(expectedOverdueNoticeCount(0.4)).toBe(0);
    expect(expectedOverdueNoticeCount(0.5)).toBe(1);
    expect(expectedOverdueNoticeCount(3)).toBe(1);
  });

  it("eşik atlandıkça bir uyarı daha ister", () => {
    expect(expectedOverdueNoticeCount(24)).toBe(2);
    expect(expectedOverdueNoticeCount(72)).toBe(3);
    expect(expectedOverdueNoticeCount(168)).toBe(4);
    expect(expectedOverdueNoticeCount(720)).toBe(5);
  });

  it("BİR AY unutulmuş valiz için bile TOPLAM beş uyarı — otuz değil", () => {
    /*
      Asil kusur buydu: gunluk cron + tekrar kontrolu yok = bir ay icin otuz
      ozdes e-posta. Zarari gurultu degil, esnafi platform e-postalarini
      gormezden gelmeye alistirmasi -- ve o aliskanlik YENI REZERVASYON
      bildirimini de oldurur.
    */
    expect(expectedOverdueNoticeCount(24 * 30)).toBe(5);
    expect(expectedOverdueNoticeCount(24 * 365)).toBe(5);
    expect(expectedOverdueNoticeCount(Number.MAX_SAFE_INTEGER)).toBe(
      OVERDUE_NOTICE_THRESHOLDS_HOURS.length,
    );
  });

  it("gönderilmiş sayısı beklenene ulaşınca SUSAR", () => {
    // 3 saat gecikmede beklenen 1; biri gonderildiyse gunlerce sussun.
    expect(shouldSendOverdueNotice(3, 0)).toBe(true);
    expect(shouldSendOverdueNotice(3, 1)).toBe(false);
    expect(shouldSendOverdueNotice(23, 1)).toBe(false);
    // 24 saati gecince yeni esik: bir uyari daha.
    expect(shouldSendOverdueNotice(24, 1)).toBe(true);
    expect(shouldSendOverdueNotice(24, 2)).toBe(false);
  });

  it("bozuk süre uyarı üretmez", () => {
    // NaN gecikme, "sonsuz uyari" demek olurdu.
    expect(expectedOverdueNoticeCount(Number.NaN)).toBe(0);
    expect(shouldSendOverdueNotice(Number.NaN, 0)).toBe(false);
  });
});
