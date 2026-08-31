/**
 * TicketStatusBadge — color-coded chip component for ticket Status enum values.
 *
 * Color mapping:
 *   OPEN        → blue
 *   IN_PROGRESS → yellow
 *   RESOLVED    → green
 *   CLOSED      → gray
 *   CANCELLED   → red
 */

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

interface TicketStatusBadgeProps {
  status: TicketStatus | string;
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700 ring-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 ring-yellow-300',
  RESOLVED: 'bg-green-100 text-green-700 ring-green-300',
  CLOSED: 'bg-gray-100 text-gray-600 ring-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 ring-red-300',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const FALLBACK_STYLES = 'bg-gray-100 text-gray-600 ring-gray-300';

function TicketStatusBadge({ status }: TicketStatusBadgeProps): React.ReactElement {
  const normalised = status as TicketStatus;
  const chipStyles = STATUS_STYLES[normalised] ?? FALLBACK_STYLES;
  const label = STATUS_LABELS[normalised] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${chipStyles}`}
    >
      {label}
    </span>
  );
}

export default TicketStatusBadge;
