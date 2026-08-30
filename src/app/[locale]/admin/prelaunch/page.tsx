import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

/**
 * Talep testi sonuçları — hangi noktada kaç kişi "açılınca haber ver" dedi.
 *
 * Bu sayfa, `Shop.isPrelaunch` noktalarının TEK okuma yüzeyidir. Karar bu
 * tabloya bakılarak veriliyor ("bu şehirde esnaf aramaya değer mi"), o yüzden
 * sayının şişmemesi önemli: `@@unique([shopId, email])` aynı kişinin iki kez
 * sayılmasını veritabanında engelliyor.
 */
export default async function AdminPrelaunchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");
  const rows = await prelaunchInterestService.summary();

  const byCity = new Map<string, number>();
  for (const r of rows) {
    byCity.set(r.city ?? "—", (byCity.get(r.city ?? "—") ?? 0) + r.interestCount);
  }
  const cities = [...byCity.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/admin"
          aria-label={tCommon("back")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-3xl id-display tracking-tight">
          {t("prelaunchTitle")}
        </h1>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-10">
        <p className="text-sm text-gray-600 max-w-2xl">{t("prelaunchIntro")}</p>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs id-eyebrow text-gray-500">
            {t("prelaunchByCity")}
          </h2>
          {cities.length === 0 ? (
            <p className="text-sm text-gray-500">{t("prelaunchEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {cities.map(([city, count]) => (
                  <tr key={city} className="border-b border-gray-100">
                    <td className="py-3 font-bold">{city}</td>
                    <td className="py-3 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs id-eyebrow text-gray-500">
            {t("prelaunchByPoint")}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.shopId} className="border-b border-gray-100">
                  <td className="py-3">
                    <span className="font-bold">{r.shopName}</span>
                    <span className="text-gray-500">
                      {" "}
                      · {r.city ?? "—"} / {r.district ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {r.interestCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
