import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    sortImports: {
      groups: [
        "type-import",
        ["value-builtin", "value-external"],
        ["value-internal", "value-parent", "value-sibling", "value-index"],
        "unknown",
      ],
    },
  },
  lint: {
    ignorePatterns: ["dist/**"],
  },
});
