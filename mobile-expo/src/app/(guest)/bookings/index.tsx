import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BookingRow } from "@/components/BookingRow";
import { Segmented } from "@/components/Segmented";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { isActiveBooking, useMyBookings } from "@/lib/queries";
import { colors, space } from "@/theme/tokens";

export default function MyBookingsScreen() {
  const { t } = useTranslation();
  const query = useMyBookings();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const all = query.data ?? [];
  const items = all
    .filter((b) => (tab === "upcoming" ? isActiveBooking(b) : !isActiveBooking(b)))
    .sort((a, b) =>
      tab === "upcoming"
        ? +new Date(a.checkInTime) - +new Date(b.checkInTime)
        : +new Date(b.checkInTime) - +new Date(a.checkInTime),
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
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
            <BookingRow booking={item} title={item.shopName} onPress={() => router.push(`/bookings/${item.id}`)} />
          )}
          ListEmptyComponent={
            <CenterMessage
              title={t("bookings.empty")}
              body={t("bookings.emptyBody")}
              action={<Button title={t("bookings.emptyCta")} onPress={() => router.push("/search")} />}
            />
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
