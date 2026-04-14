"use client";

import { useState, useTransition } from "react";
import { shipSealRequestAction } from "@/actions/seal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function SealShipButton({ requestId }: { requestId: string }) {
  const t = useTranslations("Admin");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [serialFrom, setSerialFrom] = useState("");
  const [serialTo, setSerialTo] = useState("");
  const [adminNote, setAdminNote] = useState("");

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setTrackingNumber("");
    setSerialFrom("");
    setSerialTo("");
    setAdminNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const from = parseInt(serialFrom, 10);
    const to = parseInt(serialTo, 10);
    if (!trackingNumber.trim()) {
      toast.error("Kargo takip numarası zorunlu");
      return;
    }
    if (!serialFrom || isNaN(from)) {
      toast.error("Seri başlangıcı zorunlu");
      return;
    }
    if (!serialTo || isNaN(to)) {
      toast.error("Seri bitişi zorunlu");
      return;
    }
    if (from > to) {
      toast.error("Seri başlangıcı bitiş değerinden büyük olamaz");
      return;
    }

    startTransition(async () => {
      const result = await shipSealRequestAction({
        requestId,
        trackingNumber: trackingNumber.trim(),
        serialFrom: from,
        serialTo: to,
        adminNote: adminNote.trim() || undefined,
      });
      if (result.success) {
        toast.success("Kargo bilgisi kaydedildi, partner bildirildi.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Bir hata oluştu");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors"
      >
        {t("sealShip")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col gap-5">
            <h2 className="text-xl font-black text-gray-900">Kargo Bilgisi Gir</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Kargo Takip Numarası <span className="text-orange-600">*</span>
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Örn: 12345678901234"
                  required
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Seri Başlangıcı <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={serialFrom}
                    onChange={(e) => setSerialFrom(e.target.value)}
                    placeholder="1001"
                    required
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Seri Bitişi <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={serialTo}
                    onChange={(e) => setSerialTo(e.target.value)}
                    placeholder="1050"
                    required
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Admin Notu (İsteğe Bağlı)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  placeholder="Varsa ek notlar..."
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={pending}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {pending ? "Kaydediliyor…" : "Kargoya Ver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
