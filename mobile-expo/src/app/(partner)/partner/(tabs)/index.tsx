import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar";
import { SealedBag } from "@/components/Illustrations";
import { ShopSwitcher } from "@/components/ShopSwitcher";
import { BookingRow } from "@/components/BookingRow";
import { PartnerPulseCard } from "@/components/PartnerPulseCard";
import { ShopSetupCard } from "@/components/ShopSetupCard";
import { Segmented } from "@/components/Segmented";
import { RowSkeleton } from "@/components/RowSkeleton";
import { AppText, Button, CenterMessage } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { isActiveBooking, usePartnerBookings, usePartnerDashboard } from "@/lib/queries";
import { wallInstant, wallParts } from "@/lib/time";
import type { PartnerBooking } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

type Tab = "today" | "upcoming" | "past";

function bucket(b: PartnerBooking): Tab {
  // Gelmeyen misafir (alma saati gecmis, hic teslim alinmamis) de gecmis sayilir.
  if (!isActiveBooking(b)) return "past";
  const start = new Date(b.checkInTime);
  const p = wallParts(new Date());
  const endOfToday = wallInstant(p.year, p.month, p.day + 1);
  // Valizi dukkanda olan (CHECKED_IN) misafir her zaman "bugun"un isi.
  return b.status === "CHECKED_IN" || start < endOfToday ? "today" : "upcoming";
}

export default function PartnerBookingsScreen() {
  const { t } = useTranslation();
  const query = usePartnerBookings(useIsFocused());
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("today");
  const { state } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;

  function refreshAll() {
    void query.refetch();
    void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
  }

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

  // Cok dukkanli esnafta liste ustteki kartta secili dukkani izler: kart "dukkanda 0 valiz"
  // derken liste baska dukkanin valizini gostermesin.
  const dash = usePartnerDashboard().data;
  const shopFilter = dash && dash.shops.length > 1 ? dash.shop.id : null;
  const items = (query.data?.items ?? [])
    .filter((b) => (!shopFilter || b.shopId === shopFilter) && bucket(b) === tab)
    .sort((a, b) =>
      tab === "past"
        ? +new Date(b.checkInTime) - +new Date(a.checkInTime)
        : +new Date(a.checkInTime) - +new Date(b.checkInTime),
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: space.sm }}>
          <AppText variant="title">{t("partner.title")}</AppText>
          <ShopSwitcher />
        </View>
        {/* Profil sag ustte: sekme cubugu uc ana ise kaldi (Emanetler, QR, Dukkanim). */}
        {user ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.title")}
            hitSlop={8}
            onPress={() => router.push("/profile")}
            style={{ alignSelf: "flex-start" }}
          >
            <Avatar name={user.name || user.email || "?"} url={user.avatarUrl} size={40} />
          </Pressable>
        ) : null}
      </View>

      {/* Kartlar listenin basliginda: sabit dururken listeye ekranin %15'i kaliyordu
          (2026-11-19, Pixel 8 emulatorde iki kart + sekmeler). Artik sayfa tek parca kayar. */}
      <FlatList
        data={query.isLoading || query.isError ? [] : items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={refreshAll} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <ShopSetupCard />
            <PartnerPulseCard />
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
        ListEmptyComponent={
          query.isLoading ? (
            <RowSkeleton />
          ) : query.isError ? (
            <CenterMessage
              title={errorMessage(query.error)}
              action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
            />
          ) : (
            <View style={styles.empty}>
              <CenterMessage art={<SealedBag size={64} />} title={t("partner.empty")} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.xl,
    paddingBottom: space.lg,
  },
  list: { paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.xxl },
  empty: { minHeight: 220 },
});
