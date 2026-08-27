// kv-ai-designation P0 — measures the designation candidates in one page.
//
// Question (Plan §1.4, carried over from kv-object-animation): can a click turn
// into a usable object mask inside a static, no-server app — and what does that
// cost in bytes, in milliseconds, and in accuracy on illustration?
//
// Four candidates, same fixtures, same clicks:
//   A  MediaPipe InteractiveSegmenter (magic_touch)  — click → mask, on-device
//   B  flood fill from the click                      — no model at all
//   C  MediaPipe ObjectDetector (EfficientDet-Lite0)  — automatic candidate boxes
//   D  bright-region components                       — automatic, no model
// Plus the mask-storage question the schema decision hangs on (§D-A04).
import {
  FIXTURES,
  FIXTURE_HEIGHT,
  FIXTURE_WIDTH,
  drawArt,
  drawGroundTruth,
} from './fixtures.js';

const RUNTIME = './vendor/package/vision_bundle.mjs';
const WASM_DIR = './vendor/package/wasm';
const DETECTOR_MODEL = './models/efficientdet_lite0.tflite';

/**
 * Two generations of the same task, and the size gap between them is the whole
 * question: v1 is a 6.2MB tflite behind the deprecated `Legacy` class, v2 a
 * 30.5MB int8 bundle behind the current one. Both are pinned versioned paths on
 * MediaPipe's own storage.
 */
const SEGMENTERS = [
  {id: 'v1', api: 'InteractiveSegmenterLegacy', model: './models/magic_touch.tflite', bytes: 6227884},
  {id: 'v2', api: 'InteractiveSegmenter', model: './models/interactive_segmentation.task', bytes: 30525312},
];

// The enum is a TypeScript declaration; the shipped .mjs does not export it.
const BRUSH_POSITIVE = 1;
const BRUSH_NEGATIVE = 2;

const now = () => performance.now();
const round = (value, digits = 1) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

/* ---------------------------------------------------------------- mask maths */

const iou = (a, b) => {
  let inter = 0;
  let union = 0;

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];

    if (x | y) {
      union += 1;

      if (x & y) {
        inter += 1;
      }
    }
  }

  return union === 0 ? 0 : inter / union;
};

const area = (mask) => {
  let count = 0;

  for (let i = 0; i < mask.length; i += 1) {
    count += mask[i];
  }

  return count;
};

const boxOf = (mask, w, h) => {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  return x1 < 0
    ? null
    : {
        x: round(x0 / w, 3),
        y: round(y0 / h, 3),
        width: round((x1 - x0 + 1) / w, 3),
        height: round((y1 - y0 + 1) / h, 3),
      };
};

const boxIou = (a, b) => {
  if (!a || !b) {
    return 0;
  }

  const ix = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const iy = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const inter = ix * iy;
  const union = a.width * a.height + b.width * b.height - inter;

  return union <= 0 ? 0 : inter / union;
};

/** Nearest-neighbour box filter, so a downsample is majority-vote, not sampling. */
const downsample = (mask, w, h, factor) => {
  const dw = Math.round(w / factor);
  const dh = Math.round(h / factor);
  const out = new Uint8Array(dw * dh);

  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      let on = 0;
      let total = 0;

      for (let sy = y * factor; sy < Math.min(h, (y + 1) * factor); sy += 1) {
        for (let sx = x * factor; sx < Math.min(w, (x + 1) * factor); sx += 1) {
          on += mask[sy * w + sx];
          total += 1;
        }
      }

      out[y * dw + x] = on * 2 >= total ? 1 : 0;
    }
  }

  return {mask: out, width: dw, height: dh};
};

const upsample = (mask, w, h, factor, fullW, fullH) => {
  const out = new Uint8Array(fullW * fullH);

  for (let y = 0; y < fullH; y += 1) {
    const sy = Math.min(h - 1, Math.floor(y / factor));

    for (let x = 0; x < fullW; x += 1) {
      out[y * fullW + x] = mask[sy * w + Math.min(w - 1, Math.floor(x / factor))];
    }
  }

  return out;
};

/** Row-major run lengths, the compact form a JSON project could actually hold. */
const rleBytes = (mask) => {
  let runs = 0;
  let bytes = 0;
  let run = 0;
  let value = mask[0];

  const flush = () => {
    runs += 1;
    bytes += run < 128 ? 1 : run < 16384 ? 2 : 3;
  };

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === value) {
      run += 1;
    } else {
      flush();
      value = mask[i];
      run = 1;
    }
  }

  flush();

  return {runs, bytes};
};

const pngBytes = (mask, w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);

  for (let i = 0; i < mask.length; i += 1) {
    const on = mask[i] ? 255 : 0;
    image.data[i * 4] = on;
    image.data[i * 4 + 1] = on;
    image.data[i * 4 + 2] = on;
    image.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');

  return Math.round((url.length - url.indexOf(',') - 1) * 0.75);
};

