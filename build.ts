import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

const web = await Bun.build({
  entrypoints: ["web/index.html"],
  outdir: "dist/web",
  target: "browser",
  minify: true,
});
if (!web.success) {
  console.error(...web.logs);
  process.exit(1);
}

const cli = await Bun.build({
  entrypoints: ["src/cli/index.ts"],
  outdir: "dist",
  naming: "cli.[ext]",
  target: "node",
  minify: true,
});
if (!cli.success) {
  console.error(...cli.logs);
  process.exit(1);
}

console.log("build complete: dist/cli.js + dist/web/");
