# Module 3 Evidence — Media and Persistence

> **Feature**: `browser-video-mvp`
> **Scope key**: `module-3`
> **PDCA phase**: Do
> **Date**: 2026-07-28
> **Status**: Implemented and verified

---

## 1. Scope Delivered

| Design Ref | Item | Result |
|-----------|------|--------|
| §3.1, §3.6 | `MediaReference` replaces the session-only `SourceMedia`; the object URL left the project document | Done |
| §3.6 | Content fingerprint (`sha256` over size + 256KB header) stored with every reference | Done |
| §4.1 | `ProjectRepository` port with an IndexedDB adapter (`projects` store) | Done |
| §3.6 | `file-handles` store for File System Access handles with permission re-request | Done |
| §2.2 | Debounced (800ms) autosave with `저장 중 / 저장됨 / 저장 실패` state | Done |
| §5.5 | Project menu: new, JSON export, JSON import, autosaved project list, delete | Done |
| §3.6 | Assisted relink with fingerprint / metadata / mismatch verdicts | Done |
| §6.2 | `AUTOSAVE_FAILED`, `MEDIA_MISSING`, `MEDIA_PERMISSION_REQUIRED` error codes | Done |
| §7 | Import validated by size limit, envelope kind, schema version, and schema | Done |

Explicitly out of scope and still owned by later modules: additional ratios, four-locale
copy, Hook analysis, TTS, audio mixing, and Batch rendering.

## 2. Architecture Notes

- The persisted project no longer contains anything session-scoped. `buildCompositionProps`
  now takes the resolved URL as an argument, so a document can round-trip through IndexedDB
  or JSON and still be schema-valid.
- `useMediaSession` is the single owner of object URLs. It revokes a replaced URL on adopt,
  revokes unreferenced URLs on `retain`, and revokes everything on unmount.
- `useEditorSource` owns every path from a `MediaReference` back to playable media: upload,
  file-picker upload with a stored handle, silent handle restore, permission grant, relink.
- Features never import infrastructure. `loadInitialProject` is injected by `src/app/App.tsx`,
  which is also where the repository and handle store are constructed.
- The project now carries `id`, `createdAt`, and `updatedAt`. `updatedAt` is stamped by
  `touchProject` at save time only, so editing commands stay pure and autosave cannot loop.

## 3. Verification

```bash
npm test                                                  # 91 passed (14 files)
npm run build                                             # tsc -b + vite build, clean
npx playwright test tests/e2e/editor-vertical-slice.spec.ts   # 2 passed
npx playwright test tests/e2e/persistence-recovery.spec.ts    # 3 passed
```

### New L1 suites

| File | Covers |
|------|--------|
| `src/domain/media/relink.test.ts` | fingerprint match, re-encode detection, mismatch reasons, best-candidate pick |
| `src/domain/editor/projectFile.test.ts` | round-trip, no binary payload, wrong kind, wrong version, malformed JSON, size limit, invariant failure |
| `src/infrastructure/persistence/projectRepository.test.ts` | save/load/list/delete, validation on read, newest-first ordering, quota failure surfaced as `AUTOSAVE_FAILED` |
| `src/infrastructure/media/fingerprint.test.ts` | stability, content sensitivity, size sensitivity |

### New L3 scenarios (`tests/e2e/persistence-recovery.spec.ts`)

1. Autosave → reload → project restored from IndexedDB → source reported missing →
   relink with the same file → exact match accepted, edit preserved, render re-enabled.
2. JSON export contains a fingerprint, no `blob:` URL, no base64, under the 1MB limit →
   new project → import restores the document with the source marked missing.
3. A JSON file that is not a project export is rejected with an actionable message.

## 4. Known Limitations

1. A file chosen through `<input type="file">` yields no `FileSystemFileHandle`, so reload
   always requires a relink for that path. The `파일 선택` button uses `showOpenFilePicker`
   and does persist a handle; that path restores silently when permission is still granted.
2. Chrome may drop handle permission between sessions. This surfaces as
   `permission-required` with an explicit grant button, never as a silent failure.
3. Only the single video source is persisted. CTA assets, BGM, and narration references
   join the same mechanism in modules 4 and 6.
