// Kills orphaned dev-server / Turbopack worker processes from previous runs before
// starting a new `next dev`. Turbopack spawns child workers that survive port-based
// kills; two live servers sharing .next cause an endless "Compiling" loop + runaway CPU.
// This guarantees a single clean instance. Windows-focused; no-op elsewhere.

import { execSync } from "node:child_process";

if (process.platform !== "win32") {
  process.exit(0);
}

const self = process.pid;
const parent = process.ppid;

function ps(cmd) {
  return execSync(`powershell -NoProfile -Command "${cmd}"`, { encoding: "utf8" });
}

try {
  const query =
    "Get-CimInstance Win32_Process -Filter \\\"name='node.exe'\\\" | " +
    "Where-Object { $_.CommandLine -like '*facepaintingbysue*' -and " +
    "($_.CommandLine -like '*\\next\\dist*' -or $_.CommandLine -like '*start-server*' -or $_.CommandLine -like '*\\.next\\dev*') } | " +
    "Select-Object -ExpandProperty ProcessId";

  const pids = ps(query)
    .split(/\r?\n/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n !== self && n !== parent);

  if (pids.length === 0) {
    process.exit(0);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      console.log(`[predev] cleaned stray dev process ${pid}`);
    } catch {
      // process may already be gone
    }
  }
} catch {
  // never block dev startup on cleanup problems
  process.exit(0);
}
