import type { BookingSummary } from "./booking";

/** `admin/stats`. */
export type AdminStats = {
  totalBookings: number;
  totalRevenue: number;
  totalPartners: number;
  pendingApplications: number;
  unreadMessages: number;
};

/** `admin/overview` (`toMobileAdminOverview`). */
export type AdminOverview = {
  series: { date: string; revenue: number; bookings: number }[];
  today: { arrivals: number; pickups: number; bagsInStorage: number; newBookings: number; revenue: number };
  attention: { pendingApplications: number; unreadMessages: number; openDisputes: number; overdueBookings: number };
  totals: { revenue: number; bookings: number; activeShops: number };
  /** Uygulamayi acan tekil cihaz; eski sunucuda yok. */
  appUsers?: { day: number; week: number; month: number; total: number; signedInMonth: number };
  recent: (BookingSummary & { guestName: string; createdAt: string })[];
};
