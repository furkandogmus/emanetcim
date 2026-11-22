import { useState } from "react";
import { Alert, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { RemoteImage } from "@/components/RemoteImage";
import { Sheet } from "@/components/Sheet";
import { AppText, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { withShop } from "@/lib/partner-shop";
import { keys } from "@/lib/queries";
import { prepareShopPhoto } from "@/lib/shop-photo";
import type { PartnerShop, ShopGalleryImage } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

/** Sunucudaki `MAX_GALLERY_IMAGES` ile ayni; son karar sunucunun (`limit`). */
const MAX_GALLERY = 8;
/** Kapak dahil toplam. */
export const MAX_SHOP_PHOTOS = MAX_GALLERY + 1;
const COLS = 3;

type Selected = { kind: "cover"; url: string } | { kind: "gallery"; id: string; url: string };

/**
 * Esnafin dukkan fotograflari: kapak + en fazla 8 galeri fotografi, 3 sutunluk izgara.
 * Ilk kare kapak (misafir listesinde gorunen); digerleri dukkan detayinda kaydirilir.
 * Birden cok fotograf tek seferde secilebilir; kapak yoksa ilki kapak olur.
 * Sistem secicisi izin istemez (medya izni app.json'da kapali, Play veri formu ayni).
 */
export function ShopPhotos({ shop, shopId }: { shop: PartnerShop; shopId: string | null }) {
  const queryClient = useQueryClient();
  return (
    <ShopPhotoGrid
      image={shop.image}
      gallery={shop.gallery ?? []}
      path={(sub) => withShop(`/partner/shop${sub}`, shopId)}
      onChanged={() => queryClient.invalidateQueries({ queryKey: keys.partnerShop })}
      errorNamespace="partner"
    />
  );
}

/**
 * Izgaranin kendisi; esnaf (`/partner/shop/...`) ve yonetici (`/admin/shops/:id/...`)
 * ayni alt yollari kullanir: `/image` kapak, `/images` galeri, `/images/:id[/cover]`.
 * `readOnly` yazma dugmelerini gizler (yonetici goruntuleme oturumu).
 */
export function ShopPhotoGrid({
  image,
  gallery,
  path,
  onChanged,
  errorNamespace,
  hint,
  emptyHint,
  readOnly = false,
}: {
  image: string | null;
  gallery: ShopGalleryImage[];
  path: (sub: string) => string;
  onChanged: () => Promise<unknown>;
  errorNamespace: string;
  /** Kapak varken gosterilen aciklama; verilmezse esnafa yazilmis metin. */
  hint?: string;
  emptyHint?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [busy, setBusy] = useState(false);

  const tile = Math.floor((width - space.xl * 2 - space.sm * (COLS - 1)) / COLS);
  const canAdd = !readOnly && (gallery.length < MAX_GALLERY || !image);
  const refresh = onChanged;

  async function send(sub: string, asset: ImagePicker.ImagePickerAsset) {
    const file = await prepareShopPhoto(asset);
    const form = new FormData();
    form.append("file", file as unknown as Blob);
    await api(path(sub), { method: "POST", body: form });
  }

  async function addPhotos() {
    const room = (image ? 0 : 1) + (MAX_GALLERY - gallery.length);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      quality: 1,
    });
    if (res.canceled || res.assets.length === 0) return;
    const assets = res.assets.slice(0, room);
    setProgress({ done: 0, total: assets.length });
    let failed: unknown = null;
    for (const [i, asset] of assets.entries()) {
      try {
        // Kapak yoksa ilk secilen kapak olur: listede gorunen fotograf o.
        await send(i === 0 && !image ? "/image" : "/images", asset);
      } catch (e) {
        failed = e;
        break;
      }
      setProgress({ done: i + 1, total: assets.length });
    }
    setProgress(null);
    await refresh();
    if (failed) notify(t("partner.photoFailed"), errorMessage(failed, errorNamespace));
    else notify(t("partner.photosSaved", { count: assets.length }));
  }

  async function replaceCover() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    await run(() => send("/image", res.assets[0]));
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refresh();
      setSelected(null);
    } catch (e) {
      notify(t("partner.actionFailed"), errorMessage(e, errorNamespace));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(t("partner.deletePhotoTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("partner.deletePhoto"),
        style: "destructive",
        onPress: () => void run(() => api(path(`/images/${encodeURIComponent(id)}`), { method: "DELETE" })),
      },
    ]);
  }

  const tiles: Selected[] = [
    ...(image ? [{ kind: "cover" as const, url: image }] : []),
    ...gallery.map((g) => ({ kind: "gallery" as const, id: g.id, url: g.url })),
  ];

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.grid}>
        {tiles.map((p) => (
          <Pressable
            key={p.kind === "cover" ? "cover" : p.id}
            accessibilityRole="button"
            accessibilityLabel={p.kind === "cover" ? t("partner.coverPhoto") : t("partner.photo")}
            onPress={() => setSelected(p)}
            style={({ pressed }) => [styles.tile, { width: tile, height: tile }, pressed && { opacity: 0.85 }]}
          >
            <RemoteImage src={p.url} width={tile} style={StyleSheet.absoluteFill} contentFit="cover" />
            {p.kind === "cover" ? (
              <View style={styles.coverBadge}>
                <AppText variant="label" style={{ color: colors.white, fontSize: 11 }}>
                  {t("partner.cover")}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        ))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("partner.addPhotos")}
            disabled={progress != null}
            onPress={() => void addPhotos()}
            style={({ pressed }) => [
              styles.tile,
              styles.add,
              { width: tile, height: tile },
              pressed && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <ImagePlus size={22} color={colors.accent} strokeWidth={1.75} />
            <AppText variant="label" style={{ color: colors.accent, textAlign: "center" }}>
              {progress ? t("partner.uploading", progress) : t("partner.addPhotos")}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <AppText variant="caption" style={{ fontSize: 13 }}>
        {image ? (hint ?? t("partner.photosHint", { max: MAX_GALLERY + 1 })) : (emptyHint ?? t("partner.photoHint"))}
      </AppText>

      <Sheet visible={selected != null} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <RemoteImage
              src={selected.url}
              width={width}
              placeholderWidth={tile}
              style={styles.preview}
              contentFit="cover"
            />
            <View style={{ gap: space.sm }}>
              {readOnly ? null : selected.kind === "cover" ? (
                <Button title={t("partner.changeCover")} loading={busy} onPress={() => void replaceCover()} />
              ) : (
                <>
                  <Button
                    title={t("partner.makeCover")}
                    loading={busy}
                    onPress={() =>
                      void run(() =>
                        api(path(`/images/${encodeURIComponent(selected.id)}/cover`), { method: "POST" }),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    textColor={colors.danger}
                    title={t("partner.deletePhoto")}
                    disabled={busy}
                    onPress={() => confirmDelete(selected.id)}
                  />
                </>
              )}
              <Button variant="ghost" title={t("common.close")} onPress={() => setSelected(null)} />
            </View>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { borderRadius: radius.inner + 2, overflow: "hidden", backgroundColor: colors.surfaceMuted },
  add: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  coverBadge: {
    position: "absolute",
    left: space.xs,
    bottom: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,25,23,0.6)",
  },
  preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.card },
});
