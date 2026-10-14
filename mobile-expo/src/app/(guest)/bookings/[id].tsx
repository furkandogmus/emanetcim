import { useLocalSearchParams } from "expo-router";

import { BookingDetailView } from "@/components/BookingDetailView";

export default function GuestBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailView id={id} mode="guest" />;
}
