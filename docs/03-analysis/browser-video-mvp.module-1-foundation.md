# Browser Video MVP Module 1 Foundation

> **Feature**: browser-video-mvp
> **Scope**: `module-1`
> **Date**: 2026-07-28
> **Status**: Completed at the agreed pragmatic scope

## Why This Ran Late

Module 1 was originally only scaffolded to the minimum that Module 2 needed.
Module 3 (persistence) requires a validated project schema and a subscribable
store, so the foundation was completed before starting it rather than growing it
implicitly inside module-3.

## Agreed Scope

The user selected a pragmatic scope over the literal Design §11.3 wording,
because building schemas and ports for unimplemented modules would violate
`CLAUDE.md` §2 "nothing speculative". The rule applied: **only build what has a
consumer today or an immediate consumer in module-3.**

| Design §11.3 item | Delivered | Note |
|---|---|---|
| Conventions | ✅ `docs/01-plan/conventions.md` | Enforceable version of Design §10 |
| Domain schema | ✅ module-3a data model | Locale copy, audio mix, Hook analysis, CTA assets join with their modules |
| Stores | ✅ `projectStore` only | `renderStore` lands with the module-7 Batch queue; UI state stays local |
| Fake ports | ⏸️ Deferred | Ports declared and typed against real adapters. Fakes need a component-test layer that does not exist; the browser E2E covers those paths more strongly today |
| Unit tests | ✅ 67 tests total | Was 49 |

## Delivered

### Typed data model

| File | Purpose |
|------|---------|
| `src/domain/editor/constants.ts` | Invariant numbers shared by the schema and the commands |
| `src/domain/editor/schema.ts` | Zod schemas, inferred types, cross-field invariants |
| `src/domain/editor/types.ts` | Public barrel: constants, inferred data types, render-contract types |

`editorProjectSchema` validates more than field shapes. It rejects a reordered
scene list, scene durations that do not total the preset, a scene under one
second, a transform outside the supported range, and a trim window that leaves
the source. `parseProject()` converts a failure into a typed `PROJECT_INVALID`
error carrying the exact issue paths, which is what module-3 needs for stored
and imported documents.

Project data now carries `schemaVersion: 1`.

### Typed errors

`src/shared/errors/appError.ts` implements Design §6.1: `code`, Korean message,
`details`, `action`, `retryable`, `cause`, plus a `Result<T>` helper. Only codes
with a producer today are in the union. `probeVideoFile` was migrated from its
local error type to `AppError`.

### Ports and adapters

| File | Purpose |
|------|---------|
| `src/domain/ports/index.ts` | `MediaResolver`, `VideoRenderer` contracts |
| `src/infrastructure/media/browserMediaResolver.ts` | File API implementation |
| `src/infrastructure/render/browserVideoRenderer.ts` | Remotion Web Renderer implementation |

`EditorWorkspace` now receives both ports as props and no longer imports
`@remotion/web-renderer` or the File API path directly. `src/app/App.tsx` is the
only module that selects adapters. This is what makes the Remotion license
contingency a single-file swap rather than an editor rewrite.

Render configuration and output naming moved to the domain
(`src/domain/render/types.ts`, `src/domain/render/fileName.ts`) so the editor no
longer imports infrastructure for pure logic.

### Store

`src/features/editor/projectStore.ts` (Zustand) owns the project and delegates
every mutation to a pure domain command. `applySource` returns the replaced
object URL so the caller releases it, which keeps the media lifecycle explicit
instead of hidden inside the store.

### Enforced boundaries

`src/test/architecture.test.ts` walks `src/`, resolves every relative import,
and fails the build on a layer violation, a forbidden package in `domain` or
`shared`, or a cross-feature import.

It found one real pre-existing violation on its first run:
`compositions/RenderPocComposition.tsx` imported its own props type from
`infrastructure/render/types`. The type moved to the composition and
infrastructure now imports it, reversing the dependency to the allowed
direction.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Unit + architecture | `npm test` | 10 files, 67 tests passed |
| Type + build | `npm run build` | Passed across three tsconfig projects |
| Browser E2E | `npx playwright test` | 3 passed, including a real 1080p60 MP4 render |

Module 2 and module 3a behavior is unchanged; the E2E that renders and ffprobes
a real MP4 still passes after the store and port refactor.

## Dependencies Added

| Package | Version | Reason |
|---------|---------|--------|
| `zod` | `4.4.3` exact | Runtime schema. Pinned to the version `@remotion/media` already resolves, to avoid a duplicate install |
| `zustand` | `5.0.9` exact | Confirmed store choice, Design §2.3 |
| `@types/node` | `25.5.1` exact, dev | The architecture and E2E tests use node builtins |

All Remotion packages remain at exactly `4.0.499`.

## Deliberately Not Done

- **ESLint / Prettier.** Plan §8.1 lists them. `tsc` strictness plus the
  architecture test already cover the rules the project actually has, so adding
  a linter now would be configuration without a failing case. Recorded in
  `conventions.md` §11 so the decision is visible rather than forgotten.
- **Fake port implementations.** No consumer. A component-test layer would be
  needed first, and the browser E2E already exercises those paths in real Chrome.
- **`renderStore` and `uiStore`.** Single consumer each today.
- **Schemas and ports for unimplemented modules.** They arrive with their module.

## Residual Risks

1. The schema covers the module-3a model only. Extending it in module-4 and
   module-6 will require a `schemaVersion` bump and a migration path for any
   documents already stored by module-3.
2. `AppError` is adopted in the media path. The render path in `EditorWorkspace`
   still formats a raw error message; it moves to `AppError` when the renderer
   port starts returning typed failures in module-7.
3. The architecture test parses imports with a regex. It is sufficient for the
   current single-quote import style enforced by the codebase, but it would miss
   a dynamic `import()` or a double-quoted specifier.
