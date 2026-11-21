import { useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { AdminMessageReply } from "@/components/AdminMessageReply";
import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { AppText, Button, CenterMessage, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, initial } from "@/lib/format";
import { flattenPages } from "@/lib/paging";
import { adminMessagesKey, keys, useAdminMessages, type AdminMessagesPage } from "@/lib/queries";
import type { ContactMessage } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function AdminMessagesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminMessages();
  const messages = flattenPages(query.data, (p) => p.messages);
  const [open, setOpen] = useState<string | null>(null);

  // Tum "admin" onbellegi degil: sekmeler acik kaldigi icin bu, her okundu isaretinde
  // ozet, rezervasyon ve dukkan isteklerini de tetikliyordu.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...keys.admin, "messages"] });
    void queryClient.invalidateQueries({ queryKey: [...keys.admin, "overview"] });
  };

  // Okundu isareti listeyi bastan indirmez: satir yerelde okundu yapilir, yalnizca sayac yenilenir.
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/admin/messages/${id}`, { method: "PATCH" }),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<InfiniteData<AdminMessagesPage>>(adminMessagesKey, (cur) =>
        cur && {
          ...cur,
          pages: cur.pages.map((p) => ({
            ...p,
            messages: p.messages.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
          })),
        },
      );
      void queryClient.invalidateQueries({ queryKey: [...keys.admin, "overview"] });
    },
    // Okundu isareti arka plan isi; basarisizsa mesaj yine acilir, sayac yenilemede duzelir.
    onError: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/messages/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function toggle(m: ContactMessage) {
    setOpen((cur) => (cur === m.id ? null : m.id));
    if (!m.isRead) markRead.mutate(m.id);
  }

  function confirmDelete(m: ContactMessage) {
    Alert.alert(t("admin.deleteMessageTitle"), t("admin.deleteMessageBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("admin.deleteConfirm"), style: "destructive", onPress: () => remove.mutate(m.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* Sekme ekrani: geri dugmesi yok, baslik diger sekmelerle ayni hizada. */}
        <View style={styles.header}>
          <AppText variant="title">{t("admin.messages")}</AppText>
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
            data={messages}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, messages.length === 0 && { flex: 1 }]}
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching && !query.isFetchingNextPage}
                onRefresh={() => query.refetch()}
                tintColor={colors.accent}
              />
            }
            ListFooterComponent={
              <LoadMoreFooter
                hasMore={!!query.hasNextPage}
                loading={query.isFetchingNextPage}
                failed={query.isFetchNextPageError}
                onPress={() => void query.fetchNextPage()}
              />
            }
            ListEmptyComponent={<CenterMessage art={<LuggageTag size={64} />} title={t("admin.noMessages")} />}
            renderItem={({ item }) => {
              const expanded = open === item.id;
              return (
                <View style={styles.item}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${!item.isRead ? `${t("admin.unread")}: ` : ""}${item.from}, ${item.subject || t("admin.noSubject")}`}
                    onPress={() => toggle(item)}
                    style={styles.head}
                  >
                    <View style={styles.avatar}>
                      <AppText style={styles.avatarText}>{initial(item.from)}</AppText>
                      {!item.isRead ? <View style={styles.dot} /> : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.row}>
                        <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                          {item.from}
                        </AppText>
                        <AppText variant="caption" style={{ fontSize: 12, fontVariant: ["tabular-nums"] }}>
                          {formatDayTime(item.createdAt)}
                        </AppText>
                      </View>
                      {item.repliedAt ? (
                        <AppText variant="caption" style={{ color: colors.accent, fontSize: 12 }}>
                          {t("admin.repliedAt", { date: formatDayTime(item.repliedAt) })}
                        </AppText>
                      ) : null}
                      <AppText
                        variant="bodyMedium"
                        numberOfLines={expanded ? undefined : 1}
                        style={!item.isRead ? { fontFamily: fonts.bodySemibold } : undefined}
                      >
                        {item.subject || t("admin.noSubject")}
                      </AppText>
                      {item.text ? (
                        <AppText variant="caption" numberOfLines={expanded ? undefined : 2} style={expanded ? { color: colors.ink, fontSize: 15, lineHeight: 22 } : undefined}>
                          {item.text}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                  {expanded ? (
                    <View style={{ gap: space.sm }}>
                      <AdminMessageReply messageId={item.id} to={item.from} onSent={refresh} />
                      {/* Her satirda kirmizi cop ikonu listeyi agirlastiriyordu: silme yalnizca acik mesajda. */}
                      <Button
                        variant="ghost"
                        textColor={colors.danger}
                        title={t("admin.deleteMessage")}
                        onPress={() => confirmDelete(item)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.xl, paddingBottom: space.lg },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  item: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 15, color: colors.inkSecondary },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
