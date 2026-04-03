import { NextResponse } from "next/server";

/**
 * Bu uç nokta devre dışı: ödeme ve rezervasyon akışı `createBookingAction` (server action) ile yapılır.
 * Doğrudan ödeme başlatmak kapasite, kupon ve rezervasyon kurallarını atlar.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is disabled. Use the in-app checkout flow (createBookingAction) from the checkout page.",
    },
    { status: 410 }
  );
}
