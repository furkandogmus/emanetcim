"use client";

import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/routing";

// Harita bir <canvas>; SEO degeri liste metninde, bu yuzden yalniz istemcide.
const SearchMap = dynamic(() => import("@/components/guest/SearchMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100" aria-hidden="true" />,
});

export default function HubShopsMap({
  center,
  shops,
}: {
  center: { lat: number; lng: number };
  shops: Array<{ id: string; name: string; latitude: number; longitude: number }>;
}) {
  const router = useRouter();
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-gray-100">
      <SearchMap
        shops={shops}
        userLat={center.lat}
        userLng={center.lng}
        onSelectShop={(id) => router.push(`/shop/${id}`)}
      />
    </div>
  );
}