/* ------------------------------------------------------- candidate B: no model */

/**
 * Region grow from the click on colour distance alone. The honest ceiling of
 * "no model": run several tolerances and keep the best IoU, because a product
 * would expose the tolerance as a slider.
 */
const floodFill = (pixels, w, h, click, tolerance) => {
  const start = (Math.round(click.y * (h - 1)) * w + Math.round(click.x * (w - 1))) | 0;
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const r0 = pixels[start * 4];
  const g0 = pixels[start * 4 + 1];
  const b0 = pixels[start * 4 + 2];
  let head = 0;
  let tail = 0;

  queue[tail += 1] = start;
  mask[start] = 1;

  while (head < tail) {
    const index = queue[head += 1];
    const x = index % w;
    const y = (index - x) / w;

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        continue;
      }

      const next = ny * w + nx;

      if (mask[next]) {
        continue;
      }

      const dr = pixels[next * 4] - r0;
      const dg = pixels[next * 4 + 1] - g0;
      const db = pixels[next * 4 + 2] - b0;

      if (dr * dr + dg * dg + db * db <= tolerance * tolerance) {
        mask[next] = 1;
        queue[tail += 1] = next;
      }
    }
  }

  return mask;
};

/* ------------------------------------------------- candidate D: bright regions */

/**
 * Light sources without a model: threshold luma, take connected components.
 * This is the candidate that exists because the effects this feature places
 * (embers, glow) go on things that emit light — which is a pixel property, not
 * a semantic class.
 */
const brightRegions = (pixels, w, h, factor) => {
  const dw = Math.floor(w / factor);
  const dh = Math.floor(h / factor);
  const luma = new Float32Array(dw * dh);
  let max = 0;

  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const source = (y * factor * w + x * factor) * 4;
      const value =
        (0.2126 * pixels[source] +
          0.7152 * pixels[source + 1] +
          0.0722 * pixels[source + 2]) /
        255;
      luma[y * dw + x] = value;
      max = Math.max(max, value);
    }
  }

  const threshold = Math.max(0.5, max * 0.7);
  const seen = new Uint8Array(dw * dh);
  const boxes = [];

  for (let i = 0; i < luma.length; i += 1) {
    if (seen[i] || luma[i] < threshold) {
      continue;
    }

    const stack = [i];
    seen[i] = 1;
    let x0 = dw;
    let y0 = dh;
    let x1 = -1;
    let y1 = -1;
    let count = 0;

    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % dw;
      const y = (index - x) / dw;
      count += 1;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) {
          continue;
        }

        const next = ny * dw + nx;

        if (!seen[next] && luma[next] >= threshold) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }

    if (count >= 12) {
      boxes.push({
        x: round(x0 / dw, 3),
        y: round(y0 / dh, 3),
        width: round((x1 - x0 + 1) / dw, 3),
        height: round((y1 - y0 + 1) / dh, 3),
        cells: count,
      });
    }
  }

  return {threshold: round(threshold, 3), boxes: boxes.sort((a, b) => b.cells - a.cells)};
};

/* -------------------------------------------------------------------- harness */

const segmentOnce = (segmenter, image, roi) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('segment timeout')), 30000);
    const settle = (result) => {
      clearTimeout(timer);
      resolve(result);
    };

    try {
      const returned = segmenter.segment(image, roi, settle);

      if (returned && returned.categoryMask) {
        settle(returned);
      }
    } catch {
      try {
        const returned = segmenter.segment(image, roi);

        if (returned) {
          settle(returned);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    }
  });

const environment = async () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  let webgpu = 'absent';

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      webgpu = adapter ? `adapter: ${adapter.info?.vendor ?? 'unknown'}` : 'no adapter';
    } catch (error) {
      webgpu = `error: ${error.message}`;
    }
  }

  return {
    crossOriginIsolated: self.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hardwareConcurrency: navigator.hardwareConcurrency,
    webgl2: Boolean(gl),
    webglRenderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
    webgpu,
  };
};

