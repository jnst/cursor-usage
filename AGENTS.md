# Agent Notes

Required context:

@CONTEXT.md
@ADR.md

- After editing files, project Cursor hooks run `bun run fix` to apply Vite+ formatting and import sorting.
- Do not fight formatter output. If formatting changes are broad, keep them separate from behavioral changes when practical.
- Use `bun run fix` for formatting and import-order fixes.
- Use `bun run precommit` before committing.
- Use `bun run prepush` before pushing.
- Use `bun run release` for releases instead of manually sequencing version, publish, push, and GitHub Release steps.
- Write all commit messages in English, including the subject and body.
- Write pull request titles and bodies in English.
- When talking about the UI, use the visible labels. Do not use CSS class names, component names, coined terms, or English nicknames that are not on screen.
