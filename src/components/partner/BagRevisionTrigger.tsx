"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PencilLine } from "lucide-react";
import BagRevisionDialog from "@/components/partner/BagRevisionDialog";

/**
 * Valiz düzeltme düğmesi. Sunucu bileşeni olan rezervasyon detay sayfasından
 * diyaloğu açabilmek için ince bir istemci sarmalayıcısı.
 *
 * Yalnızca revizyonun MÜMKÜN olduğu durumlarda çiziliyor
 * (`APPROVED | PAID | CHECKED_IN` — `bag-revision.ts`teki birleşik küme).
 * Sunucu zaten reddediyor ama esnafın bunu düğmeye bastıktan sonra öğrenmesi
 * için sebep yok; tezgahta müşteri beklerken en kötü an odur.
 */

const REVISABLE = ["APPROVED", "PAID", "CHECKED_IN"];

type Props = {
  bookingId: string;
  status: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  unitPrice: number;
};

export default function BagRevisionTrigger({
  bookingId, status, bagCountS, bagCountM, bagCountXl, unitPrice,
}: Props) {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState(false);

  if (!REVISABLE.includes(status)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="id-control mt-4 inline-flex w-full items-center justify-center gap-2 border border-gray-200 bg-white py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
      >
        <PencilLine size={15} />
        {t("bagRevisionTitle")}
      </button>
      {open && (
        <BagRevisionDialog
          bookingId={bookingId}
          initial={{ bagCountS, bagCountM, bagCountXl }}
          unitPrice={unitPrice}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
