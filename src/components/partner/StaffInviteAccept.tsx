"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { acceptShopInviteAction } from "@/actions/shop-staff";
import { useActionErrorText } from "@/lib/use-action-error";

export default function StaffInviteAccept({ token }: { token: string }) {
  const t = useTranslations("shopStaff");
  const errorText = useActionErrorText();
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const accept = () =>
    startTransition(async () => {
      const res = await acceptShopInviteAction(token);
      if (!res.success) {
        const raw = res.error;
        toast.error(raw?.startsWith("shopStaff.") ? t(raw.slice("shopStaff.".length) as never) : errorText(raw));
        return;
      }
      toast.success(t("inviteAccepted"));
      router.push(`/${locale}/partner?shop=${encodeURIComponent(res.shopId)}`);
    });

  return (
    <button
      type="button"
      onClick={accept}
      disabled={pending}
      className="self-start rounded-xl id-accent-bg px-5 py-3 text-sm font-bold hover:opacity-90 disabled:opacity-50"
    >
      {t("inviteAccept")}
    </button>
  );
}
