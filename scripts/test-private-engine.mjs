import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), "prism-private-engine-"));
const compiler = join(projectRoot, "node_modules", "typescript", "bin", "tsc");
let exitCode = 1;

try {
  const compile = spawnSync(
    process.execPath,
    [
      compiler,
      "-p",
      join(projectRoot, "tsconfig.private-engine.test.json"),
      "--outDir",
      outputDirectory,
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );

  if (compile.status === 0) {
    const test = spawnSync(
      process.execPath,
      ["--test", join(outputDirectory, "private-engine", "provider.test.js")],
      { cwd: projectRoot, stdio: "inherit" },
    );
    exitCode = test.status ?? 1;
  } else {
    exitCode = compile.status ?? 1;
  }
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
