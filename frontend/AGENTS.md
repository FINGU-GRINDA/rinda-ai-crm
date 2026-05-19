# AGENTS.md — `frontend/`

Module-scoped agent instructions. Mirror of [`CLAUDE.md`](./CLAUDE.md);
keep both in sync. Root contract: [`../AGENTS.md`](../AGENTS.md).

## Stack

React 19 + Vite 6 + TypeScript + Tailwind 4 + React Router 7. **npm**
(not bun).

## Commands

```bash
npm install
npm run dev           # local dev server
npm run build         # full Vite build + type-check (slow, but thorough)
npx tsc --noEmit      # types only (fast — Stop hook uses this)
```

No test runner. `npm run build` and `tsc --noEmit` are the only gates.
For UI changes, exercise the feature in a browser.

## Layout

- `frontend/components/`, `frontend/services/`, `frontend/contexts/`,
  `frontend/hooks/` — legacy top-level layout, still holds most code.
- `frontend/src/router.tsx`, `frontend/src/services/apiClient.ts`,
  `frontend/src/utils/{safeStorage,apiTransformers,typeGuards}.ts` —
  newer code.

New components → next to existing components. New routing/utilities →
under `src/`.

## `App.tsx`

1200+ lines, hotspot for `useEffect` cleanup bugs. **Don't add inline
features** — extract to `frontend/components/<Feature>.tsx`. When
editing, re-verify cleanup paths.

## Rules

- LocalStorage **must** go through `src/utils/safeStorage.ts`. No raw
  `JSON.parse(localStorage.getItem(...))`.
- API calls **must** go through `src/services/apiClient.ts`. No raw
  `fetch` in components.
- Env vars: `import.meta.env.VITE_*` only. They are baked in at build
  time and public. Document in `frontend/.env.example`.

## React 19 / Vite 6 notes

- New JSX runtime: no explicit `import React` for JSX.
- Dashboard is lazy-loaded (`lazy(() => import("../App"))`) — keep it.
- Tailwind 4 uses `@tailwindcss/vite`; config in `tailwind.config.js`.
