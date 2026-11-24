"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { createWalkInBookingAction, type WalkInActionResult } from "@/actions/walk-in";
import { Link } from "@/i18n/routing";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

const KNOWN_ERRORS = new Set([
  "INVALID_INPUT",
  "TERMS_REQUIRED",
  "NOT_FOUND",
  "FORBIDDEN",
  "SHOP_NOT_OPERATING",
  "RATE_LIMITED",
  "TOO_MANY_BAGS",
  "CAPACITY_EXCEEDED",
  "INVALID_DATES",
  "PLATFORM_HOLIDAY",
  "SHOP_CLOSED_ON_DATE",
  "SHOP_PRELAUNCH",
  "AUTH",
  "IN_PROGRESS",
]);

type Success = Extract<WalkInActionResult, { ok: true }>;

/** `datetime-local` degeri (tarayicinin saat diliminde): simdiden `hours` sonra, 15 dk'ya yuvarli. */
function defaultPickup(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WalkInDialog({
  shopId,
  onClose,
  onDone,
  onNeedsCheckIn,
}: {
  shopId: string;
  onClose: () => void;
  /** Rezervasyon acildi ve teslim alindi; ebeveyn listeyi tazeler. */
  onDone: () => void;
  /** Muhur zorunlu ya da teslim reddedildi: normal check-in penceresi bu kimlikle acilir. */
  onNeedsCheckIn: (bookingId: string) => void;
}) {
  const t = useTranslations("walkIn");
  const ref = useRef<HTMLDivElement>(null);
  useModalBehavior({ open: true, onClose, ref });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bags, setBags] = useState(1);
  const [pickup, setPickup] = useState(() => defaultPickup(4));
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Success | null>(null);
  // Diyalog basina tek anahtar: ag tekrari ya da cift tiklama ikinci rezervasyon acmaz.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) {
      setError(t("errors.TERMS_REQUIRED"));
      return;
    }
    const pickupDate = new Date(pickup);
    if (Number.isNaN(pickupDate.getTime())) {
      setError(t("errors.INVALID_DATES"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createWalkInBookingAction({
        shopId,
        guestName: name,
        ...(phone.trim() ? { guestPhone: phone.trim() } : {}),
        ...(email.trim() ? { guestEmail: email.trim() } : {}),
        bagCount: bags,
        pickupAt: pickupDate.toISOString(),
        termsConfirmed: true,
        idempotencyKey,
      });
      if (!res.ok) {
        setError(t(`errors.${KNOWN_ERRORS.has(res.code) ? res.code : "generic"}`));
        return;
      }
      if (res.needsCheckIn) {
        onNeedsCheckIn(res.bookingId);
        return;
      }
      setDone(res);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900";

  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-in-title"
        className="relative w-full max-w-md rounded-4xl bg-white p-6 text-gray-900 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={done ? onDone : onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100"
        >
          <X size={20} />
        </button>
        <h2 id="walk-in-title" className="id-display mb-1 pr-10 text-2xl">
          {t("title")}
        </h2>

        {done ? (
          <div className="flex flex-col items-center gap-4 pt-2 text-center" data-testid="walk-in-done">
            <CheckCircle2 className="text-green-600" size={40} aria-hidden />
            <p className="font-bold">{t("doneTitle")}</p>
            <p className="text-sm text-gray-500">{t("shortCodeLabel")}</p>
            <p className="id-display text-3xl tracking-wider">{done.shortCode}</p>
            {done.qrSvg ? (
              <div
                className="h-48 w-48 [&_svg]:h-full [&_svg]:w-full"
                role="img"
                aria-label={t("qrAlt")}
                dangerouslySetInnerHTML={{ __html: done.qrSvg }}
              />
            ) : null}
            <p className="text-sm text-gray-600">{done.emailQueued ? t("emailSent") : t("photoHint")}</p>
            <button
              type="button"
              onClick={onDone}
              className="id-accent-bg w-full rounded-xl px-6 py-3 text-sm font-bold"
            >
              {t("finish")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-gray-500">{t("lead")}</p>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("guestName")}
              <input
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("guestPhone")}
              <input
                className={field}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                maxLength={24}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("guestEmail")}
              <input
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                maxLength={254}
                autoComplete="off"
              />
            </label>
            <p className="-mt-2 text-xs text-gray-400">{t("contactHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                {t("bagCount")}
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={50}
                  value={bags}
                  onChange={(e) => setBags(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                {t("pickupAt")}
                <input
                  className={field}
                  type="datetime-local"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                {t("termsConfirm")}{" "}
                <Link href="/terms" target="_blank" className="font-bold underline">
                  {t("termsLink")}
                </Link>
                {" · "}
                <Link href="/kvkk" target="_blank" className="font-bold underline">
                  {t("kvkkLink")}
                </Link>
              </span>
            </label>
            <p className="text-xs text-gray-400">{t("payAtShop")}</p>
            {error ? (
              <p role="alert" className="text-sm font-bold text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="id-accent-bg flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
              {t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
