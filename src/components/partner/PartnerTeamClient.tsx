"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Mail, UserMinus, Users } from "lucide-react";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { inviteShopStaffAction, removeShopStaffAction, revokeShopInviteAction } from "@/actions/shop-staff";
import { useActionErrorText } from "@/lib/use-action-error";
import { formatInstant } from "@/lib/format-datetime";

type Member = { userId: string; name: string | null; email: string | null; since: string };
type Invite = { id: string; email: string; expiresAt: string };

type Props = {
  shopId: string;
  shopName: string;
  shops: { id: string; name: string }[];
  members: Member[];
  invites: Invite[];
  limit: number;
};

/** Sahibin ekip ekrani: personel listesi, davet, cikarma, bekleyen davetler. */
export default function PartnerTeamClient({ shopId, shopName, shops, members, invites, limit }: Props) {
  const t = useTranslations("shopStaff");
  const errorText = useActionErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<Member | null>(null);
  const used = members.length + invites.length;

  // `shopStaff.*` kodlari bu ad alaninda; digerleri ortak `Errors` sozlugunde.
  const showError = (raw: string | undefined) => {
    if (raw?.startsWith("shopStaff.")) toast.error(t(raw.slice("shopStaff.".length) as never));
    else toast.error(errorText(raw));
  };

  const invite = () => {
    startTransition(async () => {
      const res = await inviteShopStaffAction(shopId, email);
      if (!res.success) return showError(res.error);
      toast.success(res.kind === "added" ? t("addedToast") : t("invitedToast"));
      setEmail("");
      router.refresh();
    });
  };

  const remove = (m: Member) => {
    setRemoving(null);
    startTransition(async () => {
      const res = await removeShopStaffAction(shopId, m.userId);
      if (!res.success) return showError(res.error);
      toast.success(t("removedToast"));
      router.refresh();
    });
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const res = await revokeShopInviteAction(shopId, id);
      if (!res.success) return showError(res.error);
      toast.success(t("revokedToast"));
      router.refresh();
    });
  };

  const fmt = (iso: string) => formatInstant(iso, locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 pb-24">
      <header className="flex items-center gap-3">
        <Link href={{ pathname: "/partner", query: { shop: shopId } }} className="rounded-full p-2 hover:bg-gray-100" aria-label={t("back")}>
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl id-display tracking-tight text-gray-900">{t("title")}</h1>
          <p className="truncate text-sm text-gray-500">{shopName}</p>
        </div>
      </header>

      {shops.length > 1 && (
        <div>
          <label htmlFor="team-shop-switcher" className="id-eyebrow block text-gray-400">
            {t("shopLabel")}
          </label>
          <select
            id="team-shop-switcher"
            value={shopId}
            onChange={(e) => router.push(`${pathname}?shop=${encodeURIComponent(e.target.value)}`)}
            className="mt-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-sm text-gray-600">{t("intro")}</p>

      <section className="ui-card flex flex-col gap-3 p-5">
        <label htmlFor="team-invite-email" className="text-sm font-bold text-gray-900">
          {t("inviteLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="team-invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("invitePlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={invite}
            disabled={pending || email.trim().length === 0 || used >= limit}
            className="rounded-xl id-accent-bg px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            {t("inviteSubmit")}
          </button>
        </div>
        <p className="text-xs text-gray-500">{t("limitHint", { used, limit })}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm id-display text-gray-900">
          <Users size={16} /> {t("membersTitle")}
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">{t("membersEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.userId} className="ui-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-gray-900">{m.name || m.email}</p>
                  <p className="truncate text-xs text-gray-500">
                    {m.email} · {t("since", { date: fmt(m.since) })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoving(m)}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  <UserMinus size={14} /> {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm id-display text-gray-900">
            <Mail size={16} /> {t("pendingTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.id} className="ui-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-gray-900">{i.email}</p>
                  <p className="text-xs text-gray-500">{t("expires", { date: fmt(i.expiresAt) })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  disabled={pending}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {t("revoke")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        message={t("removeConfirm", { name: removing?.name || removing?.email || "" })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
