"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { 
  Store, 
  ArrowLeft, 
  Save, 
  Trash2, 
  MapPin, 
  Package, 
  CreditCard,
  User,
  Phone,
  MessageSquare
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { updateShopAction, deleteReviewAction } from "@/actions/admin-management";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StarRating from "@/components/common/StarRating";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { formatDecimal } from "@/lib/currency";

interface AdminPartnerEditClientProps {
  shop: {
    id: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    capacity: number;
    pricePerDay: number; // Decimal
    isActive: boolean;
    isTest: boolean;
    rating: number;
    owner: {
      name: string | null;
      phone: string | null;
    };
    reviews: Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date | string;
      guest: {
        name: string | null;
      };
    }>;
    _count: {
      bookings: number;
    };
  };
}

export default function AdminPartnerEditClient({ shop }: AdminPartnerEditClientProps) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingReviewDeleteId, setPendingReviewDeleteId] = useState<string | null>(null);
  const ratingDisplay = Number(shop.rating);
  const ratingSafe = Number.isFinite(ratingDisplay) ? ratingDisplay : 0;
  
  // Form State
  const [formData, setFormData] = useState({
    name: shop.name,
    address: shop.address || "",
    latitude: shop.latitude || 41.0082,
    longitude: shop.longitude || 28.9784,
    capacity: shop.capacity || 10,
    pricePerDay: Number(shop.pricePerDay || 50),
    isActive: shop.isActive,
    isTest: shop.isTest
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateShopAction(shop.id, formData);
      toast.success(t("shopUpdatedSuccess"));
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteReview = async () => {
    if (!pendingReviewDeleteId) return;
    try {
      await deleteReviewAction(pendingReviewDeleteId);
      toast.success(t("reviewDeletedSuccess"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingReviewDeleteId(null);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-10">
        <Link href="/admin/partners" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">{t("backToPartners")}</span>
        </Link>
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
          <Store className="text-orange-600" />
          {formData.name}
        </h1>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Edit Form */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
             {/* Background Accent */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[4rem] -z-10 translate-x-8 -translate-y-8"></div>
             
             <h2 className="text-lg font-black tracking-tight mb-8 flex items-center gap-2">
               <Store size={20} className="text-orange-600" />
               {t("shopDetails")}
             </h2>

             <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("shopName")}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl p-4 text-sm font-bold outline-none transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("pricePerDayLabel")}</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="number"
                      value={formData.pricePerDay}
                      onChange={(e) => setFormData({...formData, pricePerDay: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("shopAddress")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 text-gray-300" size={18} />
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none transition-all min-h-[100px] resize-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("latitude")}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: Number(e.target.value)})}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl p-4 text-sm font-bold outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("longitude")}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: Number(e.target.value)})}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl p-4 text-sm font-bold outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{t("capacity")}</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({...formData, capacity: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 h-full mt-4">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-5 h-5 rounded-lg border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-black text-gray-700 uppercase tracking-tight cursor-pointer">
                    {t("active")}
                  </label>
                </div>

                {/*
                  Test kaydı işareti. `Aktif değil` ile karıştırılmamalı:
                  işaretli dükkan kamuya açık arama/harita/istatistiklerden düşer ama
                  ESNAF AKIŞLARI ÇALIŞMAYA DEVAM EDER — mevcut rezervasyonları olan
                  bir test kaydını pasife almak esnaf tarafını bozuyordu (P1-4).
                */}
                <div className="md:col-span-2 flex items-start gap-4 px-4 mt-2 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <input
                    type="checkbox"
                    id="isTest"
                    checked={formData.isTest}
                    onChange={(e) => setFormData({...formData, isTest: e.target.checked})}
                    className="w-5 h-5 mt-0.5 rounded-lg border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="isTest" className="cursor-pointer">
                    <span className="block text-sm font-black text-amber-800 uppercase tracking-tight">
                      {t("shopIsTest")}
                    </span>
                    <span className="block text-xs font-medium text-amber-700 mt-1">
                      {t("shopIsTestHint")}
                    </span>
                  </label>
                </div>

                <div className="md:col-span-2 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white h-16 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-orange-100 disabled:opacity-50"
                  >
                    <Save size={20} />
                    {t("saveSettings")}
                  </button>
                </div>
             </form>
          </section>

          {/* Owner Info Cards */}
          <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
             <h2 className="text-lg font-black tracking-tight mb-8 flex items-center gap-2">
               <User size={20} className="text-gray-400" />
               {t("ownerDetails")}
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-gray-50 rounded-3xl flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 shadow-sm">
                      <User size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("fullName")}</p>
                      <p className="font-bold text-gray-900">{shop.owner.name}</p>
                   </div>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 shadow-sm">
                      <Phone size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("phone")}</p>
                      <p className="font-bold text-gray-900">{shop.owner.phone}</p>
                   </div>
                </div>
             </div>
          </section>
        </div>

        {/* Sidebar: Reviews and Stats */}
        <div className="flex flex-col gap-8">
           <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-black tracking-tight mb-6 flex items-center gap-2">
                <MessageSquare size={20} className="text-gray-400" />
                {t("reviews")}
              </h2>
              
              <div className="flex flex-col gap-4">
                {shop.reviews.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 text-center py-10 uppercase tracking-widest bg-gray-50 rounded-3xl">
                    {t("noReviewsYet")}
                  </p>
                ) : (
                  shop.reviews.map((review) => (
                    <div key={review.id} className="p-5 bg-gray-50 rounded-3xl flex flex-col gap-3 group relative">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <StarRating rating={review.rating} size={10} />
                             <span className="text-[10px] font-black text-gray-900">{review.guest.name}</span>
                          </div>
                          <button 
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            onClick={() => setPendingReviewDeleteId(review.id)}
                          >
                             <Trash2 size={14} />
                          </button>
                       </div>
                       <p className="text-xs text-gray-600 font-medium leading-relaxed italic">
                         &quot;{review.comment}&quot;
                       </p>
                       <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">
                         {new Date(review.createdAt).toLocaleDateString()}
                       </p>
                    </div>
                  ))
                )}
              </div>
           </section>

           <section className="bg-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-200 mb-2">{t("totalEarnings")}</p>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-5xl font-black tracking-tighter">{formatDecimal(ratingSafe, locale)}</div>
                <StarRating rating={Math.round(ratingSafe)} size={32} />
              </div>
              <div className="w-full bg-white/20 h-1 rounded-full mb-4 overflow-hidden">
                <motion.div 
                   className="h-full bg-white"
                   initial={{ width: 0 }}
                   animate={{ width: `${(ratingSafe / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs font-bold text-orange-100 leading-relaxed">
                {shop._count.bookings} {t("bookingsCountLabel")}
              </p>
           </section>
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={pendingReviewDeleteId !== null}
      message={t("confirmDeleteReview")}
      confirmLabel={t("delete")}
      cancelLabel={tCommon("cancel")}
      onCancel={() => setPendingReviewDeleteId(null)}
      onConfirm={() => void confirmDeleteReview()}
    />
    </>
  );
}
