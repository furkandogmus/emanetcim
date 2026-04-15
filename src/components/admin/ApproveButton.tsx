"use client";

import { useState, useTransition } from "react";
import { approveShopAction } from "@/actions/admin";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export default function ApproveButton({
  shopId,
  label,
}: {
  shopId: string;
  label: string;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const handleApprove = () => {
    setConfirmOpen(true);
  };

  return (
    <>
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="flex-1 md:w-32 bg-gray-900 text-white py-4 rounded-2xl text-xs font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        ) : (
          <CheckCircle2 size={16} />
        )}
        {label}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message={t("approveConfirm")}
        confirmLabel={t("approve")}
        cancelLabel={tCommon("cancel")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startTransition(async () => {
            const result = await approveShopAction(shopId);
            if (result.success) {
              toast.success(t("approveSuccess"));
              router.refresh();
            } else {
              toast.error(t("approveError"));
            }
          });
        }}
      />
    </>
  );
}
