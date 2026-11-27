import { createBrowserRouter, Link, Navigate, RouterProvider } from "react-router-dom"
import { ProtectedRoute, GuestRoute } from "@/components/layout/ProtectedRoute"
import { StudentLayout } from "@/components/layout/StudentLayout"
import { LecturerLayout } from "@/components/layout/LecturerLayout"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { LoginForm, useAuthUser, ROLE_DEFAULT_REDIRECT } from "@/features/auth"
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminSemestersPage,
  AdminAcademicsPage,
} from "@/features/admin"
import {
  StudentOverviewPage,
  StudentAcademicRecordPage,
  StudentWhatIfPage,
  StudentSimulationPage,
  StudentAdvisingPage,
  StudentSettingsPage,
} from "@/features/students"
import {
  LecturerDashboardPage,
  LecturerClassesPage,
  LecturerInterventionsPage,
  LecturerSettingsPage,
} from "@/features/lecturers"

const RootRedirect = () => {
  const { data: user, isLoading } = useAuthUser()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_DEFAULT_REDIRECT[user.role]} replace />
}

const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    element: <GuestRoute />,
    children: [
      {
        path: "/login",
        element: <LoginForm />,
      },
    ],
  },
  // Admin Role Routes
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/admin/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <AdminDashboardPage />,
          },
          {
            path: "users",
            element: <AdminUsersPage />,
          },
          {
            path: "semesters",
            element: <AdminSemestersPage />,
          },
          {
            path: "academics",
            element: <AdminAcademicsPage />,
          },
        ],
      },
    ],
  },
  // Lecturer Role Routes
  {
    path: "/lecturer",
    element: <ProtectedRoute allowedRoles={["lecturer"]} />,
    children: [
      {
        element: <LecturerLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/lecturer/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <LecturerDashboardPage />,
          },
          {
            path: "classes",
            element: <LecturerClassesPage />,
          },
          {
            path: "alerts",
            element: <LecturerInterventionsPage />,
          },
          {
            path: "settings",
            element: <LecturerSettingsPage />,
          },
        ],
      },
    ],
  },
  // Student Role Routes
  {
    path: "/student",
    element: <ProtectedRoute allowedRoles={["student"]} />,
    children: [
      {
        element: <StudentLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/student/overview" replace />,
          },
          {
            path: "overview",
            element: <StudentOverviewPage />,
          },
          {
            path: "record",
            element: <StudentAcademicRecordPage />,
          },
          {
            path: "what-if",
            element: <StudentWhatIfPage />,
          },
          {
            path: "simulation",
            element: <StudentSimulationPage />,
          },
          {
            path: "prediction",
            element: <StudentSimulationPage />,
          },
          {
            path: "advising",
            element: <StudentAdvisingPage />,
          },
          {
            path: "alerts",
            element: <Navigate to="/student/advising" replace />,
          },
          {
            path: "settings",
            element: <StudentSettingsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/403",
    element: (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
            <span className="font-heading text-xl font-extrabold tabular-nums">403</span>
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900">
            Không có quyền truy cập
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Tài khoản của bạn không có quyền truy cập vào khu vực hoặc tài nguyên học vụ này.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-brand-blue-hover"
            >
              Quay về Cổng chính
            </Link>
          </div>
        </div>
      </main>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
])

export function AppRouter() {
  return <RouterProvider router={appRouter} />
}
