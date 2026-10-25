import { randomUUID } from "crypto";
import prisma from "@/lib/db";
import {
  buildObjectKey,
  getStorage,
  isStorageConfigured,
  validateImageBytes,
} from "@/lib/storage";

export const TEAM_ISSUE_USERS = ["Berat", "Furkan"] as const;
export type TeamIssueUser = (typeof TEAM_ISSUE_USERS)[number];

export type TeamIssueEventDto = {
  user_name: string;
  action: string;
  created_at: string;
};

export type TeamIssuePhotoDto = {
  id: string;
  image_path: string;
  uploaded_by: string;
  created_at: string;
};

export type TeamIssueDto = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  photos: TeamIssuePhotoDto[];
  events: TeamIssueEventDto[];
};

export class TeamIssueValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "TeamIssueValidationError";
    this.status = status;
  }
}

export function parseTeamIssueUser(input: unknown): TeamIssueUser {
  if (input === "Berat" || input === "Furkan") {
    return input;
  }
  throw new TeamIssueValidationError("Önce kullanıcı seçimi yapılmalı.", 422);
}

export function parseTeamIssueId(input: unknown): number {
  const num = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(num) || num < 1) {
    throw new TeamIssueValidationError("Geçersiz sorun numarası.", 422);
  }
  return num;
}

async function storeIssuePhoto(
  issueId: number,
  bytes: Uint8Array,
): Promise<string> {
  const validation = validateImageBytes(bytes);
  if (!validation.ok) {
    if (validation.reason === "too_large") {
      throw new TeamIssueValidationError(
        "Fotoğraflar yüklenemedi veya bir dosya 8 MB sınırını aşıyor.",
        422,
      );
    }
    throw new TeamIssueValidationError(
      "Yalnızca geçerli JPG, PNG veya WebP fotoğraf yüklenebilir.",
      422,
    );
  }

  if (isStorageConfigured()) {
    const key = buildObjectKey({
      prefix: "team-issues",
      ownerId: String(issueId),
      uniqueId: randomUUID(),
      extension: validation.extension,
    });
    const uploaded = await getStorage().put({
      key,
      body: bytes,
      contentType: validation.contentType,
    });
    return uploaded.url;
  }

  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${validation.contentType};base64,${base64}`;
}

function extractS3KeyFromUrl(url: string): string | null {
  const baseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl || !url.startsWith(`${baseUrl}/`)) return null;
  const key = url.slice(baseUrl.length + 1);
  return key.startsWith("team-issues/") ? key : null;
}

export class TeamIssueService {
  async listIssues(): Promise<TeamIssueDto[]> {
    const rows = await prisma.teamIssue.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        photos: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });

    return rows.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      created_by: issue.createdBy,
      created_at: issue.createdAt.toISOString(),
      photos: issue.photos.map((p) => ({
        id: p.id,
        image_path: p.imageUrl,
        uploaded_by: p.uploadedBy,
        created_at: p.createdAt.toISOString(),
      })),
      events: issue.events.map((e) => ({
        user_name: e.userName,
        action: e.action,
        created_at: e.createdAt.toISOString(),
      })),
    }));
  }

  async createIssue(
    rawTitle: unknown,
    rawUser: unknown,
  ): Promise<{ id: number }> {
    const user = parseTeamIssueUser(rawUser);
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    if (title.length < 1 || title.length > 180) {
      throw new TeamIssueValidationError(
        "Sorun adı 1-180 karakter arasında olmalı.",
        422,
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const issue = await tx.teamIssue.create({
        data: {
          title,
          createdBy: user,
          status: "open",
        },
      });
      await tx.teamIssueEvent.create({
        data: {
          issueId: issue.id,
          userName: user,
          action: "created",
        },
      });
      return issue;
    });

    return { id: created.id };
  }

  private async ensureIssueExists(id: number) {
    const issue = await prisma.teamIssue.findUnique({
      where: { id },
      include: { photos: { select: { id: true, imageUrl: true } } },
    });
    if (!issue) {
      throw new TeamIssueValidationError("Sorun bulunamadı.", 404);
    }
    return issue;
  }

  async recordVisit(
    rawIssueId: unknown,
    rawUser: unknown,
    action: "opened" | "left",
  ): Promise<{ ok: true }> {
    const user = parseTeamIssueUser(rawUser);
    const issueId = parseTeamIssueId(rawIssueId);
    await this.ensureIssueExists(issueId);

    await prisma.teamIssueEvent.create({
      data: {
        issueId,
        userName: user,
        action,
      },
    });

    return { ok: true };
  }

  async updateStatus(
    rawIssueId: unknown,
    rawUser: unknown,
    action: "resolve" | "reopen",
  ): Promise<{ ok: true; status: "open" | "resolved" }> {
    const user = parseTeamIssueUser(rawUser);
    const issueId = parseTeamIssueId(rawIssueId);
    await this.ensureIssueExists(issueId);

    const status = action === "resolve" ? "resolved" : "open";
    const eventAction = action === "resolve" ? "resolved" : "reopened";

    await prisma.$transaction([
      prisma.teamIssue.update({
        where: { id: issueId },
        data: { status },
      }),
      prisma.teamIssueEvent.create({
        data: {
          issueId,
          userName: user,
          action: eventAction,
        },
      }),
    ]);

    return { ok: true, status };
  }

  async saveDetails(params: {
    issueId: unknown;
    user: unknown;
    description: unknown;
    photos: Uint8Array[];
  }): Promise<{ ok: true; photos_added: number }> {
    const user = parseTeamIssueUser(params.user);
    const issueId = parseTeamIssueId(params.issueId);
    const description =
      typeof params.description === "string" ? params.description.trim() : "";

    if (!description) {
      throw new TeamIssueValidationError("Sorunun açıklamasını yazın.", 422);
    }

    const issue = await this.ensureIssueExists(issueId);
    if (issue.photos.length === 0 && params.photos.length === 0) {
      throw new TeamIssueValidationError(
        "Soruna ait en az bir fotoğraf yükleyin.",
        422,
      );
    }

    const storedUrls: string[] = [];
    for (const bytes of params.photos) {
      const url = await storeIssuePhoto(issueId, bytes);
      storedUrls.push(url);
    }

    await prisma.$transaction(async (tx) => {
      for (const imageUrl of storedUrls) {
        await tx.teamIssueImage.create({
          data: {
            issueId,
            imageUrl,
            uploadedBy: user,
          },
        });
      }
      await tx.teamIssue.update({
        where: { id: issueId },
        data: { description },
      });
      await tx.teamIssueEvent.create({
        data: {
          issueId,
          userName: user,
          action: "details_saved",
        },
      });
    });

    return { ok: true, photos_added: storedUrls.length };
  }

  async deleteIssue(
    rawIssueId: unknown,
    rawUser: unknown,
  ): Promise<{ ok: true }> {
    parseTeamIssueUser(rawUser);
    const issueId = parseTeamIssueId(rawIssueId);
    const issue = await this.ensureIssueExists(issueId);

    await prisma.teamIssue.delete({
      where: { id: issueId },
    });

    if (isStorageConfigured()) {
      const storage = getStorage();
      for (const photo of issue.photos) {
        const key = extractS3KeyFromUrl(photo.imageUrl);
        if (key) {
          await storage.remove(key).catch(() => undefined);
        }
      }
    }

    return { ok: true };
  }
}

export const teamIssueService = new TeamIssueService();
