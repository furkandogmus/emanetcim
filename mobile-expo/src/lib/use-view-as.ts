import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";

/**
 * "Bu kullanici olarak gir" (destek): kullanici listesi, rezervasyon ve dukkan karti
 * ayni onayi ve ayni hata metnini kullanir. Basarida rol degisir; `Stack.Protected`
 * hedefin paneline gecirir, cagiran ekran kendiliginden kapanir.
 */
export function useViewAs() {
  const { t } = useTranslation();
  const { startImpersonation } = useAuth();
  const mutation = useMutation({
    mutationFn: (id: string) => startImpersonation(id),
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function confirmViewAs(id: string, label: string) {
    Alert.alert(t("admin.impersonateTitle", { name: label }), t("admin.impersonateBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("admin.impersonateConfirm"), onPress: () => mutation.mutate(id) },
    ]);
  }

  return { confirmViewAs, pendingId: mutation.isPending ? mutation.variables : undefined };
}
