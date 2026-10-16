import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { AuthUser, LoginCredentialsDTO, TokenResponseDTO } from "../types"

export const AUTH_QUERY_KEY = ["auth-user"] as const

export const getCurrentUser = async (): Promise<AuthUser> => {
  const response = await apiClient.get<AuthUser>("/users/me")
  const data = response.data
  return {
    ...data,
    full_name: data.name || data.full_name || data.email,
    is_active: data.is_active ?? true,
  }
}

export const loginWithPassword = async (
  data: LoginCredentialsDTO
): Promise<TokenResponseDTO> => {
  const response = await apiClient.post<TokenResponseDTO>("/auth/login", data)
  return response.data
}

export const useAuthUser = () => {
  const hasToken = Boolean(localStorage.getItem("access_token"))
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: loginWithPassword,
    onSuccess: async (tokens) => {
      localStorage.setItem("access_token", tokens.access_token)
      localStorage.setItem("refresh_token", tokens.refresh_token)
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  return () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    queryClient.setQueryData(AUTH_QUERY_KEY, null)
    queryClient.clear()
    window.location.href = "/login"
  }
}

