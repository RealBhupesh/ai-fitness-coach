import { NextResponse } from "next/server";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";

export async function GET() {
  return NextResponse.json({ methodology: REVIEW_LAB_METHODOLOGY });
}
