import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const backendDir = path.join(root, "backend");
const frontendDir = path.join(root, "frontend");

const isWin = process.platform === "win32";
const venvDir = path.join(backendDir, ".venv");
const python = isWin
  ? path.join(venvDir, "Scripts", "python")
  : path.join(venvDir, "bin", "python");

function start(name, cmd, args, cwd) {
  const p = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWin, // helps on Windows
    env: { ...process.env },
  });
  p.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });
  return p;
}

console.log("Starting backend + frontend (CTRL+C to stop)\n");

const backend = start(
  "backend",
  python,
  ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
  backendDir
);

const npmCmd = process.env.NPM ?? "npm";
const frontend = start("frontend", npmCmd, ["run", "dev"], frontendDir);

function shutdown() {
  console.log("\nShutting down...");
  backend.kill("SIGINT");
  frontend.kill("SIGINT");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
