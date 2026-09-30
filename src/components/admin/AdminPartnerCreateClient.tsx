"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Store,
  UserPlus,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { adminCreatePartnerAction } from "@/actions/admin-partner-create";
import { actionErrorKey } from "@/lib/action-error";
import { parseCoordinates } from "@/lib/coordinates";
import { waMeUrl } from "@/lib/whatsapp";

const EMPTY = {
  ownerName: "",
  phone: "",
  email: "",
  shopName: "",
  shopAddress: "",
  city: "",
  district: "",
  location: "",
};

const INPUT =
  "w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl p-4 text-sm font-bold outline-none transition-all";

type Created = { shopId: string; resetUrl: string; ownerName: string; phone: string };

export default function AdminPartnerCreateClient() {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("Errors");
  const tCommon = useTranslations("Common");
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // Admin gönderMEDEN önce görsün: yanlış okunan konum aramada yanlış yerde
  // görünen bir dükkan demek ve kimse fark etmeyebilir.
  const coords = useMemo(() => parseCoordinates(form.location), [form.location]);
  const locationTouched = form.location.trim().length > 0;

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      toast.error(t("partnerCreateLocationInvalid"));
      return;
    }
    startTransition(async () => {
      try {
        const res = await adminCreatePartnerAction(form);
        if (!res.ok) {
          toast.error(tErrors(actionErrorKey(new Error(res.error))));
          return;
        }
        setCreated({
          shopId: res.shopId,
          resetUrl: res.resetUrl,
          ownerName: form.ownerName.trim(),
          phone: form.phone,
        });
      } catch (caughtError: unknown) {
        toast.error(tErrors(actionErrorKey(caughtError)));
      }
    });
  };

  const copyLink = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      });
  };

  const header = (
    <header className="mb-10">
      <Link
        href="/admin/partners"
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs id-eyebrow">{t("backToPartners")}</span>
      </Link>
      <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
        <UserPlus className="text-orange-600" />
        {t("partnerCreateTitle")}
      </h1>
    </header>
  );

  if (created) {
    const whatsapp = waMeUrl(
      created.phone,
      t("partnerCreateWhatsappMessage", { name: created.ownerName, url: created.resetUrl }),
    );
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
        {header}
        <section className="max-w-2xl bg-white rounded-4xl p-8 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-black tracking-tight mb-2 flex items-center gap-2">
            <Check size={20} className="text-green-600" />
            {t("partnerCreateSuccessTitle")}
          </h2>
          <p className="text-sm text-gray-600 mb-6">{t("partnerCreateSuccessBody")}</p>

          <label htmlFor="partner-create-reset-url" className="id-eyebrow text-gray-400 px-1">
            {t("partnerCreateResetLink")}
          </label>
          <div className="relative mt-2">
            <input
              id="partner-create-reset-url"
              type="text"
              readOnly
              value={created.resetUrl}
              className="w-full pr-12 pl-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium text-gray-700"
            />
            <button
              type="button"
              aria-label={t("partnerCreateCopyLink")}
              onClick={() => copyLink(created.resetUrl)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
            </button>
          </div>
          {copyFailed ? (
            <p className="mt-2 text-xs font-bold text-red-600">{tCommon("linkCopyFailed")}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                <MessageCircle size={16} />
                {t("partnerCreateSendWhatsapp")}
              </a>
            ) : null}
            <Link
              href={`/admin/partners/${created.shopId}/edit`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Store size={16} />
              {t("partnerCreateOpenShop")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setForm(EMPTY);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              <UserPlus size={16} />
              {t("partnerCreateAnother")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
      {header}
      <section className="max-w-3xl bg-white rounded-4xl p-8 border border-gray-100 shadow-sm">
        <p className="text-sm text-gray-600 mb-8">{t("partnerCreateIntro")}</p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="partner-create-owner" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreateOwnerName")}
            </label>
            <input id="partner-create-owner" type="text" value={form.ownerName} onChange={set("ownerName")} className={INPUT} required minLength={2} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="partner-create-phone" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreatePhone")}
            </label>
            <input id="partner-create-phone" type="tel" inputMode="tel" placeholder="05xx xxx xx xx" value={form.phone} onChange={set("phone")} className={INPUT} required />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="partner-create-email" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreateEmail")}
            </label>
            <input id="partner-create-email" type="email" value={form.email} onChange={set("email")} className={INPUT} />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="partner-create-shop" className="id-eyebrow text-gray-400 px-4">
              {t("shopName")}
            </label>
            <input id="partner-create-shop" type="text" value={form.shopName} onChange={set("shopName")} className={INPUT} required minLength={2} />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="partner-create-address" className="id-eyebrow text-gray-400 px-4">
              {t("shopAddress")}
            </label>
            <textarea
              id="partner-create-address"
              value={form.shopAddress}
              onChange={set("shopAddress")}
              className={`${INPUT} min-h-[90px] resize-none`}
              required
              minLength={5}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="partner-create-city" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreateCity")}
            </label>
            <input id="partner-create-city" type="text" value={form.city} onChange={set("city")} className={INPUT} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="partner-create-district" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreateDistrict")}
            </label>
            <input id="partner-create-district" type="text" value={form.district} onChange={set("district")} className={INPUT} />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="partner-create-location" className="id-eyebrow text-gray-400 px-4">
              {t("partnerCreateLocation")}
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input
                id="partner-create-location"
                type="text"
                placeholder="https://www.google.com/maps?q=36.62,29.10"
                value={form.location}
                onChange={set("location")}
                className={`${INPUT} pl-12`}
                aria-describedby="partner-create-location-status"
                required
              />
            </div>
            <p id="partner-create-location-status" className="px-4 text-xs">
              {coords ? (
                <span className="font-bold text-green-700">
                  {coords.latitude}, {coords.longitude}{" "}
                  <a
                    href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    {t("partnerCreateLocationPreview")}
                    <ExternalLink size={12} />
                  </a>
                </span>
              ) : locationTouched ? (
                <span className="font-bold text-red-600">{t("partnerCreateLocationInvalid")}</span>
              ) : (
                <span className="text-gray-400">{t("partnerCreateLocationHint")}</span>
              )}
            </p>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={pending || !coords}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {t("partnerCreateSubmit")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
