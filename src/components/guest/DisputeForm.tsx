"use client";

import { useState } from "react";
import { createDisputeAction } from "@/actions/dispute";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { disputeErrorKey } from "@/lib/dispute-error-copy";

export default function DisputeForm({
  bookingId,
  shopName,
}: {
  bookingId: string;
  shopName: string;
}) {
  const router = useRouter();
  const t = useTranslations("Dispute");
  const tErrors = useTranslations("Errors");
  const [reason, setReason] = useState<"DAMAGE" | "THEFT" | "OTHER">("OTHER");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const MIN_DESCRIPTION_LENGTH = 10;
  const remaining = Math.max(0, MIN_DESCRIPTION_LENGTH - description.length);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    const r = await createDisputeAction({ bookingId, reason, description });
    setLoading(false);
    if (r.success) router.push("/bookings");
    else setErr(disputeErrorKey(r.error));
  };

  return (
    <div className="ui-card max-w-lg mx-auto rounded-3xl p-8">
      <Link
        href={`/bookings/${bookingId}`}
        className="ui-kicker inline-flex items-center gap-1.5 text-gray-400 hover:text-orange-600 transition-colors mb-4"
      >
        <ChevronLeft size={14} />
        {t("backToBooking")}
      </Link>
      <h1 className="ui-heading-md">{t("title")}</h1>
      <p className="ui-body-sm mt-1">{shopName}</p>

      <label htmlFor="dispute-reason" className="ui-kicker block mt-6">
        {t("reasonLabel")}
      </label>
      <select
        id="dispute-reason"
        className="ui-field mt-2"
        value={reason}
        onChange={(e) => setReason(e.target.value as typeof reason)}
      >
        <option value="DAMAGE">{t("reasonDamage")}</option>
        <option value="THEFT">{t("reasonTheft")}</option>
        <option value="OTHER">{t("reasonOther")}</option>
      </select>

      <label htmlFor="dispute-description" className="ui-kicker block mt-4">
        {t("descriptionLabel")}
      </label>
      <textarea
        id="dispute-description"
        className="ui-field mt-2 min-h-[120px]"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label={t("descriptionLabel")}
        aria-describedby={remaining > 0 ? "dispute-description-hint" : undefined}
        placeholder={t("descriptionPlaceholder")}
      />
      {/* Buton aciklama 10 karakterin altindaysa hicbir mesaj olmadan
          devre disi kaliyordu -- kullanici neden basamadigini bilemiyordu. */}
      {remaining > 0 && description.length > 0 && (
        <p id="dispute-description-hint" className="ui-body-sm mt-1 text-gray-400">
          {t("descriptionMinHint", { remaining })}
        </p>
      )}

      {err && <p className="ui-state ui-state-error mt-2">{tErrors(err)}</p>}

      <button
        type="button"
        disabled={loading || remaining > 0}
        onClick={submit}
        className="btn-ui btn-ui-lg btn-ui-primary mt-6 w-full rounded-2xl"
      >
        {loading ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
