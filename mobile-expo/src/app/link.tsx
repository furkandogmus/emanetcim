import { useEffect } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button, CenterMessage } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { parseDeepLink, resolveDeepLink, savePendingLink } from "@/lib/deep-link-target";
import { openSitePage } from "@/lib/site-page";
import { space } from "@/theme/tokens";

/**
 * Web baglantisinin (`app-link-path.ts`) oturuma gore cozuldugu ekran. Girissizse hedef
 * saklanir ve giris acilir; giristen sonra `_layout` kaldigi yerden devam ettirir.
 */
export default function DeepLinkScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const { state, signOut, impersonating } = useAuth();
  const link = parseDeepLink(params);
  const role = state.status === "signedIn" ? state.user.role : null;
  const outcome = link ? resolveDeepLink(link, role) : null;

  const needsLogin = outcome?.type === "login";
  useEffect(() => {
    const l = parseDeepLink({ kind: params.kind, id: params.id });
    if (l && needsLogin) savePendingLink(l);
  }, [params.kind, params.id, needsLogin]);

  if (state.status === "loading") return null;
  if (!link || !outcome) return <Redirect href="/" />;
  if (outcome.type === "go") return <Redirect href={outcome.href} />;
  if (outcome.type === "login") return <Redirect href="/login" />;

  if (outcome.type === "web") {
    return (
      <CenterMessage
        title={t("deepLink.partnerInviteTitle")}
        body={t("deepLink.partnerInviteBody")}
        action={
          <View style={{ gap: space.sm, alignSelf: "stretch" }}>
            <Button title={t("deepLink.openOnWeb")} onPress={() => openSitePage(outcome.path, i18n.language)} />
            <Button variant="secondary" title={t("common.goHome")} onPress={() => router.replace("/")} />
          </View>
        }
      />
    );
  }

  // Misafir esnaf baglantisini acti: baska hesaba gecis sunulur, hedef giristen sonra acilir.
  return (
    <CenterMessage
      title={t("deepLink.partnerOnlyTitle")}
      body={t("deepLink.partnerOnlyBody")}
      action={
        <View style={{ gap: space.sm, alignSelf: "stretch" }}>
          {impersonating ? null : (
            <Button
              title={t("deepLink.switchAccount")}
              onPress={() => {
                savePendingLink(link);
                void signOut();
              }}
            />
          )}
          <Button variant="secondary" title={t("common.goHome")} onPress={() => router.replace("/")} />
        </View>
      }
    />
  );
}
