import type { SafeUser } from "./user.types";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type ContactMethod = "EMAIL" | "PHONE" | "TEAMS";
export type ManufacturingSite = "ADCV" | "ADGT" | "ADPG" | "ADTH";

export const VALID_CONTACT_METHODS: ContactMethod[] = ["EMAIL", "PHONE", "TEAMS"];
export const VALID_MANUFACTURING_SITES: ManufacturingSite[] = ["ADCV", "ADGT", "ADPG", "ADTH"];
export type TicketCategory =
  | "Hardware"
  | "Software"
  | "Network"
  | "Access Request"
  | "Account Issue"
  | "Other";

export const VALID_CATEGORIES: TicketCategory[] = [
  "Hardware",
  "Software",
  "Network",
  "Access Request",
  "Account Issue",
  "Other",
];

export interface CreateTicketDto {
  title: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  assignedToId?: number;
  usedKnowledgeBase?: boolean;
  contactMethod?: ContactMethod;
  manufacturingSite?: ManufacturingSite;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: Priority;
}

export interface TicketListQuery {
  page?: number;
  limit?: number;
  status?: Status;
  priority?: Priority;
  search?: string;
  assignedToId?: number;
  createdById?: number;
  /** When true, filter tickets where assignedToId IS NULL */
  unassigned?: boolean;
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  title: string;
  category: TicketCategory;
  priority: Priority;
  status: Status;
  usedKnowledgeBase: boolean;
  manufacturingSite: ManufacturingSite | null;
  createdById: number;
  assignedToId: number | null;
  assignedToName: string | null;
  resolvedById: number | null;
  resolvedByName: string | null;
  closedById: number | null;
  closedByName: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketComment {
  id: number;
  content: string;
  ticketId: number;
  authorId: number;
  author: Pick<SafeUser, "id" | "fullName" | "email">;
  createdAt: Date;
}

export interface TicketActivity {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  ticketId: number;
  actorId: number;
  actor: Pick<SafeUser, "id" | "fullName" | "email">;
  createdAt: Date;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  status: Status;
  usedKnowledgeBase: boolean;
  contactMethod: ContactMethod | null;
  manufacturingSite: ManufacturingSite | null;
  createdById: number;
  assignedToId: number | null;
  resolvedById: number | null;
  resolvedByName: string | null;
  closedById: number | null;
  closedByName: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Pick<SafeUser, "id" | "fullName" | "email">;
  assignedTo: Pick<SafeUser, "id" | "fullName" | "email"> | null;
  resolvedBy: Pick<SafeUser, "id" | "fullName" | "email"> | null;
  closedBy: Pick<SafeUser, "id" | "fullName" | "email"> | null;
  comments: TicketComment[];
  activities: TicketActivity[];
}

/**
 * Shape returned by DashboardService.getSummary().
 * Satisfies Requirements 11.1–11.5.
 */
export interface DashboardSummary {
  /** Count of tickets with status OPEN (Req 11.1) */
  open: number;
  /** Count of tickets with status IN_PROGRESS (Req 11.1) */
  inProgress: number;
  /** Count of tickets with status RESOLVED (Req 11.1) */
  resolved: number;
  /** Count of tickets with status CLOSED (Req 11.1) */
  closed: number;
  /** Count of tickets with status CANCELLED (Req 11.1) */
  cancelled: number;
  /** Count of URGENT priority tickets (Req 11.2) */
  urgent: number;
  /** Count of tickets with no assignee (Req 11.3) */
  unassigned: number;
  /** Count of tickets assigned to the requesting user (Req 11.4) */
  myAssigned: number;
  /** Up to 10 most recently created tickets (Req 11.5) */
  recentTickets: RecentTicket[];
}

/**
 * Minimal ticket shape used in the recentTickets array (Req 11.5).
 */
export interface RecentTicket {
  id: number;
  ticketNumber: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: Date;
}
