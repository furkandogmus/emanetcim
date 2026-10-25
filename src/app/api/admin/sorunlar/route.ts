import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  teamIssueService,
  TeamIssueValidationError,
} from "@/services/TeamIssueService";

export const dynamic = "force-dynamic";

async function isAuthorizedAdmin(): Promise<boolean> {
  const mobileSession = await getMobileSession();
  if (mobileSession?.role === "ADMIN") return true;

  const webSession = await auth();
  return webSession?.user?.role === "ADMIN";
}

export async function GET() {
  if (!(await isAuthorizedAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const issues = await teamIssueService.listIssues();
    return NextResponse.json({ issues });
  } catch (error) {
    if (error instanceof TeamIssueValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "request_failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAuthorizedAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  try {
    if (action === "save-details") {
      const formData = await req.formData();
      const user = formData.get("user");
      const issueId = formData.get("issue_id");
      const description = formData.get("description");
      const files = [
        ...formData.getAll("photos[]"),
        ...formData.getAll("photo"),
      ].filter((item): item is File => item instanceof File && item.size > 0);

      const photoBuffers: Uint8Array[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        photoBuffers.push(new Uint8Array(buffer));
      }

      const result = await teamIssueService.saveDetails({
        issueId,
        user,
        description,
        photos: photoBuffers,
      });
      return NextResponse.json(result);
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (action === "create") {
      const created = await teamIssueService.createIssue(body.title, body.user);
      return NextResponse.json(created, { status: 201 });
    }

    if (action === "open") {
      const result = await teamIssueService.recordVisit(
        body.issue_id,
        body.user,
        "opened",
      );
      return NextResponse.json(result);
    }

    if (action === "leave") {
      const result = await teamIssueService.recordVisit(
        body.issue_id,
        body.user,
        "left",
      );
      return NextResponse.json(result);
    }

    if (action === "resolve" || action === "reopen") {
      const result = await teamIssueService.updateStatus(
        body.issue_id,
        body.user,
        action,
      );
      return NextResponse.json(result);
    }

    if (action === "delete") {
      const result = await teamIssueService.deleteIssue(
        body.issue_id,
        body.user,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 404 });
  } catch (error) {
    if (error instanceof TeamIssueValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "request_failed" },
      { status: 500 },
    );
  }
}
