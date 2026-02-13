import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const backendDir = path.join(root, "backend");
const frontendDir = path.join(root, "frontend");

// --- Backend: create venv + install deps ---
const venvDir = path.join(backendDir, ".venv");
const isWin = process.platform === "win32";
const py = process.env.PYTHON ?? "python";

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWin });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n[1/2] Setting up Python backend...");

if (!existsSync(venvDir)) {
  console.log("Creating venv at backend/.venv");
  run(py, ["-m", "venv", venvDir], backendDir);
} else {
  console.log("venv already exists: backend/.venv");
}

const pip = isWin
  ? path.join(venvDir, "Scripts", "pip")
  : path.join(venvDir, "bin", "pip");

console.log("Installing backend deps...");
run(pip, ["install", "--upgrade", "pip"], backendDir);
run(pip, ["install", "-r", "requirements.txt"], backendDir);

// --- Frontend: install deps ---
console.log("\n[2/2] Setting up TypeScript frontend...");
const npmCmd = process.env.NPM ?? "npm";
run(npmCmd, ["install"], frontendDir);

console.log("\nDone. Run: node scripts/dev.mjs");
