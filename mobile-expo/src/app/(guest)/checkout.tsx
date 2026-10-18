import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Luggage, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, Divider, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney, stayDays } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { keys, useShop } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import type { CheckoutRequest, CheckoutResponse } from "@/lib/types";
import { colors, fonts, space } from "@/theme/tokens";

export default function CheckoutScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t } = useTranslation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const shopQuery = useShop(shopId);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: CheckoutRequest) =>
      api<CheckoutResponse>("/checkout/intent", { method: "POST", body }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: keys.myBookings });
      router.replace({ pathname: "/success", params: { bookingId: res.bookingId } });
    },
    onError: (e) => setError(errorMessage(e, "checkout")),
  });

  if (shopQuery.isLoading) return <Loading />;
  if (shopQuery.isError || !shopQuery.data) {
    return (
      <CenterMessage
        title={errorMessage(shopQuery.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }

  const shop = shopQuery.data;
  const days = stayDays(search.checkIn, search.checkOut);
  const price = estimate(shop, search.bags, days);
  const bagCount = totalBags(search.bags);

  function confirm() {
    setError(null);
    mutation.mutate({
      shopId: shop.id,
      checkInTime: search.checkIn.toISOString(),
      checkOutTime: search.checkOut.toISOString(),
      bagCountS: search.bags.s,
      bagCountM: search.bags.m,
      bagCountXl: search.bags.xl,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("checkout.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ gap: space.md }}>
          <AppText variant="heading">{shop.name}</AppText>
          <Divider />
          <EditableRow
            icon={<Calendar size={20} color={colors.inkSecondary} />}
            label={t("checkout.when")}
            value={`${formatDayTime(search.checkIn)}\n→ ${formatDayTime(search.checkOut)}`}
            onEdit={() => router.push({ pathname: "/search", params: { step: "1", returnTo: "back" } })}
          />
          <EditableRow
            icon={<Luggage size={20} color={colors.inkSecondary} />}
            label={t("checkout.bags")}
            value={t("common.bag", { count: bagCount })}
            onEdit={() => router.push({ pathname: "/search", params: { step: "2", returnTo: "back" } })}
          />
        </Card>

        <Card style={{ gap: space.sm }}>
          <AppText variant="heading">{t("checkout.priceTitle")}</AppText>
          {price.lines.map((l) => (
            <View key={l.size} style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.bagLine", {
                  count: l.count,
                  size: t(`bags.${l.size}`),
                  days: t("common.day", { count: days }),
                })}
              </AppText>
              <AppText variant="body">{formatMoney(l.count * l.unit * days)}</AppText>
            </View>
          ))}
          {price.insurance > 0 ? (
            <View style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.insurance")}
              </AppText>
              <AppText variant="body">{formatMoney(price.insurance)}</AppText>
            </View>
          ) : null}
          <Divider />
          <View style={styles.priceRow}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {t("checkout.estimatedTotal")}
            </AppText>
            <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
              {formatMoney(price.total)}
            </AppText>
          </View>
          <AppText variant="caption">{t("checkout.estimateNote")}</AppText>
        </Card>

        <View style={styles.payNote}>
          <Wallet size={20} color={colors.accent} />
          <AppText variant="bodyMedium" style={{ flex: 1 }}>
            {t("checkout.payAtShop")}
          </AppText>
        </View>

        {error ? <Banner tone="danger" body={error} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t("checkout.confirm")}
          loading={mutation.isPending}
          disabled={bagCount === 0}
          onPress={confirm}
        />
      </View>
    </SafeAreaView>
  );
}

function EditableRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.editRow}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="bodyMedium">{value}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t("checkout.edit")}: ${label}`} onPress={onEdit} hitSlop={10}>
        <AppText variant="bodyMedium" style={{ color: colors.accent }}>
          {t("checkout.edit")}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  content: { padding: space.xl, gap: space.lg },
  editRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  priceRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  payNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
  },
  footer: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
