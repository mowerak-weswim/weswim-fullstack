import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../weswim-backend");
const outputPath = path.resolve(__dirname, "../src/types/database.ts");

const result = spawnSync("npx supabase gen types typescript --local", {
  cwd: backendDir,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  shell: true,
});

const output = result.stdout ?? "";

if (!output.includes("export type Database")) {
  console.error(result.stderr ?? "Failed to generate Supabase types");
  process.exit(result.status ?? 1);
}

writeFileSync(outputPath, output.replace(/\r\n/g, "\n"), "utf8");
console.log(`Wrote ${outputPath}`);
