import { NextResponse } from "next/server";
import { getDanceRoutineDemo } from "@/lib/server/app-data";
import { requireServerSession } from "@/lib/auth/session";
import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";

export async function GET(request: Request) {
  try {
    await requireServerSession(request);
    try {
      const routinePack = await loadPrimaryDanceRoutinePack();
      return NextResponse.json({ routine: routinePack, source: "asset" });
    } catch {
      const routine = await getDanceRoutineDemo();
      return NextResponse.json({ routine, source: "db" });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
