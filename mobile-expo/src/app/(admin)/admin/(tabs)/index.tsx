import type { ReactNode } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, ExternalLink, Megaphone, ScrollText, User, Users, MessageSquareText, AlertTriangle, Flag, SlidersHorizontal, Ticket, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { LuggageTag, MapSnippet } from "@/components/Illustrations";
import { LinkGroup, LinkRow } from "@/components/LinkRow";
import { RevenueChart } from "@/components/RevenueChart";
import { StatusBadge } from "@/components/StatusBadge";
import { AppText, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatDayTime, formatMoney } from "@/lib/format";
import { SITE_ORIGIN } from "@/lib/images";
import { languageInfo } from "@/lib/languages";
import { useAdminOverview } from "@/lib/queries";
import type { AdminBookingFilter, AdminOverview } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

/** Mobilde olmayan yonetim isleri web panelinde; yollar `src/app/[locale]/admin/*` ile ayni. */
const WEB_SECTIONS = ["seals", "partners"] as const;

/** Uygulama ici yonetim araclari; odemeler ve platform ayarlari web listesinden buraya tasindi. */
const TOOL_SCREENS = [
  { key: "disputes", href: "/admin/disputes", Icon: AlertTriangle },
  { key: "coupons", href: "/admin/coupons", Icon: Ticket },
  { key: "payments", href: "/admin/payments", Icon: Wallet },
  { key: "settings", href: "/admin/platform-settings", Icon: SlidersHorizontal },
  { key: "flags", href: "/admin/feature-flags", Icon: Flag },
] as const;

/** Son 7 gun ile onceki 7 gunun cirosu; karsilastirma her zaman neye gore oldugunu soyler. */
function weekChange(series: AdminOverview["series"]) {
  const last = series.slice(-7).reduce((a, p) => a + p.revenue, 0);
  const prev = series.slice(-14, -7).reduce((a, p) => a + p.revenue, 0);
  return { last, prev, pct: prev > 0 ? Math.round(((last - prev) / prev) * 100) : null };
}

export default function AdminDashboardScreen() {
  const { t, i18n } = useTranslation();
  const query = useAdminOverview();
  const lang = languageInfo(i18n.language).site;
  const openWeb = (section: string) =>
    void Linking.openURL(`${SITE_ORIGIN}/${lang}/admin/${section}`).catch(() => undefined);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <AppText variant="title">{t("admin.title")}</AppText>
          <AppText variant="caption">{formatDay(new Date())}</AppText>
        </View>
        <IconButton label={t("home.profile")} onPress={() => router.push("/profile")}>
          <User size={20} color={colors.ink} />
        </IconButton>
      </View>

      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <Dashboard data={query.data} openWeb={openWeb} refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
      )}
    </SafeAreaView>
  );
}

