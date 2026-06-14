import type { AddressInfo } from "node:net";

import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 4321;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

/**
 * Locate the pre-bundled dashboard assets. In the published package the CLI
 * lives at dist/cli.js next to dist/web/; during development we fall back to
 * the repo's dist/web (requires `bun run build`).
 */
function findWebRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "web"), join(here, "../../dist/web")];
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  throw new Error(
    "Dashboard assets not found. Run `bun run build` first (expected dist/web/index.html).",
  );
}

function openBrowser(url: string): void {
  const [cmd, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    spawn(cmd!, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Browser opening is best-effort; the URL is printed anyway.
  }
}

export interface ServeOptions {
  /** Fixed port. If omitted, tries DEFAULT_PORT then falls back to a free port. */
  port?: number;
  open: boolean;
}

/**
 * Serves the bundled dashboard assets from the local machine.
 *
 * The server only serves static files; Usage Export data is loaded and analyzed
 * in the browser so sensitive usage data is not uploaded anywhere.
 */
export function serve(options: ServeOptions): void {
  const webRoot = findWebRoot();

  const server: Server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const filePath = normalize(join(webRoot, pathname === "/" ? "/index.html" : pathname));
    if (!filePath.startsWith(webRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Content-Length": info.size,
      });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  const onListening = () => {
    const { port } = server.address() as AddressInfo;
    const url = `http://localhost:${port}`;
    console.log(`cursor-usage dashboard running at ${url}`);
    console.log("Drop a Cursor usage-events CSV onto the page. Ctrl+C to stop.");
    if (options.open) openBrowser(url);
  };

  if (options.port !== undefined) {
    server.listen(options.port, onListening);
    return;
  }

  // Default port may be occupied (another instance, Astro, etc.) — let the
  // OS assign a free one instead of failing.
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.log(`port ${DEFAULT_PORT} is in use, picked a free port instead`);
    server.listen(0);
  });
  server.once("listening", onListening);
  server.listen(DEFAULT_PORT);
}
