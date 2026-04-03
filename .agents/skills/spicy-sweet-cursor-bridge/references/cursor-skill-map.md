# Cursor Skill Map For This Repo

Source of truth:
- `.cursor/rules/project-skills.mdc`
- `.cursor/rules/game-constants.mdc`

Always read these before substantial code changes:
- `.cursor/rules/project-skills.mdc`
- `.cursor/skills/taste-skill/output-skill/SKILL.md`
- `.cursor/skills/vercel-react-best-practices/SKILL.md`

Task routing:

| Area | Read |
|---|---|
| UI styling, `className`, tokens, variants, spacing, color | `.cursor/skills/tailwind-design-system/SKILL.md` |
| React component API, composition, prop design | `.cursor/skills/vercel-composition-patterns/SKILL.md` |
| Next.js and React performance | `.cursor/skills/vercel-react-best-practices/SKILL.md` |
| shadcn/ui components and forms | `.cursor/skills/josechifflet-architecture-patterns-shadcn-ui/SKILL.md` |
| Web game development and Playwright game loops | `.cursor/skills/jmead-cursor-config-develop-web-game/SKILL.md` |
| UI/UX direction, palette, accessibility, responsive layout | `.cursor/skills/jmead-cursor-config-ui-ux-pro-max/SKILL.md` |
| Socket.IO client or server events, rooms, reconnect, auth | `.cursor/skills/agents-inc-skills-web-realtime-socket-io/SKILL.md` |
| NestJS modules, DTOs, controllers, guards, providers | `.cursor/skills/nestjs-best-practices/AGENTS.md` and `.cursor/skills/nestjs-best-practices/SKILL.md` |
| i18n and i18next usage | `.cursor/skills/mindrally-skills-internationalization-i18n/SKILL.md` |
| PRDs, user stories, acceptance criteria | `.cursor/skills/dirkkok101-skills-prd/SKILL.md` |
| System design and architecture planning | `.cursor/skills/spacey6849-agentskills-system-design/SKILL.md` |
| Image generation tasks | `.cursor/skills/openai-image-gen/SKILL.md` |

Repo-specific rules:

| Situation | Read |
|---|---|
| Changing gameplay timers, room limits, socket error strings, or game constants | `.cursor/rules/game-constants.mdc` |
| Adding a new type, helper, constant, enum, or utility | Search existing code first; follow reuse rules in `.cursor/rules/project-skills.mdc` |

Notes:
- The project rule file says Tailwind work should read `tailwind-design-system`, but that skill is written for Tailwind v4. In this repo, use it mainly for token discipline, component variants, and accessibility patterns. Do not migrate v3 setup unless the task explicitly asks for it.
- `project-skills.mdc` mentions `.cursor/skills/kensaurus-cursor-kenji-realtime-features/SKILL.md`, but that path does not exist in this repo. Ignore it unless the skill is added later.
