# Agent Notes

## Required Context

@CONTEXT.md
@ADR.md

## Formatting and Lint

- Project Cursor hooks run `bun run fix` after edits to apply formatting, import sorting, and automatic lint fixes.
- Accept formatter output; keep broad formatting changes separate from behavioral changes when practical.

## Communication

- Write all commit messages in English, including the subject and body.
- Write pull request titles and bodies in English.
- When talking about the UI, use the visible labels. Do not use CSS class names, component names, coined terms, or English nicknames that are not on screen.

## Git Workflow

- Automatically commit, push, and create or update a draft PR for each independent change, unless the user requests a different grouping.
- Amend or squash trivial follow-ups; preserve meaningful commits. Use `--force-with-lease` when rewriting PR branches.
- Leave merging and releases to the user.
