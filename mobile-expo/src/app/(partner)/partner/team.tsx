import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { ShopSwitcher } from "@/components/ShopSwitcher";
import { AppText, Button, Card, CenterMessage } from "@/components/ui";
import { Input } from "@/components/Field";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useInviteStaff, useRemoveStaff, useRevokeStaffInvite, useShopTeam } from "@/lib/queries";
import { colors, space } from "@/theme/tokens";

/**
 * Sahibin ekip ekrani (web `/partner/team` ile ayni servis): personel listesi, e-posta ile
 * davet, cikarma, bekleyen davetler. Personel bu ekrana baglanti gormez; sunucu da 403 verir.
 */
export default function PartnerTeamScreen() {
  const { t, i18n } = useTranslation();
  const query = useShopTeam();
  const invite = useInviteStaff();
  const remove = useRemoveStaff();
  const revoke = useRevokeStaffInvite();
  const [email, setEmail] = useState("");
  const team = query.data;
  const used = team ? team.members.length + team.invites.length : 0;

  function submitInvite() {
    if (invite.isPending || !email.trim()) return;
    invite.mutate(
      { email: email.trim(), locale: i18n.language },
      {
        onSuccess: () => {
          setEmail("");
          notify(t("shopStaff.title"), t("shopStaff.invitedToast"));
        },
        onError: (e) => notify(t("shopStaff.inviteFailed"), errorMessage(e, "shopStaff")),
      },
    );
  }

  function confirmRemove(userId: string, label: string) {
    Alert.alert(t("shopStaff.removeTitle"), t("shopStaff.removeConfirm", { name: label }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopStaff.remove"),
        style: "destructive",
        onPress: () =>
          remove.mutate(userId, {
            onSuccess: () => notify(t("shopStaff.title"), t("shopStaff.removedToast")),
            onError: (e) => notify(t("shopStaff.title"), errorMessage(e, "shopStaff")),
          }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("shopStaff.title")} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
      >
        <ShopSwitcher />
        <AppText variant="caption">{t("shopStaff.intro")}</AppText>

        {query.isLoading ? null : !team ? (
          <CenterMessage
            title={errorMessage(query.error, "shopStaff")}
            action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
          />
        ) : (
          <>
            <Card style={{ gap: space.sm }}>
              <AppText variant="bodyMedium" nativeID="team-invite-email">
                {t("shopStaff.inviteLabel")}
              </AppText>
              <Input
                accessibilityLabelledBy="team-invite-email"
                accessibilityLabel={t("shopStaff.inviteLabel")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("shopStaff.invitePlaceholder")}
                placeholderTextColor={colors.inkMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
              />
              <Button
                title={t("shopStaff.inviteSubmit")}
                loading={invite.isPending}
                disabled={!email.trim() || used >= team.limit}
                onPress={submitInvite}
              />
              <AppText variant="caption">{t("shopStaff.limitHint", { used, limit: team.limit })}</AppText>
            </Card>

            <View style={{ gap: space.sm }}>
              <AppText variant="label">{t("shopStaff.membersTitle")}</AppText>
              {team.members.length === 0 ? (
                <AppText variant="caption">{t("shopStaff.membersEmpty")}</AppText>
              ) : (
                team.members.map((m) => {
                  const label = m.name || m.email || "";
                  return (
                    <Card key={m.userId} style={styles.row}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="bodyMedium" numberOfLines={1}>
                          {label}
                        </AppText>
                        <AppText variant="caption" numberOfLines={1}>
                          {t("shopStaff.since", { date: formatDay(m.since) })}
                        </AppText>
                      </View>
                      <Button
                        variant="danger"
                        title={t("shopStaff.remove")}
                        disabled={remove.isPending}
                        onPress={() => confirmRemove(m.userId, label)}
                      />
                    </Card>
                  );
                })
              )}
            </View>

            {team.invites.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <AppText variant="label">{t("shopStaff.pendingTitle")}</AppText>
                {team.invites.map((i) => (
                  <Card key={i.id} style={styles.row}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {i.email}
                      </AppText>
                      <AppText variant="caption">{t("shopStaff.expires", { date: formatDay(i.expiresAt) })}</AppText>
                    </View>
                    <Button
                      variant="secondary"
                      title={t("shopStaff.revoke")}
                      disabled={revoke.isPending}
                      onPress={() =>
                        revoke.mutate(i.id, {
                          onSuccess: () => notify(t("shopStaff.title"), t("shopStaff.revokedToast")),
                          onError: (e) => notify(t("shopStaff.title"), errorMessage(e, "shopStaff")),
                        })
                      }
                    />
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
});
