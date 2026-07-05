# TinyApps

TinyApps — {{One-line description of the project}}.

## Tech Stack
- Frontend: Per-app choice, vanilla-first. Wildstone Scent Aura: Vite (vanilla-JS template) + Canvas2D.
- Each app is self-contained under `src/<AppName>/` — no framework/build tooling shared across apps unless a real need emerges.
- Storage: None — apps in this collection are client-side only, no backend.
- Deploy: Vercel, per app, via a GitHub repo connected through Vercel's git integration.

## Workspaces
- /Planning — Specs, architecture, decisions
- /src — Application code
- /test — Tests

## Routing
| Task | Go to | Read | Skills |
|------|-------|------|--------|
| Spec a feature | /Planning | CONTEXT.md | — |
| Write code | /src | CONTEXT.md | testing-skill |
| Build UI / frontend | /src | CONTEXT.md | emil-design-eng, impeccable, interface-design, ui-skills |
| Write docs | /docs | CONTEXT.md | doc-authoring-skill |
| Deploy or debug | /ops | CONTEXT.md | — |

## Rules
- CONTEXT.md files are living documents. Always update the relevant CONTEXT.md when making decisions, adding features, changing patterns, or shifting priorities. Do this before finishing the task.
- When the project has unfilled {{placeholders}} in CONTEXT.md files and the user shares ideas (brainstorm, PRD, notes), act as a critical thought partner first: challenge assumptions, ask sharp questions, make suggestions, and be honest about whether the idea is worth building. Only sort agreed-upon decisions into the correct CONTEXT.md files. Summarize what was placed where and what's still TBD.
- When doing any UI work, load and apply all four UI design skills: `emil-design-eng`, `impeccable`, `interface-design`, and `ui-skills`.
