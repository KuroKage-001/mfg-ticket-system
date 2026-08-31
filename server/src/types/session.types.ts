// Re-export Role type for use in session
import type { Role } from "./user.types";

export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
}

export interface SessionData {
  user?: SessionUser;
}
