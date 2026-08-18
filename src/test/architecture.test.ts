// Plan NFR Maintainability — "architecture test 및 import boundary 검사".
// Design Ref: §9.2 Dependency Direction and §9.4 Import Rules.
import {readFile, readdir} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

type Layer =
  | 'app'
  | 'compositions'
  | 'domain'
  | 'features'
  | 'infrastructure'
  | 'shared'
  | 'test';

const SRC_ROOT = resolve(import.meta.dirname, '..');

/** Layers a file in the key layer is allowed to depend on. */
const ALLOWED_LAYERS: Record<Layer, Layer[]> = {
  app: ['app', 'compositions', 'domain', 'features', 'infrastructure', 'shared'],
  // The renderer adapter mounts the composition, so infrastructure may use it.
  compositions: ['compositions', 'domain', 'shared'],
  domain: ['domain', 'shared'],
  features: ['compositions', 'domain', 'features', 'shared'],
  infrastructure: ['compositions', 'domain', 'infrastructure', 'shared'],
  shared: ['shared'],
  test: ['app', 'compositions', 'domain', 'features', 'infrastructure', 'shared', 'test'],
};

/** External packages a layer must never import. */
const FORBIDDEN_PACKAGES: Partial<Record<Layer, RegExp[]>> = {
  domain: [/^react/, /^remotion/, /^@remotion\//, /^zustand/],
  shared: [/^react/, /^remotion/, /^@remotion\//, /^zustand/],
  compositions: [/^zustand/],
};

const layerOf = (relativePath: string): Layer | null => {
  const [top] = relativePath.split('/');

  return top && top in ALLOWED_LAYERS ? (top as Layer) : null;
};

const listSourceFiles = async () => {
  const entries = await readdir(SRC_ROOT, {recursive: true});

  return entries
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .map((entry) => entry.replaceAll('\\', '/'));
};

const IMPORT_PATTERN = /(?:from|import)\s+'([^']+)'/g;

const importsOf = async (relativePath: string) => {
  const contents = await readFile(join(SRC_ROOT, relativePath), 'utf8');

  return [...contents.matchAll(IMPORT_PATTERN)].map(
    (match) => match[1] as string,
  );
};

const featureOf = (relativePath: string) => relativePath.split('/')[1] ?? '';

describe('import boundaries', () => {
  it('finds source files to inspect', async () => {
    expect((await listSourceFiles()).length).toBeGreaterThan(10);
  });

  it('never lets a layer depend on a layer above it', async () => {
    const violations: string[] = [];

    for (const file of await listSourceFiles()) {
      const layer = layerOf(file);

      if (!layer) {
        continue;
      }

      for (const specifier of await importsOf(file)) {
        if (!specifier.startsWith('.')) {
          continue;
        }

        const target = relative(
          SRC_ROOT,
          resolve(SRC_ROOT, dirname(file), specifier),
        ).replaceAll('\\', '/');
        const targetLayer = layerOf(target);

        if (targetLayer && !ALLOWED_LAYERS[layer].includes(targetLayer)) {
          violations.push(`${file} -> ${target} (${layer} may not use ${targetLayer})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the domain and shared layers free of UI and SDK packages', async () => {
    const violations: string[] = [];

    for (const file of await listSourceFiles()) {
      const layer = layerOf(file);
      const forbidden = layer ? FORBIDDEN_PACKAGES[layer] : undefined;

      if (!forbidden) {
        continue;
      }

      for (const specifier of await importsOf(file)) {
        if (specifier.startsWith('.')) {
          continue;
        }

        if (forbidden.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('never lets a feature reach into another feature', async () => {
    const violations: string[] = [];

    for (const file of await listSourceFiles()) {
      if (layerOf(file) !== 'features') {
        continue;
      }

      for (const specifier of await importsOf(file)) {
        if (!specifier.startsWith('.')) {
          continue;
        }

        const target = relative(
          SRC_ROOT,
          resolve(SRC_ROOT, dirname(file), specifier),
        ).replaceAll('\\', '/');

        if (layerOf(target) === 'features' && featureOf(target) !== featureOf(file)) {
          violations.push(`${file} -> ${target}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  /**
   * Day1 render speed — every render path has to go through the panel proxies.
   *
   * This exists because one of them did not. The proxies were wired into the
   * batch queue, the single render button built its own snapshot straight from
   * the project, and the optimisation deployed and did nothing with no error to
   * show for it. A third render path would have made the same mistake, so the
   * rule is checked here instead of trusted: a snapshot built for a render is
   * built from a prepared project, never from the raw one.
   */
  it('builds every render snapshot from a prepared project', async () => {
    const pattern = /buildEditorSnapshot\(\s*\{?\s*(?:\.\.\.)?([A-Za-z.]+)/g;
    const violations: string[] = [];

    for (const file of await listSourceFiles()) {
      if (layerOf(file) !== 'features') {
        continue;
      }

      const contents = await readFile(join(SRC_ROOT, file), 'utf8');

      for (const match of contents.matchAll(pattern)) {
        if (match[1] !== 'prepared.project') {
          violations.push(`${file} -> buildEditorSnapshot(${match[1]})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
