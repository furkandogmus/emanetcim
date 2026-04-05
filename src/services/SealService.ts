import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export type SealAssignmentInput = {
  sealNumber: number;
  bagIndex: number;
  bagSize: string;
};

type Tx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

/**
 * Platform mühür stoku: toplu oluşturma, dükkana atama, check-in/out ile durum güncelleme.
 */
export class SealService {
  async bulkCreateSeals(
    fromSerial: number,
    toSerial: number
  ): Promise<{ created: number }> {
    if (!Number.isInteger(fromSerial) || !Number.isInteger(toSerial)) {
      throw new Error("invalid_range");
    }
    if (fromSerial > toSerial) {
      throw new Error("invalid_range");
    }
    if (toSerial - fromSerial > 50_000) {
      throw new Error("range_too_large");
    }
    const data: { serialNumber: number; status: "STOCK" }[] = [];
    for (let n = fromSerial; n <= toSerial; n++) {
      data.push({ serialNumber: n, status: "STOCK" });
    }
    const result = await prisma.seal.createMany({
      data,
      skipDuplicates: true,
    });
    return { created: result.count };
  }

  async assignSealsToShop(
    shopId: string,
    fromSerial: number,
    toSerial: number
  ): Promise<{ updated: number }> {
    if (fromSerial > toSerial) {
      throw new Error("invalid_range");
    }
    const now = new Date();
    const result = await prisma.seal.updateMany({
      where: {
        serialNumber: { gte: fromSerial, lte: toSerial },
        status: "STOCK",
        shopId: null,
      },
      data: {
        shopId,
        status: "ASSIGNED",
        assignedAt: now,
      },
    });
    return { updated: result.count };
  }

  async getSealCounts() {
    const grouped = await prisma.seal.groupBy({
      by: ["status"],
      _count: { serialNumber: true },
    });
    const map: Record<string, number> = {};
    for (const g of grouped) {
      map[g.status] = g._count.serialNumber;
    }
    return map;
  }

  /**
   * Check-in içinde: hatalı mühürleri FAULTY yap, atananları IN_USE + BookingSeal kaydı.
   */
  async applyCheckInWithinTx(
    tx: Tx,
    params: {
      shopId: string;
      bookingId: string;
      assignments: SealAssignmentInput[];
      faultySealNumbers: number[];
      sealPhotoUrl: string | null;
    }
  ): Promise<void> {
    const { shopId, bookingId, assignments, faultySealNumbers, sealPhotoUrl } =
      params;

    const assignmentNums = new Set(assignments.map((a) => a.sealNumber));
    if (assignmentNums.size !== assignments.length) {
      throw new Error("duplicate_seal_in_assignments");
    }
    for (const sn of faultySealNumbers) {
      if (assignmentNums.has(sn)) {
        throw new Error("faulty_overlaps_assignment");
      }
    }

    for (const sn of faultySealNumbers) {
      const seal = await tx.seal.findUnique({ where: { serialNumber: sn } });
      if (!seal || seal.shopId !== shopId || seal.status !== "ASSIGNED") {
        throw new Error(`SEAL_FAULTY_INVALID:${sn}`);
      }
      await tx.seal.update({
        where: { serialNumber: sn },
        data: { status: "FAULTY" },
      });
    }

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const seal = await tx.seal.findUnique({
        where: { serialNumber: a.sealNumber },
      });
      if (!seal || seal.shopId !== shopId) {
        throw new Error(`SEAL_INVALID:${a.sealNumber}`);
      }
      if (seal.status !== "ASSIGNED") {
        throw new Error(`SEAL_NOT_ASSIGNED:${a.sealNumber}`);
      }
      await tx.seal.update({
        where: { serialNumber: a.sealNumber },
        data: { status: "IN_USE" },
      });
      await tx.bookingSeal.create({
        data: {
          bookingId,
          sealNumber: a.sealNumber,
          bagIndex: a.bagIndex,
          bagSize: a.bagSize,
          photoUrl: i === 0 ? sealPhotoUrl : null,
        },
      });
    }
  }

  /**
   * Check-out: BookingSeal kayıtlarındaki mühürleri RETURNED yap.
   */
  async applyCheckOutReturnSealsWithinTx(tx: Tx, bookingId: string): Promise<void> {
    const rows = await tx.bookingSeal.findMany({
      where: { bookingId },
      select: { sealNumber: true },
    });
    for (const row of rows) {
      await tx.seal.update({
        where: { serialNumber: row.sealNumber },
        data: { status: "RETURNED" },
      });
    }
  }
}

export const sealService = new SealService();
