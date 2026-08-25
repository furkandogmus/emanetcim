"use client";

import { useCallback, useState, useTransition } from "react";
import { shipSealRequestAction } from "@/actions/seal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { useActionErrorText } from "@/lib/use-action-error";

export default function SealShipButton({ requestId, requestedQuantity }: { requestId: string, requestedQuantity: number }) {
  const t = useTranslations("Admin");
  const errorText = useActionErrorText();
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [quantity, setQuantity] = useState(requestedQuantity.toString());
  const [adminNote, setAdminNote] = useState("");

  function handleOpen() {
    setOpen(true);
  }

  const closeModal = useCallback(() => setOpen(false), []);
  useModalBehavior({ open, onClose: closeModal });

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setTrackingNumber("");
    setAdminNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error(t("sealShipTrackingRequired"));
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t("sealShipQuantityInvalid"));
      return;
    }

    startTransition(async () => {
      const result = await shipSealRequestAction({
        requestId,
        trackingNumber: trackingNumber.trim(),
        quantity: qty,
        adminNote: adminNote.trim() || undefined,
      });
      if (result.success) {
        toast.success("Kargo bilgisi kaydedildi, partner bildirildi.");
        setOpen(false);
        router.refresh();
      } else {
        // `result.error` snake_case bir KOD ("tracking_number_required"); ham basiliyordu.
        toast.error(errorText(result.error, tErrors("generic")));
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seal-ship-title"
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col gap-5"
          >
            <h2 id="seal-ship-title" className="text-xl font-black text-gray-900">
              Kargo Bilgisi Gir
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs id-eyebrow text-gray-500">
                  {t("sealShipTrackingLabel")} <span className="text-orange-600">*</span>
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={t("sealShipTrackingPlaceholder")}
                  required
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs id-eyebrow text-gray-500">
                  {t("sealShipQuantityLabel")} <span className="text-orange-600">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="200"
                  required
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>



              <div className="flex flex-col gap-1">
                <label className="text-xs id-eyebrow text-gray-500">
                  {t("sealShipNoteLabel")}
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
                  {tCommon("cancel")}
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
