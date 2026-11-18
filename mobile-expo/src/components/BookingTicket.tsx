import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/components/StatusBadge";
import { AppText, Banner } from "@/components/ui";
import { formatDay, formatMoney, formatTime } from "@/lib/format";
import type { BookingSummary } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Bilet yalnizca ozet alanlarini ve (gosterilecekse) QR token'ini okur; yonetim de kullanir. */
type TicketBooking = BookingSummary & { qrCodeToken?: string | null };

/**
 * Misafirin dukkanda gosterdigi "emanet fisi". Vestiyer/bagaj fisi gibi iki parca:
 * ustte kim-nerede-ne zaman, delikli cizginin altinda dukkana okutulan QR ve kod.
 * Kod web'deki "Rezervasyon kodu" ile ayni: QR okunamazsa telefonda soylenir.
 */
export function BookingTicket({
  booking: b,
  showQr,
  title,
  subtitle,
}: {
  booking: TicketBooking;
  showQr: boolean;
  /** Esnaf gorunumunde misafir adi; varsayilan dukkan adi. */
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  const code = b.id.slice(0, 8).toUpperCase();
  const bagLines = [
    { size: "s", count: b.bagCountS },
    { size: "m", count: b.bagCountM },
    { size: "xl", count: b.bagCountXl },
  ].filter((l) => l.count > 0);

  return (
    <View style={styles.ticket}>
      <View style={styles.top}>
        <StatusBadge status={b.status} checkOutTime={b.checkOutTime} />
        <View style={{ gap: 2 }}>
          <AppText variant="title" numberOfLines={2}>
            {title ?? b.shopName}
          </AppText>
          {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
        </View>

        <View style={styles.times}>
          <TimeBlock label={t("bookings.dropOff")} at={b.checkInTime} />
          <View style={styles.timeRule} />
          <TimeBlock label={t("bookings.pickUp")} at={b.checkOutTime} alignEnd />
        </View>

        <View style={styles.bags}>
          {bagLines.map((l) => (
            <View key={l.size} style={styles.bagPill}>
              <AppText variant="mono" style={{ fontSize: 13 }}>
                {l.count}×
              </AppText>
              <AppText variant="label">{t(`bags.${l.size}`)}</AppText>
            </View>
          ))}
        </View>
      </View>

      <Perforation />

      <View style={styles.bottom}>
        {showQr ? (
          b.qrCodeToken ? (
            <>
              <View style={styles.qrFrame}>
                <QRCode value={b.qrCodeToken} size={184} color={colors.ink} backgroundColor={colors.surface} />
              </View>
              <AppText variant="caption" style={{ textAlign: "center", color: colors.inkSecondary }}>
                {t("bookings.showQr")}
              </AppText>
            </>
          ) : (
            <Banner tone="warning" body={t("bookings.qrMissing")} />
          )
        ) : null}

        <View style={[styles.footer, !showQr && styles.footerBare]}>
          <View style={{ gap: 2 }}>
            <AppText variant="label" style={{ color: colors.inkMuted }}>
              {t("bookings.code")}
            </AppText>
            <AppText variant="mono" style={styles.code} selectable>
              {code}
            </AppText>
          </View>
          <View style={{ gap: 2, alignItems: "flex-end" }}>
            <AppText variant="label" style={{ color: colors.inkMuted }}>
              {t("bookings.total")}
            </AppText>
            <AppText style={styles.total}>{formatMoney(b.totalPrice)}</AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

function TimeBlock({ label, at, alignEnd }: { label: string; at: string; alignEnd?: boolean }) {
  return (
    <View style={{ gap: 2, alignItems: alignEnd ? "flex-end" : "flex-start" }}>
      <AppText variant="label" style={{ color: colors.inkMuted }}>
        {label}
      </AppText>
      <AppText style={styles.time}>{formatTime(at)}</AppText>
      <AppText variant="caption">{formatDay(at)}</AppText>
    </View>
  );
}

/** Fisin yirtma cizgisi: iki yanda zemin rengiyle oyulmus yarim daire, arada kesik cizgi. */
function Perforation() {
  return (
    <View style={styles.perfRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.notch, { marginLeft: -NOTCH / 2 }]} />
      <View style={styles.dashes} />
      <View style={[styles.notch, { marginRight: -NOTCH / 2 }]} />
    </View>
  );
}

const NOTCH = 20;

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  top: { padding: space.xl - space.xs, gap: space.md },
  times: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xs },
  timeRule: { flex: 1, height: 1, backgroundColor: colors.border, marginTop: space.md },
  time: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: ["tabular-nums"] },
  bags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  bagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.inner,
    backgroundColor: colors.surfaceMuted,
  },
  perfRow: { flexDirection: "row", alignItems: "center", height: NOTCH },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dashes: {
    flex: 1,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    marginHorizontal: space.sm,
  },
  bottom: { padding: space.xl - space.xs, gap: space.lg, alignItems: "stretch" },
  qrFrame: {
    alignSelf: "center",
    padding: space.md,
    borderRadius: radius.inner + 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // QR yokken delikli cizgi zaten ayirici: ust cizgi tekrar olmasin.
  footerBare: { borderTopWidth: 0, paddingTop: 0 },
  code: { fontSize: 18, lineHeight: 24, letterSpacing: 1.5 },
  total: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
});
