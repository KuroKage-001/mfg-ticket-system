/**
 * exportImage — captures a DOM element as a PNG or JPEG download.
 *
 * Uses html2canvas-pro (a fork of html2canvas v1 that adds support for
 * oklch() and oklab() color functions used by Tailwind CSS v4).
 *
 * SCROLLABLE CONTENT:
 * html2canvas only captures the visible portion of overflow-hidden/scroll
 * containers. Before capturing we temporarily remove max-height and overflow
 * constraints from all descendant elements so the full content renders, then
 * restore them immediately after.
 */

import html2canvas from 'html2canvas-pro';

interface OverflowSnapshot {
  el: HTMLElement;
  maxHeight: string;
  overflow: string;
  overflowY: string;
}

/** Remove scroll/clip constraints from all descendants, return a restore fn. */
function expandScrollableChildren(root: HTMLElement): () => void {
  const snapshots: OverflowSnapshot[] = [];

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const node of nodes) {
    const style = node.style;
    const computed = window.getComputedStyle(node);

    const hasMaxHeight =
      style.maxHeight !== '' ||
      (computed.maxHeight !== 'none' && computed.maxHeight !== '');
    const hasOverflowScroll =
      computed.overflow === 'auto' ||
      computed.overflow === 'scroll' ||
      computed.overflowY === 'auto' ||
      computed.overflowY === 'scroll';

    if (hasMaxHeight || hasOverflowScroll) {
      snapshots.push({
        el: node,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        overflowY: style.overflowY,
      });
      style.maxHeight = 'none';
      style.overflow  = 'visible';
      style.overflowY = 'visible';
    }
  }

  return () => {
    for (const { el, maxHeight, overflow, overflowY } of snapshots) {
      el.style.maxHeight = maxHeight;
      el.style.overflow  = overflow;
      el.style.overflowY = overflowY;
    }
  };
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
  // Expand all scrollable/clipped children so full content is captured.
  const restore = expandScrollableChildren(element);

  try {
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
  } finally {
    // Always restore original styles, even if html2canvas throws.
    restore();
  }
}
