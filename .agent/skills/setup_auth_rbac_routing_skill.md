---
name: setup-auth-rbac-routing
description: Implement authentication state management, role-based access control (RBAC) for admin, lecturer, and student roles, ProtectedRoute guards, and login/session flows in a React + Vite + TypeScript frontend integrated with FastAPI.
triggers:
  - "setup auth rbac routing"
  - "implement authentication and rbac"
  - "setup protected routes"
  - "run setup_auth_rbac_routing"
---

# Skill: Setup Auth & 3-Role RBAC Routing (`setup-auth-rbac-routing`)

## Purpose

Implement a complete authentication and Role-Based Access Control (RBAC) architecture supporting three distinct roles (`admin`, `lecturer`, `student`) following `alan2207/bulletproof-react` and `fastapi/full-stack-fastapi-template` conventions. This workflow connects directly to `src/lib/api-client.ts` (Dual-Token Axios client) and manages session state via TanStack Query.

## Pre-Execution Checks

1. Verify that `src/lib/api-client.ts` exists. If not, prompt or execute `setup-axios-dual-token` first.
2. Verify that `@tanstack/react-query`, `react-router-dom`, `react-hook-form`, `zod`, and `@hookform/resolvers` are installed.

## Step-by-Step Execution Workflow

### Step 1: Update Global & Auth Types (`src/types/index.ts` & `src/features/auth/types/index.ts`)

1. Ensure `UserRole` in `src/types/index.ts` includes all 3 roles:
   ```typescript
   export type UserRole = "admin" | "lecturer" | "student";
   ```

2. Create `src/features/auth/types/index.ts` matching FastAPI's Pydantic schemas and OAuth2 token response:
   ```typescript
   import { UserRole } from "@/types";

   export interface AuthUser {
     id: string;
     email: string;
     full_name: string;
     role: UserRole;
     is_active: boolean;
   }

   export interface LoginCredentialsDTO {
     username: string;
     password: string;
   }

   export interface TokenResponseDTO {
     access_token: string;
     refresh_token: string;
     token_type: string;
   }

   export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
     admin: "/admin/dashboard",
     lecturer: "/lecturer/classes",
     student: "/student/overview",
   };
   ```

### Step 2: Create Auth API & TanStack Query Hooks (`src/features/auth/api/auth-api.ts`)

Use `apiClient` from `@/lib/api-client` and TanStack Query (`['auth-user']` query key) to manage user session hydration, OAuth2 form-encoded login, and logout cleanup:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { AuthUser, LoginCredentialsDTO, TokenResponseDTO } from "../types";

export const AUTH_QUERY_KEY = ["auth-user"] as const;

export const getCurrentUser = async (): Promise<AuthUser> => {
  const response = await apiClient.get<AuthUser>("/auth/me");
  return response.data;
};

