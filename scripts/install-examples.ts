import { readdirSync, statSync } from "fs";
import { join } from "path";

const examplesDir = join(import.meta.dir, "../examples");
const dirs = readdirSync(examplesDir);

for (const dir of dirs) {
  const fullPath = join(examplesDir, dir);
  if (statSync(fullPath).isDirectory() && !dir.startsWith(".") && readdirSync(fullPath).includes("package.json")) {
    console.log(`\x1b[34m[install-examples]\x1b[0m Installing dependencies in ${dir}...`);
    const proc = Bun.spawn(["bun", "install"], {
      cwd: fullPath,
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  }
}
