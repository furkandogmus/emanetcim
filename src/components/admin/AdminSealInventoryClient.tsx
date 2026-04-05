"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, PackagePlus, Truck } from "lucide-react";
import {
  assignSealsToShopAction,
  bulkCreateSealsAction,
} from "@/actions/admin";

type ShopOption = { id: string; name: string; isActive: boolean };

type Props = {
  sealCounts: Record<string, number>;
  shops: ShopOption[];
};

export default function AdminSealInventoryClient({ sealCounts, shops }: Props) {
  const t = useTranslations("Admin");
  const [fromCreate, setFromCreate] = useState("");
  const [toCreate, setToCreate] = useState("");
  const [creating, setCreating] = useState(false);

  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [fromAssign, setFromAssign] = useState("");
  const [toAssign, setToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);

  const statusOrder = ["STOCK", "ASSIGNED", "IN_USE", "RETURNED", "FAULTY"] as const;

  const handleBulkCreate = async () => {
    const a = parseInt(fromCreate, 10);
    const b = parseInt(toCreate, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      alert(t("sealInvalidRange"));
      return;
    }
    setCreating(true);
    try {
      const res = await bulkCreateSealsAction(a, b);
      if (res.success) {
        alert(t("sealBulkCreated", { count: res.created }));
        setFromCreate("");
        setToCreate("");
        window.location.reload();
      } else {
        alert(res.error);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!shopId) {
      alert(t("sealSelectShop"));
      return;
    }
    const a = parseInt(fromAssign, 10);
    const b = parseInt(toAssign, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      alert(t("sealInvalidRange"));
      return;
    }
    setAssigning(true);
    try {
      const res = await assignSealsToShopAction(shopId, a, b);
      if (res.success) {
        alert(t("sealAssigned", { count: res.updated }));
        setFromAssign("");
        setToAssign("");
        window.location.reload();
      } else {
        alert(res.error);
      }
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusOrder.map((st) => (
          <div
            key={st}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {t(`sealStatus_${st}`)}
            </p>
            <p className="text-2xl font-black text-gray-900 mt-1">
              {sealCounts[st] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-orange-600">
            <PackagePlus size={24} />
            <h3 className="font-black text-lg">{t("sealBulkCreateTitle")}</h3>
          </div>
          <p className="text-sm text-gray-500">{t("sealBulkCreateHint")}</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-400 uppercase">
              {t("sealFrom")}
              <input
                type="number"
                className="bg-gray-50 rounded-xl px-4 py-3 font-black text-gray-900 w-28"
                value={fromCreate}
                onChange={(e) => setFromCreate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-400 uppercase">
              {t("sealTo")}
              <input
                type="number"
                className="bg-gray-50 rounded-xl px-4 py-3 font-black text-gray-900 w-28"
                value={toCreate}
                onChange={(e) => setToCreate(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleBulkCreate()}
              className="bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {creating ? <Loader2 className="animate-spin w-5 h-5" /> : null}
              {t("sealBulkCreateSubmit")}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-gray-900">
            <Truck size={24} />
            <h3 className="font-black text-lg">{t("sealAssignTitle")}</h3>
          </div>
          <p className="text-sm text-gray-500">{t("sealAssignHint")}</p>
          <select
            className="bg-gray-50 rounded-xl px-4 py-3 font-bold text-gray-900 w-full"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.isActive ? ` (${t("sealShopInactive")})` : ""}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-400 uppercase">
              {t("sealFrom")}
              <input
                type="number"
                className="bg-gray-50 rounded-xl px-4 py-3 font-black text-gray-900 w-28"
                value={fromAssign}
                onChange={(e) => setFromAssign(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-400 uppercase">
              {t("sealTo")}
              <input
                type="number"
                className="bg-gray-50 rounded-xl px-4 py-3 font-black text-gray-900 w-28"
                value={toAssign}
                onChange={(e) => setToAssign(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={assigning}
              onClick={() => void handleAssign()}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-black disabled:opacity-50 flex items-center gap-2"
            >
              {assigning ? <Loader2 className="animate-spin w-5 h-5" /> : null}
              {t("sealAssignSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
