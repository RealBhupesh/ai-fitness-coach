import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DanceRoutinePack } from "@/lib/dance/types";

const ROUTINE_FILE = path.join(process.cwd(), "public", "routines", "starter-groove-pack.json");

export async function loadPrimaryDanceRoutinePack() {
  const raw = await readFile(ROUTINE_FILE, "utf8");
  return JSON.parse(raw) as DanceRoutinePack;
}
