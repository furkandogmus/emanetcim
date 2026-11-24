import { Megaphone, MessageSquareText, ScrollText, Store, UserCheck, UserPlus, Users, UserX } from "lucide-react-native";

import type { AdminToolLink } from "./types";

/**
 * "Bekleyenler" bolumunun ikinci grubu: kisi ve icerik yonetimi.
 * Yonetim araclari burada (Kullanicilar'in yaninda): gelen kutusu bir okuma ekrani, duyuru bir eylem.
 */
export const ADMIN_MANAGE_LINKS: readonly AdminToolLink[] = [
  { key: "users", href: "/admin/users", Icon: Users, labelKey: "admin.users" },
  { key: "roleApprovals", href: "/admin/role-approvals", Icon: UserCheck, labelKey: "admin.roleApprovals" },
  { key: "partnerLeads", href: "/admin/partner-leads", Icon: Store, labelKey: "admin.partnerLeads" },
  { key: "partnerNew", href: "/admin/partner-new", Icon: UserPlus, labelKey: "adminPartnerNew.title" },
  { key: "broadcast", href: "/admin/broadcast", Icon: Megaphone, labelKey: "admin.broadcast" },
  { key: "auditLog", href: "/admin/audit-log", Icon: ScrollText, labelKey: "adminUsers.auditLog" },
  { key: "reviews", href: "/admin/reviews", Icon: MessageSquareText, labelKey: "adminShop.recentReviews" },
  { key: "accountDeletions", href: "/admin/account-deletions", Icon: UserX, labelKey: "accountDeletions.title" },
];
