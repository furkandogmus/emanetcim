export const keys = {
  myBookings: ["bookings", "me"] as const,
  booking: (id: string) => ["bookings", id] as const,
  shop: (id: string) => ["shops", id] as const,
  partnerBookings: ["partner", "bookings"] as const,
  partnerShop: ["partner", "shop"] as const,
  partnerSeals: ["partner", "seals"] as const,
  admin: ["admin"] as const,
};
