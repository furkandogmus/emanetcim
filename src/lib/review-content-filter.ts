/**
 * Yorum metninde kufur/hakaret suzgeci (App Review 1.2, 2026-11-23). Bilerek basit:
 * kisa bir Turkce + Ingilizce kok listesi. Amac acik hakareti yazildigi anda
 * durdurmak; geri kalani bildir + yonetici moderasyonu yakalar.
 *
 * Eslesme kelime basinda yapilir ("amk" yakalanir, "hamken" yakalanmaz). Metin
 * once sadelestirilir: Turkce kucuk harf, aksan/sapka, tekrarlanan harfler
 * ("siiiik"), arada nokta/yildiz ("s.i.k") ve yaygin rakam ikameleri ("s1k").
 */

/** Kelimenin BASINDA eslesen kokler (ekler serbest: "orospu" -> "orospunun"). */
const PREFIX_ROOTS = [
  // Turkce
  "amcik", "aminakoy", "aminakoyim", "amk", "aq", "orospu", "orosbu", "sikerim", "sikeyim",
  "siktir", "yarak", "yarrak", "gotveren", "gavat", "pezevenk", "kahpe",
  "serefsiz", "yavsak", "ibne", "kaltak", "salak", "gerizekali", "dangalak", "haysiyetsiz",
  // Ingilizce
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "cunt", "motherfucker", "whore",
  "slut", "retard", "faggot", "nigger", "nigga",
];

/**
 * Yalnizca TAM kelime olarak engellenenler: kok olarak masum kelimeyi yakalarlar
 * ("cunt" -> "cunta").
 * "got"/"pic"/"dick" listede yok: Ingilizcede "got there", "nice pic", "Dick" (ad)
 * yorumlari reddediliyordu. "sikis" ve "mal" de yok ("sıkıştı", "mal kabul").
 */
const EXACT_ONLY = new Set(["salak", "aq", "cunt"]);

/**
 * ASCII'ye katlanmadan, ozgun metinde TAM kelime olarak aranir: "göt" katlaninca
 * Ingilizce "got" olur ve "We got there" yorumunu reddederdi.
 */
const ORIGINAL_EXACT = new Set(["göt", "götveren", "götün"]);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c)
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // "s.i.k", "s*i*k": kelime ici ayiricilar
    .replace(/(?<=\p{L})[.*_\-](?=\p{L})/gu, "")
    // "siiiik" -> "sik"
    .replace(/(\p{L})\1{2,}/gu, "$1");
}

/** Metinde engelli bir kelime varsa true. Bos/null metin temizdir. */
export function containsBlockedWords(text: string | null | undefined): boolean {
  if (!text) return false;
  const original = text.normalize("NFC").toLocaleLowerCase("tr").split(/[^\p{L}]+/u);
  if (original.some((w) => ORIGINAL_EXACT.has(w))) return true;
  const words = normalize(text).split(/[^\p{L}]+/u).filter(Boolean);
  return words.some((w) =>
    PREFIX_ROOTS.some((root) => (EXACT_ONLY.has(root) ? w === root : w.startsWith(root))),
  );
}
