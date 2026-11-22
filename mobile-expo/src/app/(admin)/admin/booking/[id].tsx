import { useState } from "react";
import type { ReactNode } from "react";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BookingTicket } from "@/components/BookingTicket";
import { AdminBookingActions } from "@/components/AdminBookingActions";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime } from "@/lib/format";
import { SITE_ORIGIN } from "@/lib/images";
import { languageInfo } from "@/lib/languages";
import { telUrl, waUrl } from "@/lib/phone";
import { useViewAs } from "@/lib/use-view-as";
import { useAdminBooking } from "@/lib/queries";
import type { AdminBookingDetail } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

const DAY = 24 * 60 * 60 * 1000;

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/**
 * Destek hattinda bir rezervasyonun tamami: bilet, kime ve nereye ulasilir, muhurler,
 * odeme ve olay gecmisi. Iptal ve zorla teslim burada; iade ve itiraz web panelinde.
 */
export default function AdminBookingScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useAdminBooking(id);
  const lang = languageInfo(i18n.language).site;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
      </View>

      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
        />
      ) : (
        <Detail b={query.data} onWeb={() => open(`${SITE_ORIGIN}/${lang}/admin/bookings/${query.data?.id ?? ""}`)} />
      )}
    </SafeAreaView>
  );
}

