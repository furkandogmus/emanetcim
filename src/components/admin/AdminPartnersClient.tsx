"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { 
  Store, 
  Search, 
  Edit3, 
  ArrowLeft, 
  User, 
  Phone, 
  Star,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  X,
  Loader2
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { adminInitiatePartnerPasswordResetAction } from "@/actions/partner-password-reset";

interface Shop {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  rating: number;
  pricePerDay: number; // Decimal
  createdAt: Date;
  owner: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  _count: {
    bookings: number;
    reviews: number;
  };
}

interface AdminPartnersClientProps {
  shops: Shop[];
}

export default function AdminPartnersClient({ shops: initialShops }: AdminPartnersClientProps) {
  const t = useTranslations("Admin");
  const [search, setSearch] = useState("");

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [resetResult, setResetResult] = useState<{ ok: true; resetUrl: string } | { ok: false; error: string } | null>(null);
  const [resetPending, startResetTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const filteredShops = initialShops.filter(shop => 
    shop.name.toLowerCase().includes(search.toLowerCase()) ||
    shop.owner.name?.toLowerCase().includes(search.toLowerCase()) ||
    shop.owner.phone?.includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
      <header className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Store className="text-orange-600" />
            {t("shopManagement")}
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">
            {initialShops.length} {t("activePartners")}
          </p>
        </div>

        <div className="relative w-full lg:w-96 group">
          <div className="absolute inset-0 bg-orange-600/5 rounded-2xl blur-xl group-focus-within:bg-orange-600/10 transition-all opacity-0 group-focus-within:opacity-100"></div>
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder={t("messagesSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="relative w-full pl-14 pr-6 py-5 bg-white border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-sm"
          />
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("shopDetails")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("owner")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("performance")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("status")}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {filteredShops.map((shop) => (
                  <motion.tr
                    key={shop.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-900">{shop.name}</p>
                        <p className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{shop.address}</p>
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                          ₺{Number(shop.pricePerDay || 0)} / {t("day")}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {shop.owner.name}
                        </p>
                        <p className="text-xs text-gray-500 font-bold flex items-center gap-1.5">
                          <Phone size={14} />
                          {shop.owner.phone}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{t("bookings")}</span>
                          <span className="font-bold text-gray-700 flex items-center gap-1">
                            <ShoppingBag size={14} />
                            {shop._count.bookings}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{t("rating")}</span>
                          <span className="font-bold text-gray-700 flex items-center gap-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            {shop.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`px-3 py-1 rounded-full inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter ${
                        shop.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {shop.isActive ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {shop.isActive ? t("active") : t("inactive")}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setResetTarget({ id: shop.id, name: shop.owner.name || shop.name, phone: shop.owner.phone })}
                          className="p-2.5 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all inline-flex items-center justify-center group/btn shadow-sm"
                          title={t("resetPassword")}
                        >
                          <KeyRound size={18} className="group-hover/btn:scale-110 transition-transform" />
                        </button>
                        <Link
                          href={`/admin/partners/${shop.id}/edit`}
                          className="p-2.5 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all inline-flex items-center justify-center group/btn shadow-sm"
                        >
                          <Edit3 size={18} className="group-hover/btn:scale-110 transition-transform" />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      {/* Şifre sıfırlama modalı */}
      <AnimatePresence>
        {resetTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => { setResetTarget(null); setResetResult(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-gray-900">{t("resetPassword")}</h2>
                <button
                  type="button"
                  onClick={() => { setResetTarget(null); setResetResult(null); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!resetResult ? (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-6">
                    {t("resetPasswordConfirm", { name: resetTarget.name, phone: resetTarget.phone || "-" })}
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => { setResetTarget(null); setResetResult(null); }}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      {t("resetCancel")}
                    </button>
                    <button
                      type="button"
                      disabled={resetPending || !resetTarget.phone}
                      onClick={() => {
                        if (!resetTarget.phone) return;
                        startResetTransition(async () => {
                          const res = await adminInitiatePartnerPasswordResetAction(resetTarget.phone!);
                          setResetResult(res);
                        });
                      }}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {resetPending ? (
                        <><Loader2 size={16} className="animate-spin" /> {t("generating")}</>
                      ) : (
                        <><KeyRound size={16} /> {t("generateResetLink")}</>
                      )}
                    </button>
                  </div>
                </div>
              ) : resetResult.ok ? (
                <div>
                  <div className="flex items-center gap-2 mb-4 text-green-700">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-bold">{t("resetLinkGenerated")}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={resetResult.resetUrl}
                      className="w-full pr-12 pl-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult.resetUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                    >
                      {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setResetTarget(null); setResetResult(null); setCopied(false); }}
                    className="mt-6 w-full px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors"
                  >
                    {t("resetDone")}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4 text-red-600">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{t("resetError")}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">{resetResult.error}</p>
                  <button
                    type="button"
                    onClick={() => { setResetTarget(null); setResetResult(null); }}
                    className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors"
                  >
                    {t("resetClose")}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
