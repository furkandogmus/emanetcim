/**
 * Kaynaktan yorumları çıkarır, SATIR NUMARALARINI koruyarak.
 *
 * NEDEN VAR (2026-09-02): statik mandallar "şu kalıp kodda geçmesin" diye
 * tarıyor ve ilk yazılışlarında yorum satırlarını `//` / `*` önekine bakarak
 * eliyorlardı. Bu depo blok yorumlarını YILDIZSIZ yazıyor:
 *
 *     /*
 *       Onceki hali `status: { not: "CANCELLED" }` idi...
 *     *\/
 *
 * Sonuç: bir düzeltmenin GEREKÇESİNİ yazmak, o düzeltmenin mandalını kırıyordu
 * -- yani mandal, kendisini doğuran açıklamayı ihlal sayıyordu. Yorumu silmek
 * yanlış cevap; bu depoda gerekçe koddan daha uzun ve bilerek öyle.
 *
 * Satır numaraları korunur (yorumlar boşlukla değiştirilir), çünkü ihlal
 * raporları `dosya:satır` veriyor ve o numara tıklanabilir olmalı.
 */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  type Mod = "kod" | "satir" | "blok" | "tirnak" | "sablon";
  let mod: Mod = "kod";
  let tirnakKar = "";

  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];

    if (mod === "kod") {
      if (c === "/" && c2 === "/") { mod = "satir"; out += "  "; i += 2; continue; }
      if (c === "/" && c2 === "*") { mod = "blok"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'") { mod = "tirnak"; tirnakKar = c; out += c; i++; continue; }
      if (c === "`") { mod = "sablon"; out += c; i++; continue; }
      out += c; i++; continue;
    }

    if (mod === "satir") {
      if (c === "\n") { mod = "kod"; out += "\n"; }
      else out += " ";
      i++; continue;
    }

    if (mod === "blok") {
      if (c === "*" && c2 === "/") { mod = "kod"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " ";
      i++; continue;
    }

    // Tırnak ve şablon içi: kaçış dizilerini atlayarak aynen kopyala.
    if (c === "\\") { out += c + (c2 ?? ""); i += 2; continue; }
    if (mod === "tirnak" && c === tirnakKar) mod = "kod";
    if (mod === "sablon" && c === "`") mod = "kod";
    out += c; i++;
  }
  return out;
}
