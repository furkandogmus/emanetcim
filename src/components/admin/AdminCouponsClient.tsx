"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Ticket, Plus, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import Money from "@/components/common/Money";
import { createCouponAction, setCouponActiveAction } from "@/actions/coupon";

type Coupon = {
  id: string;
  code: string;
  discount: number;
  isPercent: boolean;
  minPrice: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function AdminCouponsClient({ coupons }: { coupons: Coupon[] }) {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = bcp47ForUiLocale(locale);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [isPercent, setIsPercent] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createCouponAction({
        code,
        discount: Number(discount),
        isPercent,
        minPrice: minPrice.trim() ? Number(minPrice) : null,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        // `datetime-local` yerel saat verir; sunucu tarafi UTC bekliyor.
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      if (!result.success) {
        // Once cevrilmis metne indir, sonra goster: action'in `error` alani
        // gosterim ilkeline HAM giremez (`raw-error-copy` mandali).
        const message =
          result.error === "duplicate_code"
            ? t("couponsDuplicateCode")
            : tErrors("invalidData");
        toast.error(message);
        return;
      }

      toast.success(t("couponsCreated"));
      setCode("");
      setMinPrice("");
      setExpiresAt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function toggle(c: Coupon) {
    startTransition(async () => {
      await setCouponActiveAction(c.id, !c.isActive);
      toast.success(c.isActive ? t("couponsDeactivated") : t("couponsActivated"));
      router.refresh();
    });
  }

  function fmtDate(iso: string | null) {
    if (!iso) return t("unlimited");
    return new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("backToDashboard")}
        </Link>

        <h1 className="text-3xl id-display text-gray-900 mb-1">
          {t("couponsTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{t("couponsIntro")}</p>

        <form
          onSubmit={submit}
          className="id-surface p-6 mb-8 grid gap-4 md:grid-cols-3"
        >
          <div>
            <label htmlFor="coupon-code" className="block text-xs id-eyebrow text-gray-500 mb-2">
              {t("couponsCode")}
            </label>
            <input
              id="coupon-code"
              aria-label={t("couponsCode")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("couponsCodePlaceholder")}
              required
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="coupon-discount"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("couponsDiscount")}
            </label>
            <input
              id="coupon-discount"
              type="number"
              min="1"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            />
          </div>

          <div>
            <label htmlFor="coupon-type" className="block text-xs id-eyebrow text-gray-500 mb-2">
              {t("couponsType")}
            </label>
            <select
              id="coupon-type"
              value={isPercent ? "percent" : "fixed"}
              onChange={(e) => setIsPercent(e.target.value === "percent")}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              <option value="percent">{t("couponsTypePercent")}</option>
              <option value="fixed">{t("couponsTypeFixed")}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="coupon-min-price"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("couponsMinPrice")}
            </label>
            <input
              id="coupon-min-price"
              aria-label={t("couponsMinPrice")}
              type="number"
              min="0"
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder={t("couponsNoMinPrice")}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="coupon-max-uses"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("couponsMaxUses")}
            </label>
            <input
              id="coupon-max-uses"
              aria-label={t("couponsMaxUses")}
              type="number"
              min="1"
              step="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder={t("unlimited")}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="coupon-expires"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("couponsExpiresAt")}
            </label>
            <input
              id="coupon-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="h-12 px-6 rounded-2xl bg-gray-900 text-white text-xs id-eyebrow hover:bg-black transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("couponsCreate")}
            </button>
          </div>
        </form>

        {coupons.length === 0 ? (
          <div className="id-surface p-12 text-center">
            <Ticket size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t("couponsEmpty")}</p>
          </div>
        ) : (
          <div className="id-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr className="text-[10px] id-eyebrow text-gray-500">
                    <th className="px-5 py-4">{t("couponsCode")}</th>
                    <th className="px-5 py-4">{t("couponsDiscount")}</th>
                    <th className="px-5 py-4">{t("couponsUsage")}</th>
                    <th className="px-5 py-4">{t("couponsExpiresAt")}</th>
                    <th className="px-5 py-4">{t("status")}</th>
                    <th className="px-5 py-4 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 id-display text-gray-900">{c.code}</td>
                      <td className="px-5 py-4 text-gray-600">
                        {c.isPercent ? `%${c.discount}` : <Money amount={c.discount} />}
                        {c.minPrice ? (
                          <div className="text-xs text-gray-400">
                            {t("couponsMinPrice")}: <Money amount={c.minPrice} />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {c.usedCount} / {c.maxUses ?? t("unlimited")}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {fmtDate(c.expiresAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                            c.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.isActive ? t("active") : t("inactive")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(c)}
                          disabled={pending}
                          className="text-xs id-eyebrow text-gray-500 hover:text-gray-900 disabled:opacity-40"
                        >
                          {c.isActive ? t("couponsDeactivate") : t("couponsActivate")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
