/**
 * exportImage — captures a DOM element as a PNG or JPEG download.
 *
 * Uses html2canvas-pro (a fork of html2canvas v1 that adds support for
 * oklch() and oklab() color functions).  This is necessary because Tailwind
 * CSS v4 emits all colors as oklch(), which the original html2canvas v1
 * cannot parse.
 */

import html2canvas from 'html2canvas-pro';

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
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
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
