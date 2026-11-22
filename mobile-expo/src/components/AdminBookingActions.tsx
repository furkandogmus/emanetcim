import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReasonSheet } from "@/components/ReasonSheet";
import { AppText, Banner, Button } from "@/components/ui";
import { ADMIN_NOTE_MIN, BOOKING_ACTIONS_NS, adminActionFor, isAdminNoteValid } from "@/lib/booking-actions";
import { errorMessage } from "@/lib/errors";
import { useAdminBookingAction } from "@/lib/queries";
import type { BookingStatus } from "@/lib/types";
import { space } from "@/theme/tokens";

/** Yonetici detayi: iptal (valiz birakilmadan once) ya da zorla teslim (valiz dukkandayken); ikisi de neden ister. */
export function AdminBookingActions({ booking }: { booking: { id: string; status: BookingStatus } }) {
  const { t } = useTranslation();
  const action = adminActionFor(booking.status);
  const mutation = useAdminBookingAction(booking.id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Islemden sonra durum degisir ve dugme kaybolur; sonuc bandi ayni yerde kalir.
  const [done, setDone] = useState<string | null>(null);

  if (!action && !done) return null;
  const cancel = action === "cancel";

  function submit() {
    if (!action || mutation.isPending) return;
    setError(null);
    mutation.mutate(
      { action, note },
      {
        onSuccess: () => {
          setOpen(false);
          setNote("");
          setDone(t(cancel ? "bookingActions.admin.cancelledDone" : "bookingActions.admin.forcedDone"));
        },
        onError: (e) => setError(errorMessage(e, BOOKING_ACTIONS_NS)),
      },
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{t("bookingActions.admin.title")}</AppText>
      {done ? <Banner tone="success" body={done} /> : null}
      {action ? (
        <Button
          variant="danger"
          title={t(cancel ? "bookingActions.admin.cancel" : "bookingActions.admin.forceCheckout")}
          onPress={() => {
            setError(null);
            setOpen(true);
          }}
        />
      ) : null}
      <ReasonSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t(cancel ? "bookingActions.admin.cancel" : "bookingActions.admin.forceCheckout")}
        body={t(cancel ? "bookingActions.admin.cancelBody" : "bookingActions.admin.forceCheckoutBody")}
        note={note}
        onNoteChange={setNote}
        noteLabel={t("bookingActions.admin.noteLabel")}
        notePlaceholder={t("bookingActions.admin.notePlaceholder")}
        noteHint={t("bookingActions.admin.noteHint", { min: ADMIN_NOTE_MIN })}
        confirmLabel={t(cancel ? "bookingActions.admin.cancelConfirm" : "bookingActions.admin.forceCheckoutConfirm")}
        canSubmit={isAdminNoteValid(note)}
        loading={mutation.isPending}
        error={error}
        onConfirm={submit}
      />
    </View>
  );
}
