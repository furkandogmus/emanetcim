import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button, CenterMessage } from "@/components/ui";

/**
 * Eşleşmeyen yol. Esnaf/yönetici bir dükkan bağlantısına dokununca `(guest)` grubu
 * onlara kapalı olduğundan yol bulunamıyordu ve boş/hatalı ekran çıkıyordu; burada
 * açıklama ve ana ekrana dönüş yolu var.
 */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <CenterMessage
      title={t("common.notFoundTitle")}
      body={t("common.notFoundBody")}
      action={<Button variant="secondary" title={t("common.goHome")} onPress={() => router.replace("/")} />}
    />
  );
}
