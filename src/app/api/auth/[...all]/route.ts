import { auth } from "@/lib/auth/config";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { isLegacyAuthEnabled } from "@/lib/env";
const handlers = toNextJsHandler(auth);
export async function GET(request: Request) { return isLegacyAuthEnabled() ? handlers.GET(request) : NextResponse.json({ error: "Use Clerk sign-in" }, { status: 404 }); }
export async function POST(request: Request) { return isLegacyAuthEnabled() ? handlers.POST(request) : NextResponse.json({ error: "Use Clerk sign-in" }, { status: 404 }); }
