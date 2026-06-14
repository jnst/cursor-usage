# Agent Notes

- After editing files, project Cursor hooks run `bun run fix` to apply Vite+ formatting and import sorting.
- Do not fight formatter output. If formatting changes are broad, keep them separate from behavioral changes when practical.
- Use `bun run fix` for formatting and import-order fixes.
- Use `bun run precommit` before committing.
- Use `bun run prepush` before pushing.
- Use `bun run release` for releases instead of manually sequencing version, publish, push, and GitHub Release steps.
