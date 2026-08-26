"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { 
  ShieldAlert, 
  Trash2, 
  UserCheck, 
  Mail, 
  Search, 
  ArrowLeft,
  Activity,
  ShieldCheck,
  ShieldX,
  ShieldPlus,
  Store,
  User as UserIcon,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import {
  toggleUserBanAction,
  deleteUserAction,
  resendVerificationEmailAction,
  blockIpAction,
  submitAdminRoleChangeAction,
} from "@/actions/admin-management";
import {
  DELETE_USER_BLOCKED_CODE,
  DELETE_USER_HAS_ACTIVE_BOOKING_CODE,
} from "@/lib/admin/constants";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { actionErrorKey } from "@/lib/action-error";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  isBanned: boolean;
  lastIp: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

interface AdminUsersClientProps {
  users: User[]; // DB'den gelen ham liste
  currentAdminId: string;
  pendingRoleApprovalCount: number;
}

function roleChangeToastError(t: (key: string) => string, code: string): string {
  switch (code) {
    case "unauthorized":
      return t("roleChangeErrorUnauthorized");
    case "not_found":
      return t("roleChangeErrorNotFound");
    case "same_role":
      return t("roleChangeErrorSameRole");
    case "pending_exists":
      return t("roleChangeErrorPendingExists");
    case "cannot_demote_sole_admin":
      return t("roleChangeErrorCannotDemoteSoleAdmin");
    default:
      return code;
  }
}

