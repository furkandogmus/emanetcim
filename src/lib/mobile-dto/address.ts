/**
 * Adres + semt + il; adreste zaten gecen parca tekrar eklenmez. Esnaf adresi cogu zaman
 * "..., Beyoglu, Istanbul" diye yaziyor ve ekranda "Beyoglu, Istanbul" iki kez cikiyordu.
 */
export function fullAddress(
  address: string | null | undefined,
  district: string | null | undefined,
  city: string | null | undefined,
): string {
  const base = (address ?? "").trim();
  const has = (part: string) => base.toLocaleLowerCase("tr").includes(part.trim().toLocaleLowerCase("tr"));
  return [base, ...[district, city].filter((p): p is string => !!p && !!p.trim() && !has(p))]
    .filter(Boolean)
    .join(", ");
}
