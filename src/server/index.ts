import { join, normalize } from "node:path";
import { existsSync } from "node:fs";

/**
 * Locate the pre-bundled dashboard assets. In the published package the CLI
 * lives at dist/cli.js next to dist/web/; during development we fall back to
 * the repo's dist/web (requires `bun run build`).
 */
function findWebRoot(): string {
  const candidates = [
    join(import.meta.dir, "web"),
    join(import.meta.dir, "../../dist/web"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  throw new Error(
    "Dashboard assets not found. Run `bun run build` first (expected dist/web/index.html).",
  );
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {
    // Browser opening is best-effort; the URL is printed anyway.
  }
}

const DEFAULT_PORT = 4321;

export interface ServeOptions {
  /** Fixed port. If omitted, tries DEFAULT_PORT then falls back to a free port. */
  port?: number;
  open: boolean;
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EADDRINUSE"
  );
}

export function serve(options: ServeOptions): void {
  const webRoot = findWebRoot();

  const fetchHandler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(webRoot, pathname));
    if (!filePath.startsWith(webRoot)) {
      return new Response("Forbidden", { status: 403 });
    }
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  };

  let server: ReturnType<typeof Bun.serve>;
  if (options.port !== undefined) {
    server = Bun.serve({ port: options.port, fetch: fetchHandler });
  } else {
    try {
      server = Bun.serve({ port: DEFAULT_PORT, fetch: fetchHandler });
    } catch (error) {
      if (!isAddrInUse(error)) throw error;
      // Default port is occupied (another instance, Astro, etc.) — let the
      // OS assign a free one instead of failing.
      server = Bun.serve({ port: 0, fetch: fetchHandler });
      console.log(`port ${DEFAULT_PORT} is in use, picked a free port instead`);
    }
  }

  const url = `http://localhost:${server.port}`;
  console.log(`cursor-usage dashboard running at ${url}`);
  console.log("Drop a Cursor usage-events CSV onto the page. Ctrl+C to stop.");
  if (options.open) openBrowser(url);
}
