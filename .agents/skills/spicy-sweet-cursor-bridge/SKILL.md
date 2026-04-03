---
name: spicy-sweet-cursor-bridge
description: Bridge Codex work to the repo-local Cursor skill stack in `.cursor`. Use when working in the Sweet & Spicy codebase and you need to choose which local skill, rule file, or agent guide to read before editing code, reviewing code, or planning changes across Next.js, React, NestJS, Socket.IO, Tailwind, shadcn/ui, i18n, gameplay constants, PRDs, or system design.
---

# Spicy Sweet Cursor Bridge

Use this skill as the entry point for repo-specific guidance that already exists under `.cursor`.

Do not duplicate those rules in new files. Route yourself to the right source and then follow it.

## Workflow

1. Read `.cursor/rules/project-skills.mdc`.
2. Read `.cursor/skills/taste-skill/output-skill/SKILL.md`.
3. If the task touches React or Next.js in any way, read `.cursor/skills/vercel-react-best-practices/SKILL.md`.
4. Based on the task area, read the matching `.cursor` skill from `references/cursor-skill-map.md`.
5. If the task changes gameplay constants, timers, room defaults, or socket error strings, also read `.cursor/rules/game-constants.mdc`.
6. Search the codebase before creating any new type, helper, constant, enum, or utility. Reuse existing code whenever possible.
7. Apply the selected skill guidance while implementing or reviewing the change.

## Task Router

Read `references/cursor-skill-map.md` and pick the smallest relevant set of source files.

Common routing:
- Styling or `className`: `tailwind-design-system`
- React architecture: `vercel-composition-patterns`
- React or Next.js performance: `vercel-react-best-practices`
- shadcn/ui or forms: `josechifflet-architecture-patterns-shadcn-ui`
- NestJS backend work: `nestjs-best-practices`
- Socket.IO: `agents-inc-skills-web-realtime-socket-io`
- i18n: `mindrally-skills-internationalization-i18n`
- PRD work: `dirkkok101-skills-prd`
- system design: `spacey6849-agentskills-system-design`

## Repo Conventions To Preserve

- Keep shared types in `packages/shared-types`.
- Keep game-rule helpers in `packages/game-logic`.
- Keep UI utilities in `apps/web/src/lib`.
- Keep Zustand state in `apps/web/src/stores`.
- Avoid new magic numbers or repeated magic strings.
- Do not introduce `any`.
- Prefer extending existing types and constants over creating parallel versions.

## When To Load Extra References

- Read `references/cursor-skill-map.md` at the start of substantial tasks.
- Read source `SKILL.md` or `AGENTS.md` files from `.cursor` only for the task areas you are actually touching.
- Re-open `.cursor/rules/game-constants.mdc` when a gameplay or socket change introduces new constants.
