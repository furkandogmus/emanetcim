/**
 * Sehir adini yazim bicimine bagli olmayan anahtara cevirir: "İstanbul", "Istanbul",
 * "ISTANBUL" ve "istanbul" ayni "istanbul" olur. `toLocaleLowerCase("tr-TR")` yalniz
 * noktasiz I'yi ayirir ("Istanbul" -> "ıstanbul"); esnafin klavyesine gore ayni sehir
 * iki kart oluyordu. NFD ile aksanlar (ş ğ ö ü ç, İ'nin noktasi) atilir, ı -> i.
 */
export function citySlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
