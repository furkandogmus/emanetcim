export type ReviewSource = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  guest: { name: string | null };
};

export type AdminOps = import("@/services/AdminOpsService").AdminOpsService;
