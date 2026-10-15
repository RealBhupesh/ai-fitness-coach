import { apiError } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { getAiProviderStatus } from "@/lib/ai/coach";

export async function GET(request: Request) {
  try {
    await requireServerSession(request);
    return NextResponse.json(getAiProviderStatus());
  } catch (error) {
    return apiError(error, request);
  }
}
