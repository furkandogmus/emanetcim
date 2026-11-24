import { useCallback, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { AdminMessageReply } from "@/components/AdminMessageReply";
import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { SearchBox } from "@/components/SearchBox";
import { Segmented } from "@/components/Segmented";
import { AppText, Button, CenterMessage, Chip, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, initial } from "@/lib/format";
import { flattenPages } from "@/lib/paging";
import {
  adminMessagesKey,
  DEFAULT_MESSAGE_FILTERS,
  keys,
  useAdminMessages,
  type AdminMessageCategory,
  type AdminMessageFilters,
  type AdminMessagesPage,
} from "@/lib/queries";
import type { ContactMessage } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { isBlockingError } from "@/lib/query-view";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

/** Web kutusundaki sekmeler; `null` tumu. */
const MESSAGE_CATEGORIES: (AdminMessageCategory | null)[] = ["SUPPORT", "BULK", "AUTOMATED", null];
/** Sunucunun toplu silme siniri. */
const MESSAGE_BULK_MAX = 100;

/**
 * Admin gelen kutusu (web `/admin/messages` ile ayni): destek/otomatik/toplu
 * kategorisi, okunmamis/tumu, arama, secip toplu silme. Suzgecler sunucuda.
 */
export default function AdminMessagesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AdminMessageFilters>(DEFAULT_MESSAGE_FILTERS);
  const query = useAdminMessages(filters);
  const messages = flattenPages(query.data, (p) => p.messages);
  const counts = query.data?.pages[0]?.counts;
  const [open, setOpen] = useState<string | null>(null);
  // Secim modu: null kapali; acikken satira dokunmak secer, mesaj acilmaz.
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const setSearch = useCallback((q: string) => {
    setFilters((f) => (f.q === q ? f : { ...f, q }));
    // Arama degisince secim de sifirlanir: gorunmeyen mesaj toplu silmeye girmesin.
    setSelected((cur) => (cur && cur.size > 0 ? new Set() : cur));
  }, [setFilters, setSelected]);
  function updateFilters(next: Partial<AdminMessageFilters>) {
    setFilters((f) => ({ ...f, ...next }));
    setSelected((cur) => (cur ? new Set() : cur));
  }

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
      queryClient.setQueriesData<InfiniteData<AdminMessagesPage>>({ queryKey: adminMessagesKey }, (cur) =>
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

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => api<{ ok: true; deleted: number }>("/admin/messages", { method: "DELETE", body: { ids } }),
    onSuccess: (res) => {
      setSelected(null);
      refresh();
      notify(t("adminParityD1.messages.bulkDeleted", { count: res.deleted }));
    },
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function toggle(m: ContactMessage) {
    if (selected) {
      setSelected((cur) => {
        const next = new Set(cur);
        if (next.has(m.id)) next.delete(m.id);
        else next.add(m.id);
        return next;
      });
      return;
    }
    setOpen((cur) => (cur === m.id ? null : m.id));
    if (!m.isRead) markRead.mutate(m.id);
  }

  function confirmDelete(m: ContactMessage) {
    Alert.alert(t("admin.deleteMessageTitle"), t("admin.deleteMessageBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("admin.deleteConfirm"), style: "destructive", onPress: () => remove.mutate(m.id) },
    ]);
  }

  function confirmBulkDelete() {
    // Yalniz ekranda gorunenler: secimden sonra liste degistiyse kalanlar silinmez.
    const visible = new Set(messages.map((m) => m.id));
    const ids = [...(selected ?? [])].filter((id) => visible.has(id)).slice(0, MESSAGE_BULK_MAX);
    if (ids.length === 0) return;
    Alert.alert(
      t("adminParityD1.messages.bulkDeleteTitle", { count: ids.length }),
      t("adminParityD1.messages.bulkDeleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("admin.deleteConfirm"), style: "destructive", onPress: () => removeMany.mutate(ids) },
      ],
    );
  }

  const visibleSelected = selected ? messages.filter((m) => selected.has(m.id)).length : 0;
  const allVisibleSelected = !!selected && messages.length > 0 && messages.every((m) => selected.has(m.id));
  const categoryLabel = (c: AdminMessageCategory | null) => {
    const name = t(`adminParityD1.messages.category.${c ?? "ALL"}`);
    const n = c && counts ? counts[c] : null;
    return n != null ? `${name} (${n})` : name;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* Sekme ekrani: geri dugmesi yok, baslik diger sekmelerle ayni hizada. */}
        <View style={[styles.header, styles.headerRow]}>
          <AppText variant="title" style={{ flex: 1 }}>
            {t("admin.messages")}
          </AppText>
          <Button
            variant="ghost"
            title={selected ? t("common.cancel") : t("adminParityD1.messages.select")}
            onPress={() => {
              setOpen(null);
              setSelected((cur) => (cur ? null : new Set()));
            }}
          />
        </View>

        <View style={styles.filters}>
          <SearchBox placeholder={t("adminParityD1.messages.searchPlaceholder")} onSearch={setSearch} />
          <Segmented
            options={[
              { value: "all", label: t("adminParityD1.messages.all") },
              {
                value: "unread",
                label: counts ? `${t("adminParityD1.messages.unread")} (${counts.unread})` : t("adminParityD1.messages.unread"),
              },
            ]}
            value={filters.unreadOnly ? "unread" : "all"}
            onChange={(v) => updateFilters({ unreadOnly: v === "unread" })}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {MESSAGE_CATEGORIES.map((c) => (
            <Chip
              key={c ?? "ALL"}
              soft
              label={categoryLabel(c)}
              selected={filters.category === c}
              onPress={() => updateFilters({ category: c })}
            />
          ))}
        </ScrollView>

        {selected ? (
          <View style={styles.bulkBar}>
            <Button
              variant="secondary"
              title={allVisibleSelected ? t("adminParityD1.messages.clearSelection") : t("adminParityD1.messages.selectAll")}
              onPress={() =>
                setSelected(allVisibleSelected ? new Set() : new Set(messages.slice(0, MESSAGE_BULK_MAX).map((m) => m.id)))
              }
            />
            <Button
              variant="danger"
              title={t("adminParityD1.messages.deleteSelected", { count: visibleSelected })}
              disabled={visibleSelected === 0}
              loading={removeMany.isPending}
              onPress={confirmBulkDelete}
            />
          </View>
        ) : null}

        <StaleQueryBanner query={query} />

        {query.isLoading ? (
          <Loading />
        ) : isBlockingError(query) ? (
          <CenterMessage
            title={errorMessage(query.error)}
            action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
          />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            extraData={selected}
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
              const expanded = !selected && open === item.id;
              const checked = !!selected?.has(item.id);
              return (
                <View style={[styles.item, checked && styles.itemChecked]}>
                  <Pressable
                    accessibilityRole={selected ? "checkbox" : "button"}
                    accessibilityState={selected ? { checked } : { expanded }}
                    accessibilityLabel={`${!item.isRead ? `${t("admin.unread")}: ` : ""}${item.from}, ${item.subject || t("admin.noSubject")}`}
                    onPress={() => toggle(item)}
                    onLongPress={() => {
                      if (selected) return;
                      setOpen(null);
                      setSelected(new Set([item.id]));
                    }}
                    style={styles.head}
                  >
                    <View style={[styles.avatar, checked && { backgroundColor: colors.accent }]}>
                      {checked ? (
                        <Check size={18} color={colors.white} />
                      ) : (
                        <AppText style={styles.avatarText}>{initial(item.from)}</AppText>
                      )}
                      {!item.isRead && !checked ? <View style={styles.dot} /> : null}
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
  header: { padding: space.xl, paddingBottom: space.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  filters: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.md },
  chips: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.md },
  bulkBar: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.md, justifyContent: "space-between" },
  itemChecked: { borderColor: colors.accent },
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
