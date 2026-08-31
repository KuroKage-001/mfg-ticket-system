/**
 * PaginationControls — prev/next navigation with a page indicator.
 *
 * Props:
 *   page         — current page (1-based)
 *   limit        — items per page
 *   total        — total number of items
 *   onPageChange — callback fired with the new page number
 */

interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

function PaginationControls({
  page,
  limit,
  total,
  onPageChange,
}: PaginationControlsProps): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  // Derive the "Showing X–Y of Z" range
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  const btnBase =
    'px-3 py-1.5 text-sm font-medium rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
  const btnEnabled =
    'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer';
  const btnDisabled =
    'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-1 text-sm text-gray-600">
      {/* Left — range indicator */}
      <span>
        {total === 0
          ? 'No results'
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </span>

      {/* Right — navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          className={`${btnBase} ${isFirst ? btnDisabled : btnEnabled}`}
          aria-label="Previous page"
        >
          Previous
        </button>

        <span className="px-2 text-gray-700 font-medium">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          className={`${btnBase} ${isLast ? btnDisabled : btnEnabled}`}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export { PaginationControls };
export default PaginationControls;
