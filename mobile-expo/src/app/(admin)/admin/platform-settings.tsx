import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, TypedConfirmSheet } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { AppText, Banner, Button } from "@/components/ui";
import { api } from "@/lib/api";
import {
  SETTINGS_FIELDS,
  adminOpsErrorMessage,
  canMutateAdminOps,
  changedRiskyFields,
  draftToValues,
  isBoolSetting,
  settingsToDraft,
  type SettingsDraft,
} from "@/lib/admin-ops";
import { formatDayTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { adminOpsKeys, useAdminPlatformSettings } from "@/lib/queries";
import type { AdminPlatformSettings } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

export default function AdminPlatformSettingsScreen() {
  const { t } = useTranslation();
  const query = useAdminPlatformSettings();
  return (
    <AdminOpsScreen title={t("adminOps.settings.title")} query={query}>
      {query.data ? <SettingsForm key={query.data.updatedAt ?? "default"} settings={query.data} /> : null}
    </AdminOpsScreen>
  );
}

function SettingsForm({ settings }: { settings: AdminPlatformSettings }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsToDraft(settings.values));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canMutate = canMutateAdminOps();
  const risky = changedRiskyFields(settings, draft);
  const before = settingsToDraft(settings.values);
  const dirty = SETTINGS_FIELDS.some((f) => before[f].trim() !== draft[f].trim());

  const save = useMutation({
    mutationFn: (confirmation: string | undefined) =>
      api<AdminPlatformSettings>("/admin/platform-settings", {
        method: "PUT",
        body: { values: draftToValues(draft), confirmation },
      }),
    onSuccess: (next) => {
      setConfirming(false);
      setError(null);
      qc.setQueryData(adminOpsKeys.settings, next);
      notify(t("adminOps.saved"));
    },
    onError: (e) => setError(adminOpsErrorMessage(e)),
  });

  const label = (f: keyof SettingsDraft) => t(`adminOps.settings.fields.${f}`);

  return (
    <View style={{ gap: space.lg }}>
      <AppText variant="caption">{t("adminOps.settings.intro")}</AppText>
      <AppText variant="caption">
        {settings.updatedAt
          ? t("adminOps.settings.updatedAt", { date: formatDayTime(settings.updatedAt) })
          : t("adminOps.settings.never")}
      </AppText>

      {SETTINGS_FIELDS.map((f) => {
        const isRisky = settings.riskyFields.includes(f);
        const title = isRisky ? `${label(f)} · ${t("adminOps.risky")}` : label(f);
        if (isBoolSetting(f)) {
          return (
            <View key={f} style={{ gap: space.xs }}>
              <AppText variant="label" style={isRisky ? { color: colors.danger } : undefined}>
                {title}
              </AppText>
              <Segmented
                options={[
                  { value: "true", label: t("adminOps.settings.on") },
                  { value: "false", label: t("adminOps.settings.off") },
                ]}
                value={draft[f] === "true" ? "true" : "false"}
                onChange={(v) => canMutate && setDraft((d) => ({ ...d, [f]: v }))}
              />
            </View>
          );
        }
        const multiline = f === "platformHolidayDates";
        const text = f === "minAppVersion" || f === "latestAppVersion";
        return (
          <Field
            key={f}
            label={title}
            value={draft[f]}
            editable={canMutate}
            multiline={multiline}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType={multiline || text ? "default" : "decimal-pad"}
            hint={
              multiline
                ? t("adminOps.settings.holidayHint")
                : text
                  ? t("adminOps.settings.versionHint")
                  : undefined
            }
            onChangeText={(v) => setDraft((d) => ({ ...d, [f]: v }))}
          />
        );
      })}

      {error && !confirming ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("adminOps.save")}
        disabled={!canMutate || !dirty}
        loading={save.isPending && !confirming}
        onPress={() => {
          setError(null);
          if (risky.length > 0) setConfirming(true);
          else save.mutate(undefined);
        }}
      />

      <TypedConfirmSheet
        visible={confirming}
        phrase={settings.confirmPhrase}
        body={t("adminOps.confirm.body", { fields: risky.map(label).join(", "), phrase: settings.confirmPhrase })}
        loading={save.isPending}
        error={confirming ? error : null}
        onClose={() => {
          setConfirming(false);
          setError(null);
        }}
        onConfirm={(typed) => save.mutate(typed)}
      />
    </View>
  );
}
