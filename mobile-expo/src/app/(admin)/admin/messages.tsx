import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AdminMessageReply } from "@/components/AdminMessageReply";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime } from "@/lib/format";
import { keys, useAdminMessages } from "@/lib/queries";
import type { ContactMessage } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, radius, space } from "@/theme/tokens";

export default function AdminMessagesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminMessages();
  const [open, setOpen] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: keys.admin });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/admin/messages/${id}`, { method: "PATCH" }),
    onSuccess: refresh,
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
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("admin.messages")}</AppText>
        <View style={{ width: 44 }} />
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
          data={query.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<CenterMessage title={t("admin.noMessages")} />}
          renderItem={({ item }) => {
            const expanded = open === item.id;
            return (
              <View style={[styles.item, !item.isRead && styles.unread]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggle(item)}
                  style={styles.head}
                >
                  <View style={styles.row}>
                    {!item.isRead ? <View style={styles.dot} accessibilityLabel={t("admin.unread")} /> : null}
                    <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={expanded ? undefined : 1}>
                      {item.subject || t("admin.noSubject")}
                    </AppText>
                    <IconButton label={t("admin.deleteMessage")} onPress={() => confirmDelete(item)}>
                      <Trash2 size={18} color={colors.danger} />
                    </IconButton>
                  </View>
                  <AppText variant="caption">
                    {item.from} · {formatDayTime(item.createdAt)}
                  </AppText>
                  {item.text ? (
                    <AppText variant="body" numberOfLines={expanded ? undefined : 2}>
                      {item.text}
                    </AppText>
                  ) : null}
                </Pressable>
                {expanded ? <AdminMessageReply messageId={item.id} to={item.from} onSent={refresh} /> : null}
              </View>
            );
          }}
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
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  item: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  head: { gap: space.xs },
  unread: { borderColor: colors.brandSoftBorder },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
