import { apiError, readJson } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";
import { guardMutationRequest, getRequestIp } from "@/lib/security/request-guard";
import { reviewLabExportSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireServerSession(request);
    const guard = await guardMutationRequest(request, {
      bucket: "review-lab-export",
      key: session.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (guard) {
      return guard;
    }

    const parsed = reviewLabExportSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid export request", details: parsed.error.flatten() }, { status: 400 });
    }

    const url = new URL(`/api/review-lab/sessions/${encodeURIComponent(parsed.data.sessionId)}`, request.url);
    const reportResponse = await fetch(url, { headers: { cookie: request.headers.get("cookie") ?? "" } });
    if (!reportResponse.ok) {
      return NextResponse.json({ error: "Report unavailable" }, { status: reportResponse.status });
    }

    const { report } = await reportResponse.json();
    return NextResponse.json({
      export: {
        generatedAt: new Date().toISOString(),
        report,
        methodology: REVIEW_LAB_METHODOLOGY,
      },
    });
  } catch (error) {
    return apiError(error, request);
  }
}
