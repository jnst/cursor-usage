// Development server with hot reload: `bun run dev`
import index from "../../web/index.html";

// port 0 = OS picks a free port. Set PORT to pin a specific one.
const port = process.env.PORT ? Number(process.env.PORT) : 0;

const server = Bun.serve({
  port,
  routes: { "/*": index },
  development: true,
});

console.log(`dev server running at ${server.url}`);
