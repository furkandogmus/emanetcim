import { RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, Divider, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatMoney } from "@/lib/format";
import { useMyAffiliate } from "@/lib/queries";
import { openSitePage } from "@/lib/site-page";
import type { AffiliatePanel } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Araci paneli (web `/account/affiliate`): link, QR, oranlar, sayaclar, rezervasyonlar. Misafir bilgisi yok. */
export default function AffiliateScreen() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const userId = state.status === "signedIn" ? state.user.id : null;
  const query = useMyAffiliate(userId);
  const panel = query.data;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("affiliate.title")} />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <CenterMessage
          title={errorMessage(query.error, "affiliate")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => void query.refetch()} />}
        />
      ) : !panel ? (
        <CenterMessage
          title={t("affiliate.noneTitle")}
          body={t("affiliate.noneBody")}
          action={
            <View style={{ gap: space.sm, alignSelf: "stretch" }}>
              <Button title={t("affiliate.apply")} onPress={() => router.push("/affiliate-apply")} />
              <Button
                variant="ghost"
                title={t("affiliate.learnMore")}
                onPress={() => openSitePage("affiliates", i18n.language)}
              />
            </View>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
          <AppText variant="caption">{panel.displayName}</AppText>
          {panel.status === "active" && panel.link ? (
            <LinkCard panel={panel} link={panel.link} />
          ) : (
            <Banner
              tone="warning"
              title={t(`affiliate.status.${panel.status}`)}
              body={t(panel.status === "pending" ? "affiliate.pendingBody" : "affiliate.pausedBody")}
            />
          )}
          <Stats panel={panel} />
          <Bookings panel={panel} />
          <Button
            variant="ghost"
            title={t("affiliate.learnMore")}
            onPress={() => openSitePage("affiliates", i18n.language)}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LinkCard({ panel, link }: { panel: AffiliatePanel; link: string }) {
  const { t } = useTranslation();
  async function share() {
    const message = t("affiliate.shareMessage", { pct: panel.guestDiscountRate, url: link });
    await Share.share({ message }).catch(() => undefined);
  }
  return (
    <Card style={{ gap: space.md, alignItems: "center" }}>
      <View style={styles.qr} accessible accessibilityLabel={t("affiliate.qrLabel")}>
        <QRCode value={link} size={168} />
      </View>
      <View style={styles.linkBox}>
        <AppText variant="label" style={{ fontSize: 12 }}>
          {t("affiliate.link")}
        </AppText>
        <AppText selectable style={styles.link}>
          {link}
        </AppText>
      </View>
      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("affiliate.rates", { commission: panel.commissionRate, discount: panel.guestDiscountRate })}
      </AppText>
      <Button title={t("affiliate.share")} onPress={() => void share()} style={{ alignSelf: "stretch" }} />
      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("affiliate.shareTip")}
      </AppText>
    </Card>
  );
}

function Stats({ panel }: { panel: AffiliatePanel }) {
  const { t } = useTranslation();
  const s = panel.stats;
  const items: [string, string][] = [
    [t("affiliate.stats.clicks"), String(s.clicks)],
    [t("affiliate.stats.bookings"), String(s.bookings)],
    [t("affiliate.stats.completed"), String(s.completedBookings)],
    [t("affiliate.stats.earned"), formatMoney(s.earned)],
    [t("affiliate.stats.unpaid"), formatMoney(s.unpaid)],
  ];
  return (
    <View style={styles.grid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
          <AppText variant="caption">{label}</AppText>
          <AppText variant="heading">{value}</AppText>
        </View>
      ))}
    </View>
  );
}

function Bookings({ panel }: { panel: AffiliatePanel }) {
  const { t } = useTranslation();
  return (
    <Card style={{ gap: space.sm }}>
      <AppText variant="heading">{t("affiliate.bookingsTitle")}</AppText>
      {panel.bookings.length === 0 ? <AppText variant="caption">{t("affiliate.noBookings")}</AppText> : null}
      {panel.bookings.map((b, i) => (
        <View key={i} style={{ gap: space.xs }}>
          {i > 0 ? <Divider /> : null}
          <AppText variant="bodyMedium" numberOfLines={1}>
            {`${formatDay(`${b.day}T12:00:00.000Z`)} · ${b.shopName}`}
          </AppText>
          <AppText variant="caption">
            {`${formatMoney(b.amount)} · ${
              b.commission != null
                ? t(b.commissionPaid ? "affiliate.commissionPaid" : "affiliate.commissionUnpaid", {
                    amount: formatMoney(b.commission),
                  })
                : b.cancelled
                  ? t("affiliate.cancelled")
                  : t("affiliate.pending")
            }`}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  qr: { padding: space.md, backgroundColor: colors.white, borderRadius: radius.card },
  linkBox: {
    alignSelf: "stretch",
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  link: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 20, color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    gap: 2,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
