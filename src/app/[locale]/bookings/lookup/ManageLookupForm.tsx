"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Search } from "lucide-react";
import AmbientBackdrop from "@/components/common/AmbientBackdrop";

export default function ManageLookupForm() {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !bookingId.trim()) {
      toast.error(t("bookingLookupFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), bookingId: bookingId.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/bookings/manage/${data.token}`);
      } else {
        toast.error(t("bookingLookupError"));
      }
    } catch {
      toast.error(t("bookingLookupError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 flex items-center justify-center p-6 overflow-hidden">
      <AmbientBackdrop />
      <div className="relative z-10 max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
          <Search size={24} className="text-orange-600" />
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">{t("manageBookingTitle")}</h1>
        <p className="text-sm text-gray-500 mb-6">{t("manageBookingDesc")}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="id-eyebrow text-gray-400">
              {t("email")}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="id-eyebrow text-gray-400">
              {t("bookingId")}
            </span>
            {/*
              `aria-label="ABC12345"` (ornek placeholder metni) buradaydi ve
              ARIA erisilebilir-ad hesabinda sarmalayan <label>in ONUNE
              geciyordu -- ekran okuyucu kullanicisi alanin ne oldugunu
              ("Rezervasyon Numarasi") degil, ornek deger "ABC12345"i
              isim olarak duyuyordu. Kaldirildi; sarmalayan <label>
              (ustteki e-posta alaniyla ayni desen) zaten dogru ismi verir.
            */}
            <input
              type="text"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="ABC12345"
              className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-mono font-bold uppercase"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-4 rounded-2xl id-eyebrow text-sm disabled:opacity-50 hover:bg-orange-700 transition-colors"
          >
            {loading ? "..." : t("manageBookingCta")}
          </button>
        </form>
      </div>
    </div>
  );
}
