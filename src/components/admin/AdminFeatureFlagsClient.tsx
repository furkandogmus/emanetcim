"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateFeatureFlagAction } from "@/actions/feature-flags";

export type FeatureFlagFormRow = {
  id: string;
  key: string;
  enabled: boolean;
  rolloutPct: number;
  allowedUserIdsLines: string;
  description: string;
  updatedAtLabel: string;
};

function parseUuidLines(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function AdminFeatureFlagsClient({
  initial,
}: {
  initial: FeatureFlagFormRow[];
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<FeatureFlagFormRow[]>(initial);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const patchRow = (key: string, partial: Partial<FeatureFlagFormRow>) => {
    setRows((list) =>
      list.map((r) => (r.key === key ? { ...r, ...partial } : r)),
    );
  };

  const save = (row: FeatureFlagFormRow) => {
    startTransition(async () => {
      const allowedUserIds = parseUuidLines(row.allowedUserIdsLines);
      const invalid = allowedUserIds.filter(
        (id) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id,
          ),
      );
      if (invalid.length > 0) {
        toast.error(t("featureFlagsInvalidUuids"));
        return;
      }
      const res = await updateFeatureFlagAction({
        key: row.key,
        enabled: row.enabled,
        rolloutPct: row.rolloutPct,
        allowedUserIds,
        description: row.description.trim() || null,
      });
      if (!res.success) {
        toast.error(t("featureFlagsInvalid"));
        return;
      }
      toast.success(t("featureFlagsSaved"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-10">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm flex flex-col gap-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {t("featureFlagsKeyLabel")}
              </p>
              <p className="font-mono text-lg font-bold text-gray-900">
                {row.key}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {t("featureFlagsUpdatedAt", { at: row.updatedAtLabel })}
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300"
              checked={row.enabled}
              onChange={(e) =>
                patchRow(row.key, { enabled: e.target.checked })
              }
            />
            <span className="text-sm font-bold text-gray-800">
              {t("featureFlagsEnabled")}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {t("featureFlagsRollout")}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-900 max-w-[12rem]"
              value={row.rolloutPct}
              onChange={(e) =>
                patchRow(row.key, {
                  rolloutPct: Math.min(
                    100,
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  ),
                })
              }
            />
            <span className="text-xs text-gray-500">
              {t("featureFlagsRolloutHint")}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {t("featureFlagsAllowlist")}
            </span>
            <textarea
              rows={4}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono text-gray-900"
              placeholder={t("featureFlagsAllowlistPlaceholder")}
              value={row.allowedUserIdsLines}
              onChange={(e) =>
                patchRow(row.key, { allowedUserIdsLines: e.target.value })
              }
            />
            <span className="text-xs text-gray-500">
              {t("featureFlagsAllowlistHint")}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {t("featureFlagsDescription")}
            </span>
            <input
              type="text"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900"
              value={row.description}
              onChange={(e) =>
                patchRow(row.key, { description: e.target.value })
              }
            />
          </label>

          <button
            type="button"
            disabled={pending}
            onClick={() => save(row)}
            className="self-start rounded-2xl bg-orange-600 px-8 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-900/30 hover:bg-orange-700 disabled:opacity-50"
          >
            {t("featureFlagsSave")}
          </button>
        </div>
      ))}
    </div>
  );
}
