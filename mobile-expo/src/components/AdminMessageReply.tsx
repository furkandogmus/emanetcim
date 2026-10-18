import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { AppText, Banner, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { space } from "@/theme/tokens";

const MIN_BODY = 2;
const MAX_BODY = 5000;

/**
 * Destek mesajına e-postayla cevap. Sunucu web paneliyle aynı servisi kullanır:
 * e-posta gitmezse cevap kaydedilmez ve burada hata görünür, metin silinmez.
 */
export function AdminMessageReply({ messageId, to, onSent }: { messageId: string; to: string; onSent: () => void }) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trimmed = body.trim();

  const send = useMutation({
    mutationFn: () =>
      api(`/admin/messages/${messageId}/reply`, {
        method: "POST",
        body: { body: trimmed },
      }),
    onSuccess: () => {
      setBody("");
      notify(t("admin.replySent"));
      onSent();
    },
    onError: (e) => setError(errorMessage(e, "admin")),
  });

  return (
    <View style={styles.wrap}>
      <Field
        label={t("admin.replyLabel")}
        hint={t("admin.replyTo", { to })}
        value={body}
        onChangeText={(v) => {
          setBody(v);
          if (error) setError(null);
        }}
        placeholder={t("admin.replyPlaceholder")}
        maxLength={MAX_BODY}
        multiline
      />
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("admin.replySend")}
        loading={send.isPending}
        disabled={trimmed.length < MIN_BODY}
        onPress={() => {
          setError(null);
          send.mutate();
        }}
      />
      {trimmed.length > 0 && trimmed.length < MIN_BODY ? (
        <AppText variant="caption">{t("admin.replyTooShort")}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginTop: space.sm },
});
