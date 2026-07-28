# Coding Conventions

> **Project**: mkt_videodesigner
> **Feature**: browser-video-mvp
> **Scope key**: `module-1`
> **Date**: 2026-07-28
> **Status**: Active

Design §10 defines the rules. This document is the enforceable version: every
rule below is either checked by a command or is a review checklist item.

## 1. Layers and Dependency Direction

| Layer | Path | Responsibility |
|-------|------|----------------|
| App | `src/app/` | Shell, adapter selection, view switch |
| Domain | `src/domain/` | Pure entities, schemas, invariants, commands |
| Features | `src/features/` | UI and workflow orchestration |
| Compositions | `src/compositions/` | Remotion visual output |
| Infrastructure | `src/infrastructure/` | Browser and SDK adapters |
| Shared | `src/shared/` | Dependency-free utilities and error types |

Allowed direction:

```text
app          -> features, infrastructure, compositions, domain, shared
features     -> compositions, domain, shared
infrastructure -> compositions, domain, shared
compositions -> domain, shared
domain       -> shared
shared       -> shared
```

Hard rules:

- `domain` and `shared` must not import React, Remotion, or Zustand.
- `compositions` must not import a store.
- A feature must not import another feature's internals.
- Components must not instantiate a renderer, IndexedDB, model runtime, or file
  handle directly. They receive a port. Design Ref: §9.2.

Enforced by `src/test/architecture.test.ts`, which runs in `npm test`. When a
new layer or an intentional exception appears, update the rule table in that
test rather than working around it.

## 2. Ports and Adapters

- Port interfaces live in `src/domain/ports/`.
- A port is declared only when it has an implementation. No dormant ports.
- Browser adapters live in `src/infrastructure/` and are named
  `browser<PortName>` (`browserMediaResolver`, `browserVideoRenderer`).
- `src/app/App.tsx` is the only place that chooses an adapter.

This keeps the Remotion license contingency to a single-file swap.

## 3. Data and Validation

- Zod schemas in `src/domain/editor/schema.ts` are the runtime source of truth.
  TypeScript types are inferred from them, never hand-duplicated.
- Constants that the schema constrains live in `src/domain/editor/constants.ts`
  so the schema and the commands share one definition.
- Any project value that did not come from a domain command must pass
  `parseProject()` before use. That includes stored, imported, and pasted data.
- Time is milliseconds or frames, and the unit is in the identifier
  (`durationMs`, `trimBeforeFrames`).

## 4. State

| Store | Persistent | Content |
|-------|:----------:|---------|
| `useProjectStore` | Yes, from module-3 | Validated `EditorProject` |
| Local component state | No | Render progress, selection, playhead |

- Project mutations go through pure domain commands. The store never edits
  nested project data inline.
- Transient render and UI state stays local until a second consumer exists.
  A `renderStore` arrives with the Batch queue in module-7.

## 5. Errors

- Expected failures return `Result<T>` from `src/shared/errors/appError.ts`,
  never a thrown string.
- `AppErrorCode` gains a member only when a producer exists. Design §6.2 lists
  the full target set.
- Every user-facing message states the problem and the required action, in
  Korean. Code, identifiers, and comments are English.
- Raw SDK errors go into `cause`, never into the primary message.
- `AbortSignal` is required for rendering, analysis, model loading, and writing.

## 6. Naming and Files

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `SceneInspector.tsx` |
| Hooks | `use` + camelCase | `useProjectStore.ts` |
| Pure functions | camelCase | `moveBoundary()` |
| Constants | UPPER_SNAKE_CASE | `MIN_SCENE_MS` |
| Types | PascalCase | `EditorProject` |
| Feature folders | kebab-case | `editor/` |
| Unit tests | co-located `.test.ts(x)` | `timeline.test.ts` |
| Browser tests | `tests/e2e/*.spec.ts` | `editor-vertical-slice.spec.ts` |
| Media IDs | lowercase prefix + UUID | `media_<uuid>` |

## 7. Imports

Order, separated by blank lines:

1. External packages
2. Internal modules, deepest layer first (`domain`, then `shared`, then local)
3. Relative siblings
4. Styles

Type-only imports use `import type`.

## 8. TypeScript

- `strict` and `noUncheckedIndexedAccess` are on. Index access is narrowed or
  explicitly asserted with a comment.
- `any` requires a documented adapter-boundary reason. The current exception is
  the `renderMediaOnWeb` cast in `renderEditor.ts`, which narrows the SDK's
  schema-aware generic to the schema-free request shape.
- `unknown` is narrowed before use.
- Type checking runs through `tsc -b` in `npm run build`, across three project
  configs: `tsconfig.app.json` (src), `tsconfig.test.json` (architecture and
  browser tests), `tsconfig.node.json` (tool configs).

## 9. Dependencies

- All Remotion packages stay pinned to the exact same version. Current: `4.0.499`.
- New dependencies are installed with `--save-exact`.
- `zod` is pinned to the version `@remotion/media` already resolves, to avoid a
  duplicate install.
- No `.env`, secret, or runtime backend configuration.
- Lockfile is committed.

## 10. Comments

- Module or file level: `// Design Ref: §{section} — {decision rationale}`
- Critical logic: `// Plan SC: {success criteria being addressed}`
- A comment explains why, not what. Restating the code is noise.
- Scope notes are required where a file intentionally implements less than the
  Design describes, so the gap is visible instead of looking like an omission.

## 11. Verification Commands

```bash
npm test          # unit + architecture boundary tests
npm run build     # tsc -b across all three configs, then vite build
npx playwright test   # real Chrome, includes a real MP4 render
```

A change is done when all three pass. Linting is currently covered by
`tsc` strictness and the architecture test; ESLint has not been added because it
would duplicate those checks without a rule set the project needs yet.
