/**
 * TicketPriorityBadge — color-coded chip component for ticket Priority enum values.
 *
 * Color mapping:
 *   LOW    → gray
 *   MEDIUM → blue
 *   HIGH   → orange
 *   URGENT → red
 */

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketPriorityBadgeProps {
  priority: TicketPriority | string;
}

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600 ring-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 ring-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 ring-orange-300',
  URGENT: 'bg-red-100 text-red-700 ring-red-300',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const FALLBACK_STYLES = 'bg-gray-100 text-gray-600 ring-gray-300';

function TicketPriorityBadge({ priority }: TicketPriorityBadgeProps): React.ReactElement {
  const normalised = priority as TicketPriority;
  const chipStyles = PRIORITY_STYLES[normalised] ?? FALLBACK_STYLES;
  const label = PRIORITY_LABELS[normalised] ?? priority;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${chipStyles}`}
    >
      {label}
    </span>
  );
}

export default TicketPriorityBadge;
