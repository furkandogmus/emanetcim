"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createCampaignAction,
  deleteCampaignAction,
  updateCampaignAction,
  toggleCampaignActiveAction,
} from "@/actions/admin";
import {
  MapPin,
  Calendar,
  Trash2,
  Edit3,
  Plus,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/common/ConfirmDialog";

type Camp = {
  id: string;
  name: string;
  message: string | null;
  discountPercent: number | null;
  isActive: boolean;
  endsAt: string | null;
};

export default function AdminCampaignsClient({
  initialCampaigns,
  topRegionLabel,
  activeDiscountLabel,
  activeCampaignCount,
}: {
  initialCampaigns: Camp[];
  topRegionLabel: string;
  activeDiscountLabel: string;
  activeCampaignCount: number;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [editing, setEditing] = useState<Camp | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setCampaigns(initialCampaigns);
  }, [initialCampaigns]);

  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("");
  const [message, setMessage] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const resetForm = () => {
    setName("");
    setDiscount("");
    setMessage("");
    setEndsAt("");
    setEditing(null);
  };

  const submitCreate = () => {
    if (!name.trim()) {
      toast.error(t("campaignNameRequired"));
      return;
    }
    startTransition(async () => {
      await createCampaignAction({
        name: name.trim(),
        message: message.trim() || undefined,
        discountPercent: discount ? parseFloat(discount) : undefined,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: true,
      });
      toast.success(t("campaignCreated"));
      resetForm();
      router.refresh();
    });
  };

  const submitEdit = () => {
    if (!editing) return;
    startTransition(async () => {
      await updateCampaignAction(editing.id, {
        name: name.trim(),
        message: message.trim() || null,
        discountPercent: discount ? parseFloat(discount) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: editing.isActive,
      });
      toast.success(t("campaignUpdated"));
      resetForm();
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    startTransition(async () => {
      await deleteCampaignAction(pendingDeleteId);
      toast.success(t("campaignDeleted"));
      setPendingDeleteId(null);
      router.refresh();
    });
  };

  const startEdit = (c: Camp) => {
    setEditing(c);
    setName(c.name);
    setDiscount(c.discountPercent != null ? String(c.discountPercent) : "");
    setMessage(c.message || "");
    setEndsAt(c.endsAt ? c.endsAt.slice(0, 10) : "");
  };

  const handleToggle = (c: Camp) => {
    startTransition(async () => {
      await toggleCampaignActiveAction(c.id, !c.isActive);
      toast.success(c.isActive ? t("campaignPaused") : t("campaignResumed"));
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-900 text-white p-10 rounded-[3rem] relative overflow-hidden group">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-2 italic">{t("discountSummaryTitle")}</h2>
            <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-10">
              {t("activeDiscountHeading")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black text-orange-500">
                {activeDiscountLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col justify-center gap-6">
          <div className="flex gap-4">
            <div className="bg-green-50 text-green-600 p-4 rounded-2xl">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                {t("activeCampaignCountLabel")}
              </p>
              <p className="text-2xl font-black">
                {t("activeCampaignCountValue", { count: activeCampaignCount })}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                {t("topBookingRegion")}
              </p>
              <p className="text-2xl font-black">{topRegionLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
          {editing ? t("editCampaign") : t("newCampaign")}
        </h3>
        <input
          className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500"
          placeholder={t("placeholderCampaignName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500"
          placeholder={t("placeholderDiscount")}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <input
          className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500"
          placeholder={t("placeholderMessage")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <input
          type="date"
          className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <div className="flex gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => (editing ? submitEdit() : submitCreate())}
            className="flex items-center gap-2 bg-orange-600 text-white px-8 py-4 rounded-2xl text-sm font-black hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus size={18} /> {editing ? t("saveCampaign") : t("createCampaignBtn")}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-4 rounded-2xl text-sm font-bold text-gray-500"
            >
              {tCommon("cancel")}
            </button>
          )}
        </div>
      </div>

      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mt-8 mb-2 px-2">
        {t("campaignListTitle")}
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {campaigns.map((camp) => (
          <div
            key={camp.id}
            className="bg-white rounded-[2rem] p-8 border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-lg transition-all border-l-8 border-l-orange-500"
          >
            <div>
              <h4 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                {camp.name}
                <span
                  className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                    camp.isActive
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {camp.isActive ? t("statusActiveBadge") : t("statusPausedBadge")}
                </span>
              </h4>
              <div className="flex items-center gap-4 mt-2 text-gray-400 font-bold text-xs uppercase tracking-widest">
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {t("campaignScopeGeneral")}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} />{" "}
                  {camp.endsAt
                    ? `${t("until")} ${camp.endsAt.slice(0, 10)}`
                    : t("unlimited")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
              <div className="text-4xl font-black text-gray-900 mr-2 md:mr-8">
                {camp.discountPercent != null ? `${camp.discountPercent}%` : t("trendNone")}
              </div>
              <button
                type="button"
                title={camp.isActive ? t("pause") : t("resume")}
                onClick={() => handleToggle(camp)}
                disabled={pending}
                className="p-4 hover:bg-gray-50 rounded-2xl transition-colors text-gray-400 hover:text-orange-600"
              >
                {camp.isActive ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
              </button>
              <button
                type="button"
                onClick={() => startEdit(camp)}
                className="p-4 hover:bg-gray-50 rounded-2xl transition-colors text-gray-400 hover:text-gray-900"
              >
                <Edit3 size={20} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(camp.id)}
                className="p-4 hover:bg-red-50 rounded-2xl transition-colors text-gray-400 hover:text-red-500"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        message={t("campaignDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={tCommon("cancel")}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
