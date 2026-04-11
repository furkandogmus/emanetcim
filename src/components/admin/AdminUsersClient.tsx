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
  ShieldPlus
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { toggleUserBanAction, deleteUserAction, resendVerificationEmailAction, blockIpAction, updateUserRoleAction } from "@/actions/admin-management";

/** admin-management deleteUserAction ile aynı (FK / RESTRICT) */
const ADMIN_DELETE_USER_HAS_RELATIONS = "ADMIN_DELETE_USER_HAS_RELATIONS";
import { toast } from "sonner";
import { Role } from "@prisma/client";

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
}

export default function AdminUsersClient({ users: initialUsers }: AdminUsersClientProps) {
  const t = useTranslations("Admin");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  const handleToggleBan = async (id: string, currentBan: boolean) => {
    setLoadingId(id);
    try {
      await toggleUserBanAction(id, !currentBan);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: !currentBan } : u));
      toast.success(currentBan ? t("userUnbanned") : t("userBanned"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDeleteUser"))) return;
    setLoadingId(id);
    try {
      await deleteUserAction(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(t("userDeleted"));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === ADMIN_DELETE_USER_HAS_RELATIONS) {
        toast.error(t("deleteUserBlockedByRelations"));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleMakeAdmin = async (id: string) => {
    if (!confirm(t("confirmMakeAdmin"))) return;
    setLoadingId(id);
    try {
      await updateUserRoleAction(id, Role.ADMIN);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: Role.ADMIN } : u));
      toast.success(t("roleUpdatedSuccess"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingId(null);
    }
  };

  const handleResendMail = async (email: string) => {
    try {
      await resendVerificationEmailAction(email);
      toast.success(t("resendSuccess"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleBlockIp = async (ip: string) => {
    if (!ip) return;
    try {
      await blockIpAction(ip, "Admin manually blocked this IP from user list.");
      toast.warning(t("ipBlockedSuccess"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">{t("backToDashboard")}</span>
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
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">{t("userRole_ALL")}</option>
            <option value="ADMIN">{t("userRole_ADMIN")}</option>
            <option value="PARTNER">{t("userRole_PARTNER")}</option>
            <option value="GUEST">{t("userRole_GUEST")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">{t("userStatus_ALL")}</option>
            <option value="ACTIVE">{t("userStatus_ACTIVE")}</option>
            <option value="UNVERIFIED">{t("userStatus_UNVERIFIED")}</option>
            <option value="BANNED">{t("userStatus_BANNED")}</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t("searchUsersPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full sm:w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-sm"
            />
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("user")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("role")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("lastIp")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("status")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">{t("actions")}</th>
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
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
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
                          <div className="flex items-center gap-1.5 text-red-600 text-[10px] font-black uppercase tracking-widest">
                            <ShieldX size={12} />
                            {t("banned")}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-green-600 text-[10px] font-black uppercase tracking-widest">
                            <ShieldCheck size={12} />
                            {t("active")}
                          </div>
                        )}
                        {!user.emailVerified && (
                          <div className="flex items-center gap-1.5 text-orange-500 text-[10px] font-black uppercase tracking-widest">
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
                            className="p-3 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all"
                            title={t("resendVerification")}
                          >
                            <Mail size={18} />
                          </button>
                        )}
                        {user.role !== Role.ADMIN && (
                          <button
                            onClick={() => handleMakeAdmin(user.id)}
                            disabled={loadingId === user.id}
                            className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-all"
                            title={t("makeAdmin")}
                          >
                            <ShieldPlus size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleBan(user.id, user.isBanned)}
                          disabled={loadingId === user.id}
                          className={`p-3 rounded-xl transition-all ${
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
                          className="p-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"
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
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">{t("noUsersFound")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
