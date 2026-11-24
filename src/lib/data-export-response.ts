import { NextResponse } from "next/server";
import type { DataExportEmailResult } from "@/services/AccountDataExportService";

/** Web ve mobil e-posta uclarinin ortak yanit eslemesi. */
export function dataExportEmailResponse(result: DataExportEmailResult) {
  if (result.ok) return NextResponse.json({ ok: true, email: result.email });
  switch (result.reason) {
    case "rate_limited":
      return NextResponse.json({ error: "rate_limited", retryAt: result.retryAt.toISOString() }, { status: 429 });
    case "no_verified_email":
      return NextResponse.json({ error: "no_verified_email" }, { status: 409 });
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "mail_failed":
      return NextResponse.json({ error: "mail_failed" }, { status: 502 });
  }
}
