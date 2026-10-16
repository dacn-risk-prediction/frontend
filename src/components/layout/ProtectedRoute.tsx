import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthUser, ROLE_DEFAULT_REDIRECT } from "@/features/auth"
import type { UserRole } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation()
  const hasToken = Boolean(localStorage.getItem("access_token"))
  const { data: user, isLoading, isError } = useAuthUser()

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

  if (isError || !user || user.is_active === false) {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
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

