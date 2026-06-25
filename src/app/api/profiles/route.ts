import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { isDemoUser, buildDemoProfile, getDemoProfileFromCookie } from "@/lib/dummy-auth";
import { getAppProfile, getProfilePersonas } from "@/lib/server/app-data";

export async function GET(request: Request) {
  const session = await getServerSession(request);
  const cookieHeader = request.headers.get("cookie") || "";

  if (!session?.user?.id) {
    return NextResponse.json(getProfilePersonas(null));
  }

  const currentProfile = isDemoUser(session.user.id)
    ? getDemoProfileFromCookie(cookieHeader) ?? buildDemoProfile()
    : await getAppProfile(session.user.id);

  return NextResponse.json(getProfilePersonas(currentProfile));
}
