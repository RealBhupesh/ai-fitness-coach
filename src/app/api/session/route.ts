import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getServerSession(request);

  if (!session?.user?.id) {
    return NextResponse.json({ session: null, user: null }, { status: 401 });
  }

  return NextResponse.json({
    session: {
      userId: session.user.id,
      expiresAt: session.session?.expiresAt ?? null,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
    },
  });
}
