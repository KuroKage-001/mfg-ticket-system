/**
 * ActivityFeed — ordered list of TicketActivity records.
 *
 * Renders action label, actor name, old → new value (where applicable),
 * and a formatted timestamp for each entry.
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

type ActivityAction =
  | 'TICKET_CREATED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNMENT_CHANGED'
  | 'FIELD_UPDATED'
  | 'COMMENT_ADDED';

const ACTION_LABELS: Record<ActivityAction, string> = {
  TICKET_CREATED: 'Ticket Created',
  STATUS_CHANGED: 'Status Changed',
  PRIORITY_CHANGED: 'Priority Changed',
  ASSIGNMENT_CHANGED: 'Assignment Changed',
  FIELD_UPDATED: 'Field Updated',
  COMMENT_ADDED: 'Comment Added',
};

function formatAction(action: string): string {
  return ACTION_LABELS[action as ActivityAction] ?? action.replace(/_/g, ' ');
}

interface ActivityFeedProps {
  activities: TicketActivityWithActor[];
}

function ActivityFeed({ activities }: ActivityFeedProps): React.ReactElement {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-4">No activity yet.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {activities.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          {/* Timeline dot */}
          <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-gray-400 ring-2 ring-white" />

          <div className="flex-1 min-w-0">
            {/* Action + actor */}
            <p className="text-gray-800">
              <span className="font-medium">{formatAction(entry.action)}</span>
              {' by '}
              <span className="font-medium">{entry.actor.fullName}</span>
            </p>

            {/* Old → new values (skip old value for TICKET_CREATED) */}
            {entry.newValue !== null && (
              <p className="text-gray-600 mt-0.5">
                {entry.action !== 'TICKET_CREATED' && entry.oldValue !== null ? (
                  <>
                    <span className="line-through text-gray-400">
                      {entry.oldValue}
                    </span>
                    {' → '}
                  </>
                ) : null}
                <span>{entry.newValue}</span>
              </p>
            )}

            {/* Timestamp */}
            <time
              dateTime={entry.createdAt}
              className="block text-xs text-gray-400 mt-0.5"
            >
              {new Date(entry.createdAt).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export { ActivityFeed };
export default ActivityFeed;
