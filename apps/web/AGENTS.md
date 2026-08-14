# Web application instructions

- Keep App Router route files thin.
- Place reusable UI in `packages/ui`.
- Place framework-free request and response shapes in `packages/contracts`.
- Never import `runtime:node` projects.
- Prefer server components; introduce client components only at interaction boundaries.
- Before Next.js-specific implementation or debugging, prefer the version-matched guidance shipped with the installed package under `node_modules/next/dist/docs/` over remembered or copied framework prose.
- Validate changes with `pnpm nx run web:typecheck` and `pnpm nx run web:build`.
