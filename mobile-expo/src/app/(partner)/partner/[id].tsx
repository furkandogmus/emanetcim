import { useLocalSearchParams } from "expo-router";

import { BookingDetailView } from "@/components/BookingDetailView";

export default function PartnerBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailView id={id} mode="partner" />;
}
