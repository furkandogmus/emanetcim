"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Check, X } from "lucide-react";
import { Role } from "@prisma/client";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import {
  approveAdminRoleChangeAction,
  cancelAdminRoleChangeAction,
} from "@/actions/admin-management";
import { actionErrorKey } from "@/lib/action-error";

export type RoleApprovalRowVm = {
  id: string;
  previousRole: Role;
  requestedRole: Role;
  createdAtIso: string;
  targetUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: Role;
  };
  requestedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

function roleLabel(t: (k: string) => string, role: Role): string {
  return t(`userRole_${role}`);
}

export default function AdminRoleApprovalsClient({
  initialRows,
  currentAdminId,
}: {
  initialRows: RoleApprovalRowVm[];
  currentAdminId: string;
}) {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();

  const approve = (requestId: string) => {
    startTransition(async () => {
      /*
        `approveAdminRoleChangeAction` icinde assertAdmin() ve `$transaction`
        hicbir try/catch icinde degil -- oturum/yetki hatasi ya da DB hatasi
        buraya kadar FIRLAR. catch olmadan hicbir toast gorulmuyordu; onay
        satiri ekranda takiliyor, yonetici ne oldugunu anlayamiyordu.
      */
      try {
        const res = await approveAdminRoleChangeAction(requestId);
        if (!res.ok) {
          const key =
            res.error === "cannot_self_approve"
              ? "roleApprovalsCannotSelfApprove"
              : res.error === "stale"
                ? "roleApprovalsStale"
                : res.error === "cannot_demote_sole_admin"
                  ? "roleChangeErrorCannotDemoteSoleAdmin"
                  : res.error === "not_found"
                    ? "roleChangeErrorNotFound"
                    : "roleApprovalsApproveError";
          toast.error(t(key));
          if (
            res.error === "stale" ||
            res.error === "not_found" ||
            res.error === "cannot_demote_sole_admin"
          ) {
            setRows((r) => r.filter((x) => x.id !== requestId));
          }
          return;
        }
        setRows((r) => r.filter((x) => x.id !== requestId));
        toast.success(t("roleApprovalsApproved"));
        refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  };

  const cancel = (requestId: string) => {
    startTransition(async () => {
      // Ayni sinif: cancelAdminRoleChangeAction icinde assertAdmin() de firlar.
      try {
        const res = await cancelAdminRoleChangeAction(requestId);
        if (!res.ok) {
          toast.error(t("roleApprovalsCancelError"));
          return;
        }
        setRows((r) => r.filter((x) => x.id !== requestId));
        toast.success(t("roleApprovalsCancelled"));
        refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <header className="mb-10">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs id-eyebrow">
            {t("backToDashboard")}
          </span>
        </Link>
        <h1 className="text-4xl font-black tracking-tighter text-gray-900">
          {t("roleApprovalsTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">{t("roleApprovalsIntro")}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white px-8 py-16 text-center text-sm font-bold text-gray-400">
          {t("roleApprovalsEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => {
            const isSelfRequest = row.requestedBy.id === currentAdminId;
            return (
              <div
                key={row.id}
                className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <p className="id-eyebrow text-gray-400">
                    {t("roleApprovalsTarget")}
                  </p>
                  <p className="font-bold text-gray-900">
                    {row.targetUser.name || "—"}{" "}
                    <span className="text-xs font-normal text-gray-500">
                      {row.targetUser.email}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {t("roleApprovalsChangeLabel", {
                      from: roleLabel(t, row.previousRole),
                      to: roleLabel(t, row.requestedRole),
                    })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("roleApprovalsRequestedBy")}:{" "}
                    <span className="font-bold text-gray-600">
                      {row.requestedBy.name || row.requestedBy.email || "—"}
                    </span>
                    {" · "}
                    {new Date(row.createdAtIso).toLocaleString(dateLocale)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || isSelfRequest}
                    title={
                      isSelfRequest ? t("roleApprovalsCannotSelfApprove") : undefined
                    }
                    onClick={() => approve(row.id)}
                    className="flex items-center gap-2 rounded-2xl bg-orange-600 px-6 py-3 text-[11px] id-eyebrow text-white shadow-lg shadow-orange-900/20 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Check size={16} />
                    {t("roleApprovalsApprove")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => cancel(row.id)}
                    className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-[11px] id-eyebrow text-gray-700 hover:bg-gray-50"
                  >
                    <X size={16} />
                    {t("roleApprovalsCancel")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
