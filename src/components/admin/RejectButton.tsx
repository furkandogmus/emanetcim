"use client";

import { useState, useTransition } from "react";
import { rejectShopAction } from "@/actions/admin";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { rejectShopErrorKey } from "@/lib/reject-shop-error-copy";

export default function RejectButton({
  shopId,
  label,
}: {
  shopId: string;
  label: string;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const handleReject = () => {
    setConfirmOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className="flex-1 md:w-32 bg-red-50 text-red-600 py-4 rounded-2xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? (
          <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
        ) : (
          <XCircle size={16} />
        )}
        {label}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message={t("rejectConfirm")}
        confirmLabel={t("reject")}
        cancelLabel={tCommon("cancel")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startTransition(async () => {
            const result = await rejectShopAction(shopId);
            if (result.success) {
              toast.success(t("rejectSuccess"));
              router.refresh();
            } else {
              toast.error(tErrors(rejectShopErrorKey(result.error)));
            }
          });
        }}
      />
    </>
  );
}