function Dashboard({
  data,
  openWeb,
  refreshing,
  onRefresh,
}: {
  data: AdminOverview;
  openWeb: (section: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const change = weekChange(data.series);
  const a = data.attention;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Bugun: operasyonun nabzi, tek kartta dort sayi. */}
      <Section title={t("admin.todayTitle")}>
        <Card style={styles.todayCard}>
          <Stat label={t("admin.todayArrivals")} value={data.today.arrivals} filter="arrivals" />
          <View style={styles.rule} />
          <Stat label={t("admin.todayPickups")} value={data.today.pickups} filter="pickups" />
          <View style={styles.rule} />
          <Stat label={t("admin.todayInStorage")} value={data.today.bagsInStorage} filter="inStorage" accent />
          <View style={styles.rule} />
          <Stat label={t("admin.todayNew")} value={data.today.newBookings} filter="all" />
        </Card>
      </Section>

      <Section title={t("admin.revenueTitle")}>
        <Card style={{ gap: space.lg }}>
          <View style={{ gap: 2 }}>
            <AppText variant="label">{t("admin.last7")}</AppText>
            <AppText style={styles.revenue}>{formatMoney(change.last)}</AppText>
            <AppText variant="caption" style={{ fontSize: 13 }}>
              {change.pct == null
                ? t("admin.last7NoCompare")
                : t("admin.last7VsPrev", { pct: `${change.pct >= 0 ? "+" : "−"}${Math.abs(change.pct)}` })}
            </AppText>
          </View>
          <RevenueChart series={data.series} />
          <View style={styles.totals}>
            <Total label={t("admin.totalRevenue")} value={formatMoney(data.totals.revenue)} />
            <Total label={t("admin.totalBookings")} value={String(data.totals.bookings)} />
            <Total label={t("admin.activeShops")} value={String(data.totals.activeShops)} />
          </View>
        </Card>
      </Section>

      {data.appUsers ? (
        <Section title={t("admin.appUsersTitle")}>
          <Card style={{ gap: space.md }}>
            <View style={styles.usersRow}>
              <Figure label={t("admin.appUsersDay")} value={data.appUsers.day} />
              <View style={styles.rule} />
              <Figure label={t("admin.appUsersWeek")} value={data.appUsers.week} />
              <View style={styles.rule} />
              <Figure label={t("admin.appUsersMonth")} value={data.appUsers.month} />
            </View>
            <AppText variant="caption" style={{ fontSize: 13 }}>
              {t("admin.appUsersFoot", { total: data.appUsers.total, signedIn: data.appUsers.signedInMonth })}
            </AppText>
          </Card>
        </Section>
      ) : null}

      <Section title={t("admin.waiting")}>
        <View style={styles.tiles}>
          <QueueTile
            label={t("admin.pendingApplications")}
            value={a.pendingApplications}
            href="/admin/applications"
            art={<MapSnippet width={72} />}
          />
          <QueueTile
            label={t("admin.unreadMessages")}
            value={a.unreadMessages}
            href="/admin/messages"
            art={<LuggageTag size={36} />}
          />
        </View>
        <LinkGroup>
          <AttentionRow label={t("admin.openDisputes")} value={a.openDisputes} onPress={() => router.push("/admin/disputes")} />
          <AttentionRow label={t("admin.overdueBookings")} value={a.overdueBookings} onPress={() => openBookings("overdue")} />
        </LinkGroup>
        <LinkGroup>
          <LinkRow
            icon={<Users size={18} color={colors.inkSecondary} />}
            label={t("admin.users")}
            onPress={() => router.push("/admin/users")}
          />
          {/* Yonetim araclari burada (Kullanicilar'in yaninda): gelen kutusu bir okuma ekrani, duyuru bir eylem. */}
          <LinkRow
            icon={<Megaphone size={18} color={colors.inkSecondary} />}
            label={t("admin.broadcast")}
            onPress={() => router.push("/admin/broadcast")}
          />
          <LinkRow
            icon={<ScrollText size={18} color={colors.inkSecondary} />}
            label={t("adminUsers.auditLog")}
            onPress={() => router.push("/admin/audit-log")}
          />

          <LinkRow
            icon={<MessageSquareText size={18} color={colors.inkSecondary} />}
            label={t("adminShop.recentReviews")}
            onPress={() => router.push("/admin/reviews")}
          />
        </LinkGroup>
      </Section>

      <Section title={t("adminOps.tools.title")}>
        <LinkGroup>
          {TOOL_SCREENS.map(({ key, href, Icon }) => (
            <LinkRow
              key={key}
              icon={<Icon size={18} color={colors.inkSecondary} />}
              label={t(`adminOps.tools.${key}`)}
              onPress={() => router.push(href)}
            />
          ))}
        </LinkGroup>
      </Section>

      <Section title={t("admin.recent")} action={{ label: t("home.allBookings"), onPress: () => openBookings("all") }}>
        {data.recent.length === 0 ? (
          <AppText variant="caption">{t("admin.noRecent")}</AppText>
        ) : (
          <LinkGroup>
            {data.recent.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="link"
                onPress={() => router.push(`/admin/booking/${b.id}`)}
                style={({ pressed }) => [styles.recent, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {b.guestName || t("partner.guest")}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1} style={{ fontSize: 13 }}>
                    {b.shopName}
                  </AppText>
                  <AppText variant="caption" style={{ fontSize: 13 }}>
                    {formatDayTime(b.createdAt)}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
                    {formatMoney(b.totalPrice)}
                  </AppText>
                  <StatusBadge status={b.status} cancelReason={b.cancelReason} />
                </View>
              </Pressable>
            ))}
          </LinkGroup>
        )}
      </Section>

      <Section title={t("admin.webPanel")}>
        <LinkGroup>
          {WEB_SECTIONS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="link"
              onPress={() => openWeb(s)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
            >
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {t(`admin.web.${s}`)}
              </AppText>
              <ExternalLink size={16} color={colors.inkMuted} />
            </Pressable>
          ))}
        </LinkGroup>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHead}>
        <AppText variant="label">{title}</AppText>
        {action ? (
          <Pressable accessibilityRole="link" hitSlop={8} onPress={action.onPress}>
            <AppText variant="label" style={{ color: colors.accent }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Genel bakistaki sayi, ilgili suzgecle Rezervasyonlar sekmesini acar. */
function openBookings(filter: AdminBookingFilter) {
  router.push({ pathname: "/admin/bookings", params: { filter } });
}

function Stat({
  label,
  value,
  accent,
  filter,
}: {
  label: string;
  value: number;
  accent?: boolean;
  filter: AdminBookingFilter;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => openBookings(filter)}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}
    >
      <AppText style={[styles.statValue, accent && value > 0 && { color: colors.accent }]}>{value}</AppText>
      <AppText variant="caption" numberOfLines={2} style={styles.statLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Tiklanmayan sayi: tekil kullanici karti. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="caption" numberOfLines={2} style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" style={{ fontSize: 12 }}>
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
        {value}
      </AppText>
    </View>
  );
}

/** Bekleyen is karosu: urun cizimi + buyuk sayi. Is varsa sayi turuncu, kenar vurgulu. */
function QueueTile({ label, value, href, art }: { label: string; value: number; href: Href; art: ReactNode }) {
  const hot = value > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.tile, hot && styles.tileHot, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={styles.tileArt}>{art}</View>
      <AppText style={[styles.tileValue, hot && { color: colors.accent }]}>{value}</AppText>
      <AppText variant="caption" numberOfLines={2} style={{ fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Webde cozulen dikkat isleri: sayi varsa turuncu rozet, yoksa sessiz gri. */
function AttentionRow({
  label,
  value,
  onPress,
  external,
}: {
  label: string;
  value: number;
  onPress: () => void;
  /** Satir uygulama ici bir ekran degil tarayiciyi acar: ok yerine dis baglanti simgesi. */
  external?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      <View style={[styles.badge, value > 0 && styles.badgeHot]}>
        <AppText variant="label" style={[{ fontVariant: ["tabular-nums"] }, value > 0 && { color: colors.white }]}>
          {value}
        </AppText>
      </View>
      {external ? <ExternalLink size={16} color={colors.inkMuted} /> : <ChevronRight size={18} color={colors.inkMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.xl,
    paddingBottom: space.lg,
  },
  content: { padding: space.xl, paddingTop: space.sm, gap: space.xl, paddingBottom: space.xxl },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayCard: { flexDirection: "row", paddingHorizontal: space.sm },
  usersRow: { flexDirection: "row" },
  rule: { width: 1, backgroundColor: colors.border, marginVertical: space.xs },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  revenue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink, fontVariant: ["tabular-nums"] },
  totals: { flexDirection: "row", gap: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  tiles: { flexDirection: "row", gap: space.md },
  tile: {
    flex: 1,
    gap: 2,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileHot: { borderColor: colors.brand },
  tileArt: {
    height: 64,
    marginBottom: space.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg },
  recent: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  badge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  badgeHot: { backgroundColor: colors.accent },
});
