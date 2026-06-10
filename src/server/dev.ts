// Development server with hot reload: `bun run dev`
import index from "../../web/index.html";

const server = Bun.serve({
  routes: { "/*": index },
  development: true,
});

console.log(`dev server running at ${server.url}`);
