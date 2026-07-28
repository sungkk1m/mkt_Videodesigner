// Design Ref: §4.1 MediaResolver — browser implementation backed by the File API.
import type {MediaResolver} from '../../domain/ports';
import {probeAudioFile, probeImageFile, probeVideoFile} from './probeMedia';

export const browserMediaResolver: MediaResolver = {
  probe: (file) => probeVideoFile(file),
  probeImage: (file) => probeImageFile(file),
  probeAudio: (file) => probeAudioFile(file),
  release: (url) => URL.revokeObjectURL(url),
};
