import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { MapPin, Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Place } from "@/lib/search";
import type { GeocodeResult } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Web aramasiyla ayni (`SearchClient.tsx`): 450 ms geciktirme, en az 3 harf. */
const DEBOUNCE_MS = 450;
const MIN_CHARS = 3;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; place: GeocodeResult }
  | { kind: "empty" }
  | { kind: "error"; message: string };

/**
 * Nominatim'in `display_name`i ulke ve posta koduna kadar uzanir; haritanin
 * basliginda ilk iki parca yeter ("Kadikoy, Istanbul").
 */
function shortLabel(label: string) {
  return label.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 2).join(", ") || label;
}

export function PlaceSearch({ onChoose }: { onChoose: (place: Place) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  // Sonuc, ait oldugu sorguyla birlikte tutulur. Kisa sorgu "bos", sonucu
  // henuz gelmemis sorgu "yukleniyor" render'da turetilir; effect yalnizca
  // ag yanitinda state yazar (effect icinde eszamanli setState = cift render).
  const [result, setResult] = useState<{ q: string; state: State } | null>(null);
  const q = query.trim();
  const state: State =
    q.length < MIN_CHARS ? { kind: "idle" } : result?.q === q ? result.state : { kind: "loading" };

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    // Gec gelen eski yanit yeni sorgunun sonucunu ezmesin.
    let stale = false;
    const settle = (next: State) => !stale && setResult({ q, state: next });
    const timer = setTimeout(() => {
      api<GeocodeResult>(`/geocode?q=${encodeURIComponent(q)}`, { auth: false })
        .then((place) => settle({ kind: "found", place }))
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.code === "not_found") settle({ kind: "empty" });
          else settle({ kind: "error", message: errorMessage(err, "placeSearch") });
        });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label" nativeID="placeSearchLabel">
        {t("placeSearch.label")}
      </AppText>
      <View style={styles.inputWrap}>
        <Search size={18} color={colors.inkMuted} />
        <TextInput
          accessibilityLabelledBy="placeSearchLabel"
          value={query}
          onChangeText={setQuery}
          placeholder={t("placeSearch.placeholder")}
          placeholderTextColor={colors.inkMuted}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("placeSearch.clear")}
            hitSlop={12}
            onPress={() => setQuery("")}
          >
            <X size={18} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      {q.length > 0 && q.length < MIN_CHARS ? (
        <AppText variant="caption">{t("placeSearch.minChars")}</AppText>
      ) : null}
      {state.kind === "loading" ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <AppText variant="caption">{t("placeSearch.searching")}</AppText>
        </View>
      ) : null}
      {state.kind === "empty" ? <Banner tone="warning" body={t("placeSearch.empty")} /> : null}
      {state.kind === "error" ? <Banner tone="danger" body={state.message} /> : null}
      {state.kind === "found" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onChoose({
              label: shortLabel(state.place.label),
              latitude: state.place.latitude,
              longitude: state.place.longitude,
            })
          }
          style={({ pressed }) => [styles.result, pressed && { opacity: 0.7 }]}
        >
          <MapPin size={20} color={colors.accent} style={{ marginHorizontal: 12 }} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">{shortLabel(state.place.label)}</AppText>
            <AppText variant="caption" numberOfLines={2}>
              {state.place.label}
            </AppText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 54,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
  },
  input: { flex: 1, minHeight: 52, fontFamily: fonts.body, fontSize: 17, color: colors.ink },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
