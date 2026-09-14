---
name: ui-skills-route
description: Use before UI/visual work to route to the smallest useful design skill set via the UI Skills registry (MCP or CLI) instead of loading every design skill.
---

# UI Skills route

Do not dump every design skill into context. Route first.

## When to use

- Building or polishing web UI, landing pages, motion, accessibility, or design tokens
- User asks for a specific visual direction and you are unsure which skill fits

## Protocol

1. Decide if the task is UI-related. If not, stop (`no skill needed`).
2. Prefer the UI Skills MCP when connected: `https://www.ui-skills.com/mcp`
   - tools: `list_skills`, `get_skill`
3. Or use the CLI:

```bash
npx ui-skills start
npx ui-skills categories
npx ui-skills list --category <category>
npx ui-skills get <slug>
```

4. Load at most 1–3 skills. Prefer specific over broad; framework-specific when the stack is obvious.
5. Implement with only that context.

## Selection rules

- Prefer 1 skill; use 2 only for two clear angles; never more than 3
- For fast cleanup, pick the narrowest craft/layout/visual skill
- If unclear, ask one short clarifying question, then route

## Install pointer

```bash
npx skills add https://github.com/ibelick/ui-skills --skill ui-skills-root
```

Registry: [ibelick/ui-skills](https://github.com/ibelick/ui-skills)

This skill is a router, not a design system. It does not replace product `DESIGN.md` or Code-KG knowledge sections.