const run = async () => {
  const result = {environment: await environment(), fixtures: [], runtime: {}, notes: []};
  const vision = await import(RUNTIME);

  const filesetStart = now();
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_DIR);
  result.runtime.filesetMs = round(now() - filesetStart);

  const art = FIXTURES.map((fixture) => ({
    fixture,
    canvas: drawArt(fixture),
    truth: drawGroundTruth(fixture),
  }));

  for (const entry of art) {
    const ctx = entry.canvas.getContext('2d');
    entry.pixels = ctx.getImageData(0, 0, FIXTURE_WIDTH, FIXTURE_HEIGHT).data;
    entry.truthBox = boxOf(entry.truth, FIXTURE_WIDTH, FIXTURE_HEIGHT);
    window.__ART__ = window.__ART__ ?? {};
    window.__ART__[entry.fixture.name] = entry.canvas.toDataURL('image/png');
  }

  /* A — interactive segmentation: both generations, both delegates. */
  for (const spec of SEGMENTERS) {
    for (const delegate of ['CPU', 'GPU']) {
      const label = `segmenter${spec.id}${delegate}`;

      try {
        const createStart = now();
        const segmenter = await vision[spec.api].createFromOptions(fileset, {
          baseOptions: {modelAssetPath: spec.model, delegate},
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        result.runtime[`${label}CreateMs`] = round(now() - createStart);

        for (const entry of art) {
          const click = entry.fixture.click;
          const passes = [];
          let mask = null;
          let maskSize = null;

          // Three passes: the first pays for lazy graph setup, the rest are the
          // steady-state cost a click would actually feel. v2 splits that cost
          // in two — encoder per image, decoder per click — and the split is the
          // interesting number, because refinement clicks only pay the second.
          for (let pass = 0; pass < 3; pass += 1) {
            const start = now();
            let raw;
            let encodeMs = null;

            if (spec.api === 'InteractiveSegmenter') {
              segmenter.setImage(entry.canvas);
              encodeMs = round(now() - start);
              raw = segmenter.segment([
                {
                  brushMode: BRUSH_POSITIVE,
                  point: [click],
                  isCompleted: true,
                },
              ]);
            } else {
              const output = await segmentOnce(segmenter, entry.canvas, {
                keypoint: click,
              });
              raw = output.categoryMask;
              raw.__owner = output;
            }

            const mw = raw.width;
            const mh = raw.height;
            const binary = new Uint8Array(mw * mh);
            const clickIndex =
              Math.round(click.y * (mh - 1)) * mw + Math.round(click.x * (mw - 1));
            let values;
            let confidence = false;

            try {
              values = raw.getAsFloat32Array();
              confidence = true;
            } catch {
              values = raw.getAsUint8Array();
            }

            if (confidence) {
              // A probability field: the object is what beats the midpoint.
              for (let i = 0; i < binary.length; i += 1) {
                binary[i] = values[i] >= 0.5 ? 1 : 0;
              }

              // Fall back to the click's own polarity if the field is inverted.
              if (!binary[clickIndex]) {
                for (let i = 0; i < binary.length; i += 1) {
                  binary[i] = binary[i] ? 0 : 1;
                }
              }
            } else {
              // Polarity from the click itself: the pixel the operator pointed
              // at belongs to the object, whichever label the model gave it.
              const at = values[clickIndex];

              for (let i = 0; i < binary.length; i += 1) {
                binary[i] = values[i] === at ? 1 : 0;
              }
            }

            mask =
              mw === FIXTURE_WIDTH && mh === FIXTURE_HEIGHT
                ? binary
                : upsample(
                    binary,
                    mw,
                    mh,
                    FIXTURE_WIDTH / mw,
                    FIXTURE_WIDTH,
                    FIXTURE_HEIGHT,
                  );
            maskSize = `${mw}x${mh}`;
            passes.push({
              totalMs: round(now() - start),
              encodeMs,
              decodeMs: encodeMs === null ? null : round(now() - start - encodeMs),
              confidence,
            });

            if (raw.__owner) {
              raw.__owner.close();
            } else {
              raw.close();
            }
          }

          // Refinement: a second, negative click on an image already encoded.
          // Only v2 can answer this — v1 re-runs the whole model per click.
          let refineMs = null;

          if (spec.api === 'InteractiveSegmenter') {
            const start = now();
            const refined = segmenter.segment([
              {
                brushMode: BRUSH_POSITIVE,
                point: [click],
                isCompleted: true,
              },
              {
                brushMode: BRUSH_NEGATIVE,
                point: [{x: click.x + 0.2, y: click.y}],
                isCompleted: true,
              },
            ]);
            refineMs = round(now() - start);
            refined.close();
          }

          entry[label] = {
            firstMs: passes[0].totalMs,
            warmMs: round((passes[1].totalMs + passes[2].totalMs) / 2),
            warmEncodeMs: passes[2].encodeMs,
            warmDecodeMs: passes[2].decodeMs,
            refineMs,
            maskKind: passes[0].confidence ? 'confidence' : 'category',
            maskSize,
            iou: round(iou(mask, entry.truth), 3),
            coverage: round(area(mask) / mask.length, 4),
            box: boxOf(mask, FIXTURE_WIDTH, FIXTURE_HEIGHT),
          };

          // The storage question is asked of one mask; the CPU path of the
          // smaller model is the one a deployed app would most likely run.
          if (!entry.mask || (spec.id === 'v1' && delegate === 'CPU')) {
            entry.mask = mask;
            entry.maskFrom = label;
          }
        }

        segmenter.close();
      } catch (error) {
        result.runtime[`${label}Error`] = String(
          error && error.message ? error.message : error,
        );
      }
    }
  }


  /* C — automatic boxes from a COCO detector. */
  try {
    const createStart = now();
    const detector = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: {modelAssetPath: DETECTOR_MODEL, delegate: 'CPU'},
      scoreThreshold: 0.2,
      runningMode: 'IMAGE',
    });
    result.runtime.detectorCreateMs = round(now() - createStart);

    for (const entry of art) {
      const start = now();
      const found = detector.detect(entry.canvas);
      entry.detector = {
        ms: round(now() - start),
        detections: (found.detections ?? []).slice(0, 5).map((d) => ({
          label: d.categories?.[0]?.categoryName ?? null,
          score: round(d.categories?.[0]?.score ?? 0, 3),
          box: {
            x: round(d.boundingBox.originX / FIXTURE_WIDTH, 3),
            y: round(d.boundingBox.originY / FIXTURE_HEIGHT, 3),
            width: round(d.boundingBox.width / FIXTURE_WIDTH, 3),
            height: round(d.boundingBox.height / FIXTURE_HEIGHT, 3),
          },
        })),
      };
      entry.detector.bestBoxIou = round(
        Math.max(
          0,
          ...entry.detector.detections.map((d) => boxIou(d.box, entry.truthBox)),
        ),
        3,
      );
    }

    detector.close();
  } catch (error) {
    result.runtime.detectorError = String(error && error.message ? error.message : error);
  }

  /* B and D — the model-free candidates, and the storage question. */
  for (const entry of art) {
    const tolerances = [24, 40, 60, 90];
    const fills = tolerances.map((tolerance) => {
      const start = now();
      const mask = floodFill(
        entry.pixels,
        FIXTURE_WIDTH,
        FIXTURE_HEIGHT,
        entry.fixture.click,
        tolerance,
      );

      return {
        tolerance,
        ms: round(now() - start),
        iou: round(iou(mask, entry.truth), 3),
        coverage: round(area(mask) / mask.length, 4),
      };
    });
    entry.floodFill = {
      best: fills.reduce((a, b) => (b.iou > a.iou ? b : a)),
      all: fills,
    };

    const brightStart = now();
    const bright = brightRegions(entry.pixels, FIXTURE_WIDTH, FIXTURE_HEIGHT, 8);
    entry.bright = {
      ms: round(now() - brightStart),
      threshold: bright.threshold,
      count: bright.boxes.length,
      boxes: bright.boxes.slice(0, 3),
      bestBoxIou: round(
        Math.max(0, ...bright.boxes.map((box) => boxIou(box, entry.truthBox))),
        3,
      ),
    };

    if (entry.mask) {
      entry.storage = [1, 4, 8].map((factor) => {
        if (factor === 1) {
          return {
            factor,
            resolution: `${FIXTURE_WIDTH}x${FIXTURE_HEIGHT}`,
            iou: round(iou(entry.mask, entry.truth), 3),
            ...rleBytes(entry.mask),
            pngBytes: pngBytes(entry.mask, FIXTURE_WIDTH, FIXTURE_HEIGHT),
          };
        }

        const small = downsample(entry.mask, FIXTURE_WIDTH, FIXTURE_HEIGHT, factor);
        const back = upsample(
          small.mask,
          small.width,
          small.height,
          factor,
          FIXTURE_WIDTH,
          FIXTURE_HEIGHT,
        );

        return {
          factor,
          resolution: `${small.width}x${small.height}`,
          iou: round(iou(back, entry.truth), 3),
          roundTripIou: round(iou(back, entry.mask), 3),
          ...rleBytes(small.mask),
          pngBytes: pngBytes(small.mask, small.width, small.height),
        };
      });
    }

    result.fixtures.push({
      name: entry.fixture.name,
      note: entry.fixture.note,
      click: entry.fixture.click,
      truthBox: entry.truthBox,
      truthCoverage: round(area(entry.truth) / entry.truth.length, 4),
      segmenters: Object.fromEntries(
        SEGMENTERS.flatMap((spec) =>
          ['CPU', 'GPU'].map((delegate) => [
            `${spec.id}${delegate}`,
            entry[`segmenter${spec.id}${delegate}`] ?? null,
          ]),
        ),
      ),
      maskFrom: entry.maskFrom ?? null,
      floodFill: entry.floodFill,
      detector: entry.detector ?? null,
      bright: entry.bright,
      storage: entry.storage ?? null,
    });
  }

  return result;
};

run().then(
  (value) => {
    window.__RESULT__ = value;
  },
  (error) => {
    window.__RESULT__ = {fatal: String(error && error.stack ? error.stack : error)};
  },
);
