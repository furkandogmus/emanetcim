import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, TypedConfirmSheet, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { AppText, Banner, Button } from "@/components/ui";
import { api } from "@/lib/api";
import {
  adminOpsErrorMessage,
  canMutateAdminOps,
  flagBody,
  flagDraftValid,
  flagToDraft,
  type FlagDraft,
} from "@/lib/admin-ops";
import { notify } from "@/lib/notify";
import { adminOpsKeys, useAdminFeatureFlags } from "@/lib/queries";
import type { AdminFeatureFlag } from "@/lib/types";
import { space } from "@/theme/tokens";

/** Var olan bayraklari duzenler; riskli bayrak (odeme/muhur/giris) anahtarini yazarak onay ister. */
export default function AdminFeatureFlagsScreen() {
  const { t } = useTranslation();
  const query = useAdminFeatureFlags();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <AdminOpsScreen title={t("adminOps.flags.title")} query={query}>
      <AppText variant="caption">{t("adminOps.flags.intro")}</AppText>
      {query.data?.length === 0 ? <AppText variant="caption">{t("adminOps.flags.empty")}</AppText> : null}
      {query.data?.map((f) =>
        editing === f.key ? (
          <FlagEditor key={f.key} flag={f} onDone={() => setEditing(null)} />
        ) : (
          <View key={f.key} style={opsStyles.row} testID={`flag-${f.key}`}>
            <View style={opsStyles.rowTop}>
              <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                {f.key}
              </AppText>
              <AppText variant="caption">{f.enabled ? t("adminOps.flags.on") : t("adminOps.flags.off")}</AppText>
            </View>
            {f.description ? <AppText variant="caption">{f.description}</AppText> : null}
            <AppText variant="caption" style={opsStyles.meta}>
              {[
                t("adminOps.flags.rolloutLine", { pct: f.rolloutPct }),
                f.allowedUserIds.length ? t("adminOps.flags.allowlistLine", { count: f.allowedUserIds.length }) : null,
                f.risky ? t("adminOps.risky") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
            {canMutateAdminOps() ? (
              <Button variant="secondary" title={t("adminOps.edit")}
                accessibilityHint={f.key} onPress={() => setEditing(f.key)} />
            ) : null}
          </View>
        ),
      )}
    </AdminOpsScreen>
  );
}

function FlagEditor({ flag, onDone }: { flag: AdminFeatureFlag; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<FlagDraft>(() => flagToDraft(flag));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = flagDraftValid(draft);
  const set = (patch: Partial<FlagDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = useMutation({
    mutationFn: (confirmation: string | undefined) =>
      api<{ success: true }>(`/admin/feature-flags/${encodeURIComponent(flag.key)}`, {
        method: "PATCH",
        body: { ...flagBody(draft), confirmation },
      }),
    onSuccess: () => {
      setConfirming(false);
      notify(t("adminOps.saved"));
      onDone();
    },
    onError: (e) => setError(adminOpsErrorMessage(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.flags }),
  });

  return (
    <View style={[opsStyles.row, { gap: space.md }]} testID={`flag-edit-${flag.key}`}>
      <AppText variant="bodyMedium">{flag.key}</AppText>
      {flag.risky ? <Banner tone="warning" body={t("adminOps.flags.riskyHint")} /> : null}
      <Segmented
        options={[
          { value: "on", label: t("adminOps.flags.on") },
          { value: "off", label: t("adminOps.flags.off") },
        ]}
        value={draft.enabled ? "on" : "off"}
        onChange={(v) => set({ enabled: v === "on" })}
      />
      <Field
        label={t("adminOps.flags.rollout")}
        value={draft.rolloutPct}
        onChangeText={(rolloutPct) => set({ rolloutPct })}
        keyboardType="number-pad"
        maxLength={3}
        hint={valid ? undefined : t("adminOps.flags.invalid")}
      />
      <Field
        label={t("adminOps.flags.allowlist")}
        value={draft.allowedUserIds}
        onChangeText={(allowedUserIds) => set({ allowedUserIds })}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label={t("adminOps.flags.description")}
        value={draft.description}
        onChangeText={(description) => set({ description })}
        maxLength={500}
        multiline
      />
      {error && !confirming ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("adminOps.save")}
        disabled={!valid}
        loading={save.isPending && !confirming}
        onPress={() => {
          setError(null);
          if (flag.risky) setConfirming(true);
          else save.mutate(undefined);
        }}
      />
      <Button variant="secondary" title={t("common.cancel")} onPress={onDone} />
      <TypedConfirmSheet
        visible={confirming}
        phrase={flag.key}
        body={t("adminOps.flags.confirmBody", { key: flag.key })}
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
