# Documentation Context — TinyApps

## Documentation Standards

- Write in plain, concise language. No jargon unless the audience expects it.
- Use present tense ("The app displays..." not "The app will display...").
- Include visuals (screenshots, GIFs) for interaction-heavy features.
- Keep docs in sync with the code — update docs in the same PR as code changes.

## Document Types and Audiences

### User Guide
- **Audience:** {{primary users}}
- **Tone:** Friendly, task-oriented. Show, don't tell.
- **Structure:** Organized by task, not by feature.
- **Location:** `docs/user-guide/`

### API / Technical Reference
- **Audience:** Contributors and future developers
- **Tone:** Technical, precise
- **Structure:** {{structure description}}
- **Location:** `docs/reference/`

### Changelog
- **Audience:** Users and contributors
- **Format:** Keep a Changelog (keepachangelog.com) format
- **Group by:** Added, Changed, Fixed, Removed
- **Location:** `docs/CHANGELOG.md`

## How Docs Relate to Code

- Each app's PRD lives at `docs/<AppName>_PRD.md` (e.g. `docs/Wildstone_Scent_Aura_PRD.md`), matching its `src/<AppName>/` folder.
- Each app's implementation plan lives at `Planning/<AppName>_Plan.md` (e.g. `Planning/WildstoneScentAura_Plan.md`) — architecture decisions, file structure, and session-by-session sequencing, separate from the PRD's product vision.
- {{What must stay in sync}}

## Skills

Skills relevant when working on documentation in this workspace.

- **`doc-authoring-skill`** — Invoke when writing or updating user-facing documentation
- {{Additional skills as needed}}
