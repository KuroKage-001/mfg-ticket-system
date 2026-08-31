/**
 * ActivityFeed — ordered list of TicketActivity records.
 *
 * Renders a human-readable description for every activity type,
 * resolving user IDs to names and mapping raw values to labels.
 */

/** Enriched activity shape — actor relation included by the API response. */
export interface TicketActivityWithActor {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  ticketId: number;
  actorId: number;
  actor: { id: number; fullName: string; email: string };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  OPEN:        'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
  CLOSED:      'Closed',
  CANCELLED:   'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW:    'Low',
  MEDIUM: 'Medium',
  HIGH:   'High',
  URGENT: 'Urgent',
};

// ---------------------------------------------------------------------------
// Dot colour per action
// ---------------------------------------------------------------------------

const DOT_CLASS: Record<string, string> = {
  TICKET_CREATED:    'bg-blue-400',
  STATUS_CHANGED:    'bg-indigo-400',
  PRIORITY_CHANGED:  'bg-amber-400',
  ASSIGNMENT_CHANGED:'bg-purple-400',
  COMMENT_ADDED:     'bg-emerald-400',
  FIELD_UPDATED:     'bg-gray-400',
};

// ---------------------------------------------------------------------------
// Human-readable description builder
// ---------------------------------------------------------------------------

function buildDescription(entry: TicketActivityWithActor): React.ReactElement {
  const actor = <span className="font-semibold text-gray-900">{entry.actor.fullName}</span>;
  const old = entry.oldValue;
  const next = entry.newValue;

  switch (entry.action) {

    case 'TICKET_CREATED':
      return (
        <span>
          {actor} created ticket{next ? <> <span className="font-mono text-xs text-gray-600">{next}</span></> : ''}
        </span>
      );

    case 'STATUS_CHANGED': {
      const oldLabel = old ? (STATUS_LABELS[old] ?? old) : null;
      const newLabel = next ? (STATUS_LABELS[next] ?? next) : '?';
      return (
        <span>
          {actor} changed status
          {oldLabel && (
            <> from <span className="font-medium text-gray-600">{oldLabel}</span></>
          )}
          {' '}to <span className="font-medium text-gray-800">{newLabel}</span>
        </span>
      );
    }

    case 'PRIORITY_CHANGED': {
      const oldLabel = old ? (PRIORITY_LABELS[old] ?? old) : null;
      const newLabel = next ? (PRIORITY_LABELS[next] ?? next) : '?';
      return (
        <span>
          {actor} changed priority
          {oldLabel && (
            <> from <span className="font-medium text-gray-600">{oldLabel}</span></>
          )}
          {' '}to <span className="font-medium text-gray-800">{newLabel}</span>
        </span>
      );
    }

    case 'ASSIGNMENT_CHANGED': {
      if (!next) {
        return <span>{actor} removed the assignee</span>;
      }
      if (!old) {
        return (
          <span>
            {actor} assigned the ticket to <span className="font-semibold text-gray-900">{next}</span>
          </span>
        );
      }
      return (
        <span>
          {actor} reassigned from <span className="font-medium text-gray-600">{old}</span>{' '}
          to <span className="font-semibold text-gray-900">{next}</span>
        </span>
      );
    }

    case 'COMMENT_ADDED':
      return <span>{actor} added a comment</span>;

    case 'FIELD_UPDATED':
      return (
        <span>
          {actor} updated a field
          {old !== null && next !== null && (
            <> from <span className="font-medium text-gray-600">{old}</span> to{' '}
            <span className="font-medium text-gray-800">{next}</span></>
          )}
        </span>
      );

    default:
      return (
        <span>
          {actor} — {entry.action.replace(/_/g, ' ').toLowerCase()}
          {next && <> · <span className="text-gray-700">{next}</span></>}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  activities: TicketActivityWithActor[];
}

function ActivityFeed({ activities }: ActivityFeedProps): React.ReactElement {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400 italic py-4">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" aria-hidden="true" />

      {activities.map((entry) => {
        const dotClass = DOT_CLASS[entry.action] ?? 'bg-gray-400';
        const dt = new Date(entry.createdAt);
        const dateLabel = dt.toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        });
        const timeLabel = dt.toLocaleTimeString(undefined, {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        return (
          <li key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
            {/* Timeline dot */}
            <span className={`relative z-10 mt-1 shrink-0 h-3.5 w-3.5 rounded-full ring-2 ring-white ${dotClass}`} aria-hidden="true" />

            <div className="flex-1 min-w-0 pt-0.5">
              {/* Description */}
              <p className="text-sm text-gray-700 leading-snug">
                {buildDescription(entry)}
              </p>

              {/* Timestamp */}
              <time
                dateTime={entry.createdAt}
                className="block text-xs text-gray-400 mt-1"
                title={dt.toISOString()}
              >
                {dateLabel} · {timeLabel}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { ActivityFeed };
export default ActivityFeed;
