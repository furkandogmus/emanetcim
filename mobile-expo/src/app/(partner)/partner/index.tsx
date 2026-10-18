import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { QrCode, Store, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BookingRow } from "@/components/BookingRow";
import { Segmented } from "@/components/Segmented";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { isActiveBooking, usePartnerBookings } from "@/lib/queries";
import { wallInstant, wallParts } from "@/lib/time";
import type { PartnerBooking } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

type Tab = "today" | "upcoming" | "past";

function bucket(b: PartnerBooking): Tab {
  if (!isActiveBooking(b)) return "past";
  // Gelmeyen misafir: alma saati gecmis ve valiz hic teslim alinmamis. Prod'da
  // aylar onceki APPROVED kayitlar "Bugun"u dolduruyordu.
  if (b.status !== "CHECKED_IN" && new Date(b.checkOutTime) < new Date()) return "past";
  const start = new Date(b.checkInTime);
  const p = wallParts(new Date());
  const endOfToday = wallInstant(p.year, p.month, p.day + 1);
  // Valizi dukkanda olan (CHECKED_IN) misafir her zaman "bugun"un isi.
  return b.status === "CHECKED_IN" || start < endOfToday ? "today" : "upcoming";
}

export default function PartnerBookingsScreen() {
  const { t } = useTranslation();
  const query = usePartnerBookings();
  const [tab, setTab] = useState<Tab>("today");

  /*
    "Yeni" rozeti: ekran ilk acildiginda gordugu rezervasyonlari hatirlar;
    sonraki yenilemelerde gelen her yeni kayit isaretlenir. Kalici degil --
    gercek bildirim push ile gelecek, bu yalnizca acik ekrandaki esnaf icin.
  */
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const items = query.data?.items;
    if (!items) return;
    if (!known.current) {
      known.current = new Set(items.map((b) => b.id));
      return;
    }
    const added = items.filter((b) => !known.current!.has(b.id)).map((b) => b.id);
    if (added.length) {
      added.forEach((id) => known.current!.add(id));
      setFresh((prev) => new Set([...prev, ...added]));
    }
  }, [query.data]);

  const items = (query.data?.items ?? [])
    .filter((b) => bucket(b) === tab)
    .sort((a, b) =>
      tab === "past"
        ? +new Date(b.checkInTime) - +new Date(a.checkInTime)
        : +new Date(a.checkInTime) - +new Date(b.checkInTime),
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("partner.title")}</AppText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label={t("scan.open")} onPress={() => router.push("/partner/scan")}>
            <QrCode size={20} color={colors.ink} />
          </IconButton>
          <IconButton label={t("partner.myShop")} onPress={() => router.push("/partner/shop")}>
            <Store size={20} color={colors.ink} />
          </IconButton>
          <IconButton label={t("home.profile")} onPress={() => router.push("/profile")}>
            <User size={20} color={colors.ink} />
          </IconButton>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "today", label: t("partner.today") },
            { value: "upcoming", label: t("partner.upcoming") },
            { value: "past", label: t("partner.past") },
          ]}
        />
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, items.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              title={item.guestName || t("partner.guest")}
              highlight={fresh.has(item.id) ? t("partner.new") : undefined}
              onPress={() => {
                setFresh((prev) => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
                router.push(`/partner/${item.id}`);
              }}
            />
          )}
          ListEmptyComponent={<CenterMessage title={t("partner.empty")} />}
        />
      )}
    </SafeAreaView>
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
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
});
