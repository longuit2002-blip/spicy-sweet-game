# Agent Instructions For This Repo

Use `.agents/skills/spicy-sweet-cursor-bridge/SKILL.md` as the entry point for repo-specific guidance.

Required baseline before substantial work:
- Read `.cursor/rules/project-skills.mdc`.
- Read `.cursor/skills/taste-skill/output-skill/SKILL.md`.
- If the task touches React or Next.js, read `.cursor/skills/vercel-react-best-practices/SKILL.md`.

Task routing:
- UI styling or `className`: read `.cursor/skills/tailwind-design-system/SKILL.md`.
- React component API or composition: read `.cursor/skills/vercel-composition-patterns/SKILL.md`.
- shadcn/ui or forms: read `.cursor/skills/josechifflet-architecture-patterns-shadcn-ui/SKILL.md`.
- Socket.IO client or gateway work: read `.cursor/skills/agents-inc-skills-web-realtime-socket-io/SKILL.md`.
- NestJS modules, DTOs, guards, controllers, or providers: read `.cursor/skills/nestjs-best-practices/AGENTS.md` and `.cursor/skills/nestjs-best-practices/SKILL.md`.
- i18n: read `.cursor/skills/mindrally-skills-internationalization-i18n/SKILL.md`.
- PRD work: read `.cursor/skills/dirkkok101-skills-prd/SKILL.md`.
- system design: read `.cursor/skills/spacey6849-agentskills-system-design/SKILL.md`.

Repo rules:
- Before creating a new type, helper, constant, enum, or utility, search for an existing one and reuse it if possible.
- Shared cross-app types belong in `packages/shared-types`.
- Game-rule helpers belong in `packages/game-logic`.
- UI utilities belong in `apps/web/src/lib`.
- Avoid magic numbers, repeated magic strings, and `any`.
- If touching gameplay timers, room defaults, or socket error strings, read `.cursor/rules/game-constants.mdc`.

Bridge reference:
- `.agents/skills/spicy-sweet-cursor-bridge/references/cursor-skill-map.md`
