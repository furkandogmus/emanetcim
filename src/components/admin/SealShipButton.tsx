"use client";

import { useTransition } from "react";
import { markSealRequestShippedAction } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function SealShipButton({ requestId }: { requestId: string }) {
  const t = useTranslations("Admin");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markSealRequestShippedAction(requestId);
          toast.success(t("sealShippedToast"));
          router.refresh();
        });
      }}
      className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
    >
      {pending ? "…" : t("sealShip")}
    </button>
  );
}
