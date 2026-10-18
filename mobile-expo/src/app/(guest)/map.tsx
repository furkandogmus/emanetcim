import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Map, Marker, UserLocation } from "@maplibre/maplibre-react-native";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { Redirect, router } from "expo-router";
import { ArrowLeft, Luggage, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/BottomSheet";
import { ShopCard } from "@/components/ShopCard";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { MAP_ATTRIBUTION, MAP_STYLE_URL } from "@/lib/map-style";
import { useNearbyShops } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import type { NearbyShop } from "@/lib/types";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

const DEFAULT_RADIUS_M = 15_000;
const SHEET_PEEK = 150;

type Viewport = { latitude: number; longitude: number; bounds: LngLatBounds };

function radiusFor(bounds: LngLatBounds) {
  // Gorunen alanin yarim yuksekligi; 2-50 km arasina sikistirilir.
  const [, south, , north] = bounds;
  const m = ((north - south) * 111_000) / 2;
  return Math.min(50_000, Math.max(2_000, m));
}

export default function MapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const search = useSearch();

  const [center, setCenter] = useState(() =>
    search.place ? { latitude: search.place.latitude, longitude: search.place.longitude, radiusM: DEFAULT_RADIUS_M } : null,
  );
  const [pendingRegion, setPendingRegion] = useState<Viewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastMarkerPress = useRef(0);

  const query = useNearbyShops(
    center && {
      ...center,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      bags: totalBags(search.bags),
    },
  );

  const shops = useMemo(
    // Rezervasyon alan noktalar once; talep testi noktalari ("Yakinda") sona.
    () => [...(query.data ?? [])].sort((a, b) => Number(a.isPrelaunch) - Number(b.isPrelaunch) || a.distanceKm - b.distanceKm),
    [query.data],
  );
  const selected = shops.find((s) => s.id === selectedId) ?? null;

  if (!search.place || !center) return <Redirect href="/search" />;

  const bags = totalBags(search.bags);
  const summary = `${search.place.label} · ${formatDay(search.checkIn)} · ${t("common.bag", { count: bags })}`;
  const openShop = (s: NearbyShop) => router.push(`/shop/${s.id}`);

  return (
    <View style={styles.root}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        attribution={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        contentInset={{ top: insets.top + 80, bottom: SHEET_PEEK, left: 0, right: 0 }}
        onPress={() => {
          /*
            MapLibre ayni dokunusu once Marker'a, hemen ardindan haritaya
            iletiyor (2026-10-15'te logla olculdu). Pin dokunusunun hemen
            arkasindan gelen harita dokunusu secimi silmesin.
          */
          if (Date.now() - lastMarkerPress.current < 400) return;
          setSelectedId(null);
        }}
        onRegionDidChange={(e) => {
          const v = e.nativeEvent;
          if (v.userInteraction) setPendingRegion({ longitude: v.center[0], latitude: v.center[1], bounds: v.bounds });
        }}
      >
        <Camera initialViewState={{ center: [center.longitude, center.latitude], zoom: 12 }} />
        {search.place.isCurrent ? <UserLocation /> : null}
        {shops.map((s) =>
          s.latitude != null && s.longitude != null ? (
            <Marker
              key={s.id}
              id={s.id}
              lngLat={[s.longitude, s.latitude]}
              anchor="center"
              onPress={() => {
                lastMarkerPress.current = Date.now();
                setSelectedId(s.id);
              }}
              accessibilityLabel={s.name}
            >
              <View
                style={[
                  styles.pin,
                  s.isPrelaunch && styles.pinMuted,
                  s.id === selectedId && styles.pinSelected,
                ]}
              >
                <Luggage size={16} color={s.isPrelaunch ? colors.inkMuted : colors.white} />
              </View>
            </Marker>
          ) : null,
        )}
      </Map>

      {/* Ustte: alttaki secili kart ve sheet atfi ortmesin (lisans sarti, her zaman gorunur). */}
      <Text style={[styles.attribution, { top: insets.top + 66 }]}>{MAP_ATTRIBUTION}</Text>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton label={t("common.back")} onPress={() => router.back()} style={shadow.card}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.editSearch")}
          onPress={() => router.push("/search")}
          style={styles.summary}
        >
          <Search size={18} color={colors.brand} />
          <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
            {summary}
          </AppText>
        </Pressable>
      </View>

      {pendingRegion ? (
        <View style={[styles.searchHere, { top: insets.top + 76 }]}>
          <Button
            variant="secondary"
            title={t("map.searchHere")}
            style={[{ minHeight: 42 }, shadow.floating]}
            onPress={() => {
              setCenter({
                latitude: pendingRegion.latitude,
                longitude: pendingRegion.longitude,
                radiusM: radiusFor(pendingRegion.bounds),
              });
              setPendingRegion(null);
              setSelectedId(null);
            }}
          />
        </View>
      ) : null}

      {selected ? (
        <View style={[styles.selectedCard, { bottom: SHEET_PEEK + space.md }]}>
          <ShopCard shop={selected} selected onPress={() => openShop(selected)} />
        </View>
      ) : null}

      <BottomSheet top={insets.top + 90} peek={SHEET_PEEK}>
        <View style={styles.sheetHeader}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            {query.isLoading
              ? t("common.loading")
              : t("map.count", { count: shops.length, place: search.place.label })}
          </AppText>
        </View>
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <CenterMessage
            title={errorMessage(query.error, "checkout")}
            action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
          />
        ) : shops.length === 0 ? (
          <CenterMessage title={t("map.empty")} />
        ) : (
          <FlatList
            data={shops}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: height * 0.2 }}
            renderItem={({ item }) => <ShopCard shop={item} onPress={() => openShop(item)} />}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  summary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.floating,
  },
  searchHere: { position: "absolute", alignSelf: "center" },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    borderWidth: 2.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pinMuted: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  pinSelected: { backgroundColor: colors.ink, transform: [{ scale: 1.15 }] },
  selectedCard: { position: "absolute", left: space.lg, right: space.lg, ...shadow.floating },
  attribution: {
    position: "absolute",
    right: space.sm,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.inkSecondary,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sheetHeader: { paddingHorizontal: space.xl, paddingBottom: space.sm },
});
