---
description: Start backend + frontend dev servers (background)
allowed-tools: Bash(just dev)
---

Run `just dev` in the **background** (the recipe spawns backend and
frontend together using `&`).

After starting, do **not** poll the process — the user will surface
relevant errors themselves. Mention:

- Backend will be at `http://localhost:3001` (Swagger at `/swagger`).
- Frontend will be at `http://localhost:3000` (Vite's default).
- The backend will boot only if `DATABASE_URL` resolves and required
  env (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`) is set.

If the user wants logs, tell them to look at the foreground terminal
where `just dev` is running.
