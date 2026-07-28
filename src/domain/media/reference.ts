// Design Ref: §3.1 MediaReference and §3.6 Persistence — a reference is the
// persistable description of a local file. It never carries the bytes or the
// session-only object URL, so a project document stays portable metadata.
import {z} from 'zod';

export const mediaKindSchema = z.enum(['video', 'image', 'audio']);

export const mediaStatusSchema = z.enum([
  'available',
  'permission-required',
  'missing',
  'unsupported',
]);

export const mediaReferenceSchema = z.object({
  id: z.string().min(1),
  kind: mediaKindSchema,
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  lastModified: z.number().int().nonnegative(),
  /** Absent for still images. */
  durationMs: z.number().positive().optional(),
  /** Absent for audio-only references. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Content-derived identity used to relink a moved or renamed file. */
  fingerprint: z.string().min(1),
  status: mediaStatusSchema,
});

export type MediaKind = z.infer<typeof mediaKindSchema>;
export type MediaStatus = z.infer<typeof mediaStatusSchema>;
export type MediaReference = z.infer<typeof mediaReferenceSchema>;

/**
 * A reference plus the object URL that makes it playable in this session.
 * Only the reference half is ever persisted. Design Ref: §3.6.
 */
export interface ResolvedMedia {
  reference: MediaReference;
  url: string;
}

export const withStatus = (
  reference: MediaReference,
  status: MediaStatus,
): MediaReference => ({...reference, status});
