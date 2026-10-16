export type UserRole = 'lecturer' | 'student';

export interface PaginationParams {
  skip?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface ApiError {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}

