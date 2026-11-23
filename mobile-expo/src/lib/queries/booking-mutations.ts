import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCancelBooking, adminForceCheckout, partnerCancelBooking, partnerLateHold, partnerNoShow, type AdminBookingAction } from "../booking-actions";
import type { PartnerCancelRequest } from "../types";
import type { InvalidatingClient } from "./internal";
import { keys } from "./keys";

/*
  Yonetim islemleri. Hata da `onSettled`da yeniler: `invalid_status` cogu zaman baska
  birinin (misafir, esnaf, zamanlanmis is) rezervasyonu degistirdigi demek; ekran eski
  durumda kalirsa ayni dugme tekrar tekrar reddedilir.
*/
function refreshAfterAdminAction(qc: InvalidatingClient, id: string) {
  void qc.invalidateQueries({ queryKey: [...keys.admin, "booking", id] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "bookings"] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "overview"] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "shop"] });
  void qc.invalidateQueries({ queryKey: keys.booking(id) });
}

function refreshAfterPartnerAction(qc: InvalidatingClient) {
  void qc.invalidateQueries({ queryKey: ["bookings"] });
  void qc.invalidateQueries({ queryKey: ["partner"] });
}

export function adminBookingActionOptions(qc: InvalidatingClient, id: string) {
  return {
    mutationFn: ({ action, note }: { action: AdminBookingAction; note: string }) =>
      action === "cancel" ? adminCancelBooking(id, note) : adminForceCheckout(id, note),
    onSettled: () => refreshAfterAdminAction(qc, id),
  };
}

export function partnerCancelOptions(qc: InvalidatingClient, id: string) {
  return {
    mutationFn: (body: PartnerCancelRequest) => partnerCancelBooking(id, body),
    onSettled: () => refreshAfterPartnerAction(qc),
  };
}

export function partnerNoShowOptions(qc: InvalidatingClient, id: string) {
  return { mutationFn: () => partnerNoShow(id), onSettled: () => refreshAfterPartnerAction(qc) };
}

export function partnerLateHoldOptions(qc: InvalidatingClient, id: string) {
  return { mutationFn: () => partnerLateHold(id), onSettled: () => refreshAfterPartnerAction(qc) };
}

export function usePartnerLateHold(id: string) {
  return useMutation(partnerLateHoldOptions(useQueryClient(), id));
}

export function useAdminBookingAction(id: string) {
  return useMutation(adminBookingActionOptions(useQueryClient(), id));
}

export function usePartnerCancel(id: string) {
  return useMutation(partnerCancelOptions(useQueryClient(), id));
}

export function usePartnerNoShow(id: string) {
  return useMutation(partnerNoShowOptions(useQueryClient(), id));
}
