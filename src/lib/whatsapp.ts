/**
 * WhatsApp "click-to-chat" bağlantısı (wa.me).
 *
 * NEDEN VAR: Türkiye'de esnafın birincil iletişim kanalı WhatsApp. Panelde
 * misafirin numarası yalnızca `tel:` olarak veriliyordu ve bu iki tarafı da
 * zorluyor:
 *
 *   - Misafirlerin çoğu YABANCI. Uluslararası arama hem esnafa pahalı hem de
 *     karşılıklı dil bilinmediğinde işe yaramıyor; WhatsApp'ta yazışma ve
 *     çeviri mümkün.
 *   - Esnafın SMS'i şu an HİÇ ÇALIŞMIYOR (`netgsm.ts` → `sendNetgsmRestSms`
 *     bilerek devre dışı, sessizce `{ok:false}` dönüyor). Geriye e-posta
 *     kalıyor; esnaf e-postaya bakmıyor.
 *
 * Bu dosya WhatsApp Business API DEĞİL: hesap, onay ve ücret gerektirmez.
 * Yalnızca bir bağlantı üretir — sohbeti insan başlatır. Otomatik bildirim
 * göndermez ve göndermemeli.
 *
 * Biçim kuralı (WhatsApp resmî): `https://wa.me/<numara>` — numara ULUSLARARASI
 * ve YALNIZCA RAKAM: artı yok, baştaki sıfır yok, boşluk/tire/parantez yok.
 * "wa.me bağlantım çalışmıyor" desteklerinin neredeyse tamamı bu kuraldan.
 */

/** Varsayılan ülke kodu. Ürün Türkiye'de; yerel yazılmış numara TR sayılır. */
const DEFAULT_COUNTRY_CODE = "90";

/**
 * Numarayı wa.me'nin beklediği biçime çevirir; çeviremezse `null`.
 *
 * `null` dönmesi ÖNEMLİ: çağıran taraf bağlantıyı hiç çizmemeli. Bozuk bir
 * wa.me bağlantısı WhatsApp'ta "numara geçersiz" ekranı açar ve esnaf hatanın
 * kendisinde olduğunu sanır — düğmeyi hiç göstermemek bundan iyidir.
 */
export function toWhatsAppNumber(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  const hadPlus = raw.startsWith("+");
  let d = raw.replace(/\D/g, "");
  if (!d) return null;

  // `00` uluslararası çıkış öneki (0090...) -- artı ile aynı anlama gelir.
  if (!hadPlus && d.startsWith("00")) d = d.slice(2);

  /*
    Artı YA DA `00` varsa numara ZATEN uluslararasıdır; ülke kodu eklemek onu
    bozar. Yalnızca uzunluk aklı başında mı diye bakılır (ITU E.164: en fazla
    15 hane, ülke kodu dahil en az 8 pratikte makul alt sınır).
  */
  if (hadPlus || raw.replace(/\D/g, "").startsWith("00")) {
    return d.length >= 8 && d.length <= 15 ? d : null;
  }

  // TR yerel yazımlar: `05xxxxxxxxx` ve `5xxxxxxxxx`.
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && d.startsWith("5")) return DEFAULT_COUNTRY_CODE + d;

  // `905xxxxxxxxx` -- artısız yazılmış TR uluslararası.
  if (d.length === 12 && d.startsWith(DEFAULT_COUNTRY_CODE)) return d;

  /*
    Geriye kalan: artısız ama TR kalıbına da uymayan bir dizi. Ülke kodu
    UYDURULMAZ -- yanlış ülkeye bağlantı üretmek, bağlantı üretmemekten kötüdür.
  */
  return null;
}

/**
 * wa.me bağlantısı. Numara çevrilemezse `null`.
 *
 * @param text Sohbete önceden yazılacak metin (isteğe bağlı). Esnafın sıfırdan
 *   cümle kurmasını beklemek, düğmeye basılmamasının en yaygın sebebi.
 */
export function waMeUrl(
  phone: string | null | undefined,
  text?: string | null,
): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  const message = text?.trim();
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
