import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, PixelRatio, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Map, Marker, UserLocation } from "@maplibre/maplibre-react-native";
import type { CameraRef, LngLatBounds } from "@maplibre/maplibre-react-native";
import { Redirect, router } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/BottomSheet";
import { MapSnippet } from "@/components/Illustrations";
import { ShopCard } from "@/components/ShopCard";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { thumbUrl } from "@/lib/images";
import { formatDay, formatDayTime, formatMoney, formatStayRange } from "@/lib/format";
import { goBackOr } from "@/lib/navigation";
import { nextOpenInstant, shiftWindowTo } from "@/lib/next-open";
import { MAP_ATTRIBUTION, useMapStyle } from "@/lib/map-style";
import { useNearbyShops } from "@/lib/queries";
import { shopPriceA11y } from "@/lib/shop-label";
import { totalBags, useSearch } from "@/lib/search";
import { wallInstant, wallParts } from "@/lib/time";
import type { NearbyShop } from "@/lib/types";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";
import { isBlockingError } from "@/lib/query-view";

const DEFAULT_RADIUS_M = 15_000;
const SHEET_PEEK = 150;

type Viewport = { latitude: number; longitude: number; bounds: LngLatBounds };

/** Yaricapi kapsayan kutu: sehir kartindan gelince il genis, sabit zoom 12 tek semti gosteriyordu. */
function boundsFor(latitude: number, longitude: number, radiusM: number): LngLatBounds {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.cos((latitude * Math.PI) / 180));
  return [longitude - dLng, latitude - dLat, longitude + dLng, latitude + dLat];
}

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
    search.place
      ? {
          latitude: search.place.latitude,
          longitude: search.place.longitude,
          radiusM: search.place.radiusM ?? DEFAULT_RADIUS_M,
        }
      : null,
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
    const radiusM = search.place.radiusM ?? DEFAULT_RADIUS_M;
    setCenter({ latitude, longitude, radiusM });
    if (radiusM > DEFAULT_RADIUS_M) {
      camera.current?.fitBounds(boundsFor(latitude, longitude, radiusM), { padding: { bottom: SHEET_PEEK }, duration: 0 });
    } else {
      camera.current?.jumpTo({ center: [longitude, latitude], zoom: 12 });
    }
    pendingRegion.current = null;
    setMoved(false);
    setSelectedId(null);
  }, [placeKey, search.place]);

  const { checkIn, checkOut, setWindow } = search;
  /*
    Saate oturmayan (kapali) nokta: odemeye gitmek yerine aramayi onun acilisina
    kaydirmayi onerir. Kabul edilirse harita ayni yerde yeni saatle tekrar aranir.
  */
  const openShop = useCallback(
    (s: NearbyShop) => {
      if (s.bookable !== false) return router.push(`/shop/${s.id}`);
      const to = s.nextOpen ? shiftWindowTo(s.nextOpen, checkIn, checkOut) : null;
      if (!to) return Alert.alert(t("map.closedNoDate"), t("map.emptyWindowBody"));
      Alert.alert(
        t("map.shiftTitle"),
        t("map.shiftBody", { name: s.name, when: formatDayTime(nextOpenInstant(s.nextOpen!)!) }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("map.shiftAction"), onPress: () => setWindow(to.checkIn, to.checkOut) },
        ],
      );
    },
    [t, checkIn, checkOut, setWindow],
  );
  // Secili pin ya da harita hareketi listeyi yeniden cizmesin: kart memo, renderItem sabit.
  const renderShop = useCallback(
    ({ item }: { item: NearbyShop }) => <ShopCard shop={item} onPress={openShop} />,
    [openShop],
  );
  const selectShop = useCallback((id: string) => {
    lastMarkerPress.current = Date.now();
    setSelectedId(id);
  }, []);

  const query = useNearbyShops(
    center && {
      ...center,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      bags: search.bags,
    },
  );

  const shops = useMemo(
    // Talep testi noktalari mobilde gosterilmez (urun karari 2026-10-18): prod'daki
    // ~500 noktanin yalnizca ~10'u rezervasyon aliyor, gerisi harita ve listeyi
    // "Yakinda" kartlariyla dolduruyordu. Olcum web'de surer.
    // Rezervasyon alabilenler once (kapalilar soluk, sonda); grup icinde yakindan uzaga.
    () =>
      (query.data ?? [])
        .filter((s) => !s.isPrelaunch)
        .sort((a, b) => Number(b.bookable !== false) - Number(a.bookable !== false) || a.distanceKm - b.distanceKm),
    [query.data],
  );
  const bookableCount = useMemo(() => shops.filter((s) => s.bookable !== false).length, [shops]);
  const selected = shops.find((s) => s.id === selectedId) ?? null;

  // Sonuclar gelince kart kucuk resimleri arka planda diske iner: liste kaydirilirken
  // her kart bos kutu olarak acilmaz. Ayni adres ikinci kez indirilmez.
  useEffect(() => {
    const urls = shops
      .slice(0, 20)
      .map((s) => thumbUrl(s.image, 64, PixelRatio.get()))
      .filter((u): u is string => !!u);
    if (urls.length) void Image.prefetch(urls, "memory-disk").catch(() => undefined);
  }, [shops]);

  if (!search.place || !center) return <Redirect href="/search" />;

  const bags = totalBags(search.bags);
  const summary = `${search.place.label} · ${formatDay(search.checkIn)}, ${formatStayRange(search.checkIn, search.checkOut)} · ${t("common.bag", { count: bags })}`;
  const emptyWindow = !query.isLoading && !isBlockingError(query) && bookableCount === 0;
  const changeDates = () => router.push({ pathname: "/search", params: { returnTo: "map", step: "1" } });
  const tomorrowMorning = () => {
    const p = wallParts(new Date());
    const morning = wallInstant(p.year, p.month, p.day + 1, 9);
    setWindow(morning, new Date(morning.getTime() + 4 * 60 * 60 * 1000));
  };
  const emptyActions = (
    <View style={{ gap: space.sm, alignSelf: "stretch" }}>
      <Button title={t("map.changeDates")} onPress={changeDates} />
      <Button variant="secondary" title={t("map.tomorrowMorning")} onPress={tomorrowMorning} />
    </View>
  );

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
        <Camera
          ref={camera}
          initialViewState={
            center.radiusM > DEFAULT_RADIUS_M
              ? { bounds: boundsFor(center.latitude, center.longitude, center.radiusM), padding: { bottom: SHEET_PEEK } }
              : { center: [center.longitude, center.latitude], zoom: 12 }
          }
        />
        {search.place.isCurrent ? <UserLocation /> : null}
        <ShopMarkers shops={shops} selectedId={selectedId} onSelect={selectShop} />
      </Map>

      {/* Ustte: alttaki secili kart ve sheet atfi ortmesin (lisans sarti, her zaman gorunur). */}
      <Text style={[styles.attribution, { top: insets.top + 66 }]}>{MAP_ATTRIBUTION}</Text>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton label={t("common.back")} onPress={goBackOr} style={shadow.card}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.editSearch")}
          onPress={changeDates}
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

      <BottomSheet
        key={isBlockingError(query) || emptyWindow ? "open" : "peek"}
        top={insets.top + 90}
        peek={SHEET_PEEK}
        initialOpen={isBlockingError(query) || emptyWindow}
        handleLabel={t("map.sheetHandle")}
        header={
          <View style={styles.sheetHeader}>
            <AppText variant="title" style={{ fontSize: 20, lineHeight: 26 }}>
              {query.isLoading
                ? t("common.loading")
                : isBlockingError(query)
                  ? search.place.label
                  : bookableCount === 0
                    ? t("map.emptyWindowTitle")
                    : search.place.isCurrent
                      ? t("map.countNear", { count: bookableCount })
                      : t("map.count", { count: bookableCount, place: search.place.label })}
            </AppText>
            {search.rolled ? (
              <AppText variant="caption" style={{ fontSize: 13 }}>
                {t("map.rolledToTomorrow")}
              </AppText>
            ) : null}
          </View>
        }
      >
        {query.isLoading ? (
          <Loading />
        ) : isBlockingError(query) ? (
          <CenterMessage
            title={errorMessage(query.error, "map")}
            action={
              query.error instanceof ApiError && query.error.code === "invalid_dates" ? (
                // Ayni istegi tekrarlamak ayni hatayi dondurur: tarih adimina git.
                <Button variant="secondary" title={t("map.changeDates")} onPress={changeDates} />
              ) : (
                <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />
              )
            }
          />
        ) : shops.length === 0 ? (
          <CenterMessage
            art={<MapSnippet width={120} price="?" />}
            title={t("map.emptyWindowTitle")}
            body={t("map.emptyWindowBody")}
            action={emptyActions}
          />
        ) : (
          <FlatList
            data={shops}
            ListHeaderComponent={bookableCount === 0 ? emptyActions : null}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: height * 0.2 }}
            renderItem={renderShop}
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
        // Kartla ayni ana fiyat: sunucunun kalis toplami, yoksa (eski sunucu) orta boy gunlugu.
        const label = s.isPrelaunch
          ? t("map.comingSoon")
          : formatMoney(s.stayQuote?.total ?? s.priceRange?.medium ?? s.pricePerDay);
        const selected = s.id === selectedId;
        return (
          <Marker
            key={s.id}
            id={s.id}
            lngLat={[s.longitude, s.latitude]}
            anchor="center"
            onPress={() => onSelect(s.id)}
            accessibilityLabel={
              s.isPrelaunch ? `${s.name}, ${label}` : `${s.name}, ${shopPriceA11y(s, t)}`
            }
          >
            {/* Seffaf kusak: gorunen pin 30 dp kalir, dokunma alani 44 dp olur. */}
            <View style={styles.pinTouch}>
              <View
                style={[
                  styles.pin,
                  (s.isPrelaunch || s.bookable === false) && styles.pinMuted,
                  s.bookable === false && styles.pinClosed,
                  selected && styles.pinSelected,
                ]}
              >
                <Text style={styles.pinText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
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
  // Pin alt-orta noktadan baglanir; ek dokunma alani yalnizca ustte olmali ki etiket konumundan kaymasin.
  pinTouch: { paddingTop: 14 },
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
  pinClosed: { opacity: 0.55 },
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
