"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useShare } from "@/lib/hooks/useShare";

/**
 * Blog yazısı üst bilgisindeki paylaşım düğmesi.
 *
 * NEDEN AYRI BİLEŞEN (2026-09-10'da bulundu): `blog/[slug]/page.tsx` bir
 * sunucu bileşeni ("use client" yok) — düğme yalnızca `<Share2>` ikonunu
 * basıyordu, `aria-label` YOKTU ve `onClick` de yoktu (sunucu bileşeninde
 * event handler olamaz). Görünüşte bir paylaşım düğmesiydi ama ekran
 * okuyucuya adı yoktu ve tıklandığında hiçbir şey olmuyordu.
 */
export default function BlogShareButton({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const tCommon = useTranslations("Common");
  const { share } = useShare();

  return (
    <button
      type="button"
      onClick={() => share({ title, text: title, url })}
      aria-label={tCommon("share")}
      className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-600 transition-colors"
    >
      <Share2 size={18} />
    </button>
  );
}
