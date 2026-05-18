---
description: Scaffold a new React component
argument-hint: [PascalCase component name, e.g. "CustomerTimeline"]
allowed-tools: Read(./frontend/components/**), Write(./frontend/components/*.tsx), Bash(cd frontend && npx tsc --noEmit)
---

Scaffold `frontend/components/$ARGUMENTS.tsx`.

## Steps

1. **Don't add code to `App.tsx`.** That file is 1200+ lines and the
   point of this command is to keep new features out of it.
2. Look at a similar existing component (e.g. `KanbanBoard.tsx`,
   `FollowUpPanel.tsx`) to match conventions: function component, named
   export, Tailwind classes inline, props typed via an interface above
   the function.
3. Create `frontend/components/$ARGUMENTS.tsx` with:
   - A `Props` interface (or `${ComponentName}Props`).
   - Hooks at the top, callbacks via `useCallback`, derived state
     memoized.
   - LocalStorage (if needed) via `src/utils/safeStorage.ts`.
   - API calls (if needed) via `src/services/apiClient.ts`.
4. Wire it in wherever the user wants. If unclear, ask:
   `AskUserQuestion` — "Mount this inside Kanban view / Meetings view /
   ..." with the 2-3 plausible parents.
5. Run `npx tsc --noEmit` in `frontend/`. Fix anything that surfaces.
6. Tell the user the component still needs **browser exercise** — type
   checks don't verify behavior.