export const loginWithPassword = async (
  data: LoginCredentialsDTO
): Promise<TokenResponseDTO> => {
  // FastAPI OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
  const formData = new URLSearchParams();
  formData.append("username", data.username);
  formData.append("password", data.password);

  const response = await apiClient.post<TokenResponseDTO>("/auth/login", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
};

export const useAuthUser = () => {
  const hasToken = Boolean(localStorage.getItem("access_token"));
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginWithPassword,
    onSuccess: async (tokens) => {
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.clear();
    window.location.href = "/login";
  };
};
```

### Step 3: Build Role-Based Route Guards (`src/components/layout/ProtectedRoute.tsx`)

Create `ProtectedRoute` (Prevents redirect flicker during initial `/auth/me` fetch and validates `allowedRoles`) and `GuestRoute` (Redirects logged-in users to their role-specific home page):

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthUser, ROLE_DEFAULT_REDIRECT } from "@/features/auth";
import { UserRole } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();
  const hasToken = Boolean(localStorage.getItem("access_token"));
  const { data: user, isLoading, isError } = useAuthUser();

  if (!hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !user || !user.is_active) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
};

export const GuestRoute = () => {
  const hasToken = Boolean(localStorage.getItem("access_token"));
  const { data: user, isLoading } = useAuthUser();

  if (hasToken && isLoading) {
    return null;
  }

  if (user) {
    return <Navigate to={ROLE_DEFAULT_REDIRECT[user.role]} replace />;
  }

  return <Outlet />;
};
```

### Step 4: Create Zod Schema & Login Form (`src/features/auth/schemas/login-schema.ts` & `src/features/auth/components/LoginForm.tsx`)

1. Create `src/features/auth/schemas/login-schema.ts`:
   ```typescript
   import { z } from "zod";

   export const loginSchema = z.object({
     username: z.string().min(1, "Email or username is required"),
     password: z.string().min(6, "Password must be at least 6 characters"),
   });

   export type LoginFormValues = z.infer<typeof loginSchema>;
   ```

2. Create `src/features/auth/components/LoginForm.tsx`:
   ```tsx
   import { useForm } from "react-hook-form";
   import { zodResolver } from "@hookform/resolvers/zod";
   import { useNavigate } from "react-router-dom";
   import { toast } from "sonner";
   import { Button } from "@/components/ui/button";
   import { Input } from "@/components/ui/input";
   import { Label } from "@/components/ui/label";
   import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
   import { useLogin, getCurrentUser } from "../api/auth-api";
   import { ROLE_DEFAULT_REDIRECT } from "../types";
   import { loginSchema, LoginFormValues } from "../schemas/login-schema";

   export const LoginForm = () => {
     const navigate = useNavigate();
     const loginMutation = useLogin();

     const {
       register,
       handleSubmit,
       formState: { errors, isSubmitting },
     } = useForm<LoginFormValues>({
       resolver: zodResolver(loginSchema),
       defaultValues: { username: "", password: "" },
     });

     const onSubmit = async (values: LoginFormValues) => {
       try {
         await loginMutation.mutateAsync(values);
         const user = await getCurrentUser();
         toast.success(`Welcome back, ${user.full_name}!`);
         navigate(ROLE_DEFAULT_REDIRECT[user.role], { replace: true });
       } catch {
         toast.error("Invalid credentials or inactive account.");
       }
     };

     return (
       <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
         <Card className="w-full max-w-md">
           <CardHeader>
             <CardTitle className="text-2xl">Academic Risk & XAI Portal</CardTitle>
             <CardDescription>Sign in with your institutional account</CardDescription>
           </CardHeader>
           <CardContent>
             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="username">Email / Username</Label>
                 <Input id="username" placeholder="user@university.edu" {...register("username")} />
                 {errors.username && (
                   <p className="text-sm text-destructive">{errors.username.message}</p>
                 )}
               </div>
               <div className="space-y-2">
                 <Label htmlFor="password">Password</Label>
                 <Input id="password" type="password" {...register("password")} />
                 {errors.password && (
                   <p className="text-sm text-destructive">{errors.password.message}</p>
                 )}
               </div>
               <Button type="submit" className="w-full" disabled={isSubmitting || loginMutation.isPending}>
                 {loginMutation.isPending ? "Signing in..." : "Sign In"}
               </Button>
             </form>
           </CardContent>
         </Card>
       </div>
     );
   };
   ```

3. Export public API in `src/features/auth/index.ts` (Unidirectional flow):
   ```typescript
   export * from "./types";
   export * from "./api/auth-api";
   export * from "./components/LoginForm";
   ```

### Step 5: Configure Central Router with 3-Role Hierarchy (`src/app/router.tsx`)

Configure `createBrowserRouter` isolating `/admin/*`, `/lecturer/*`, and `/student/*` routes, plus `/403` Access Denied handling:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, GuestRoute } from "@/components/layout/ProtectedRoute";
import { LoginForm, useAuthUser, ROLE_DEFAULT_REDIRECT } from "@/features/auth";

const RootRedirect = () => {
  const { data: user, isLoading } = useAuthUser();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_DEFAULT_REDIRECT[user.role]} replace />;
};

export const appRouter = createBrowserRouter([
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
        path: "dashboard",
        element: <div className="p-6">Admin System Overview & User Management</div>,
      },
    ],
  },
  // Lecturer Role Routes
  {
    path: "/lecturer",
    element: <ProtectedRoute allowedRoles={["lecturer", "admin"]} />,
    children: [
      {
        path: "classes",
        element: <div className="p-6">Lecturer Class Roster & Student Risk XAI</div>,
      },
    ],
  },
  // Student Role Routes
  {
    path: "/student",
    element: <ProtectedRoute allowedRoles={["student"]} />,
    children: [
      {
        path: "overview",
        element: <div className="p-6">Student Academic Risk & What-If Simulator</div>,
      },
    ],
  },
  {
    path: "/403",
    element: (
      <div className="flex h-screen flex-col items-center justify-center space-y-2">
        <h1 className="text-3xl font-bold">403 - Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this resource.</p>
      </div>
    ),
  },
]);
```

## Post-Execution Verification (Mandatory)

1. Ensure `src/app/App.tsx` renders `<RouterProvider router={appRouter} />` inside `<AppProviders>`.
2. Run `npx tsc --noEmit` to confirm zero TypeScript errors across all role guards and auth hooks.
3. Run `npm run build` to verify clean bundling.