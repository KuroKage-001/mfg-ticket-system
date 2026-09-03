/**
 * exportImage — captures a DOM element as a PNG or JPEG download.
 *
 * WHY THE EXTRA WORK:
 * html2canvas v1 cannot parse `oklch()` color values, but Tailwind CSS v4
 * compiles all its colors to `oklch()` in the stylesheet bundle.  When
 * html2canvas clones the document the Tailwind <style> tags come with it, so
 * `getComputedStyle` inside the clone still resolves to `oklch()` and the
 * library crashes.
 *
 * THE FIX:
 * Before handing the element to html2canvas we walk every descendant of the
 * *live* element (where the browser's own color engine can resolve oklch just
 * fine) and inline the key color/background/border properties as explicit
 * `rgb(a)` strings directly on the clone's matching nodes.  html2canvas then
 * reads those inline values instead of recomputing from the stylesheet.
 */

import html2canvas from 'html2canvas';

// CSS properties whose computed values may contain oklch and must be inlined.
const COLOR_PROPS = [
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'box-shadow',
  'caret-color',
  'column-rule-color',
] as const;

/**
 * Read computed color properties from every element in `liveRoot`, then write
 * them as inline styles on the corresponding element in `cloneRoot`.
 *
 * Both trees must have the same structure (as guaranteed by html2canvas's own
 * `onclone` callback, which receives the cloned document element that
 * corresponds to the target element).
 */
function inlineComputedColors(
  liveRoot: HTMLElement,
  cloneRoot: HTMLElement,
): void {
  const liveNodes  = [liveRoot,  ...Array.from(liveRoot.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>('*'))];

  for (let i = 0; i < liveNodes.length; i++) {
    const live  = liveNodes[i];
    const clone = cloneNodes[i];
    if (!live || !clone) continue;

    const computed = window.getComputedStyle(live);

    for (const prop of COLOR_PROPS) {
      const value = computed.getPropertyValue(prop);
      // Only bother writing the value if it looks like a color (non-empty,
      // not "none", not "transparent" — those are all safe for html2canvas).
      if (value && value !== 'none' && value !== '') {
        (clone as HTMLElement).style.setProperty(prop, value);
      }
    }
  }
}

/**
 * Export `element` as a PNG or JPEG file download.
 *
 * @param element  - The live DOM element to capture.
 * @param format   - `'png'` or `'jpeg'`.
 * @param filename - Download filename including extension, e.g. `'chart-2026.png'`.
 */
export async function exportImage(
  element: HTMLElement,
  format: 'png' | 'jpeg',
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (_clonedDoc, clonedElement) => {
      // Inline all computed colors from the live tree onto the clone so that
      // html2canvas never has to call getComputedStyle on oklch values itself.
      inlineComputedColors(element, clonedElement);
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
