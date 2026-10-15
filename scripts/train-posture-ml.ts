import { spawnSync } from "node:child_process";
const result = spawnSync(process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3"), ["scripts/train_posture_model.py", ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
