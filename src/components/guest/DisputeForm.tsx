"use client";

import { useState } from "react";
import { createDisputeAction } from "@/actions/dispute";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";

export default function DisputeForm({
  bookingId,
  shopName,
}: {
  bookingId: string;
  shopName: string;
}) {
  const router = useRouter();
  const t = useTranslations("Dispute");
  const [reason, setReason] = useState<"DAMAGE" | "THEFT" | "OTHER">("OTHER");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    const r = await createDisputeAction({ bookingId, reason, description });
    setLoading(false);
    if (r.success) router.push("/bookings");
    else setErr(r.error);
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

      <label className="ui-kicker block mt-6">{t("reasonLabel")}</label>
      <select
        className="ui-field mt-2"
        value={reason}
        onChange={(e) => setReason(e.target.value as typeof reason)}
      >
        <option value="DAMAGE">{t("reasonDamage")}</option>
        <option value="THEFT">{t("reasonTheft")}</option>
        <option value="OTHER">{t("reasonOther")}</option>
      </select>

      <label className="ui-kicker block mt-4">{t("descriptionLabel")}</label>
      <textarea
        className="ui-field mt-2 min-h-[120px]"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label={t("descriptionPlaceholder")}
        placeholder={t("descriptionPlaceholder")}
      />

      {err && <p className="ui-state ui-state-error mt-2">{err}</p>}

      <button
        type="button"
        disabled={loading || description.length < 10}
        onClick={submit}
        className="btn-ui btn-ui-lg btn-ui-primary mt-6 w-full rounded-2xl"
      >
        {loading ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
