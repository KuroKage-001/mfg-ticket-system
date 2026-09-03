/**
 * exportImage — captures a DOM element as a PNG or JPEG download.
 *
 * ROOT CAUSE OF THE oklch ERROR:
 * html2canvas v1 parses CSS from every <style> / <link> tag it finds in the
 * cloned document.  Tailwind CSS v4 emits ALL colors as oklch() — a color
 * space that html2canvas v1 simply does not understand.  The `onclone`
 * callback fires only after the clone is built but BEFORE html2canvas walks
 * the styles, so we can safely strip every external stylesheet from the clone
 * and replace it with a tiny override that uses only safe rgb/hex values.
 *
 * STRATEGY:
 *  1. Before calling html2canvas, read getComputedStyle() on every element of
 *     the LIVE tree (the browser resolves oklch natively here) and cache the
 *     key color / background values as rgb() strings.
 *  2. In `onclone`, remove ALL <link rel="stylesheet"> and <style> tags from
 *     the cloned document's <head> so html2canvas never sees an oklch value
 *     in a stylesheet.
 *  3. Write the cached rgb() values as inline styles on the corresponding
 *     clone nodes so the visual output is still correct.
 */

import html2canvas from 'html2canvas';

// The CSS properties we snapshot from the live tree and replay on the clone.
const SNAPSHOT_PROPS: readonly string[] = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
];

type ColorSnapshot = Map<HTMLElement, Record<string, string>>;

/**
 * Walk the live DOM tree rooted at `root` and record the computed values of
 * every property in SNAPSHOT_PROPS for each element.  The browser resolves
 * oklch here just fine — we capture the resulting rgb() strings.
 */
function snapshotColors(root: HTMLElement): ColorSnapshot {
  const snapshot: ColorSnapshot = new Map();
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const node of nodes) {
    const computed = window.getComputedStyle(node);
    const entry: Record<string, string> = {};
    for (const prop of SNAPSHOT_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value && value !== 'none' && value !== '') {
        entry[prop] = value;
      }
    }
    snapshot.set(node, entry);
  }
  return snapshot;
}

/**
 * Inside the cloned document:
 *  - Remove every <link> and <style> tag so no oklch-containing stylesheet
 *    survives into html2canvas's CSS parser.
 *  - Replay the snapshot of rgb() values as inline styles on each element
 *    so the visual result is preserved.
 */
function applySnapshotToClone(
  cloneDoc: Document,
  liveRoot: HTMLElement,
  cloneRoot: HTMLElement,
  snapshot: ColorSnapshot,
): void {
  // 1. Nuke all stylesheets from the clone's <head>
  const head = cloneDoc.head;
  head.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());

  // 2. Inject a minimal safe baseline (white bg, black text, reset borders)
  const base = cloneDoc.createElement('style');
  base.textContent = `
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body { background: #fff; color: #111; }
  `;
  head.appendChild(base);

  // 3. Replay snapshotted colors as inline styles on clone nodes
  const liveNodes  = [liveRoot,  ...Array.from(liveRoot.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>('*'))];

  for (let i = 0; i < liveNodes.length; i++) {
    const liveNode  = liveNodes[i];
    const cloneNode = cloneNodes[i];
    if (!liveNode || !cloneNode) continue;

    const entry = snapshot.get(liveNode);
    if (!entry) continue;

    for (const [prop, value] of Object.entries(entry)) {
      cloneNode.style.setProperty(prop, value);
    }
  }
}

/**
 * Export `element` as a PNG or JPEG file download.
 *
 * @param element  - The live DOM element to capture.
 * @param format   - `'png'` or `'jpeg'`.
 * @param filename - Download filename including extension.
 */
export async function exportImage(
  element: HTMLElement,
  format: 'png' | 'jpeg',
  filename: string,
): Promise<void> {
  // Snapshot computed colors BEFORE cloning (live tree, browser-resolved).
  const snapshot = snapshotColors(element);

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc, clonedElement) => {
      applySnapshotToClone(clonedDoc, element, clonedElement, snapshot);
    },
  });

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    `image/${format}`,
    0.95,
  );
}
