"use client";

import { useState } from "react";
import { createDisputeAction } from "@/actions/dispute";
import { useRouter } from "@/i18n/routing";

export default function DisputeForm({
  bookingId,
  shopName,
}: {
  bookingId: string;
  shopName: string;
}) {
  const router = useRouter();
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
    <div className="max-w-lg mx-auto bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
      <h1 className="text-xl font-black text-gray-900">Şikayet / İtiraz</h1>
      <p className="text-sm text-gray-500 mt-1">{shopName}</p>

      <label className="block mt-6 text-xs font-bold uppercase text-gray-400">Sebep</label>
      <select
        className="mt-2 w-full border border-gray-200 rounded-xl p-3 text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value as typeof reason)}
      >
        <option value="DAMAGE">Hasar</option>
        <option value="THEFT">Kayıp / hırsızlık</option>
        <option value="OTHER">Diğer</option>
      </select>

      <label className="block mt-4 text-xs font-bold uppercase text-gray-400">Açıklama</label>
      <textarea
        className="mt-2 w-full border border-gray-200 rounded-xl p-3 text-sm min-h-[120px]"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detaylı açıklama yazın."
      />

      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

      <button
        type="button"
        disabled={loading || description.length < 10}
        onClick={submit}
        className="mt-6 w-full bg-orange-600 text-white py-4 rounded-2xl font-black disabled:opacity-50"
      >
        {loading ? "Gönderiliyor…" : "Gönder"}
      </button>
    </div>
  );
}
