import { useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthUser, ROLE_DEFAULT_REDIRECT } from "@/features/auth"
import type { UserRole } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation()
  const hasToken = Boolean(localStorage.getItem("access_token"))
  const { data: user, isLoading, isError, error, refetch } = useAuthUser()
  const isInactive = Boolean(user && user.is_active === false)

  useEffect(() => {
    if (isInactive) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
    }
  }, [isInactive])

  if (!hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    const status = getHttpStatus(error)
    if (status === 401 || status === 403) {
      return <Navigate to="/login" state={{ from: location }} replace />
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <h2 className="text-base font-bold text-slate-900">
          Không thể kết nối máy chủ xác thực
        </h2>
        <p className="max-w-sm text-xs text-slate-600">
          Vui lòng kiểm tra kết nối mạng hoặc thử tải lại phiên đăng nhập.
        </p>
        <Button
          size="sm"
          onClick={() => void refetch()}
          className="cursor-pointer bg-primary text-xs font-semibold text-primary-foreground hover:bg-brand-blue-hover"
        >
          Thử lại
        </Button>
      </div>
    )
  }

  if (!user || isInactive) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export const GuestRoute = () => {
  const hasToken = Boolean(localStorage.getItem("access_token"))
  const { data: user, isLoading } = useAuthUser()

  if (hasToken && isLoading) {
    return null
  }

  if (user) {
    return <Navigate to={ROLE_DEFAULT_REDIRECT[user.role]} replace />
  }

  return <Outlet />
}
