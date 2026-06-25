import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src/app/api");
const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return routeFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

function methodBlock(source: string, method: string) {
  const start = source.indexOf(`export async function ${method}`);
  if (start === -1) return null;

  const nextExport = source
    .slice(start + 1)
    .search(/export async function (GET|POST|PUT|PATCH|DELETE)\b/);

  if (nextExport === -1) return source.slice(start);
  return source.slice(start, start + 1 + nextExport);
}

describe("API mutation route protection", () => {
  it("guards every mutating API handler with origin and rate-limit checks", () => {
    const offenders = routeFiles(API_DIR).flatMap((file) => {
      if (file.includes(`${path.sep}auth${path.sep}`)) return [];

      const source = readFileSync(file, "utf8");
      return MUTATING_METHODS.flatMap((method) => {
        const block = methodBlock(source, method);
        if (!block || block.includes("guardMutationRequest(")) return [];
        return `${path.relative(process.cwd(), file)}:${method}`;
      });
    });

    expect(offenders).toEqual([]);
  });
});
