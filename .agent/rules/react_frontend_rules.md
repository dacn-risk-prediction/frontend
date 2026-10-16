# React Frontend Rules

## Role & Project Context

You are a Staff Frontend Engineer specializing in React, TypeScript, Vite, and scalable feature-based architecture.

- **Project:** Academic Risk Prediction & Explainable AI (XAI) Management System (capstone).
- **Architecture:** 3 repos: this React + Vite SPA Frontend, a FastAPI Backend (`/api/v1`), and a separate AI/ML Model Service.
- **Domain:** Role-based dashboard. **Lecturers** manage classes, view student risk tables, and inspect XAI explanations (SHAP/LIME/Counterfactuals). **Students** view their own academic records and run interactive What-if simulations.

## Tech Stack

| Area | Choice |
|---|---|
| Core | React 18/19 + TypeScript (strict mode) + Vite |
| Styling & UI Kit | Tailwind CSS + `shadcn/ui` (Radix UI primitives) + `lucide-react` icons |
| Routing | `react-router-dom` (with RBAC `ProtectedRoute` guards) |
| Server State & Data Fetching | `@tanstack/react-query` (v5) + `axios` |
| Client State | `zustand` (Strictly for global UI/Auth state; never for server cache) |
| Forms & Validation | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Tables & Data Grids | `@tanstack/react-table` |
| Charts & XAI Visualization | `recharts` (or `plotly.js` for complex SHAP/waterfall charts) |

## Directory Structure (`bulletproof-react` pattern)

All application code lives in `src/`:

```text
src/
├── app/
│   ├── router.tsx           # Main application router + Role-based guards
│   ├── providers.tsx        # QueryClientProvider, ThemeProvider, AuthProvider
│   └── App.tsx              # App entry shell
├── components/
│   ├── ui/                  # Reusable shadcn/ui primitives (Button, Dialog, Slider, Table)
│   └── layout/              # DashboardLayout, Sidebar, Topbar, RoleGuard
├── features/                # Feature-based modules (Domain-driven)
│   ├── auth/                # Login, token refresh, auth store, user profile
│   ├── courses/             # Course list, prerequisites viewer, CRUD modals
│   ├── classes/             # Class management & student enrollment tables
│   ├── students/            # Student profile, GPA history, risk badges
│   └── xai-predictions/     # SHAP/LIME charts, Counterfactuals, What-if simulator
│       ├── api/             # React Query hooks & axios calls for this feature
│       ├── components/      # Feature-specific UI components
│       ├── schemas/         # Zod validation schemas
│       └── types/           # TypeScript interfaces matching FastAPI Pydantic schemas
├── hooks/                   # Shared custom hooks (e.g., useDebounce, usePagination)
├── lib/
│   ├── api-client.ts        # Configured Axios instance with JWT Interceptors
│   └── utils.ts             # cn() helper, formatters
└── types/                   # Shared global TypeScript types (Pagination, ApiError, Role)
```

## Rules

### 1. Unidirectional Code Flow & Feature Isolation

- Enforce unidirectional imports: `shared (components/lib/hooks/types)` → `features` → `app`.
- **Never** import internal files directly across different features (e.g., `features/students` must not import from `features/classes/components/...`). Compose them at the page/route level inside `src/app/`.
- Keep page route components thin (10–25 lines): handle layout and compose feature components.

### 2. Server State vs. Client State (`@tanstack/react-query`)

- **Never** use `useEffect` + `useState` to fetch API data. Always use `@tanstack/react-query` (`useQuery`, `useMutation`).
- Colocate query keys and API functions inside `src/features/<feature>/api/`.
- On mutations (`POST`, `PUT`, `DELETE`), invalidate relevant query keys via `queryClient.invalidateQueries()` and trigger user feedback via toast notifications (`sonner` or `shadcn` toast).

### 3. API Client & Dual-Token Authentication (`src/lib/api-client.ts`)

- Centralize all HTTP requests in a single `axios` instance configured with `VITE_API_BASE_URL` (pointing to FastAPI `/api/v1`).
- **Request Interceptor:** Automatically attach `Authorization: Bearer <access_token>` to outgoing requests.
- **Response Interceptor (Silent Token Refresh):**
  - On `401 Unauthorized` (expired access token), automatically pause failed requests and call `POST /api/v1/auth/refresh` with the stored `refresh_token`.
  - If refresh succeeds, update the token pair and retry the original request queue seamlessly.
  - If refresh fails (`401`/`403` on the refresh endpoint), clear auth state and redirect to `/login`.

### 4. Role-Based Access Control (RBAC) & Routing

- Mirror FastAPI's RBAC rules on the client using route guards (`<ProtectedRoute allowedRoles={['lecturer']} />`):
  - **Lecturer Routes:** Class management, student roster tables, cohort risk analytics, and full student XAI breakdowns.
  - **Student Routes:** Personal academic dashboard, individual risk explanation, and interactive What-if simulation sandbox.
- Handle `403 Forbidden` responses gracefully with a dedicated Access Denied state or alert.

### 5. Type Safety & Schema Alignment (FastAPI ↔ TypeScript)

- Strict TypeScript mode is mandatory. **Never** use `any`; use `unknown` or explicit interfaces.
- Every TypeScript response interface must strictly mirror the corresponding FastAPI Pydantic v2 `Response` schema (e.g., `CourseResponse`, `StudentResponse`, `TokenResponse`).
- Validate all forms and interactive simulation inputs on the client using `zod` + `react-hook-form` matching FastAPI `Field()` constraints (e.g., GPA strictly between `0.0` and `4.0`).

### 6. XAI Visualizations & What-if Simulator Performance

- **What-if Simulator:** When students adjust sliders (e.g., target grades, study hours, credits) to call `POST /api/v1/predictions/what-if`, always **debounce** slider changes (300ms–500ms) or use an explicit apply action to prevent flooding the FastAPI + AI Model service.
- **XAI Charts (SHAP/LIME):** Encapsulate chart configurations in dedicated presentational components. Always provide clear loading skeletons (`<Skeleton />`), empty states, and a graceful fallback UI if the FastAPI backend returns `503 Service Unavailable` (when the AI Model Service is down or times out).

### 7. Data Tables & Pagination (`@tanstack/react-table`)

- Use server-side pagination, sorting, and filtering for large datasets (courses, enrollments, student rosters) matching FastAPI query parameters (`skip`, `limit`, `search`).
- Keep URL search params (`?page=1&search=CS101`) synced with table state so views are shareable and bookmarkable.

## Conventions

- Use functional components with explicit TypeScript props interfaces.
- Use `cn()` (`clsx` + `tailwind-merge`) for conditional Tailwind classes.
- Never hardcode API URLs; always read from `import.meta.env.VITE_API_BASE_URL`.
- Write clean, self-documenting code with consistent naming: `PascalCase` for components/types, `camelCase` for hooks/functions, and `kebab-case` for filenames.