export default function AdminUsersClient({
  users: initialUsers,
  currentAdminId,
  pendingRoleApprovalCount,
}: AdminUsersClientProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    confirmLabel: string;
    onConfirm: null | (() => void | Promise<void>);
  }>({ open: false, message: "", confirmLabel: "", onConfirm: null });
  const iconBtnBase = "btn-ui btn-ui-md btn-ui-icon";

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    const matchSearch = u.email?.toLowerCase().includes(searchLower) ||
      u.name?.toLowerCase().includes(searchLower) ||
      u.lastIp?.includes(search);

    const matchRole = roleFilter === "ALL" || u.role === roleFilter;

    let matchStatus = true;
    if (statusFilter === "BANNED") matchStatus = u.isBanned;
    else if (statusFilter === "UNVERIFIED") matchStatus = !u.isBanned && !u.emailVerified;
    else if (statusFilter === "ACTIVE") matchStatus = !u.isBanned && !!u.emailVerified;

    return matchSearch && matchRole && matchStatus;
  });

  const hasActiveFilters =
    search.trim().length > 0 || roleFilter !== "ALL" || statusFilter !== "ALL";

  const handleToggleBan = async (id: string, currentBan: boolean) => {
    setLoadingId(id);
    try {
      await toggleUserBanAction(id, !currentBan);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: !currentBan } : u));
      toast.success(currentBan ? t("userUnbanned") : t("userBanned"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("confirmDeleteUser"),
      confirmLabel: t("delete"),
      onConfirm: async () => {
        setLoadingId(id);
        try {
          const res = await deleteUserAction(id);
          if (!res.ok) {
            // `HAS_ACTIVE_BOOKING` da iliskili-kayit engeliydi ama "unauthorized"
            // dalina dusuyordu -- admin, tam yetkisi varken "yetkiniz yok" okuyordu.
            if (
              res.error === DELETE_USER_BLOCKED_CODE ||
              res.error === DELETE_USER_HAS_ACTIVE_BOOKING_CODE
            ) {
              toast.error(t("deleteUserBlockedByRelations"));
            } else {
              toast.error(tErrors("unauthorized"));
            }
            return;
          }
          setUsers((prev) => prev.filter((u) => u.id !== id));
          toast.success(t("userDeleted"));
        } catch (caughtError: unknown) {
          toast.error(tErrors(actionErrorKey(caughtError)));
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const applyRoleChangeResult = async (id: string, newRole: Role) => {
    setLoadingId(id);
    try {
      const res = await submitAdminRoleChangeAction(id, newRole);
      if (!res.ok) {
        toast.error(roleChangeToastError(t, res.error));
        return;
      }
      if ("pendingApproval" in res && res.pendingApproval) {
        toast.success(t("roleChangePendingSecondAdmin"));
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
      );
      toast.success(t("roleChangeApplied"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    } finally {
      setLoadingId(null);
    }
  };

  const handleMakeAdmin = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("confirmMakeAdmin"),
      confirmLabel: t("makeAdmin"),
      onConfirm: async () => applyRoleChangeResult(id, Role.ADMIN),
    });
  };

  const handleDemoteToPartner = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("confirmDemoteAdminPartner"),
      confirmLabel: t("demoteToPartner"),
      onConfirm: async () => applyRoleChangeResult(id, Role.PARTNER),
    });
  };

  const handleDemoteToGuest = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("confirmDemoteAdminGuest"),
      confirmLabel: t("demoteToGuest"),
      onConfirm: async () => applyRoleChangeResult(id, Role.GUEST),
    });
  };

  const handleResendMail = async (email: string) => {
    try {
      // Bu action da başarısızlıkta fırlatmıyor, `{ success: false }` dönüyor
      // (ör. geçersiz e-posta). Kontrol edilmezse gönderilmemiş bir mail için
      // "gönderildi" denir.
      const res = await resendVerificationEmailAction(email);
      if (!res.success) {
        toast.error(t("resendFailed"));
        return;
      }
      toast.success(t("resendSuccess"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    }
  };

  const handleBlockIp = async (ip: string) => {
    if (!ip) return;
    try {
      /**
       * SONUÇ KONTROL EDİLİYOR.
       *
       * `blockIpAction` başarısızlıkta FIRLATMIYOR, `{ success: false }` dönüyor
       * (ör. geçersiz IP biçimi). Yalnızca `catch` yazmak, hiçbir şey
       * engellenmediği hâlde "IP engellendi" demek anlamına geliyordu —
       * yöneticinin bir güvenlik denetimini yapılmış sanması.
       */
      const res = await blockIpAction(
        ip,
        "Admin manually blocked this IP from user list.",
      );
      if (!res.success) {
        toast.error(t("ipBlockFailed"));
        return;
      }
      toast.warning(t("ipBlockedSuccess"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs id-eyebrow">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <ShieldAlert className="text-orange-600" />
            {t("usersManagement")}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs id-eyebrow text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">{t("userRole_ALL")}</option>
            <option value="ADMIN">{t("userRole_ADMIN")}</option>
            <option value="PARTNER">{t("userRole_PARTNER")}</option>
            <option value="GUEST">{t("userRole_GUEST")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs id-eyebrow text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">{t("userStatus_ALL")}</option>
            <option value="ACTIVE">{t("userStatus_ACTIVE")}</option>
            <option value="UNVERIFIED">{t("userStatus_UNVERIFIED")}</option>
            <option value="BANNED">{t("userStatus_BANNED")}</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder={t("searchUsersPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full sm:w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-sm"
            />
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRoleFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="btn-ui btn-ui-md btn-ui-ghost"
            >
              Clear
            </button>
          ) : null}
        </div>
      </header>

      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs id-eyebrow text-gray-400">
          {filteredUsers.length} / {users.length} users
        </p>
      </div>

      {pendingRoleApprovalCount > 0 ? (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-6 py-4 text-sm font-bold text-orange-900 flex flex-wrap items-center justify-between gap-3">
          <span>
            {t("roleApprovalsPendingBanner", { count: pendingRoleApprovalCount })}
          </span>
          <Link
            href="/admin/role-approvals"
            className="id-eyebrow text-orange-700 hover:underline"
          >
            {t("roleApprovalsNav")}
          </Link>
        </div>
      ) : null}

      <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("user")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("role")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("lastIp")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("status")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {filteredUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${user.isBanned ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-900"}`}>
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{user.name || "N/A"}</p>
                          <p className="text-xs text-gray-400 font-bold">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={` px-3 py-1 rounded-full text-[9px] id-eyebrow ${
                        user.role === Role.ADMIN ? "bg-purple-50 text-purple-600" :
                        user.role === Role.PARTNER ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 font-bold">{user.lastIp || "—"}</span>
                        {user.lastIp && (
                          <button 
                            onClick={() => handleBlockIp(user.lastIp!)}
                            className="p-1 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title={t("blockThisIp")}
                          >
                            <ShieldX size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        {user.isBanned ? (
                          <div className="flex items-center gap-1.5 text-red-600 id-eyebrow">
                            <ShieldX size={12} />
                            {t("banned")}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-green-600 id-eyebrow">
                            <ShieldCheck size={12} />
                            {t("active")}
                          </div>
                        )}
                        {!user.emailVerified && (
                          <div className="flex items-center gap-1.5 text-orange-500 id-eyebrow">
                            <Activity size={12} className="animate-pulse" />
                            {t("unverified")}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.emailVerified && user.email && (
                          <button
                            onClick={() => handleResendMail(user.email!)}
                            className={`${iconBtnBase} bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600`}
                            title={t("resendVerification")}
                          >
                            <Mail size={18} />
                          </button>
                        )}
                        {user.role !== Role.ADMIN && (
                          <button
                            onClick={() => handleMakeAdmin(user.id)}
                            disabled={loadingId === user.id}
                            className={`${iconBtnBase} bg-purple-50 hover:bg-purple-100 text-purple-600`}
                            title={t("makeAdmin")}
                          >
                            <ShieldPlus size={18} />
                          </button>
                        )}
                        {user.role === Role.ADMIN &&
                          user.id !== currentAdminId && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDemoteToPartner(user.id)}
                                disabled={loadingId === user.id}
                                className={`${iconBtnBase} bg-blue-50 hover:bg-blue-100 text-blue-600`}
                                title={t("demoteToPartner")}
                              >
                                <Store size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDemoteToGuest(user.id)}
                                disabled={loadingId === user.id}
                                className={`${iconBtnBase} bg-gray-100 hover:bg-gray-200 text-gray-700`}
                                title={t("demoteToGuest")}
                              >
                                <UserIcon size={18} />
                              </button>
                            </>
                          )}
                        <button
                          onClick={() => handleToggleBan(user.id, user.isBanned)}
                          disabled={loadingId === user.id}
                          className={`${iconBtnBase} ${
                            user.isBanned 
                              ? "bg-green-50 text-green-600 hover:bg-green-100" 
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          title={user.isBanned ? t("unbanUser") : t("banUser")}
                        >
                          {user.isBanned ? <UserCheck size={18} /> : <ShieldAlert size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={loadingId === user.id}
                          className={`${iconBtnBase} bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600`}
                          title={t("deleteUser")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xs id-eyebrow text-gray-400">{t("noUsersFound")}</p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden space-y-3">
        <AnimatePresence>
          {filteredUsers.map((user) => (
            <motion.article
              key={user.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${user.isBanned ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-900"}`}>
                    {user.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{user.name || "N/A"}</p>
                    <p className="text-xs text-gray-400 font-bold truncate">{user.email}</p>
                  </div>
                </div>
                <span className={` px-3 py-1 rounded-full text-[9px] id-eyebrow ${
                  user.role === Role.ADMIN ? "bg-purple-50 text-purple-600" :
                  user.role === Role.PARTNER ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"
                }`}>
                  {user.role}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-gray-500 font-bold truncate">{user.lastIp || "—"}</span>
                {user.lastIp ? (
                  <button
                    type="button"
                    onClick={() => handleBlockIp(user.lastIp!)}
                    className="btn-ui btn-ui-sm btn-ui-icon bg-gray-50 text-gray-500 hover:text-red-500 hover:bg-red-50"
                    title={t("blockThisIp")}
                  >
                    <ShieldX size={14} />
                  </button>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {user.isBanned ? (
                  <span className="inline-flex items-center gap-1.5 text-red-600 id-eyebrow">
                    <ShieldX size={12} />
                    {t("banned")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-green-600 id-eyebrow">
                    <ShieldCheck size={12} />
                    {t("active")}
                  </span>
                )}
                {!user.emailVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-orange-500 id-eyebrow">
                    <Activity size={12} className="animate-pulse" />
                    {t("unverified")}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {!user.emailVerified && user.email && (
                  <button
                    type="button"
                    onClick={() => handleResendMail(user.email!)}
                    className={`${iconBtnBase} bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600`}
                    title={t("resendVerification")}
                  >
                    <Mail size={18} />
                  </button>
                )}
                {user.role !== Role.ADMIN && (
                  <button
                    type="button"
                    onClick={() => handleMakeAdmin(user.id)}
                    disabled={loadingId === user.id}
                    className={`${iconBtnBase} bg-purple-50 hover:bg-purple-100 text-purple-600`}
                    title={t("makeAdmin")}
                  >
                    <ShieldPlus size={18} />
                  </button>
                )}
                {user.role === Role.ADMIN &&
                  user.id !== currentAdminId && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDemoteToPartner(user.id)}
                        disabled={loadingId === user.id}
                        className={`${iconBtnBase} bg-blue-50 hover:bg-blue-100 text-blue-600`}
                        title={t("demoteToPartner")}
                      >
                        <Store size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDemoteToGuest(user.id)}
                        disabled={loadingId === user.id}
                        className={`${iconBtnBase} bg-gray-100 hover:bg-gray-200 text-gray-700`}
                        title={t("demoteToGuest")}
                      >
                        <UserIcon size={18} />
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  onClick={() => handleToggleBan(user.id, user.isBanned)}
                  disabled={loadingId === user.id}
                  className={`${iconBtnBase} ${
                    user.isBanned
                      ? "bg-green-50 text-green-600 hover:bg-green-100"
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  }`}
                  title={user.isBanned ? t("unbanUser") : t("banUser")}
                >
                  {user.isBanned ? <UserCheck size={18} /> : <ShieldAlert size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(user.id)}
                  disabled={loadingId === user.id}
                  className={`${iconBtnBase} bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600`}
                  title={t("deleteUser")}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
        {filteredUsers.length === 0 && (
          <div className="py-14 text-center bg-white rounded-3xl border border-gray-100">
            <p className="text-xs id-eyebrow text-gray-400">{t("noUsersFound")}</p>
          </div>
        )}
      </div>
    </div>
    <ConfirmDialog
      open={confirmState.open}
      message={confirmState.message}
      confirmLabel={confirmState.confirmLabel}
      cancelLabel={tCommon("cancel")}
      onCancel={() =>
        setConfirmState({ open: false, message: "", confirmLabel: "", onConfirm: null })
      }
      onConfirm={() => {
        const fn = confirmState.onConfirm;
        setConfirmState({ open: false, message: "", confirmLabel: "", onConfirm: null });
        if (fn) void fn();
      }}
    />
    </>
  );
}
