import { NextResponse } from "next/server";
import { getDanceRoutineDemo } from "@/lib/server/app-data";
import { requireServerSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    await requireServerSession(request);
    const routine = await getDanceRoutineDemo();
    return NextResponse.json({ routine });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
