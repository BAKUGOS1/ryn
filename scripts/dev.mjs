// Translate conventional dev-server flags to Next.js flags for local preview.
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
let port = "4173",
  hostname = "0.0.0.0";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") port = args[++i];
  else if (args[i] === "--host" || args[i] === "--hostname")
    hostname = args[++i];
  else if (args[i] !== "--strictPort") throw new Error("Unsupported dev flag");
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    hostname,
    "--port",
    port,
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
