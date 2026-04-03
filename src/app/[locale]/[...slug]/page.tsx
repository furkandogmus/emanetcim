import { notFound } from "next/navigation";

/**
 * /[locale]/ altında eşleşmeyen tüm yollar → locale not-found.tsx (KAYBOLDUN vb.)
 */
export default function CatchAllLocale() {
  notFound();
}
