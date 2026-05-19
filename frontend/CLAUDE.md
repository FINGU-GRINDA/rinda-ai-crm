# `frontend/` — agent instructions

Module-scoped rules for the React app. The root [`CLAUDE.md`](../CLAUDE.md)
applies first; this file refines.

## Stack reminders

- **React 19** + **Vite 6** + **TypeScript** + **Tailwind 4** + **React
  Router 7**.
- Package manager: **npm** (not bun — backend uses bun, frontend uses
  npm).
- No test runner configured. `npm run build` is the only automated gate.

## Quality gate (mandatory after every change)

```bash
npm run build         # full Vite build (production)
# or for a fast feedback loop:
npx tsc --noEmit      # types only (what the Stop hook runs)
```

The Stop hook runs `npx tsc --noEmit`. For UI-affecting changes you must
also exercise the feature in a browser — type checks don't catch
behavior bugs.

## File layout (this is unusual — read carefully)

There are **two** top-level directories with code:

- `frontend/components/`, `frontend/services/`, `frontend/contexts/`,
  `frontend/hooks/` — legacy top-level layout. Most components still
  live here.
- `frontend/src/router.tsx`, `frontend/src/services/apiClient.ts`,
  `frontend/src/utils/{safeStorage,apiTransformers,typeGuards}.ts` —
  newer code lives under `src/`.

When adding new files, match the surrounding code. New components → go
next to existing components. New routing/utility code → under `src/`.

## `App.tsx` is a danger zone

- 1200+ lines, several `useEffect`s with lifecycle bugs in history.
- **Do not add features inline.** Extract into a new
  `frontend/components/<Feature>.tsx`, import from `App.tsx`.
- If you must touch `App.tsx`, re-verify cleanup of every `useEffect`
  you change — duplicate intervals and stale closures are the historical
  pattern of bugs here.

## LocalStorage

Always use `frontend/src/utils/safeStorage.ts`:

```ts
import { safeGetItem, safeSetItem } from "@/utils/safeStorage"

const settings = safeGetItem<Settings>("settings", defaultSettings)
safeSetItem("settings", settings)
```

Raw `JSON.parse(localStorage.getItem(...))` has crashed the app in the
past (corrupted data, quota exceeded). The util wraps both in try/catch.

## API calls

Single client: `frontend/src/services/apiClient.ts`. It reads
`import.meta.env.VITE_API_URL`. Don't `fetch(...)` directly in
components.

If a backend response shape changes, update the transformer in
`frontend/src/utils/apiTransformers.ts` (also `try/catch`-wrapped for
JSON parsing).

## Environment variables

- Build-time only. Vite bakes them into the bundle, so anything in
  `VITE_*` is **public**.
- Required at build: `VITE_API_URL` (else dev proxy is wrong).
- Document new vars in `frontend/.env.example`.

## React 19 notes

- The codebase uses the new JSX runtime; no explicit `import React`
  needed unless you use a named API (`useState`, etc.).
- `lazy(() => import(...))` is used for the dashboard chunk — keep it
  that way.

## Common gotchas

- `App.tsx` `useEffect` patterns: be careful with arrays in deps (a new
  array every render = infinite loop). Use refs or memoize.
- Tailwind 4 uses the new `@tailwindcss/vite` plugin — config is in
  `tailwind.config.js`. No `postcss.config` tinkering needed for v4.
- `dayjs`/`date-fns` is **not** installed. Use `Date` directly, and
  validate before formatting (see `KanbanBoard` history).
