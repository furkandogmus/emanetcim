"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { 
  Store, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Search,
  User,
  Phone,
  MapPin,
  Calendar
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { approveShopAction, rejectShopAction } from "@/actions/admin-management";
import { toast } from "sonner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { actionErrorKey } from "@/lib/action-error";

interface Application {
  id: string;
  name: string;
  address: string | null;
  ownerId: string;
  createdAt: Date;
  owner: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}

interface AdminApplicationsClientProps {
  applications: Application[];
}

export default function AdminApplicationsClient({ applications: initialApps }: AdminApplicationsClientProps) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    confirmLabel: string;
    onConfirm: null | (() => void);
  }>({ open: false, message: "", confirmLabel: "", onConfirm: null });

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.owner.name?.toLowerCase().includes(search.toLowerCase()) ||
    app.owner.phone?.includes(search)
  );

  const handleApprove = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("approveConfirm"),
      confirmLabel: t("approve"),
      onConfirm: async () => {
        setLoadingId(id);
        try {
          await approveShopAction(id);
          setApps(prev => prev.filter(a => a.id !== id));
          toast.success(t("approveSuccess"));
        } catch (caughtError: unknown) {
          toast.error(tErrors(actionErrorKey(caughtError)));
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleReject = async (id: string) => {
    setConfirmState({
      open: true,
      message: t("rejectConfirm"),
      confirmLabel: t("reject"),
      onConfirm: async () => {
        setLoadingId(id);
        try {
          const res = await rejectShopAction(id);
          if (!res.success) {
            toast.error(t("shopDeleteBlockedByRelations"));
            return;
          }
          setApps((prev) => prev.filter((a) => a.id !== id));
          toast.success(t("rejectSuccess"));
        } catch (caughtError: unknown) {
          toast.error(tErrors(actionErrorKey(caughtError)));
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs id-eyebrow">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Store className="text-orange-600" />
            {t("applications")}
          </h1>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t("searchApplicationsPlaceholder") || "Başvuru ara..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full md:w-80 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-sm"
          />
        </div>
      </header>

      <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("shopDetails")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("owner")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400">{t("date")}</th>
                <th className="px-8 py-5 id-eyebrow text-gray-400 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {filteredApps.map((app) => (
                  <motion.tr
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-6 max-w-xs">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2">
                          <Store size={14} className="text-orange-600" />
                          {app.name}
                        </p>
                        <p className="text-xs text-gray-500 flex items-start gap-1.5 leading-relaxed font-medium">
                          <MapPin size={14} className="shrink-0 mt-0.5" />
                          {app.address}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {app.owner.name}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-gray-500 font-bold flex items-center gap-1.5">
                            <Phone size={14} />
                            {app.owner.phone}
                          </p>
                          {app.owner.email && (
                            <p className="text-xs text-gray-400 font-bold">{app.owner.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs text-gray-500 font-bold flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(app.createdAt).toLocaleDateString(dateLocale)}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleReject(app.id)}
                          disabled={loadingId === app.id}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl id-eyebrow transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          {t("reject")}
                        </button>
                        <button
                          onClick={() => handleApprove(app.id)}
                          disabled={loadingId === app.id}
                          className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl id-eyebrow transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          {t("approve")}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredApps.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xs id-eyebrow text-gray-400">
                {search ? t("noApplicationsFound") : t("noApplications")}
              </p>
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
    </div>
  );
}
