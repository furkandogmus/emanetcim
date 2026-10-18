import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { resolveImage } from "@/lib/images";
import { keys, usePartnerShop } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Esnafin dukkan vitrin fotografi. Sistem fotograf secicisi kullanilir: izin
 * istemez (kamera/medya izinleri app.json'da engelli, Play veri formu degismez).
 */
export default function PartnerShopScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = usePartnerShop();

  const upload = useMutation({
    mutationFn: (asset: ImagePicker.ImagePickerAsset) => {
      const form = new FormData();
      // RN FormData dosyayi { uri, name, type } nesnesiyle tasir.
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "shop.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
      return api<{ url: string }>("/partner/shop/image", { method: "POST", body: form });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
      Alert.alert(t("partner.photoSaved"));
    },
    onError: (e) => Alert.alert(t("partner.photoFailed"), errorMessage(e, "partner")),
  });

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      // Sunucu 8 MB ve 6000 px ustunu reddediyor; telefon fotografi kucultulup gonderilir.
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) upload.mutate(res.assets[0]);
  }

  const image = resolveImage(query.data?.image);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("partner.myShop")}</AppText>
        <View style={{ width: 44 }} />
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <View style={styles.content}>
          <AppText variant="title">{query.data.name}</AppText>
          <Card style={styles.photoCard}>
            {image ? (
              <Image
                source={{ uri: image }}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel={t("partner.photo")}
              />
            ) : (
              <View style={[styles.photo, styles.placeholder]}>
                <Store size={48} color={colors.brand} />
                <AppText variant="caption">{t("partner.noPhoto")}</AppText>
              </View>
            )}
          </Card>
          <Banner tone="brand" body={t("partner.photoHint")} />
          <Button
            title={image ? t("partner.changePhoto") : t("partner.addPhoto")}
            icon={<ImagePlus size={18} color={colors.white} />}
            loading={upload.isPending}
            onPress={() => void pick()}
          />
        </View>
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
  content: { padding: space.xl, gap: space.lg },
  photoCard: { padding: 0, overflow: "hidden", borderRadius: radius.card },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  placeholder: { alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: colors.brandSoft },
});
