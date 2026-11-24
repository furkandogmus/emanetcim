import { useState } from "react";
import { Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { notify } from "@/lib/notify";
import { fetchWalletLink, useAppConfig } from "@/lib/queries";
import { walletKindFor } from "@/lib/wallet";

/**
 * "Apple Cuzdan'a / Google Cuzdan'a ekle". Yeni yerel modul yok: sunucunun kisa
 * omurlu bagi tarayicida acilir, Safari `.pkpass`i, Chrome kaydetme bagini cuzdana verir.
 * Resmi rozet gorseli lisans geregi pakete girmedi; siyah metin dugme.
 */
export function WalletPassButton({ bookingId, status }: { bookingId: string; status: string }) {
  const { t } = useTranslation();
  const config = useAppConfig();
  const kind = walletKindFor(config.data, Platform.OS, status);
  const [busy, setBusy] = useState(false);
  if (!kind) return null;

  async function open() {
    if (busy || !kind) return;
    setBusy(true);
    try {
      const link = await fetchWalletLink(bookingId, kind);
      await Linking.openURL(link.url);
    } catch {
      notify(t("wallet.openFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      title={kind === "apple" ? t("wallet.addApple") : t("wallet.addGoogle")}
      loading={busy}
      onPress={() => void open()}
      style={{ backgroundColor: "#000000", borderColor: "#000000" }}
      textColor="#FFFFFF"
      testID="wallet-pass-button"
    />
  );
}
