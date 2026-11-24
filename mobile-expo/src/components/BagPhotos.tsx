import { useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useBagPhotos, useDeleteBagPhoto, useUploadBagPhoto } from "@/lib/queries";
import { prepareBagPhoto } from "@/lib/shop-photo";
import { colors, radius, space } from "@/theme/tokens";

type Audience = "operator" | "guest" | "admin";
type Asset = { uri: string; width: number; height: number };

const NS = "bagPhotos";

/**
 * Valiz durumu fotograflari (sunucu `BagPhotoService`). Operator teslim oncesi / hemen
 * sonrasi 1-3 kare ekler ve siler; misafir ve yonetici gorur. Yukleme hatasi teslimi
 * ENGELLEMEZ: kart hatayi ve "tekrar dene"yi gosterir. Eski sunucuda uc yoksa hic cizilmez.
 */
export function BagPhotos({ bookingId, audience }: { bookingId: string; audience: Audience }) {
  const { t } = useTranslation();
  const query = useBagPhotos(bookingId);
  const upload = useUploadBagPhoto(bookingId);
  const remove = useDeleteBagPhoto(bookingId);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<Asset | null>(null);
  const lastRefetch = useRef(0);

  const data = query.data;
  if (!data || !data.storageReady || !Array.isArray(data.photos)) return null;
  const { photos, canUpload, canDelete, maxPhotos } = data;
  // Bos ve eklenemiyorsa (misafir, yonetici, kilitli pencere) bolum hic cizilmez.
  if (photos.length === 0 && !canUpload) return null;
  const busy = upload.isPending || remove.isPending;

  async function send(asset: Asset) {
    setError(null);
    try {
      const file = await prepareBagPhoto(asset);
      await upload.mutateAsync(file);
      setRetry(null);
    } catch (e) {
      const msg = errorMessage(e, NS);
      setError(msg === t("common.genericError") ? t("bagPhotos.uploadFailed") : msg);
      setRetry(asset);
    }
  }

  async function pick(source: "camera" | "gallery") {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("bagPhotos.pickTitle"), t("bagPhotos.permissionDenied"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("bagPhotos.gallery"), onPress: () => void pick("gallery") },
          ...(perm.canAskAgain ? [] : [{ text: t("bagPhotos.openSettings"), onPress: () => void Linking.openSettings() }]),
        ]);
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
    const res =
      source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await send(asset);
  }

  function choose() {
    Alert.alert(t("bagPhotos.pickTitle"), t("bagPhotos.pickBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bagPhotos.gallery"), onPress: () => void pick("gallery") },
      { text: t("bagPhotos.camera"), onPress: () => void pick("camera") },
    ]);
  }

  function confirmDelete(photoId: string) {
    Alert.alert(t("bagPhotos.deleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("bagPhotos.delete"),
        style: "destructive",
        onPress: () => {
          setError(null);
          remove.mutate(photoId, { onError: (e) => setError(errorMessage(e, NS)) });
        },
      },
    ]);
  }

  const hint =
    audience === "operator" ? "bagPhotos.operatorHint" : audience === "guest" ? "bagPhotos.guestHint" : "bagPhotos.adminHint";

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t(audience === "operator" ? "bagPhotos.operatorTitle" : "bagPhotos.title")}</AppText>
      <AppText variant="caption">{t(hint, { max: maxPhotos })}</AppText>
      {photos.length > 0 ? (
        <View style={styles.row}>
          {photos.map((p, i) => (
            <View key={p.id}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={t("bagPhotos.openPhoto", { n: i + 1 })}
                onPress={() => void Linking.openURL(p.url).catch(() => undefined)}
              >
                <Image
                  source={{ uri: p.url }}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="none"
                  accessibilityLabel={t("bagPhotos.photoAlt", { n: i + 1 })}
                  onError={() => {
                    // Imzali adresin suresi dolmus olabilir: en fazla 30 sn'de bir yenile.
                    if (Date.now() - lastRefetch.current < 30_000) return;
                    lastRefetch.current = Date.now();
                    void query.refetch();
                  }}
                />
              </Pressable>
              {canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("bagPhotos.deletePhoto", { n: i + 1 })}
                  hitSlop={8}
                  disabled={busy}
                  onPress={() => confirmDelete(p.id)}
                  style={styles.delete}
                >
                  <Trash2 size={14} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Banner tone="warning" body={error} /> : null}
      {error && retry ? (
        <Button variant="secondary" title={t("bagPhotos.retry")} loading={upload.isPending} onPress={() => void send(retry)} />
      ) : null}
      {canUpload && photos.length < maxPhotos ? (
        <Button
          variant="secondary"
          icon={<Camera size={16} color={colors.ink} />}
          title={
            upload.isPending
              ? t("bagPhotos.uploading")
              : t(photos.length === 0 ? "bagPhotos.add" : "bagPhotos.addMore", { count: photos.length, max: maxPhotos })
          }
          loading={upload.isPending}
          disabled={busy}
          onPress={choose}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  thumb: { width: 88, height: 88, borderRadius: radius.inner, backgroundColor: colors.surfaceMuted },
  delete: {
    position: "absolute",
    top: -6,
    right: -6,
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
