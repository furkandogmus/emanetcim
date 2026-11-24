import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Map } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { MapPin } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Button, CenterMessage, Loading } from "@/components/ui";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { errorMessage } from "@/lib/errors";
import { getDevicePosition } from "@/lib/location";
import { MAP_ATTRIBUTION, useMapStyle } from "@/lib/map-style";
import { goBackOr } from "@/lib/navigation";
import { notify } from "@/lib/notify";
import { DEFAULT_PIN_CENTER, hasPin, roundCoord } from "@/lib/partner-parity";
import { usePartnerShopSelection } from "@/lib/partner-shop";
import { keys, savePartnerShopLocation, usePartnerShopSettings } from "@/lib/queries";
import type { PartnerShopSettings } from "@/lib/types";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

/**
 * Dukkanin konum pini. Pin ekranin ortasinda sabit, harita altinda kayar
 * (surukle) ya da dokunulan noktaya gider: parmak pini ortmez, ince ayar kolay.
 * Misafir haritasi ve "yol tarifi" bu noktayi kullanir.
 */
export default function PartnerLocationScreen() {
  const { t } = useTranslation();
  const query = usePartnerShopSettings();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("partnerParity.locationTitle")} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "shopSettings")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <PinPicker shop={query.data} />
      )}
    </SafeAreaView>
  );
}

function PinPicker({ shop }: { shop: PartnerShopSettings }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [shopId] = usePartnerShopSelection();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  const initial = hasPin(shop)
    ? { latitude: shop.latitude as number, longitude: shop.longitude as number }
    : DEFAULT_PIN_CENTER;
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(initial);
  const [locating, setLocating] = useState(false);

  const moveTo = (latitude: number, longitude: number) => {
    setCoords({ latitude, longitude });
    camera.current?.easeTo({ center: [longitude, latitude], duration: 300 });
  };

  async function locateMe() {
    setLocating(true);
    const res = await getDevicePosition();
    setLocating(false);
    if (!res.ok) {
      notify(t(res.reason === "denied" ? "partnerParity.locationDenied" : "partnerParity.locationUnavailable"));
      return;
    }
    moveTo(res.position.latitude, res.position.longitude);
  }

  const save = useMutation({
    mutationFn: () =>
      savePartnerShopLocation(shopId, {
        latitude: roundCoord(coords.latitude),
        longitude: roundCoord(coords.longitude),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
      notify(t("partnerParity.locationSaved"));
      goBackOr();
    },
    onError: (e) => notify(t("shopSettings.saveFailed"), errorMessage(e, "shopSettings")),
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          compass={false}
          touchRotate={false}
          touchPitch={false}
          onPress={(e) => {
            const [lng, lat] = e.nativeEvent.lngLat;
            moveTo(lat, lng);
          }}
          onRegionDidChange={(e) => {
            const v = e.nativeEvent;
            if (!v.userInteraction) return;
            setCoords({ latitude: v.center[1], longitude: v.center[0] });
          }}
        >
          <Camera
            ref={camera}
            initialViewState={{ center: [initial.longitude, initial.latitude], zoom: hasPin(shop) ? 17 : 12 }}
          />
        </Map>
        {/* Pinin ucu tam merkezde: ikon yuksekliginin yarisi kadar yukari. */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <MapPin size={40} color={colors.accent} fill={colors.brandSoft} strokeWidth={2} />
        </View>
        <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
      </View>

      <View style={styles.footer}>
        <AppText variant="caption">{t("partnerParity.locationHint")}</AppText>
        <AppText style={styles.coords} accessibilityLabel={t("partnerParity.locationCoordsA11y")}>
          {`${roundCoord(coords.latitude).toFixed(6)}, ${roundCoord(coords.longitude).toFixed(6)}`}
        </AppText>
        <View style={styles.actions}>
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            title={t("partnerParity.locateMe")}
            loading={locating}
            onPress={() => void locateMe()}
          />
          <Button style={{ flex: 1 }} title={t("partnerParity.locationSave")} loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pinWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  attribution: {
    position: "absolute",
    right: space.sm,
    bottom: space.sm,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSecondary,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    gap: space.sm,
    padding: space.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    ...shadow.card,
  },
  coords: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.inkSecondary, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: space.md },
});