function Detail({ b, onWeb }: { b: AdminBookingDetail; onWeb: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = languageInfo(i18n.language).site;
  const viewAs = useViewAs();
  const [now] = useState(() => Date.now());
  const lateDays = b.status === "CHECKED_IN" ? Math.floor((now - new Date(b.checkOutTime).getTime()) / DAY) : 0;
  const disputeOpen = b.disputeStatus === "OPEN" || b.disputeStatus === "IN_REVIEW";
  const directions =
    b.shop.latitude != null && b.shop.longitude != null
      ? Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${b.shop.latitude},${b.shop.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${b.shop.latitude},${b.shop.longitude}`
      : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lateDays >= 1 ? (
        <Banner tone="danger" title={t("admin.lateDays", { count: lateDays })} body={t("admin.lateBody")} />
      ) : null}
      {disputeOpen ? (
        <View style={{ gap: space.sm }}>
          <Banner tone="warning" body={t("admin.disputeOpen")} />
          <Button variant="secondary" title={t("admin.openDisputeWeb")} onPress={() => open(`${SITE_ORIGIN}/${lang}/admin/disputes`)} />
        </View>
      ) : null}

      <BookingTicket booking={b} showQr={false} title={b.guestName || t("partner.guest")} subtitle={b.shopName} audience="staff" />

      <AdminBookingActions booking={b} />

      <Block title={t("admin.guest")}>
        <Card style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="bodyMedium">{b.guest.name || t("partner.guest")}</AppText>
            {b.guest.email ? <AppText variant="caption">{b.guest.email}</AppText> : null}
            {b.guest.phone ? <AppText variant="caption">{b.guest.phone}</AppText> : null}
          </View>
          <View style={styles.actions}>
            {b.guest.phone ? (
              <Button variant="secondary" style={{ flex: 1 }} title={t("admin.call")} onPress={() => open(telUrl(b.guest.phone, b.guest.whatsapp))} />
            ) : null}
            {b.guest.whatsapp ? (
              <IconButton label="WhatsApp" onPress={() => open(waUrl(b.guest.whatsapp ?? ""))}>
                <MessageCircle size={18} color={colors.ink} />
              </IconButton>
            ) : null}
            {b.guest.email ? (
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                title={t("admin.email")}
                onPress={() => open(`mailto:${b.guest.email}?subject=${encodeURIComponent(`BagajPark ${b.id.slice(0, 8).toUpperCase()}`)}`)}
              />
            ) : null}
          </View>
          {b.guest.id && b.guest.canViewAs !== false ? (
            <Button
              variant="secondary"
              title={t("admin.impersonate")}
              loading={viewAs.pendingId === b.guest.id}
              disabled={viewAs.pendingId !== undefined}
              onPress={() => viewAs.confirmViewAs(b.guest.id ?? "", b.guest.name || b.guest.email || b.guest.phone)}
            />
          ) : null}
        </Card>
      </Block>

      <Block title={t("admin.shop")}>
        <Card style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="bodyMedium">{b.shop.name}</AppText>
            {b.shop.address ? <AppText variant="caption">{b.shop.address}</AppText> : null}
            {b.shop.ownerName ? (
              <AppText variant="caption">
                {b.shop.ownerName}
                {b.shop.phone ? ` · ${b.shop.phone}` : ""}
              </AppText>
            ) : null}
          </View>
          <View style={styles.actions}>
            {b.shop.phone ? (
              <Button variant="secondary" style={{ flex: 1 }} title={t("admin.callShop")} onPress={() => open(telUrl(b.shop.phone, b.shop.whatsapp))} />
            ) : null}
            {b.shop.whatsapp ? (
              <IconButton label="WhatsApp" onPress={() => open(waUrl(b.shop.whatsapp ?? ""))}>
                <MessageCircle size={18} color={colors.ink} />
              </IconButton>
            ) : null}
            {directions ? (
              <Button variant="secondary" style={{ flex: 1 }} title={t("bookings.directions")} onPress={() => open(directions)} />
            ) : null}
          </View>
          {b.shop.id ? (
            <Button variant="secondary" title={t("admin.openShop")} onPress={() => router.push(`/admin/shop/${b.shop.id}`)} />
          ) : null}
          {b.shop.ownerId && b.shop.canViewAsOwner !== false ? (
            <Button
              variant="secondary"
              title={t("admin.impersonateOwner")}
              loading={viewAs.pendingId === b.shop.ownerId}
              disabled={viewAs.pendingId !== undefined}
              onPress={() => viewAs.confirmViewAs(b.shop.ownerId ?? "", b.shop.ownerName || b.shop.name)}
            />
          ) : null}
        </Card>
      </Block>

      {b.seals.length > 0 ? (
        <Block title={t("admin.seals")}>
          <View style={styles.seals}>
            {b.seals.map((s) => (
              <View key={`${s.bagIndex}-${s.sealNumber}`} style={styles.seal}>
                <AppText variant="mono" style={{ fontSize: 13 }}>
                  #{s.sealNumber}
                </AppText>
                <AppText variant="caption" style={{ fontSize: 12 }}>
                  {t(`bags.${s.bagSize.toLowerCase()}`)}
                </AppText>
              </View>
            ))}
          </View>
        </Block>
      ) : null}

      <Block title={t("admin.payment")}>
        <Card style={{ gap: space.sm }}>
          <Fact label={t("admin.paymentStatus")} value={b.paymentStatus ? t(`admin.paymentStatuses.${b.paymentStatus}`, { defaultValue: b.paymentStatus }) : t("admin.payAtShop")} />
          {b.couponCode ? <Fact label={t("admin.coupon")} value={b.couponCode} mono /> : null}
          <Fact label={t("admin.createdAt")} value={formatDayTime(b.createdAt)} />
        </Card>
      </Block>

      {b.events.length > 0 ? (
        <Block title={t("admin.history")}>
          <Card style={{ gap: 0 }}>
            {b.events.map((e, i) => (
              <View key={`${e.event}-${e.createdAt}`} style={styles.event}>
                <View style={styles.rail}>
                  <View style={[styles.dot, i === b.events.length - 1 && { backgroundColor: colors.accent }]} />
                  {i < b.events.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < b.events.length - 1 ? space.md : 0 }}>
                  <AppText variant="bodyMedium">{t(`admin.events.${e.event}`, { defaultValue: e.event })}</AppText>
                  <AppText variant="caption" style={{ fontSize: 13 }}>
                    {formatDayTime(e.createdAt)}
                    {e.actorRole ? ` · ${t(`profile.role.${e.actorRole}`, { defaultValue: e.actorRole })}` : ""}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        </Block>
      ) : null}

      <Button variant="ghost" title={t("admin.openInWeb")} onPress={onWeb} />
    </ScrollView>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant={mono ? "mono" : "bodyMedium"}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm },
  content: { padding: space.xl, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  actions: { flexDirection: "row", gap: space.md },
  seals: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  seal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.inner,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fact: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  event: { flexDirection: "row", gap: space.md },
  rail: { width: 12, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: colors.borderStrong },
  line: { flex: 1, width: 1, marginTop: 4, backgroundColor: colors.border },
});
