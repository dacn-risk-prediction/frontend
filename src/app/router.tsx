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
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-background p-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
          <span className="text-2xl font-black">403</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You do not have the required permissions to access this institutional resource.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow hover:bg-brand-blue-hover transition-colors"
        >
          Return to Portal
        </Link>
      </div>
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
