// Shared media fixture so every suite describes the same persisted reference.
import type {MediaReference} from '../../domain/editor/types';

export const testMediaReference = (
  overrides: Partial<MediaReference> = {},
): MediaReference => ({
  id: 'media_test',
  kind: 'video',
  name: 'gameplay.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 2048,
  lastModified: 1_700_000_000_000,
  durationMs: 30_000,
  width: 1920,
  height: 1080,
  fingerprint: 'sha256-test',
  status: 'available',
  ...overrides,
});

export const TEST_SOURCE_URL = 'blob:mock-url';

/** Resolver for `buildCompositionProps` that answers with one session URL. */
export const testUrlResolver =
  (url: string | null = TEST_SOURCE_URL) =>
  (reference: MediaReference | null | undefined) =>
    reference ? url : null;
