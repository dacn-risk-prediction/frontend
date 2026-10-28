import type { UserRole } from "@/types"

export interface AuthUser {
  id: string
  email: string
  name: string
  full_name?: string
  role: UserRole
  user_code?: string
  title?: string
  avatar_url?: string
  is_active?: boolean
}

export interface LoginCredentialsDTO {
  email: string
  password: string
}

export interface TokenResponseDTO {
  access_token: string
  refresh_token: string
  token_type: string
}

export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  lecturer: "/lecturer/dashboard",
  student: "/student/overview",
}

