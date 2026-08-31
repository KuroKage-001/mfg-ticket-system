export type Role = "ADMIN" | "EMPLOYEE";

export interface SafeUser {
  id: number;
  employeeId: string | null;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  employeeId?: string;
  fullName: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

export interface UpdateUserDto {
  employeeId?: string | null;
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}
