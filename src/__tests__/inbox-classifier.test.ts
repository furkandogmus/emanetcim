import { describe, it, expect } from "vitest";
import { classifyInboxMessage, extractEmail } from "@/lib/inbox-classifier";

/**
 * Gelen kutusu sınıflandırıcı.
 *
 * Neden test edilir: `destek@bagajpark.com`'a gelen her e-posta sınıflandırılmadan
 * kutuya yazılıyordu; 67 mesajın 57'si okunmamıştı ve ezici çoğunluğu soğuk
 * pazarlamaydı. Gerçek bir misafir şikâyeti bunların arasında kaybolur (P1-18).
 *
 * En kritik sözleşme: **yanlış sınıflandırma yönü.** Bir pazarlama e-postasının
 * destek kutusunda görünmesi can sıkıcı, gerçek bir şikâyetin toplu klasöre
 * düşmesi kabul edilemez.
 */

const hdr = (h: Record<string, string>) => ({ headers: h });

describe("extractEmail", () => {
  it("açılı parantezli biçimden adresi çıkarır", () => {
    expect(extractEmail("Ali Veli <ali@example.com>")).toBe("ali@example.com");
    expect(extractEmail("ali@example.com")).toBe("ali@example.com");
    expect(extractEmail("  ALI@Example.COM  ")).toBe("ali@example.com");
  });
});

describe("SUPPORT — gerçek insan", () => {
  it("iletişim formu her zaman destek, gönderen ne olursa olsun", () => {
    const r = classifyInboxMessage({
      from: "newsletter@spammy.com",
      subject: "İletişim Formu: Ayşe Yılmaz",
    });
    expect(r.category).toBe("SUPPORT");
    expect(r.reason).toBe("contact_form_subject");
  });

  it("sıradan bir kişisel e-posta destek sayılır", () => {
    const r = classifyInboxMessage({
      from: "Ayşe Yılmaz <ayse@gmail.com>",
      subject: "Valizim teslim edilmedi",
      raw: hdr({}),
    });
    expect(r.category).toBe("SUPPORT");
  });

  it("BİLİNMEYEN durumda destek varsayılır — hata payı ucuz tarafta", () => {
    // Bir pazarlama e-postasinin destek kutusunda gorunmesi can sikicidir; gercek
    // bir sikayetin toplu klasore dusmesi kabul edilemez.
    const r = classifyInboxMessage({ from: "birisi@bilinmeyen.tr", subject: "Merhaba" });
    expect(r.category).toBe("SUPPORT");
    expect(r.reason).toBe("default");
  });
});

describe("BULK — toplu gönderim", () => {
  it("List-Unsubscribe başlığı toplu işaretidir (RFC 2369)", () => {
    const r = classifyInboxMessage({
      from: "Product Hunt <hello@producthunt.com>",
      subject: "Your product was upvoted",
      raw: hdr({ "List-Unsubscribe": "<https://x.com/u>" }),
    });
    expect(r.category).toBe("BULK");
    expect(r.reason).toBe("list_unsubscribe_header");
  });

  it("Precedence: bulk yakalanır", () => {
    const r = classifyInboxMessage({
      from: "info@example.com",
      subject: "Kampanya",
      raw: hdr({ Precedence: "bulk" }),
    });
    expect(r.category).toBe("BULK");
  });

  it.each([
    "posta-recap@mail.instagram.com",
    "follow-suggestions@mail.instagram.com",
    "newsletter@somewhere.io",
    "notifications@app.dev",
    "marketing@vendor.com",
  ])("%s başlıksız da olsa toplu sayılır", (from) => {
    // 2026-08-22'de kutuda GERCEKTEN bulunan gonderenler.
    const r = classifyInboxMessage({ from, subject: "Launch your product to early users" });
    expect(r.category).toBe("BULK");
  });

  it("kampanya başlığı yakalanır", () => {
    const r = classifyInboxMessage({
      from: "someone@vendor.com",
      subject: "x",
      raw: hdr({ "X-Campaign-ID": "abc" }),
    });
    expect(r.category).toBe("BULK");
  });
});

describe("AUTOMATED — sistem postası", () => {
  it.each(["no-reply@x.com", "noreply@x.com", "mailer-daemon@x.com", "postmaster@x.com"])(
    "%s otomatik sayılır",
    (from) => {
      expect(classifyInboxMessage({ from, subject: "x" }).category).toBe("AUTOMATED");
    },
  );

  it("Auto-Submitted başlığı yakalanır", () => {
    const r = classifyInboxMessage({
      from: "kisi@sirket.com",
      subject: "Out of office",
      raw: hdr({ "Auto-Submitted": "auto-replied" }),
    });
    expect(r.category).toBe("AUTOMATED");
  });

  it('Auto-Submitted: no otomatik SAYILMAZ — standartta "bu insan yazdı" demektir', () => {
    const r = classifyInboxMessage({
      from: "kisi@sirket.com",
      subject: "Şikayet",
      raw: hdr({ "Auto-Submitted": "no" }),
    });
    expect(r.category).toBe("SUPPORT");
  });

  it("otomatik kontrolü toplu kontrolünden ÖNCE gelir", () => {
    // no-reply hem otomatik hem toplu gorunebilir; cevaplanamaz olmasi daha
    // belirleyici bir bilgidir.
    const r = classifyInboxMessage({
      from: "no-reply@newsletter.com",
      subject: "x",
      raw: hdr({ "List-Unsubscribe": "<https://x>" }),
    });
    expect(r.category).toBe("AUTOMATED");
  });
});

describe("başlık biçimleri", () => {
  it("dizi biçimindeki başlıkları da okur", () => {
    const r = classifyInboxMessage({
      from: "x@y.com",
      subject: "z",
      raw: { headers: [{ name: "List-Unsubscribe", value: "<https://x>" }] },
    });
    expect(r.category).toBe("BULK");
  });

  it("data.headers altındaki başlıkları da okur", () => {
    const r = classifyInboxMessage({
      from: "x@y.com",
      subject: "z",
      raw: { data: { headers: { "list-id": "<list.x.com>" } } },
    });
    expect(r.category).toBe("BULK");
  });

  it("bozuk veya eksik raw ile ÇÖKMEZ", () => {
    for (const raw of [null, undefined, "metin", 42, [], { headers: "yanlis" }]) {
      expect(() =>
        classifyInboxMessage({ from: "a@b.com", subject: "x", raw }),
      ).not.toThrow();
    }
  });
});
