export type ArticleCategory =
  "ACCESS" | "SOFTWARE" | "NETWORK" | "HARDWARE" | "SECURITY";
export type TicketCategory = ArticleCategory | "OTHER";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "OPEN" | "TRIAGE" | "IN_PROGRESS" | "RESOLVED";

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: ArticleCategory;
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  updated_at: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface TicketSummary {
  id: string;
  protocol: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: UserRef;
  assignee: UserRef | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketEvent {
  id: string;
  author_id: string;
  author: UserRef;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  comment: string | null;
  created_at: string;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  events: TicketEvent[];
}

export interface DashboardEmployeeSummary {
  account_locked: boolean;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
}

export interface DashboardTechnicianSummary {
  unassigned_tickets: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
}
