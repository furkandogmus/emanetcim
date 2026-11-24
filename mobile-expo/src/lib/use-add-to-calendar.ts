import { useState } from "react";
import { Alert, Linking } from "react-native";
import { useTranslation } from "react-i18next";

import { addBookingToCalendar, calendarAvailable, isInCalendar } from "./booking-calendar";
import { bookingCode } from "./booking-search";
import { googleCalendarUrl } from "./calendar-link";
import { notify } from "./notify";
import { openUrl } from "./phone";

type Booking = { id: string; shopName: string; shopAddress?: string | null; checkInTime: string; checkOutTime: string };

/** "Takvime ekle": 0.3.6+ cihaz takvimi, eski ikilide Google Takvim baglantisi. */
export function useAddToCalendar() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function write(b: Booking) {
    setBusy(true);
    try {
      const r = await addBookingToCalendar(b, {
        dropOffTitle: t("calendarSync.dropOffTitle", { shop: b.shopName }),
        pickUpTitle: t("calendarSync.pickUpTitle", { shop: b.shopName }),
        notes: t("guestParity.calendarDetails", { code: bookingCode(b.id), shop: b.shopName }),
      });
      if (r === "added") notify(t("calendarSync.added"));
      else if (r === "denied")
        Alert.alert(t("calendarSync.deniedTitle"), t("calendarSync.deniedBody"), [
          { text: t("calendarSync.cancel"), style: "cancel" },
          { text: t("calendarSync.openSettings"), onPress: () => void Linking.openSettings().catch(() => undefined) },
        ]);
      else Alert.alert(t("calendarSync.failed"), t("calendarSync.noCalendar"));
    } catch {
      Alert.alert(t("calendarSync.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function add(b: Booking) {
    if (busy) return;
    if (!calendarAvailable()) {
      openUrl(
        googleCalendarUrl({
          title: t("guestParity.calendarTitle", { shop: b.shopName }),
          details: t("guestParity.calendarDetails", { code: bookingCode(b.id), shop: b.shopName }),
          location: b.shopAddress ?? null,
          start: b.checkInTime,
          end: b.checkOutTime,
        }),
      );
      return;
    }
    if (await isInCalendar(b)) {
      // Takvim yalniz yazma izniyle acik: kullanici etkinligi sildiyse bilemeyiz, secim onda.
      Alert.alert(t("calendarSync.alreadyTitle"), t("calendarSync.alreadyBody"), [
        { text: t("calendarSync.ok"), style: "cancel" },
        { text: t("calendarSync.addAgain"), onPress: () => void write(b) },
      ]);
      return;
    }
    await write(b);
  }

  return { add, busy };
}
