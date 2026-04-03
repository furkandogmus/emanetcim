"use client";

import { useTransition } from "react";
import { rejectShopAction } from "@/actions/admin";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function RejectButton({
  shopId,
  label,
}: {
  shopId: string;
  label: string;
}) {
  const t = useTranslations("Admin");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleReject = () => {
    if (!confirm(t("rejectConfirm"))) {
      return;
    }
    startTransition(async () => {
      const result = await rejectShopAction(shopId);
      if (result.success) {
        toast.success(t("rejectSuccess"));
        router.refresh();
      } else {
        toast.error(result.error || t("rejectError"));
      }
    });
  };

  return (
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
  );
}
