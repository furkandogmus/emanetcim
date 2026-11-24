import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle } from "@/components/AdminOps";
import { BarList } from "@/components/BarList";
import { Segmented } from "@/components/Segmented";
import { AppText, Card } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { useAdminAnalytics } from "@/lib/queries";
import type { AdminAnalytics } from "@/lib/types";
import { colors, fonts, space } from "@/theme/tokens";

const RANGES = ["7", "30", "90"] as const;
type Range = (typeof RANGES)[number];

/**
 * Birinci taraf analitik (salt okuma): web `/admin/analytics` ile ayni ozet
 * (`AnalyticsService.getDashboardSummary`). Huni oturuma oranlanir; uygulama olay
 * gondermedigi icin sayilar yalniz web'i olcer (ekranda yazar).
 */
export default function AdminAnalyticsScreen() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>("30");
  const query = useAdminAnalytics(Number(range));

  return (
    <AdminOpsScreen title={t("adminAnalytics.title")} query={query}>
      <Segmented
        options={RANGES.map((r) => ({ value: r, label: t("adminAnalytics.range", { days: Number(r) }) }))}
        value={range}
        onChange={setRange}
      />
      {query.data ? <Body data={query.data} /> : null}
    </AdminOpsScreen>
  );
}

function Body({ data }: { data: AdminAnalytics }) {
  const { t } = useTranslation();
  const conversion = data.uniqueSessions > 0 ? (data.bookingsCreated / data.uniqueSessions) * 100 : null;
  const funnel = [
    { key: "sessions", label: t("adminAnalytics.sessions"), value: data.uniqueSessions },
    { key: "searches", label: t("adminAnalytics.searches"), value: data.searches },
    { key: "shopViews", label: t("adminAnalytics.shopViews"), value: data.shopViews },
    { key: "checkouts", label: t("adminAnalytics.checkouts"), value: data.checkoutsStarted },
    { key: "bookings", label: t("adminAnalytics.bookings"), value: data.bookingsCreated },
  ];

  return (
    <>
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: 2 }}>
          <SectionTitle>{t("adminAnalytics.funnelTitle")}</SectionTitle>
          <AppText variant="caption" style={{ fontSize: 13 }}>
            {conversion == null
              ? t("adminAnalytics.conversionNone")
              : t("adminAnalytics.conversion", { pct: conversion.toFixed(conversion < 10 ? 1 : 0) })}
          </AppText>
        </View>
        <BarList items={funnel} max={data.uniqueSessions} accentIndex={funnel.length - 1} />
        <View style={styles.figures}>
          <Figure label={t("adminAnalytics.pageViews")} value={data.pageViews} />
          <View style={styles.rule} />
          <Figure label={t("adminAnalytics.newUsers")} value={data.newUsers} />
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle>{t("adminAnalytics.topPages")}</SectionTitle>
        {data.topPaths.length === 0 ? (
          <AppText variant="caption">{t("adminAnalytics.noData")}</AppText>
        ) : (
          <BarList items={data.topPaths.map((p) => ({ key: p.path, label: p.path, value: p.count }))} />
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle>{t("adminAnalytics.topShops")}</SectionTitle>
        {data.topShops.length === 0 ? (
          <AppText variant="caption">{t("adminAnalytics.noData")}</AppText>
        ) : (
          <BarList items={data.topShops.map((s) => ({ key: s.shopId, label: s.name, value: s.count }))} />
        )}
      </Card>

      <AppText variant="caption" style={{ fontSize: 13 }}>
        {t("adminAnalytics.note")}
      </AppText>
    </>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText style={styles.figure}>{formatCount(value)}</AppText>
      <AppText variant="caption" style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: "row", alignItems: "stretch", gap: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rule: { width: 1, backgroundColor: colors.border },
  figure: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
});
