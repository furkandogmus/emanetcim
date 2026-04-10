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
   * Dükkanın stoğundaki (ASSIGNED) en küçük seri numaralı N mühürü getirir.
   */
  async getNextAvailableSeals(shopId: string, count: number) {
    return await prisma.seal.findMany({
      where: {
        shopId,
        status: "ASSIGNED",
      },
      orderBy: { serialNumber: "asc" },
      take: count,
    });
  }

  /**
   * Bir mühürü FAULTY olarak işaretler ve kullanımdan çıkarır.
   */
  async markSealAsFaulty(serialNumber: number, shopId: string): Promise<void> {
    const seal = await prisma.seal.findUnique({
      where: { serialNumber },
    });
    
    if (!seal || seal.shopId !== shopId) {
      throw new Error("seal_not_owned_by_shop");
    }

    if (seal.status === "IN_USE" || seal.status === "RETURNED") {
       throw new Error("seal_already_processed");
    }

    await prisma.seal.update({
      where: { serialNumber },
      data: { status: "FAULTY" },
    });
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

  /**
   * Aktif atamaları (ASSIGNED) dükkan bazlı ve ardışık aralıklar halinde getirir.
   */
  async getAssignedSealBatches() {
    const seals = await prisma.seal.findMany({
      where: { status: "ASSIGNED", shopId: { not: null } },
      include: { shop: { select: { name: true } } },
      orderBy: { serialNumber: "asc" },
    });

    if (seals.length === 0) return [];

    const batches: {
      shopId: string;
      shopName: string;
      fromSerial: number;
      toSerial: number;
      count: number;
    }[] = [];

    let currentBatch = {
      shopId: seals[0].shopId!,
      shopName: seals[0].shop?.name || "Unknown",
      fromSerial: seals[0].serialNumber,
      toSerial: seals[0].serialNumber,
      count: 1,
    };

    for (let i = 1; i < seals.length; i++) {
      const s = seals[i];
      const isContiguous = s.serialNumber === currentBatch.toSerial + 1;
      const isSameShop = s.shopId === currentBatch.shopId;

      if (isContiguous && isSameShop) {
        currentBatch.toSerial = s.serialNumber;
        currentBatch.count++;
      } else {
        batches.push(currentBatch);
        currentBatch = {
          shopId: s.shopId!,
          shopName: s.shop?.name || "Unknown",
          fromSerial: s.serialNumber,
          toSerial: s.serialNumber,
          count: 1,
        };
      }
    }
    batches.push(currentBatch);

    // En son verilen batçları en üstte göstermek için bitiş seri nosuna göre ters sıralayalım
    return batches.sort((a, b) => b.toSerial - a.toSerial);
  }
}

export const sealService = new SealService();
