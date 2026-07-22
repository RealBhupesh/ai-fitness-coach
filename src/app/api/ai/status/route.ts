import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { getAiProviderStatus } from "@/lib/ai/coach";

export async function GET(request: Request) {
  try {
    await requireServerSession(request);
    return NextResponse.json(getAiProviderStatus());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
