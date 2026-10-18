import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Map, Marker, UserLocation } from "@maplibre/maplibre-react-native";
import type { CameraRef, LngLatBounds } from "@maplibre/maplibre-react-native";
import { Redirect, router } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/BottomSheet";
import { ShopCard } from "@/components/ShopCard";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatMoney } from "@/lib/format";
import { MAP_ATTRIBUTION, useMapStyle } from "@/lib/map-style";
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
  /*
    Kaydirilan bolge ref'te: her `onRegionDidChange`de state yazmak butun ekrani
    (isaretciler dahil) yeniden ciziyordu. State yalnizca "bu bolgede ara"
    dugmesinin gorunmesi icin tek bir bayrak.
  */
  const pendingRegion = useRef<Viewport | null>(null);
  const [moved, setMoved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastMarkerPress = useRef(0);
  const camera = useRef<CameraRef>(null);
  const mapStyle = useMapStyle();

  /*
    Harita yerinde kalir: "Aramayi duzenle" sihirbazi bitince yeni harita acmak
    yerine buraya doner (`returnTo=map`). Yer degistiyse kamera tasinir ve arama
    yeni merkezle tekrarlanir; MapLibre ve stil yeniden kurulmaz.
  */
  const placeKey = search.place ? `${search.place.latitude},${search.place.longitude}` : null;
  const lastPlaceKey = useRef(placeKey);
  useEffect(() => {
    if (!search.place || placeKey === lastPlaceKey.current) return;
    lastPlaceKey.current = placeKey;
    const { latitude, longitude } = search.place;
    setCenter({ latitude, longitude, radiusM: DEFAULT_RADIUS_M });
    camera.current?.jumpTo({ center: [longitude, latitude], zoom: 12 });
    pendingRegion.current = null;
    setMoved(false);
    setSelectedId(null);
  }, [placeKey, search.place]);

  const selectShop = useCallback((id: string) => {
    lastMarkerPress.current = Date.now();
    setSelectedId(id);
  }, []);

  const query = useNearbyShops(
    center && {
      ...center,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      bags: totalBags(search.bags),
    },
  );

  const shops = useMemo(
    // Talep testi noktalari mobilde gosterilmez (urun karari 2026-10-18): prod'daki
    // ~500 noktanin yalnizca ~10'u rezervasyon aliyor, gerisi harita ve listeyi
    // "Yakinda" kartlariyla dolduruyordu. Olcum web'de surer.
    () => (query.data ?? []).filter((s) => !s.isPrelaunch).sort((a, b) => a.distanceKm - b.distanceKm),
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
        mapStyle={mapStyle}
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
          if (!v.userInteraction) return;
          pendingRegion.current = { longitude: v.center[0], latitude: v.center[1], bounds: v.bounds };
          setMoved(true);
        }}
      >
        <Camera ref={camera} initialViewState={{ center: [center.longitude, center.latitude], zoom: 12 }} />
        {search.place.isCurrent ? <UserLocation /> : null}
        <ShopMarkers shops={shops} selectedId={selectedId} onSelect={selectShop} />
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
          onPress={() => router.push({ pathname: "/search", params: { returnTo: "map" } })}
          style={styles.summary}
        >
          <Search size={18} color={colors.brand} />
          <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
            {summary}
          </AppText>
        </Pressable>
      </View>

      {moved ? (
        <View style={[styles.searchHere, { top: insets.top + 76 }]}>
          <Button
            variant="secondary"
            title={t("map.searchHere")}
            style={[{ minHeight: 42 }, shadow.floating]}
            onPress={() => {
              const r = pendingRegion.current;
              if (r) setCenter({ latitude: r.latitude, longitude: r.longitude, radiusM: radiusFor(r.bounds) });
              pendingRegion.current = null;
              setMoved(false);
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
              : shops.length === 0
                ? t("map.emptyTitle", { place: search.place.label })
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

/** Haritanin uzerindeki pinler; liste ya da secili kart degisince yeniden cizilmez. */
const ShopMarkers = memo(function ShopMarkers({
  shops,
  selectedId,
  onSelect,
}: {
  shops: NearbyShop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {shops.map((s) => {
        if (s.latitude == null || s.longitude == null) return null;
        // Web haritasiyla ayni: pinde gunluk fiyat. Talep testi noktasindaki fiyat
        // sema varsayilani, gercek degil; orada "Yakinda" yazar.
        const label = s.isPrelaunch ? t("map.comingSoon") : formatMoney(s.pricePerDay);
        const selected = s.id === selectedId;
        return (
          <Marker
            key={s.id}
            id={s.id}
            lngLat={[s.longitude, s.latitude]}
            anchor="center"
            onPress={() => onSelect(s.id)}
            accessibilityLabel={
              s.isPrelaunch ? `${s.name}, ${label}` : `${s.name}, ${t("shop.perDay", { price: label })}`
            }
          >
            <View
              style={[styles.pin, s.isPrelaunch && styles.pinMuted, selected && styles.pinSelected]}
            >
              <Text style={styles.pinText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
});

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
  // Fiyat hapi: dar ekranda komsu pinleri ortmesin diye kucuk tutuldu (web `h-8`).
  pin: {
    minWidth: 44,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  pinMuted: { backgroundColor: colors.inkSecondary },
  pinSelected: { backgroundColor: colors.ink, transform: [{ scale: 1.1 }] },
  pinText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.white },
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
