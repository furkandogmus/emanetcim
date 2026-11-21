import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { BookingRow } from "@/components/BookingRow";
import { LuggageTag } from "@/components/Illustrations";
import { Segmented } from "@/components/Segmented";
import { RowSkeleton } from "@/components/RowSkeleton";
import { AppText, Banner, Button, CenterMessage } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { isActiveBooking, useMyBookings } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useOfflineTickets } from "@/lib/offline-tickets";
import { SignInPrompt } from "@/components/SignInPrompt";
import { colors, space } from "@/theme/tokens";
import { isBlockingError } from "@/lib/query-view";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

export default function MyBookingsScreen() {
  const { t } = useTranslation();
  const query = useMyBookings();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { state } = useAuth();

  // Liste sunucudan gelmediyse (internet yok) cihazdaki biletler gosterilir.
  const offlineTickets = useOfflineTickets(query.isError && !query.data);
  const offlineMode = query.isError && !query.data && offlineTickets.length > 0;
  const all = offlineMode ? offlineTickets : (query.data ?? []);
  const items = all
    .filter((b) => (tab === "upcoming" ? isActiveBooking(b) : !isActiveBooking(b)))
    .sort((a, b) =>
      tab === "upcoming"
        ? +new Date(a.checkInTime) - +new Date(b.checkInTime)
        : +new Date(b.checkInTime) - +new Date(a.checkInTime),
    );

  if (state.status !== "signedIn") {
    return <SignInPrompt title={t("auth.bookingsPromptTitle")} body={t("auth.bookingsPromptBody")} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("bookings.title")}</AppText>
      </View>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: t("bookings.upcoming") },
            { value: "past", label: t("bookings.past") },
          ]}
        />
      </View>

      {offlineMode ? (
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm }}>
          <Banner tone="warning" title={t("bookings.offlineTitle")} body={t("bookings.offlineListBody")} />
          <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />
        </View>
      ) : null}

      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <RowSkeleton />
      ) : isBlockingError(query) && !offlineMode ? (
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
            <BookingRow booking={item} title={item.shopName} onPress={() => router.push(`/bookings/${item.id}`)} />
          )}
          ListEmptyComponent={
            tab === "past" ? (
              // Gecmis sekmesi: "henuz rezervasyonun yok" yalan, ve arama dugmesi buraya ait degil.
              <CenterMessage
                art={<LuggageTag size={80} />}
                title={t("bookings.emptyPast")}
                body={t("bookings.emptyPastBody")}
              />
            ) : (
              <CenterMessage
                art={<LuggageTag size={80} />}
                title={t("bookings.empty")}
                body={t("bookings.emptyBody")}
                action={<Button title={t("bookings.emptyCta")} onPress={() => router.push("/search")} />}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.xl, paddingBottom: space.lg },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
});
