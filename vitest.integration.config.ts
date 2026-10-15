import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { environment:"node",include:["tests/integration/**/*.test.ts"],maxWorkers:1,testTimeout:30000,hookTimeout:30000 },resolve:{alias:{"@":path.resolve("src")}} });
