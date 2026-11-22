import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ChoiceSheet } from "@/components/ChoiceSheet";
import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, Card, CenterMessage, Loading } from "@/components/ui";
import {
  anonymizeUser,
  canErase,
  canSubmitErasure,
  changeUserRole,
  ERASURE_REASON_MIN,
  generatePassword,
  resendUserVerification,
  ROLES,
  sendUserPasswordReset,
  setUserPassword,
} from "@/lib/admin-user-actions";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import i18n from "@/lib/i18n";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { MIN_PASSWORD, isValidNewPassword } from "@/lib/password-rules";
import { waUrl } from "@/lib/phone";
import { keys, useAdminUser } from "@/lib/queries";
import type { AdminUserDetail, Role } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

const fail = (e: unknown) => notify(i18n.t("admin.actionFailed"), errorMessage(e, "adminUsers"));

/**
 * Admin kullanici karti ve islemleri (webden tasindi): rol, sifirlama/dogrulama
 * e-postasi, sifre belirleme, hesap silme ve kisinin denetim kaydi. Her kural
 * sunucuda; ekran yalnizca onay kapilarini kurar.
 */
export default function AdminUserScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useAdminUser(id);
  const { state } = useAuth();
  const myId = state.status === "signedIn" ? state.user.id : null;
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: [...keys.admin, "users"] });

  const [roleSheet, setRoleSheet] = useState(false);
  const [pwSheet, setPwSheet] = useState(false);
  const [eraseSheet, setEraseSheet] = useState(false);

  const role = useMutation({
    mutationFn: (r: Role) => changeUserRole(id, r),
    onSuccess: (res) => notify(res.status === "applied" ? t("adminUsers.roleApplied") : t("adminUsers.rolePending")),
    onError: fail,
    onSettled: refresh,
  });
  const reset = useMutation({
    mutationFn: () => sendUserPasswordReset(id, i18n.language),
    onSuccess: () => notify(t("adminUsers.sendResetDone")),
    onError: fail,
  });
  const verify = useMutation({
    mutationFn: () => resendUserVerification(id, i18n.language),
    onSuccess: () => notify(t("adminUsers.resendVerificationDone")),
    onError: fail,
  });

  const u = query.data;
  const label = !u ? "" : u.isAnonymized ? t("adminUsers.anonymizedLabel") : u.name || u.email || u.phone;

  function confirmRole(next: Role) {
    if (!u) return;
    const touchesAdmin = u.role === "ADMIN" || next === "ADMIN";
    Alert.alert(
      t("adminUsers.roleConfirmTitle", { name: label, role: t(`admin.role.${next}`) }),
      touchesAdmin ? t("adminUsers.roleConfirmAdminBody") : t("adminUsers.roleConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("adminUsers.roleConfirm"), style: "destructive", onPress: () => role.mutate(next) },
      ],
    );
  }

  function confirmReset() {
    if (!u) return;
    Alert.alert(t("adminUsers.sendResetTitle"), t("adminUsers.sendResetBody", { email: u.email }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("adminUsers.sendResetConfirm"), onPress: () => reset.mutate() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={label || t("adminUsers.title")} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : !u ? (
        <CenterMessage
          title={errorMessage(query.error, "adminUsers")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={{ gap: space.xs }}>
            <AppText variant="bodyMedium">{label}</AppText>
            {u.email && !u.isAnonymized ? <AppText variant="caption">{u.email}</AppText> : null}
            {u.phone ? <AppText variant="caption">{u.phone}</AppText> : null}
            <AppText variant="caption">
              {[
                t(`admin.role.${u.role}`),
                u.email && !u.isAnonymized
                  ? u.emailVerified
                    ? t("adminUsers.emailVerified")
                    : t("adminUsers.emailUnverified")
                  : null,
                u.hasPassword ? null : t("adminUsers.noPassword"),
                formatDay(u.createdAt),
              ]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
          </Card>

          {u.isAnonymized ? <Banner tone="warning" body={t("adminUsers.anonymized")} /> : null}
          {u.pendingRole ? (
            <Banner tone="warning" body={t("adminUsers.pendingRole", { role: t(`admin.role.${u.pendingRole}`) })} />
          ) : null}

          <AppText variant="label">{t("adminUsers.actions")}</AppText>
          <View style={{ gap: space.sm }}>
            {u.id !== myId ? (
              <Button
                variant="secondary"
                title={t("adminUsers.changeRole")}
                loading={role.isPending}
                onPress={() => setRoleSheet(true)}
              />
            ) : null}
            {u.email && !u.isAnonymized ? (
              <Button variant="secondary" title={t("adminUsers.sendReset")} loading={reset.isPending} onPress={confirmReset} />
            ) : null}
            {u.email && !u.emailVerified && !u.isAnonymized ? (
              <Button
                variant="secondary"
                title={t("adminUsers.resendVerification")}
                loading={verify.isPending}
                onPress={() => verify.mutate()}
              />
            ) : null}
            {u.role !== "ADMIN" && !u.isAnonymized ? (
              <Button variant="secondary" title={t("adminUsers.setPassword")} onPress={() => setPwSheet(true)} />
            ) : null}
            <Button
              variant="secondary"
              title={t("adminUsers.auditLog")}
              onPress={() => router.push({ pathname: "/admin/audit-log", params: { userId: u.id, name: label } })}
            />
            {canErase(u, myId) ? (
              <Button variant="danger" title={t("adminUsers.erase")} onPress={() => setEraseSheet(true)} />
            ) : u.id !== myId && !u.isAnonymized ? (
              <AppText variant="caption">{t("adminUsers.eraseNotGuest")}</AppText>
            ) : null}
          </View>
        </ScrollView>
      )}

      {u ? (
        <>
          <ChoiceSheet
            visible={roleSheet}
            onClose={() => setRoleSheet(false)}
            title={t("adminUsers.changeRoleTitle")}
            choices={ROLES.map((r) => ({ value: r, label: t(`admin.role.${r}`) }))}
            selected={u.role}
            onSelect={(v) => confirmRole(v as Role)}
          />
          <SetPasswordSheet visible={pwSheet} onClose={() => setPwSheet(false)} user={u} label={label} />
          <EraseSheet
            visible={eraseSheet}
            onClose={() => setEraseSheet(false)}
            user={u}
            onDone={() => {
              setEraseSheet(false);
              refresh();
              notify(t("adminUsers.eraseDone"));
              router.back();
            }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

/** Sifre belirleme: oneri + duzenleme, ikinci onay, sonra sifre bir kez gosterilir. */
function SetPasswordSheet({
  visible,
  onClose,
  user,
  label,
}: {
  visible: boolean;
  onClose: () => void;
  user: AdminUserDetail;
  label: string;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState(() => generatePassword());
  const [saved, setSaved] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (pw: string) => setUserPassword(user.id, pw),
    onSuccess: (_r, pw) => setSaved(pw),
  });
  const close = () => {
    if (save.isPending) return;
    setSaved(null);
    save.reset();
    setPassword(generatePassword());
    onClose();
  };

  function confirm() {
    Alert.alert(t("adminUsers.setPasswordConfirmTitle"), t("adminUsers.setPasswordConfirmBody", { name: label }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("adminUsers.setPasswordSubmit"), style: "destructive", onPress: () => save.mutate(password) },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={{ gap: space.md }}>
        <AppText variant="heading" accessibilityRole="header">
          {t("adminUsers.setPasswordTitle")}
        </AppText>
        {saved ? (
          <>
            <AppText variant="caption">{t("adminUsers.setPasswordDone")}</AppText>
            <AppText variant="mono" selectable>
              {saved}
            </AppText>
            {user.whatsapp ? (
              <Button
                variant="secondary"
                title={t("adminUsers.setPasswordWhatsapp")}
                onPress={() => void Linking.openURL(waUrl(user.whatsapp ?? "")).catch(() => undefined)}
              />
            ) : null}
            <Button title={t("adminUsers.done")} onPress={close} />
          </>
        ) : (
          <>
            <AppText variant="caption">{t("adminUsers.setPasswordBody")}</AppText>
            <Field
              label={t("adminUsers.setPasswordLabel")}
              hint={t("adminUsers.setPasswordHint", { min: MIN_PASSWORD })}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!save.isPending}
            />
            {save.error ? <Banner tone="danger" body={errorMessage(save.error, "adminUsers")} /> : null}
            <Button
              variant="danger"
              title={t("adminUsers.setPasswordSubmit")}
              disabled={!isValidNewPassword(password)}
              loading={save.isPending}
              onPress={confirm}
            />
            <Button
              variant="ghost"
              title={t("adminUsers.setPasswordRegenerate")}
              disabled={save.isPending}
              onPress={() => setPassword(generatePassword())}
            />
          </>
        )}
      </View>
    </Sheet>
  );
}

/** Hesap silme: e-posta/telefon yazilmadan ve gerekce girilmeden dugme acilmaz. */
function EraseSheet({
  visible,
  onClose,
  user,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  user: AdminUserDetail;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const erase = useMutation({
    mutationFn: () => anonymizeUser(user.id, confirm.trim(), reason.trim()),
    onSuccess: () => {
      setConfirm("");
      setReason("");
      onDone();
    },
  });

  return (
    <Sheet visible={visible} onClose={erase.isPending ? () => undefined : onClose}>
      <View style={{ gap: space.md }}>
        <AppText variant="heading" accessibilityRole="header">
          {t("adminUsers.eraseTitle")}
        </AppText>
        <AppText variant="caption">{t("adminUsers.eraseBody")}</AppText>
        <Field
          label={t("adminUsers.eraseConfirmLabel")}
          value={confirm}
          onChangeText={setConfirm}
          placeholder={t("adminUsers.eraseConfirmPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!erase.isPending}
        />
        <Field
          label={t("adminUsers.eraseReasonLabel")}
          hint={t("adminUsers.eraseReasonHint", { min: ERASURE_REASON_MIN })}
          value={reason}
          onChangeText={setReason}
          placeholder={t("adminUsers.eraseReasonPlaceholder")}
          multiline
          maxLength={500}
          inputStyle={{ maxHeight: 120 }}
          editable={!erase.isPending}
        />
        {erase.error ? <Banner tone="danger" body={errorMessage(erase.error, "adminUsers")} /> : null}
        <Button
          variant="danger"
          title={t("adminUsers.eraseSubmit")}
          disabled={!canSubmitErasure({ confirm, reason }, user)}
          loading={erase.isPending}
          onPress={() => erase.mutate()}
        />
        <Button variant="ghost" title={t("common.cancel")} disabled={erase.isPending} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
});
