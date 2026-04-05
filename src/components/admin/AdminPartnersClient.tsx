"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";

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

  const filteredShops = initialShops.filter(shop => 
    shop.name.toLowerCase().includes(search.toLowerCase()) ||
    shop.owner.name?.toLowerCase().includes(search.toLowerCase()) ||
    shop.owner.phone?.includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Store className="text-orange-600" />
            {t("shopManagement")}
          </h1>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t("searchShopsPlaceholder") || "Dükkan, sahip veya telefon ara..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full md:w-80 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-sm"
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
                          ₺{Number(shop.pricePerDay || 0)} / {t("day") || "Gün"}
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
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{t("bookings") || "Emanet"}</span>
                          <span className="font-bold text-gray-700 flex items-center gap-1">
                            <ShoppingBag size={14} />
                            {shop._count.bookings}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{t("rating") || "Puan"}</span>
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
                        {shop.isActive ? t("active") : t("inactive") || "Pasif"}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Link
                        href={`/admin/partners/${shop.id}/edit`}
                        className="p-2.5 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all inline-flex items-center justify-center group/btn shadow-sm"
                      >
                        <Edit3 size={18} className="group-hover/btn:scale-110 transition-transform" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
