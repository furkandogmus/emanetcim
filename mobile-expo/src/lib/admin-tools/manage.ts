import { Megaphone, MessageSquareText, ScrollText, Store, UserCheck, Users } from "lucide-react-native";

import type { AdminToolLink } from "./types";

/**
 * "Bekleyenler" bolumunun ikinci grubu: kisi ve icerik yonetimi.
 * Yonetim araclari burada (Kullanicilar'in yaninda): gelen kutusu bir okuma ekrani, duyuru bir eylem.
 */
export const ADMIN_MANAGE_LINKS: readonly AdminToolLink[] = [
  { key: "users", href: "/admin/users", Icon: Users, labelKey: "admin.users" },
  { key: "roleApprovals", href: "/admin/role-approvals", Icon: UserCheck, labelKey: "admin.roleApprovals" },
  { key: "partnerLeads", href: "/admin/partner-leads", Icon: Store, labelKey: "admin.partnerLeads" },
  { key: "broadcast", href: "/admin/broadcast", Icon: Megaphone, labelKey: "admin.broadcast" },
  { key: "auditLog", href: "/admin/audit-log", Icon: ScrollText, labelKey: "adminUsers.auditLog" },
  { key: "reviews", href: "/admin/reviews", Icon: MessageSquareText, labelKey: "adminShop.recentReviews" },
];
